// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

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

  constructor(IWETH _weth, ERC20 _baseToken) {
    if (address(_weth) == address(0) || address(_baseToken) == address(0))
      revert CannotBeZeroAddress();
    WETH = _weth;
    baseToken = _baseToken;
  }

  receive() external payable {}

  function depositETH(
    ERC20 buyToken,
    uint256 amount,
    address location,
    address spender,
    address payable swapTarget,
    bytes calldata swapCallData
  ) external payable {
    if (buyToken != baseToken) revert IncorrectBuyToken();
    uint256 boughtAmount = buyToken.balanceOf(address(this));
    WETH.deposit{ value: amount }();
    if (WETH.allowance(address(this), spender) == 0) {
      WETH.safeApprove(spender, type(uint256).max);
    } else if (WETH.allowance(address(this), spender) < amount) {
      WETH.safeApprove(spender, 0);
      WETH.safeApprove(spender, type(uint256).max);
    }
    (bool success, ) = swapTarget.call{ value: msg.value - amount }(
      swapCallData
    );
    if (!success) revert ZeroXSwapFailed();
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
    if (buyToken != baseToken) revert IncorrectBuyToken();
    sellToken.safeTransferFrom(msg.sender, address(this), amount);
    uint256 boughtAmount = buyToken.balanceOf(address(this));
    if (sellToken.allowance(address(this), spender) == 0) {
      sellToken.safeApprove(spender, type(uint256).max);
    } else if (sellToken.allowance(address(this), spender) < amount) {
      sellToken.safeApprove(spender, 0);
      sellToken.safeApprove(spender, type(uint256).max);
    }
    (bool success, ) = swapTarget.call{ value: msg.value }(swapCallData);
    if (!success) revert ZeroXSwapFailed();
    payable(msg.sender).transfer(address(this).balance);
    boughtAmount = buyToken.balanceOf(address(this)) - boughtAmount;
    emit SwapDeposit(msg.sender, amount, sellToken, location);
    buyToken.safeTransfer(location, boughtAmount);
  }
}
