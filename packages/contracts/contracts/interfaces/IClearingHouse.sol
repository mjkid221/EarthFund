// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

interface IClearingHouse {
  /*///////////////////////////////////
                EVENTS
    ///////////////////////////////////*/

  event ChildDaoRegistered(address _childDaoToken);

  /*///////////////////////////////////
                FUNCTIONS
    ///////////////////////////////////*/

  /**
   * @notice Adds a child dao token to the register of swappable tokens
   * @param _childDaoToken The address of the child dao's ERC20 token contract
   */
  function registerChildDao(address _childDaoToken) external;

  /**
   * @notice Swaps a user's 1Earth tokens for a specific child dao's tokens
   * @param _childDaoToken The address of the child dao's ERC20 token contract
   * @param _account The address of the user whose tokens are being swapped
   * @param _amount The amount of 1Earth tokens being swapped
   */
  function swapForChildDaoTokens(
    address _childDaoToken,
    address _account,
    uint256 _amount
  ) external;

  /**
   * @notice Swaps a user's tokens for a specific child dao for 1Earth tokens
   * @param _childDaoToken The address of the child dao's ERC20 token contract
   * @param _account The address of the user whose tokens are being swapped
   * @param _amount The amount of child dao tokens being swapped
   */
  function swapForEarthTokens(
    address _childDaoToken,
    address _account,
    uint256 _amount
  ) external;
}
