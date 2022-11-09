import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ContractAddresses } from "../constants/contractAddresses";
import { ethers } from "hardhat";
import { IClearingHouse, IGovernor } from "../typechain-types";
import prompts from "prompts";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = await hre.getChainId();
  const keys = Object.keys(ContractAddresses);
  if (!keys.includes(chainId)) {
    throw new Error(`
    Unsupported network: ${chainId};
    Valid networks: ${keys.reduce((acc, el) => acc.concat(`${el}, `))}
    `);
  }

  const parentDao = process.env.PARENT_DAO || deployer;

  const deploymentConfig = {
    ensRegistry: ContractAddresses[chainId].ENSRegistry,
    ensResolver: ContractAddresses[chainId].ENSResolver,
    ensRegistrar: ContractAddresses[chainId].ENSRegistrar,
    gnosisFactory: ContractAddresses[chainId].GnosisFactory,
    gnosisSafeSingleton: ContractAddresses[chainId].GnosisSafeSingleton,
    erc20Singleton: ContractAddresses[chainId].ERC20Singleton,
    parentDao: parentDao,
    clearingHouse: ContractAddresses[chainId].ClearingHouse,
    donationsRouter: ContractAddresses[chainId].DonationsRouter,
  };

  console.log(deploymentConfig);

  const response = await promptConfirmConfig();
  if (!response) {
    process.exit(1);
  }

  const deployment = await deploy("Governor", {
    from: deployer,
    args: [deploymentConfig],
    log: true,
  });

  if (chainId === "31337") {
    // add the governor contract in the clearing house contract
    const governor = (await ethers.getContract("Governor")) as IGovernor;

    const clearingHouse = (await ethers.getContract(
      "ClearingHouse"
    )) as IClearingHouse;
    await clearingHouse.addGovernor(governor.address);
  }
};

const promptConfirmConfig = async () => {
  const response = await prompts({
    type: "confirm",
    name: "answer",
    message: "Please confirm the above configuration is correct",
  });
  return response.answer;
};

export default func;
func.tags = ["testbed", "_Governor"];
