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

  function registerChildDao(address _childDaoToken) external;

  function swapForChildDaoTokens(
    address _childDaoToken,
    address _account,
    uint256 amount
  ) external;

  function swapForEarthTokens(
    address _childDaoToken,
    address _account,
    uint256 amount
  ) external;
}
