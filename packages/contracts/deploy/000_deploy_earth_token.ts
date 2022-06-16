import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy("EarthToken", {
    from: deployer,
    args: [ethers.constants.MaxUint256],
    log: true,
  });
};

export default func;
func.tags = ["testbed", "_EarthToken"];
