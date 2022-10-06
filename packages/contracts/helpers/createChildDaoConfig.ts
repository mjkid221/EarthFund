import { BigNumber, ethers } from "ethers";
import { parseEther, toUtf8Bytes } from "ethers/lib/utils";

import createGnosisSetupTx from "./createGnosisSetupTx";
import ContractAddresses from "../constants/contractAddresses";

const createChildDaoConfig = async (
  owners: string[],
  tokenName = "Test",
  tokenSymbol = "TEST",
  subdomain = "subtest",
  snapshotKey = "A",
  snapshotValue = "B",
  chainId = "31337",
  safeThreshold = 1,
  maxSupply = 10000,
  maxSwap = 1000,
  release = 0,
  autoStaking = false,
  kycRequired = false,
  rewardPercentage = 10 ** 16, // 1%
  mintingAmount = 1,
  KYCId = "testKYC",
  expiry = 0,
  signature = "testSignature"
) => ({
  _tokenData: {
    tokenName: toUtf8Bytes(tokenName),
    tokenSymbol: toUtf8Bytes(tokenSymbol),
    maxSupply: parseEther(String(maxSupply)),
    maxSwap: parseEther(String(maxSwap)),
    release,
    autoStaking,
    kycRequired,
    rewardPercentage: BigNumber.from(String(rewardPercentage)),
    mintingAmount: parseEther(String(mintingAmount)),
    KYCId: toUtf8Bytes(KYCId),
    expiry: BigNumber.from(String(expiry)),
    signature: toUtf8Bytes(signature),
  },
  _safeData: {
    initializer:
      (await createGnosisSetupTx(
        owners,
        safeThreshold,
        ethers.constants.AddressZero,
        [],
        ContractAddresses[chainId].GnosisFallbackHandler,
        ethers.constants.AddressZero,
        0,
        ethers.constants.AddressZero
      )) || [],
  },
  _subdomain: {
    subdomain: toUtf8Bytes(subdomain),
    snapshotKey: toUtf8Bytes(snapshotKey),
    snapshotValue: toUtf8Bytes(snapshotValue),
  },
});

export default createChildDaoConfig;
