import { ethers } from "ethers";
import { toUtf8Bytes } from "ethers/lib/utils";

import createGnosisSetupTx from "./createGnosisSetupTx";
import ContractAddresses from "../constants/contractAddresses";

const createChildDaoConfig = async (
  owners: string[],
  tokenName = "Test",
  tokenSymbol = "TEST",
  subdomain = "subtest",
  snapshotKey = "A",
  snapshotValue = "B",
  chainId = "31337"
) => ({
  _tokenData: {
    tokenName: toUtf8Bytes(tokenName),
    tokenSymbol: toUtf8Bytes(tokenSymbol),
  },
  _safeData: {
    initializer:
      (await createGnosisSetupTx(
        owners,
        1,
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
