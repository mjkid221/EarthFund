import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { ClearingHouse, DonationsRouter } from "../typechain-types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const clearingHouse: ClearingHouse = await ethers.getContract(
    "ClearingHouse"
  );

  const donationsRouter: DonationsRouter = await ethers.getContract(
    "DonationsRouter"
  );

  await clearingHouse.addDonationsRouter(donationsRouter.address);
};

export default func;
func.tags = ["testbed", "_SetDonationRouter"];
