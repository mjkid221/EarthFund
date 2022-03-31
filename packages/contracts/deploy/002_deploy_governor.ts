import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ContractAddresses } from "../constants/contractAddresses";
import { ethers } from "hardhat";

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

  await deploy("Governor", {
    from: deployer,
    args: [
      {
        ensRegistry: ContractAddresses[chainId].ENSRegistry,
        ensResolver: ContractAddresses[chainId].ENSResolver,
        ensRegistrar: ContractAddresses[chainId].ENSRegistrar,
        gnosisFactory: ContractAddresses[chainId].GnosisFactory,
        gnosisSafeSingleton: ContractAddresses[chainId].GnosisSafeSingleton,
        erc20Singleton: (await ethers.getContract("ERC20Singleton")).address,
        parentDao: parentDao,
      },
    ],
    log: true,
  });
};
export default func;
func.tags = ["testbed", "_Governor"];
