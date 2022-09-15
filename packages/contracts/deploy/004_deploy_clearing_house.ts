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
  let autoStake = false;
  let maxSupply = process.env.MAX_SUPPLY;
  let maxSwap = process.env.MAX_SWAP;

  if (process.env.CLEARING_HOUSE_AUTO_STAKE == "true") {
    autoStake = true;
  }
  if (chainId == "31337") {
    maxSupply = ethers.utils.parseEther("1000000").toString();
    maxSwap = ethers.utils.parseEther("5000").toString();
    autoStake = false;
    earthToken = (await ethers.getContract("EarthToken")).address;
    owner = deployer;
  }

  if (!maxSupply || !maxSwap) {
    throw new Error("Limit parameters not found");
  }

  await deploy("ClearingHouse", {
    from: deployer,
    args: [earthToken, stakingRewards.address, maxSwap, owner],
    log: true,
  });
};

export default func;
func.tags = ["testbed", "_ClearingHouse"];
