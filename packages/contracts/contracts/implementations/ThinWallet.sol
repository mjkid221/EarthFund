// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "../interfaces/IThinWallet.sol";

contract ThinWallet is IThinWallet, Initializable {
  /// ### Functions
  /// @notice Initializes the thin wallet clone with the accounts that can control it
  /// @param _admin  This is should be set as the default admin. This will be the donation router
  /// @param _owners  The accounts that can call the transfer functions
  function initialize(address _admin, address[] calldata _owners) external {}

  /// @notice Transfers amounts of an ERC20 to one or more recipients
  /// @dev If the `setApprove` field is true, the contract should approve that recipient for type(uint256).max
  /// @param _transfers  An array of transfers. Each transfer object specifies the amount and recipient to send tokens to
  /// @param _approvals  An array of approval objects. Each approval specifies the recipient and the amount to approve that recipient to spend.
  function transferERC20(
    TokenMovement[] calldata _transfers,
    TokenMovement[] calldata _approvals
  ) external {}

  /// @notice Transfers amounts of ether to one or more recipeints
  /// @dev This should use address(recipient).call to transfer the ether
  /// @param _transfers  The ether transfers
  function transferEther(EtherPaymentTransfer[] calldata _transfers) external {}
}
