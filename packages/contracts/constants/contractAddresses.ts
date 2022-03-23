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
}

const goerli: IContractAddresses = {
  GnosisFactory: getProxyFactoryDeployment({ network: "5" }).defaultAddress,
  GnosisSafeSingleton: getSafeSingletonDeployment({ network: "5" })
    .defaultAddress,
  GnosisFallbackHandler: getFallbackHandlerDeployment({ network: "5" })
    .defaultAddress,
  ENSRegistry: "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e",
};

const ContractAddresses: { [key: string]: IContractAddresses } = {
  goerli,
};

export default ContractAddresses;
