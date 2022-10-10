import {
  getSafeSingletonDeployment,
  getProxyFactoryDeployment,
  getFallbackHandlerDeployment,
} from "@gnosis.pm/safe-deployments";
import { ethers } from "hardhat";

interface IContractAddresses {
  ZodiacFactory: string;
  ZodiacRealityEth: string;
  ZodiacRealityERC20: string;
  GnosisFactory: string;
  GnosisSafeSingleton: string;
  GnosisFallbackHandler: string;
  ENSRegistry: string;
  ENSResolver: string;
  ENSRegistrar: string;
  ENSController: string;
  RealityOracle: string;
  RealityArbitrator: string;
}

export const mainnet: IContractAddresses = {
  ZodiacFactory: "0x00000000000DC7F163742Eb4aBEf650037b1f588",
  ZodiacRealityERC20: "0x6f628F0c3A3Ff75c39CF310901f10d79692Ed889",
  ZodiacRealityEth: "0x72d453a685c27580acDFcF495830EB16B7E165f8",
  RealityOracle: "0x5b7dD1E86623548AF054A4985F7fc8Ccbb554E2c",
  RealityArbitrator: ethers.constants.AddressZero,
  GnosisFactory:
    getProxyFactoryDeployment({ network: "1" })?.defaultAddress || "",
  GnosisSafeSingleton:
    getSafeSingletonDeployment({ network: "1" })?.defaultAddress || "",
  GnosisFallbackHandler:
    getFallbackHandlerDeployment({ network: "1" })?.defaultAddress || "",
  ENSRegistry: "0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e",
  ENSResolver: "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41",
  ENSRegistrar: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
  ENSController: "0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5",
};

export const goerli: IContractAddresses = {
  ZodiacFactory: "0x00000000000DC7F163742Eb4aBEf650037b1f588",
  ZodiacRealityERC20: "0x6f628F0c3A3Ff75c39CF310901f10d79692Ed889",
  ZodiacRealityEth: "0x72d453a685c27580acDFcF495830EB16B7E165f8",
  RealityOracle: "0x6F80C5cBCF9FbC2dA2F0675E56A5900BB70Df72f",
  RealityArbitrator: ethers.constants.AddressZero,
  GnosisFactory:
    getProxyFactoryDeployment({ network: "5" })?.defaultAddress || "",
  GnosisSafeSingleton:
    getSafeSingletonDeployment({ network: "5" })?.defaultAddress || "",
  GnosisFallbackHandler:
    getFallbackHandlerDeployment({ network: "5" })?.defaultAddress || "",
  ENSRegistry: "0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e",
  ENSResolver: "0x4B1488B7a6B320d2D721406204aBc3eeAa9AD329",
  ENSRegistrar: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
  ENSController: "0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5",
};

export const ContractAddresses: { [key: string]: IContractAddresses } = {
  "1": { ...mainnet },
  "31337": { ...mainnet },
  "5": { ...goerli },
};

export default ContractAddresses;
