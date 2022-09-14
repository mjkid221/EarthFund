pragma solidity 0.8.13;

/**
 * Helper library to recover admin signatures approving certain user's
 * as KYCed in the earthfund ecosystem.
 */

library SigRecovery {
  function recoverApproval(
    bytes memory _KYCId,
    address _user,
    uint256 _causeId,
    uint256 _expiry,
    bytes memory _signature
  ) internal pure returns (address recoveredAddress) {
    bytes32 messageHash = recreateApprovalHash(
      _KYCid,
      _user,
      _causeId,
      _expiry
    );

    (bytes32 r, bytes32 s, uint8 v) = _splitSignature(_signature);

    recoveredAddress = ecrecover(messageHash, v, r, s);
  }

  function recreateApprovalHash(
    bytes memory _KYCId,
    address _user,
    uint256 _causeId,
    uint256 _expiry,
    bytes memory signature
  ) internal pure returns (bytes32 messageHash) {
    messageHash = keccak256(
      abi.encodePacked(
        "\x19Ethereum Signed Message:\n32",
        keccak256(abi.encode(_KYCid, _user, _causeId, _expiry))
      )
    );
  }
}
