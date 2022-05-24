// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

interface IDonateRouter {
    /// ### Enums
    enum FeeType {
        REWARD,
        PLATFORM
    }

    /// ### Events
    event SetFee(FeeType feeType, uint256 newFee);
    event RegisterDao(address daoSafe, address daoToken);
    event Donate(address user, address daoSafe, uint256 amount);

    /// ### Functions
    /// @notice Allows the user to donate _amount of the base token directly
    /// @param _daoSafe The dao to donate to
    /// @param _amount The amount of base toke to donate
    function donate(address _daoSafe, uint256 _amount) external;

    /// @notice Registers a dao for donations
    /// @dev Should be restricted to the platform operator
    /// @param _daoSafe The gnosis safe address for the dao
    /// @param _daoToken The governance token for the dao. This cannot be duplicated or the rewards will be blended in the staking contract
    /// @param _rewardFee The reward percentage to cut from donations
    function registerDao(
        address _daoSafe,
        address _daoToken,
        uint256 _rewardFee
    ) external;

    /// @notice Sets the fee split for donations
    /// @param _feeType The type of fee to set. Platform fee can only be set by the platform owner. Reward fee can only be changed by the Dao that's calling the function.
    /// @param _fee The new fee percentage schedule
    function setFee(FeeType _feeType, uint256 _fee) external;

    /// @notice Sets the destination for platform fees
    /// @param _newOwner The new platform fee destination. Also the only one who can set the platform fee
    function setPlatformOwner(address _newOwner) external;

    /// ### Autogenerated getter functions
    /**
    address baseToken
    address stakingContract
    mapping (address=>address) daoRegistry
    mapping (address =>uint256) rewardPercentage
    address platformOwner
    uint256 platformFee
     */
    function baseToken() external view returns (address baseToken);

    function stakingContract() external view returns (address stakingContract);

    function daoRegistry(address _daoSafe)
        external
        view
        returns (address daoToken);

    function platformOwner() external returns (address platformOwner);

    function platformFee() external view returns (uint256 platformFee);

    function rewardPercentage(address _daoSafe)
        external
        view
        returns (uint256 rewardFee);
}
