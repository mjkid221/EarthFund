import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await hre.getChainId();

  // Test Staking Reward Token deployment on Rinkeby
  if (chainId == "4"){
    await deploy("StakingRewardToken", {
      from: deployer,
      args: [ethers.utils.parseEther("1000000")],
      log: true,
    });
  }
};

export default func;
func.tags = ["_StakingRewardToken"];
