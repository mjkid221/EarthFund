// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../interfaces/IDonationsProxy.sol";

contract DonationProxy is IDonationsProxy {
  function deposit(
    uint256 amount,
    ERC20 token,
    bytes calldata swapCallData
  ) external {}

  receive() external payable {}
}
