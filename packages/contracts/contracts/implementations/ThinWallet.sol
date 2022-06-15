// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/IThinWallet.sol";

error InvalidPermissions(address _user);

contract ThinWallet is IThinWallet, Initializable, AccessControl {
  // Access Control Role Definitions
  bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER");
  bytes32 public constant TRANSFER_ADMIN_ROLE = keccak256("TRANSFER_ADMIN");

  // Store admin address
  address public admin;

  /// ### Functions
  function initialize(address _admin, address[] calldata _owners) external {
    require(_admin != address(0), "admin address cannot be 0x0");
    admin = _admin;
    _setupRole(TRANSFER_ADMIN_ROLE, _admin);
    _setupRole(DEFAULT_ADMIN_ROLE, _admin);
    for (uint64 i = 0; i < _owners.length; i++) {
      require(_owners[i] != address(0), "owner cannot be 0x0");
      _setupRole(TRANSFER_ROLE, _owners[i]);
      _setupRole(TRANSFER_ADMIN_ROLE, _owners[i]);
    }
  }

  function transferERC20(
    TokenMovement[] calldata _transfers
  ) external {
    if (!(hasRole(TRANSFER_ROLE, msg.sender) || msg.sender == admin)){
      revert InvalidPermissions(msg.sender);
    }
    for (uint64 i = 0; i < _transfers.length; i++) {
      ERC20 token = ERC20(_transfers[i].token);
      token.transfer(_transfers[i].recipient, _transfers[i].amount);
      emit TransferERC20(_transfers[i]);
    }
  }

  function transferEther(EtherPaymentTransfer[] calldata _transfers) external {
    if (!(hasRole(TRANSFER_ROLE, msg.sender) || msg.sender == admin)){
      revert InvalidPermissions(msg.sender);
    }
    for (uint64 i = 0; i < _transfers.length; i++) {
      (bool success, ) = address(_transfers[i].recipient).call{
        value: _transfers[i].amount
      }("");
      require(success, "failed to send ether");
      emit TransferEther(_transfers[i]);
    }
  }

  receive() external payable {}
}
