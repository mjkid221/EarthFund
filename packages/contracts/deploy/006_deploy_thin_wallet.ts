import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  await deploy("ThinWallet", {
    from: deployer,
    args: [],
    log: true,
  });

  const ThinWallet = await ethers.getContract("ThinWallet");

  await ThinWallet.initialize(deployer, []);
};

export default func;
func.tags = ["testbed", "_ThinWallet"];
