// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

import "./ERC20Singleton.sol";
import "../interfaces/IClearingHouse.sol";
import "../interfaces/IGovernor.sol";

contract ClearingHouse is IClearingHouse, Ownable {
  /*///////////////////////////////////////////////////////////////
                            IMMUTABLES
    //////////////////////////////////////////////////////////////*/

  mapping(ERC20Singleton => bool) public childDaoRegistry;

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

  modifier childDaoRegistered(address _childDaoToken) {
    require(
      childDaoRegistry[ERC20Singleton(_childDaoToken)],
      "invalid child dao address"
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
      childDaoRegistry[ERC20Singleton(_childDaoToken)] == false,
      "already registered this child dao token"
    );

    childDaoRegistry[ERC20Singleton(_childDaoToken)] = true;

    emit ChildDaoRegistered(_childDaoToken);
  }

  /*///////////////////////////////////////////////////////////////
                            SWAP LOGIC
    //////////////////////////////////////////////////////////////*/

  function swapEarthForChildDao(address _childDaoToken, uint256 _amount)
    external
    childDaoRegistered(_childDaoToken)
  {
    require(
      earthToken.balanceOf(msg.sender) >= _amount,
      "not enough 1Earth tokens"
    );

    // transfer 1Earth from msg sender to this contract
    uint256 earthBalanceBefore = earthToken.balanceOf(msg.sender);

    earthToken.transferFrom(msg.sender, address(this), _amount);

    require(
      earthBalanceBefore - _amount == earthToken.balanceOf(msg.sender),
      "1Earth token transfer failed"
    );

    // mint child dao tokens to the msg sender
    ERC20Singleton childDaoToken = ERC20Singleton(_childDaoToken);

    uint256 childDaoTotalSupplyBefore = childDaoToken.totalSupply();

    childDaoToken.mint(msg.sender, _amount);

    require(
      childDaoTotalSupplyBefore + _amount == childDaoToken.totalSupply(),
      "child dao token mint error"
    );
  }

  function swapChildDaoForEarth(address _childDaoToken, uint256 _amount)
    external
  {}

  function swapChildDaoForChildDao(
    address _fromChildDaoToken,
    address _toChildDaoToken,
    uint256 _amount
  ) external {}
}
