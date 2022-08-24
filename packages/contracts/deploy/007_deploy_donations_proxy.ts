import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "dotenv/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const USDT_ADDRESS = process.env.USDT_ADDRESS;
  const WETH_ADDRESS = process.env.WETH_ADDRESS;

  await deploy("DonationsProxy", {
    from: deployer,
    args: [WETH_ADDRESS, USDT_ADDRESS],
    log: true,
  });
};

export default func;
func.tags = ["_donationsProxy"];
