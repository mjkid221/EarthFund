// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@prb/math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IStakingRewards.sol";

contract StakingRewards is IStakingRewards {
    address public immutable override rewardToken;
    uint256 public override lastRewardBalance;
    // Dao token => dao reward data
    mapping(address => RewardDistribution) public override daoRewards;
    // Dao token => user address => user stake data
    mapping(address => mapping(address => UserStake))
        public
        override userStakes;

    constructor(address _rewardToken) {
        require(_rewardToken != address(0), "invalid reward token");
        rewardToken = _rewardToken;
    }

    function stake(address _daoToken, uint256 _amount) external override {
        require(_daoToken != address(0), "invalid token");
        require(_amount > 0, "invalid amount");

        RewardDistribution memory dao = daoRewards[_daoToken];
        UserStake memory user = userStakes[_daoToken][msg.sender];

        if (!dao.isSecondStaker) {
            dao.isSecondStaker = true;
        } else {
            user.rewardsClaimed += dao.rewardPerToken * _amount;
        }

        user.stakedAmount += _amount;
        dao.totalStake += _amount;

        userStakes[_daoToken][msg.sender] = user;
        daoRewards[_daoToken] = dao;

        emit Stake(msg.sender, _daoToken, _amount);

        // Transfer tokens
        ERC20 token = ERC20(_daoToken);
        uint256 balanceBefore = token.balanceOf(address(this));
        token.transferFrom(msg.sender, address(this), _amount);
        require(
            token.balanceOf(address(this)) - balanceBefore == _amount,
            "reflective token"
        );
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

        // Claim outstanding rewards

        // Update stakes
    }

    function claimRewards(address _daoToken, address _to) external override {}

    function emergencyEject(address _daoToken, address _to) external override {}

    function distributeRewards(address _daoToken, uint256 _amount)
        external
        override
    {}
}
