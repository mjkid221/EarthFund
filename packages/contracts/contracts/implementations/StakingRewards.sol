// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@prb/math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IStakingRewards.sol";

// import "hardhat/console.sol";

contract StakingRewards is IStakingRewards {
    using PRBMathUD60x18 for uint256;

    ERC20 public immutable override rewardToken;

    // Dao token => dao reward data
    mapping(address => RewardDistribution) public override daoRewards;
    // Dao token => user address => user stake data
    mapping(address => mapping(address => UserStake))
        public
        override userStakes;

    constructor(address _rewardToken) {
        require(_rewardToken != address(0), "invalid reward token");
        rewardToken = ERC20(_rewardToken);
    }

    function stake(address _daoToken, uint256 _amount) external override {
        require(_daoToken != address(0), "invalid token");
        require(_amount > 0, "invalid amount");

        RewardDistribution memory dao = daoRewards[_daoToken];
        UserStake memory user = userStakes[_daoToken][msg.sender];

        if (dao.totalStake == 0) {
            // Distribute reward amount equally across the first staker's tokens
            if (dao.rewardPerToken > 0) {
                user.pendingRewards = dao.rewardPerToken;
                dao.rewardPerToken = _calculateRewardPerToken(
                    0,
                    dao.rewardPerToken,
                    _amount
                );
            }
        } else {
            user.pendingRewards += _getRewardAmount(
                user.stakedAmount,
                dao.rewardPerToken,
                user.rewardEntry
            );
        }

        user.rewardEntry = dao.rewardPerToken;
        user.stakedAmount += _amount;
        dao.totalStake += _amount;

        daoRewards[_daoToken] = dao;
        userStakes[_daoToken][msg.sender] = user;

        emit Stake(msg.sender, _daoToken, _amount);

        ERC20(_daoToken).transferFrom(msg.sender, address(this), _amount);
    }

    function unstake(
        address _daoToken,
        uint256 _amount,
        address _to
    ) external override {
        require(_daoToken != address(0), "invalid token");
        require(_amount > 0, "invalid amount");
        require(_to != address(0), "invalid destination");

        RewardDistribution memory dao = daoRewards[_daoToken];
        UserStake memory user = userStakes[_daoToken][msg.sender];

        require(_amount <= user.stakedAmount, "invalid unstake amount");

        // Save their currently earned reward entitlement
        user.pendingRewards += _getRewardAmount(
            user.stakedAmount,
            dao.rewardPerToken,
            user.rewardEntry
        );

        user.stakedAmount -= _amount;
        user.rewardEntry = dao.rewardPerToken;
        dao.totalStake -= _amount;

        if (dao.totalStake == 0) {
            // Last man out the door resets the staking contract for that DAO.
            dao.rewardPerToken = 0;
        }

        daoRewards[_daoToken] = dao;
        userStakes[_daoToken][msg.sender] = user;

        emit Unstake(msg.sender, _daoToken, _amount);

        ERC20(_daoToken).transfer(_to, _amount);
    }

    function claimRewards(address _daoToken, address _to) external override {
        require(_daoToken != address(0), "invalid dao token");
        require(_to != address(0), "invalid destination");

        RewardDistribution memory dao = daoRewards[_daoToken];
        UserStake memory user = userStakes[_daoToken][msg.sender];

        uint256 entitlement = _getRewardAmount(
            user.stakedAmount,
            dao.rewardPerToken,
            user.rewardEntry
        ) + user.pendingRewards;

        user.pendingRewards = 0;
        user.rewardEntry = dao.rewardPerToken;

        userStakes[_daoToken][msg.sender] = user;

        emit ClaimRewards(msg.sender, _daoToken, entitlement);

        rewardToken.transfer(_to, entitlement);
    }

    function emergencyEject(address _daoToken, address _to) external override {
        require(_daoToken != address(0), "invalid dao token");
        require(_to != address(0), "invalid destination");

        RewardDistribution memory dao = daoRewards[_daoToken];
        UserStake memory user = userStakes[_daoToken][msg.sender];

        uint256 entitlement = _getRewardAmount(
            user.stakedAmount,
            dao.rewardPerToken,
            user.rewardEntry
        ) + user.pendingRewards;

        uint256 ejectAmount = user.stakedAmount;
        user.stakedAmount = 0;
        user.rewardEntry = 0;
        user.pendingRewards = 0;
        dao.totalStake -= ejectAmount;

        if (dao.totalStake > 0) {
            // Distribute user's lost rewards to everyone else.
            dao.rewardPerToken = _calculateRewardPerToken(
                dao.rewardPerToken,
                entitlement,
                dao.totalStake
            );
        } else {
            // Last man out the door resets the dao
            dao.rewardPerToken = 0;
        }

        daoRewards[_daoToken] = dao;
        userStakes[_daoToken][msg.sender] = user;

        emit Eject(msg.sender, _daoToken, ejectAmount);

        ERC20(_daoToken).transfer(_to, ejectAmount);
    }

    function distributeRewards(address _daoToken, uint256 _amount)
        external
        override
    {
        require(_daoToken != address(0), "invalid dao");
        require(_amount > 0, "invalid amount");

        RewardDistribution memory dao = daoRewards[_daoToken];

        if (dao.totalStake == 0) {
            dao.rewardPerToken += _amount;
        } else {
            dao.rewardPerToken = _calculateRewardPerToken(
                dao.rewardPerToken,
                _amount,
                dao.totalStake
            );
        }

        daoRewards[_daoToken] = dao;

        // Emit event
        emit Distribution(_daoToken, _amount);

        rewardToken.transferFrom(msg.sender, address(this), _amount);
    }

    function pendingRewards(address _user, address _daoToken)
        external
        view
        override
        returns (uint256 rewardAmount)
    {
        RewardDistribution memory dao = daoRewards[_daoToken];
        UserStake memory user = userStakes[_daoToken][_user];

        rewardAmount =
            _getRewardAmount(
                user.stakedAmount,
                dao.rewardPerToken,
                user.rewardEntry
            ) +
            user.pendingRewards;
    }

    /// ### Internal functions

    /// @notice Calculates the actual amount of reward token that a user is entitled to
    /// @param _userStake  The number of tokens a user has currently staked
    /// @param _rewardPerToken  The current reward per token A 60.18 fixed point number
    /// @param _userRewardEntry  The reward per token the last time the user modified their stake. A 60.18 fixed point number
    function _getRewardAmount(
        uint256 _userStake,
        uint256 _rewardPerToken,
        uint256 _userRewardEntry
    ) internal pure returns (uint256 rewardAmount) {
        if (_userStake == 0 || _rewardPerToken == _userRewardEntry) return 0;
        rewardAmount = PRBMathUD60x18.toUint(
            (_userStake.mul(_rewardPerToken) -
                (_userStake.mul(_userRewardEntry)))
        );
    }

    /// @notice Calculates the reward per token
    /// @param _currentRewardPerToken The current reward token per staked token
    /// @param _distribution  The amount to distribute
    /// @param _totalStake  The total amount of tokens staked
    function _calculateRewardPerToken(
        uint256 _currentRewardPerToken,
        uint256 _distribution,
        uint256 _totalStake
    ) internal pure returns (uint256 rewardPerToken) {
        rewardPerToken =
            _currentRewardPerToken +
            (PRBMathUD60x18.fromUint(_distribution).div(_totalStake));
    }
}
