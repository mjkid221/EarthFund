// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../implementations/ERC20Singleton.sol";
import "../implementations/Governor.sol";
import "../implementations/StakingRewards.sol";

interface IClearingHouse {
  /*///////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/
  event ChildDaoRegistered(address childDaoToken);

  event TokensSwapped(address from, address to, uint256 amount);

  event SetSwapFee(uint256 oldFee, uint256 newFee);

  /*///////////////////////////////////////////////////////////////
                            FUNCTIONS
    //////////////////////////////////////////////////////////////*/
  /**
   * @notice Updates the governor contract in state, an only owner function
   * @param _governor The address of the new governor contract
   */
  function addGovernor(Governor _governor) external;

  /**
   * @notice Adds a child dao token to the register of swappable tokens
   * @param _childDaoToken The address of the child dao's ERC20 token contract
   */
  function registerChildDao(ERC20Singleton _childDaoToken) external;

  /**
   * @notice Updates the auto stake state, an only owner function
   * @param _state Boolean of the new auto stake state
   */
  function setAutoStake(bool _state) external;

  /**
   * @notice Updates the staking contract in state, an only owner function
   * @param _staking The address of the new staking contract
   */
  function setStaking(StakingRewards _staking) external;

  /**
   * @notice Swaps a user's 1Earth tokens for a specific child dao's tokens
   * @param _childDaoToken The address of the child dao's ERC20 token contract
   * @param _amount The amount of 1Earth tokens being swapped
   */
  function swapEarthForChildDao(ERC20Singleton _childDaoToken, uint256 _amount)
    external;

  /**
   * @notice Swaps a user's tokens for a specific child dao for 1Earth tokens
   * @param _childDaoToken The address of the child dao's ERC20 token contract
   * @param _amount The amount of child dao tokens being swapped
   */
  function swapChildDaoForEarth(ERC20Singleton _childDaoToken, uint256 _amount)
    external;

  /**
   * @notice Swaps a user's tokens for a specific child dao for another specific child dao's tokens
   * @param _fromChildDaoToken The address of the child dao's ERC20 token contract whose tokens are being burnt
   * @param _toChildDaoToken The address of the child dao's ERC20 token contract whose tokens are being minted
   * @param _amount The amount of child dao tokens being swapped
   */
  function swapChildDaoForChildDao(
    ERC20Singleton _fromChildDaoToken,
    ERC20Singleton _toChildDaoToken,
    uint256 _amount
  ) external;

  /**
   * @notice Pauses the contract, an only owner function
   */
  function pause() external;

  /**
   * @notice Unpauses the contract, an only owner function
   */
  function unpause() external;

  /**
   * @notice Autogenerated getters
   */
  function childDaoRegistry(ERC20Singleton _childDaoToken)
    external
    view
    returns (bool);
}
