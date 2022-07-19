import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await hre.getChainId();

  const params = {
    _owner: process.env.PARENT_DAO || deployer,
    _baseToken: process.env.REWARD_TOKEN,
    _stakingContract: "",
    _walletImplementation: "",
  };

  if (chainId === "31337") {
    params._stakingContract = (await ethers.getContract("StakingRewards")).address;
    params._baseToken = (await ethers.getContract("EarthToken")).address;
    params._owner = deployer;
    params._walletImplementation = (await ethers.getContract("ThinWallet")).address;
  } else {
    params._stakingContract = process.env.STAKING_REWARDS_CONTRACT || (
      await ethers.getContract("StakingRewards")
    ).address || "";
    params._walletImplementation = (
      await ethers.getContract("ThinWallet")
    ).address || "";
  }

  if(!params._stakingContract || 
    !params._walletImplementation) {
    console.log("invalid params");
    return;
  }

  await deploy("DonationsRouter", {
    from: deployer,
    args: [
      params._baseToken,
      params._stakingContract,
      params._owner,
      params._walletImplementation
    ],
    log: true,
  });
};

export default func;
func.tags = ["testbed", "_DonationsRouter"];
