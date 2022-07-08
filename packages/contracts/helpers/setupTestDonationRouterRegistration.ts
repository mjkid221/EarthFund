import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, ethers } from "ethers";
import {
  ERC20,
  IDonationsRouter,
} from "../typechain-types";

interface CauseRegistrationRequest {
  owner: string;
  rewardPercentage: BigNumber;
  daoToken: string;
}

interface CauseRecord {
  owner: string;
  defaultWallet: string;
  daoToken: string;
  rewardPercentage: BigNumber;
}

interface WithdrawalRequest {
  token: string;
  recipient: string;
  amount: BigNumber;
}

interface ThinWalletId {
  causeId: BigNumber;
  thinWalletId : string;
}

export const setUpRegistration = async (
  router : IDonationsRouter,
  registrationRequest : CauseRegistrationRequest,
  deployer : SignerWithAddress,
  token : ERC20
) => {
  await router.connect(deployer).registerCause(registrationRequest);
  const causeID : BigNumber = await router.causeId();
  const walletId : ThinWalletId = {
    causeId : causeID,
    thinWalletId : ethers.utils.hexZeroPad(causeID.toHexString(), 32)
  }
  const cause : CauseRecord = await router.causeRecords(causeID);
  const thinWalletClone : string = cause.defaultWallet;

  const rewardTokenToSend = (await token.balanceOf(deployer.address)).div(2);
  await token.connect(deployer).transfer(router.address, rewardTokenToSend);
  await token.connect(deployer).transfer(thinWalletClone, rewardTokenToSend);

  return [walletId, cause, thinWalletClone];
}