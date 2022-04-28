// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

import "../interfaces/IClearingHouse.sol";
import "../interfaces/IERC20Singleton.sol";

contract ClearingHouse is IClearingHouse {
  /*///////////////////////////////////////////////////////////////
                            IMMUTABLES
    //////////////////////////////////////////////////////////////*/

  mapping(IERC20Singleton => bool) public childDaoRegistry;

  IERC20 public immutable earthToken;

  constructor(address _earthToken) {
    earthToken = IERC20(_earthToken);
  }

  /*///////////////////////////////////////////////////////////////
                            REGISTER LOGIC
    //////////////////////////////////////////////////////////////*/

  function registerChildDao(address _childDaoToken) public returns (bool) {}

  /*///////////////////////////////////////////////////////////////
                            SWAP LOGIC
    //////////////////////////////////////////////////////////////*/

  function swapEarthForChildDao(address _childDaoToken, uint256 _amount)
    public
  {}

  function swapChildDaoForEarth(address _childDaoToken, uint256 _amount)
    public
  {}

  function swapChildDaoForChildDao(
    address _fromChildDaoToken,
    address _toChildDaoToken,
    uint256 _amount
  ) public {}
}
