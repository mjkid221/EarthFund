import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const earthToken = await ethers.getContract("EarthToken");

  await deploy("ClearingHouse", {
    from: deployer,
    args: [process.env.EARTH_ERC20_TOKEN_ADDRESS ?? earthToken.address],
    log: true,
  });
};

export default func;
func.tags = ["testbed", "_ClearingHouse"];
