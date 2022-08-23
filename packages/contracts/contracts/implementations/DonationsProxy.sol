// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IDonationsProxy.sol";

interface IWETH is IERC20 {
  function deposit() external payable;
}

contract DonationsProxy is IDonationsProxy {
  using SafeERC20 for ERC20;
  using SafeERC20 for IWETH;

  // The Targeted ERC20 for Swaps
  ERC20 public baseToken;

  // The WETH contract.
  IWETH public immutable WETH;

  constructor(IWETH _weth, IERC20 _baseToken) {
    WETH = _weth;
    _baseToken = _baseToken;
  }

  receive() external payable {}

  function depositETH(
    ERC20 buyToken,
    uint256 amount,
    address location,
    address spender,
    address payable swapTarget,
    bytes calldata swapCallData
  ) external payable override {
    uint256 boughtAmount = buyToken.balanceOf(address(this));
    WETH.deposit{ value: amount }();
    if (WETH.allowance(address(this), spender) < amount) {
      WETH.safeApprove(spender, type(uint256).max);
    }
    (bool success, ) = swapTarget.call{ value: msg.value - amount }(
      swapCallData
    );
    require(success, "SWAP_CALL_FAILED");
    payable(msg.sender).transfer(address(this).balance);
    boughtAmount = buyToken.balanceOf(address(this)) - boughtAmount;
    emit SwapETH(msg.sender, amount, location);
    buyToken.safeTransfer(location, boughtAmount);
  }

  function depositERC20(
    ERC20 sellToken,
    ERC20 buyToken,
    uint256 amount,
    address location,
    address spender,
    address payable swapTarget,
    bytes calldata swapCallData
  ) external payable override {
    sellToken.safeTransferFrom(msg.sender, address(this), amount);
    uint256 boughtAmount = buyToken.balanceOf(address(this));
    if (sellToken.allowance(address(this), spender) < amount) {
      sellToken.safeApprove(spender, type(uint256).max);
    }
    (bool success, ) = swapTarget.call{ value: msg.value }(swapCallData);
    require(success, "SWAP_CALL_FAILED");
    payable(msg.sender).transfer(address(this).balance);
    boughtAmount = buyToken.balanceOf(address(this)) - boughtAmount;
    emit SwapDeposit(msg.sender, amount, sellToken, location);
    buyToken.safeTransfer(location, boughtAmount);
  }
}
