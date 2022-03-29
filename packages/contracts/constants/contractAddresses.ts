import {
  getSafeSingletonDeployment,
  getProxyFactoryDeployment,
  getFallbackHandlerDeployment,
} from "@gnosis.pm/safe-deployments";

interface IContractAddresses {
  GnosisFactory: string;
  GnosisSafeSingleton: string;
  GnosisFallbackHandler: string;
  ENSRegistry: string;
  ENSResolver: string;
  ENSRegistrar: string;
  ENSController: string;
}

export const goerli: IContractAddresses = {
  GnosisFactory:
    getProxyFactoryDeployment({ network: "5" })?.defaultAddress || "",
  GnosisSafeSingleton:
    getSafeSingletonDeployment({ network: "5" })?.defaultAddress || "",
  GnosisFallbackHandler:
    getFallbackHandlerDeployment({ network: "5" })?.defaultAddress || "",
  ENSRegistry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  ENSResolver: "0xc1EA41786094D1fBE5aded033B5370d51F7a3F96",
  ENSRegistrar: "",
  ENSController: "",
};

export const mainnet: IContractAddresses = {
  GnosisFactory:
    getProxyFactoryDeployment({ network: "1" })?.defaultAddress || "",
  GnosisSafeSingleton:
    getSafeSingletonDeployment({ network: "1" })?.defaultAddress || "",
  GnosisFallbackHandler:
    getFallbackHandlerDeployment({ network: "1" })?.defaultAddress || "",
  ENSRegistry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
  ENSResolver: "0x4976fb03C32e5B8cfe2b6cCB31c09Ba78EBaBa41",
  ENSRegistrar: "0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85",
  ENSController: "0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5",
};

export const ContractAddresses: { [key: string]: IContractAddresses } = {
  // "5": { ...goerli },
  "1": { ...mainnet },
  "31337": { ...mainnet },
};

export default ContractAddresses;
