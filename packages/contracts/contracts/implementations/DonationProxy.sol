// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "../interfaces/IDonationsProxy.sol";
import "../interfaces/IThinWallet.sol";

contract DonationProxy is IDonationsProxy {
  ERC20 public immutable baseToken;

  constructor(ERC20 _baseToken) {
    baseToken = _baseToken;
  }

  function deposit(
    uint256 amount,
    ERC20 token,
    IThinWallet target,
    bytes calldata swapCallData
  ) external payable override {
    (bool success, ) = address(baseToken).call{ value: msg.value }(
      swapCallData
    );
    require(success, "swap failed");
    emit SwapDeposit(msg.sender, amount, token, target);
  }

  receive() external payable {}
}
