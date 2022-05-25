// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@prb/math/contracts/PRBMathUD60x18.sol";
import "../interfaces/IDonationsRouter.sol";
import "../interfaces/IStakingRewards.sol";

contract DonationsRouter is IDonationsRouter, Ownable {
    using PRBMathUD60x18 for uint256;

    ERC20 public immutable override baseToken;
    IStakingRewards public immutable override stakingContract;
    address public override registrar;
    uint256 public override platformFee;

    // DAO Safe => DAO registration data
    mapping(address => DaoRegistration) public override daoRegistry;

    modifier onlyRegistrar() {
        require(msg.sender == registrar, "not a registrar");
        _;
    }

    constructor(
        address _owner,
        address _registrar,
        uint256 _platformFee,
        address _baseToken,
        address _stakingContract
    ) {
        require(_owner != address(0), "invalid owner");
        require(_registrar != address(0), "invalid registrar");
        require(_baseToken != address(0), "invalid base token");
        require(_stakingContract != address(0), "invalid staking");

        registrar = _registrar;
        platformFee = _platformFee;
        baseToken = ERC20(_baseToken);
        stakingContract = IStakingRewards(_stakingContract);

        if (msg.sender != _owner) {
            _transferOwnership(_owner);
        }
    }

    function donate(address _daoSafe, uint256 _amount) external override {
        DaoRegistration memory dao = daoRegistry[_daoSafe];
        uint256 rewardAmount = _amount.mul(dao.rewardRate);
        uint256 feeAmount = _amount.mul(platformFee);
        uint256 netAmount = _amount - (rewardAmount + feeAmount);

        emit Donate(msg.sender, _daoSafe, netAmount, feeAmount, rewardAmount);

        baseToken.transferFrom(msg.sender, _daoSafe, netAmount);
        baseToken.transferFrom(msg.sender, owner(), feeAmount);
        baseToken.transferFrom(
            msg.sender,
            address(stakingContract),
            rewardAmount
        );
        stakingContract.distributeRewards(dao.daoToken, rewardAmount);
    }

    function registerDao(
        address _daoSafe,
        address _daoToken,
        uint256 _rewardFee
    ) external override onlyRegistrar {
        require(_daoSafe != address(0), "invalid safe");
        require(_daoToken != address(0), "invalid token");
        daoRegistry[_daoSafe] = DaoRegistration({
            daoToken: _daoToken,
            rewardRate: _rewardFee
        });
        emit RegisterDao(_daoSafe, _daoToken, _rewardFee);
    }

    function setFee(FeeType _feeType, uint256 _fee) external override {
        if (_feeType == FeeType.PLATFORM) {
            require(msg.sender == owner(), "not the owner");
            platformFee = _fee;
        } else {
            // Enums are validated at runtime, so this will always be the reward type
            daoRegistry[msg.sender].rewardRate = _fee;
        }

        emit SetFee(_feeType, _fee);
    }

    function setRegistrar(address _newRegistrar) external override onlyOwner {
        require(_newRegistrar != address(0), "invalid registrar");
        registrar = _newRegistrar;
    }
}
