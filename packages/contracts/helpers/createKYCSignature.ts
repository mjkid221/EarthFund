import { ethers } from "ethers";
/**
 * @notice a helper functino used for generating KYC signatures
 * @param signer the address that is signing the signatures
 * @param KYCId the unique ID of a KYCed individual
 * @param user the address that is being approved
 * @param causeId the ID representing the cause on the smart contract
 * @param expiry the unix time that this approval will expire
 */
const createKYCSignature = (
  signer: ethers.Signer,
  KYCId: string,
  user: string,
  causeId: number,
  expiry: number
): Promise<string> => {
  const messageHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["string", "address", "uint256", "uint256"],
      [KYCId, user, causeId, expiry]
    )
  );
  return signer.signMessage(ethers.utils.arrayify(messageHash));
};

export { createKYCSignature };
