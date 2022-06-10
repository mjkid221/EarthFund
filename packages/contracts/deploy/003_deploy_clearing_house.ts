import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const earthToken = await ethers.getContract("EarthToken");
  const stakingRewards = await ethers.getContract("StakingRewards");

  await deploy("ClearingHouse", {
    from: deployer,
    args: [
      process.env.EARTH_ERC20_TOKEN_ADDRESS ?? earthToken.address,
      stakingRewards.address,
      process.env.CLEARING_HOUSE_AUTO_STAKE ?? false,
    ],
    log: true,
  });
};

export default func;
func.tags = ["testbed", "_ClearingHouse"];
