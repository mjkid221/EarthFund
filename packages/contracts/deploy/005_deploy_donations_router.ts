import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await hre.getChainId();

  const params = {
    _owner: process.env.PARENT_DAO,
    _registrar: process.env.DAO_REGISTRAR,
    _platformFee: process.env.PLATFORM_FEE || 0,
    _baseToken: process.env.REWARD_TOKEN,
    _stakingContract: "",
  };
  if (chainId === "31337") {
    params._stakingContract = (await ethers.getContract("TestStaking")).address;
    params._baseToken = (await ethers.getContract("EarthToken")).address;
    params._owner = deployer;
    params._registrar = deployer;
    params._platformFee = ethers.utils.parseEther("0.03").toString();
  } else {
    params._stakingContract = (
      await ethers.getContract("StakingContract")
    ).address;
  }

  await deploy("DonationsRouter", {
    from: deployer,
    args: [
      params._owner,
      params._registrar,
      params._platformFee,
      params._baseToken,
      params._stakingContract,
    ],
    log: true,
  });
};

export default func;
func.tags = ["testbed", "_donationsRouter"];
