import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { IStakingRewards } from "../typechain-types";
import convertToSeconds from "../helpers/convertToSeconds";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await hre.getChainId();

  let rewardToken : string = process.env.REWARD_TOKEN || '';
  let owner : string = process.env.PARENT_DAO || deployer;
  
  if (chainId === "31337") {
    rewardToken = (await ethers.getContract("EarthToken")).address;
    owner = deployer;
  }
  if (!rewardToken) {
    throw new Error("Invalid reward token");
  }

  if (chainId === "31337"){
    await deploy("StakingRewards", {
      from: deployer,
      args: [
        rewardToken,
        owner,
        ethers.BigNumber.from(convertToSeconds({ days: 0 }))
      ],
      log: true,
    });
  }else{
    await deploy("StakingRewards", {
      from: deployer,
      args: [
        rewardToken,
        owner,
        ethers.BigNumber.from(convertToSeconds({ days: 30 }))
      ],
      log: true,
    });
  }
};

export default func;
func.tags = ["testbed", "_StakingRewards"];
