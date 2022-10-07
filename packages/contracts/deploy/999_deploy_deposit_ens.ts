import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { IENSRegistrar, IGovernor } from "../typechain-types";
import ContractAddresses from "../constants/contractAddresses";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // ------------------Replace ENS tokenId -------------------------
  const tokenId = ""; //Example: 88998552866518861582649490262863558042022180025031588298860166316630392060562
  // --------------------------------------------------------------------------------

  const chainId = await hre.getChainId();
  const governor = (await ethers.getContract("Governor")) as IGovernor;
  const ensRegistrar: IENSRegistrar = await ethers.getContractAt(
    "IENSRegistrar",
    ContractAddresses[chainId].ENSRegistrar
  );

  console.log("Depositing ENS to Governor...");
  await ensRegistrar.approve(governor.address, tokenId);
  await governor.addENSDomain(tokenId);
};

export default func;
func.tags = ["_DepositENS"];
