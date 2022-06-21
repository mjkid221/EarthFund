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

  await deploy("StakingRewards", {
    from: deployer,
    args: [
      rewardToken,
      owner
    ],
    log: true,
  });

  if (chainId !== "31337"){
    const stakingRewards = (await ethers.getContract("StakingRewards")) as IStakingRewards;
    await stakingRewards.setLockupPeriod(ethers.BigNumber.from(convertToSeconds({ days: 30 })));
  };
  
};

export default func;
func.tags = ["testbed", "_StakingRewards"];
