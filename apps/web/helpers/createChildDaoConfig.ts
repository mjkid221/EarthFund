import ContractAddresses from "contracts/constants/contractAddresses";
import { ethers } from "ethers";
import { toUtf8Bytes } from "ethers/lib/utils";

import createGnosisSetupTx from "./createGnosisSetupTx";

// TODO: move this into it's own helper file
const createChildDaoConfig = async (
  owners: string[],
  threshold: number,
  tokenName: string,
  tokenSymbol: string,
  subdomain: string,
  snapshotKey = "A",
  snapshotValue = "B"
) => ({
  _tokenData: {
    tokenName: toUtf8Bytes(tokenName),
    tokenSymbol: toUtf8Bytes(tokenSymbol),
  },
  _safeData: {
    initializer:
      (await createGnosisSetupTx(
        owners,
        threshold,
        ethers.constants.AddressZero,
        [],
        ContractAddresses["31337"].GnosisFallbackHandler,
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
