import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();
  const AddressOne : string = "0x0000000000000000000000000000000000000001";

  await deploy("ThinWallet", {
    from: deployer,
    args: [],
    log: true
  });

  await execute ("ThinWallet", 
    { from: deployer }, 
    "initialize", 
    AddressOne,
    [AddressOne]
  );  
};

export default func;
func.tags = ["testbed", "_ThinWallet"];
