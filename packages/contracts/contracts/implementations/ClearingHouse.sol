// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

import "../interfaces/IClearingHouse.sol";
import "../interfaces/IERC20Singleton.sol";
import "../interfaces/IGovernor.sol";

contract ClearingHouse is IClearingHouse, Ownable {
  /*///////////////////////////////////////////////////////////////
                            IMMUTABLES
    //////////////////////////////////////////////////////////////*/

  mapping(IERC20Singleton => bool) public override childDaoRegistry;

  IERC20 public immutable earthToken;

  IGovernor public governor; // this one is not actually immutable

  constructor(address _earthToken) {
    earthToken = IERC20(_earthToken);
  }

  /*///////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/
  modifier isGovernor() {
    require(
      msg.sender == address(governor),
      "caller is not the governor contract"
    );
    _;
  }

  /*///////////////////////////////////////////////////////////////
                            REGISTER LOGIC
    //////////////////////////////////////////////////////////////*/

  function addGovernor(address _governor) external onlyOwner {
    governor = IGovernor(_governor);
  }

  function registerChildDao(address _childDaoToken) external isGovernor {
    require(
      childDaoRegistry[IERC20Singleton(_childDaoToken)] == false,
      "already registered this child dao token"
    );
    childDaoRegistry[IERC20Singleton(_childDaoToken)] = true;
  }

  /*///////////////////////////////////////////////////////////////
                            SWAP LOGIC
    //////////////////////////////////////////////////////////////*/

  function swapEarthForChildDao(address _childDaoToken, uint256 _amount)
    external
  {}

  function swapChildDaoForEarth(address _childDaoToken, uint256 _amount)
    external
  {}

  function swapChildDaoForChildDao(
    address _fromChildDaoToken,
    address _toChildDaoToken,
    uint256 _amount
  ) external {}
}
