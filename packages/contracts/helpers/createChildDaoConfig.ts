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
  safeThreshold = 1
) => ({
  _tokenData: {
    tokenName: toUtf8Bytes(tokenName),
    tokenSymbol: toUtf8Bytes(tokenSymbol),
    maxSupply: parseEther("10000"),
    release: 0,
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
