import { formatEther } from "ethers/lib/utils";
import { BigNumber } from "ethers"
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { deployments, ethers, network } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { execute } = deployments;
  const { deployer, alice } = await getNamedAccounts();

  // ------------------Replace fee percentage -------------------------
  const feePercentage = 1; // default: 1%
  // --------------------------------------------------------------------------------

  console.log("Set platform fee");
  await execute(
    "DonationsRouter",
    {from: deployer, log: true},
    "setPlatformFee",
    BigNumber.from((feePercentage * (10 ** 16)).toString())
  );
}

export default func;
func.tags = ["_configPlatformFee"];