// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IDonationsProxy {
  function deposit(
    uint256 amount,
    ERC20 token,
    bytes calldata swapCallData
  ) external;
}
