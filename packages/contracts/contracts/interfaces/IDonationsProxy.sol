// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IThinWallet.sol";

interface IDonationsProxy {
  /**
    @notice emits when a user swaps a token to deposit into a thin wallet
    @param user the user who swapped the token
    @param amount the amount the user swapped of their token
    @param token the token that the user swapped
    @param target the thin wallet that the user was depositing into
  */
  event SwapDeposit(
    address user,
    uint256 amount,
    ERC20 token,
    IThinWallet target
  );

  /**
    @notice emits when a user swaps a token to deposit into a thin wallet
    @param user the user who swapped the token
    @param amount the amount the user swapped of their token
    @param target the thin wallet that the user was depositing into
  */
  event SwapETH(address user, uint256 amount, IThinWallet target);

  /**
    @notice this function is used for depositing tokens to be swapped and donated
    @param amount the amount of token that will be swapped and donated
    @param token the token that will be swapped
    @param target the thin wallet that will be donated to
    @param swapCallData the call data supplied by 0x that will be used to swap the token
  */
  function deposit(
    uint256 amount,
    ERC20 token,
    IThinWallet target,
    bytes calldata swapCallData
  ) external payable;

  /**
    @notice this function is used for depositing tokens to be swapped and donated
    @param amount the amount of token that will be swapped and donated
    @param target the thin wallet that will be donated to
    @param swapCallData the call data supplied by 0x that will be used to swap the token
  */
  function depositETH(
    uint256 amount,
    IThinWallet target,
    bytes calldata swapCallData
  ) external payable;
}
