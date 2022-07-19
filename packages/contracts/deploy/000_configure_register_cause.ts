import { formatEther } from "ethers/lib/utils";
import { BigNumber } from "ethers"
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { execute } = deployments;
  const { deployer, alice } = await getNamedAccounts();

  // -------------Replace with relevant variables--------------
  const gnosisSafeAddress = "";
  const rewardPercentage = 1; // default: 1%
  const childDaoTokenAddress = "";
  // ----------------------------------------------------------
  if (!gnosisSafeAddress || 
    !rewardPercentage ||
    !childDaoTokenAddress
  ){
    return;
  }
  const registration = {
    owner: gnosisSafeAddress,
    rewardPercentage: BigNumber.from((rewardPercentage * (10 ** 16)).toString()),
    daoToken: childDaoTokenAddress
  }
  console.log("Register cause");
  await execute(
    "DonationsRouter",
    { from: deployer, log: true },
    "registerCause",
    registration
  );
}


export default func;
func.tags = ["_configRegisterCause"];