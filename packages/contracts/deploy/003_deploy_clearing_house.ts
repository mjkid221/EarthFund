import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await hre.getChainId();

  const earthToken = await ethers.getContract("EarthToken");
  const stakingRewards = await ethers.getContract("StakingRewards");

  let maxSupply = process.env.MAX_SUPPLY;
  let maxSwap = process.env.MAX_SWAP;
  if (chainId == "31337") {
    maxSupply = ethers.utils.parseEther("1000000").toString();
    maxSwap = ethers.utils.parseEther("5000").toString();
  }

  if (!maxSupply || !maxSwap) {
    throw new Error("Limit parameters not found");
  }

  await deploy("ClearingHouse", {
    from: deployer,
    args: [
      process.env.EARTH_ERC20_TOKEN_ADDRESS ?? earthToken.address,
      stakingRewards.address,
      process.env.CLEARING_HOUSE_AUTO_STAKE ?? false,
      maxSupply,
      maxSwap,
    ],
    log: true,
  });
};

export default func;
func.tags = ["testbed", "_ClearingHouse"];
