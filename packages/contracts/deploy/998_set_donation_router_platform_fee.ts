import { BigNumber, ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { execute } = deployments;
  const { deployer } = await getNamedAccounts();

  // ------------------Replace fee percentage -------------------------
  const feePercentage = process.env.PLATFORM_FEE || "1"; // default: 1%
  // --------------------------------------------------------------------------------

  console.log("Set platform fee");
  await execute(
    "DonationsRouter",
    { from: deployer, log: true },
    "setPlatformFee",
    ethers.utils.formatUnits(feePercentage, 16)
  );
};

export default func;
func.tags = ["_setPlatformFee"];
