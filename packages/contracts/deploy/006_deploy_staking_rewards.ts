import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await hre.getChainId();

  let rewardToken = process.env.REWARD_TOKEN;
  if (chainId === "31337") {
    rewardToken = (await ethers.getContract("EarthToken")).address;
  }
  if (!rewardToken) {
    throw new Error("Invalid reward token");
  }

  await deploy("StakingRewards", {
    from: deployer,
    args: [rewardToken],
    log: true,
  });
};

export default func;
func.tags = ["testbed", "_stakingRewards"];
