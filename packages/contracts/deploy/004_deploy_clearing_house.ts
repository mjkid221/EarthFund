import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await hre.getChainId();

  const stakingRewards = await ethers.getContract("StakingRewards");
  let earthToken = process.env.EARTH_ERC20_TOKEN_ADDRESS;
  let owner = process.env.PARENT_DAO || deployer;

  if (chainId == "31337") {
    earthToken = (await ethers.getContract("EarthToken")).address;
    owner = deployer;
  }

  await deploy("ClearingHouse", {
    from: deployer,
    args: [earthToken, stakingRewards.address, owner],
    log: true,
  });
};

export default func;
func.tags = ["testbed", "_ClearingHouse"];
