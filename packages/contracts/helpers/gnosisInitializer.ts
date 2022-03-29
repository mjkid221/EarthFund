import { BigNumberish, BytesLike } from "ethers";
import { ethers } from "hardhat";
import { IGnosisSafe } from "../typechain-types";

export const createGnosisSetupTx = async (
  owners: string[],
  threshold: BigNumberish,
  to: string,
  data: BytesLike,
  fallbackHandler: string,
  paymentToken: string,
  payment: BigNumberish,
  paymentReceiver: string
) => {
  const safe: IGnosisSafe = await ethers.getContractAt(
    "IGnosisSafe",
    ethers.constants.AddressZero
  );
  return (
    await safe.populateTransaction.setup(
      owners,
      threshold,
      to,
      data,
      fallbackHandler,
      paymentToken,
      payment,
      paymentReceiver
    )
  ).data;
};
