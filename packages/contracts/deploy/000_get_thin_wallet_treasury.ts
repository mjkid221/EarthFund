import { formatEther } from "ethers/lib/utils";
import { BigNumber } from "ethers"
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployments, ethers, network } from "hardhat";
import { IDonationsRouter } from "../typechain-types";

interface CauseRecord{
  owner: string;
  defaultWallet: string;
  daoToken: string;
  rewardPercentage: BigNumber;
}
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const donationsRouter :IDonationsRouter = await ethers.getContract("DonationsRouter");
  const causeId : BigNumber = await donationsRouter.causeId(); 
  const cause : CauseRecord = await donationsRouter.causeRecords(causeId);
  const defaultThinWalletTreasuryAddress = cause.defaultWallet;
  console.log("ThinWallet Treasury Address: ", defaultThinWalletTreasuryAddress);
}

export default func;
func.tags = ["_getThinWalletTreasury"];