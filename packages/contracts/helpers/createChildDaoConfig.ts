import { ethers } from "ethers";
import { toUtf8Bytes } from "ethers/lib/utils";

import ContractAddresses from "../constants/contractAddresses";
import { IGovernor } from "../typechain-types";

const createChildDaoConfig = (
  owners: string[],
  tokenName = "Test",
  tokenSymbol = "TEST",
  subdomain = "subtest",
  snapshotKey = "A",
  snapshotValue = "B",
  chainId = "31337",
  safeThreshold = 1,
  zodiacParams = {
    timeout: 604800,
    cooldown: 0,
    expiration: 0,
    bond: ethers.utils.parseEther("0.01"),
    templateId: 0,
    template: `{
    "title": "Did the proposal with the id %s pass the execution of the transactions with hash 0x%s?",
    "lang": "en",
    "type": "bool",
    "category": "DAO Proposal"
}`,
  }
) => ({
  _tokenData: {
    tokenName: toUtf8Bytes(tokenName),
    tokenSymbol: toUtf8Bytes(tokenSymbol),
  },
  _safeData: {
    safe: {
      owners,
      threshold: safeThreshold,
      to: ethers.constants.AddressZero,
      data: [],
      fallbackHandler: ContractAddresses[chainId].GnosisFallbackHandler,
      paymentToken: ethers.constants.AddressZero,
      payment: 0,
      paymentReceiver: ethers.constants.AddressZero,
    },
    zodiac: {
      zodiacFactory: ContractAddresses[chainId].ZodiacFactory,
      moduleMasterCopy: ContractAddresses[chainId].ZodiacRealityERC20,
      oracle: ContractAddresses[chainId].RealityOracle,
      timeout: zodiacParams.timeout,
      cooldown: zodiacParams.cooldown,
      expiration: zodiacParams.expiration,
      bond: zodiacParams.bond,
      templateId: zodiacParams.templateId,
      template: zodiacParams.template,
      arbitrator: ContractAddresses[chainId].RealityArbitrator,
    },
  },
  _subdomain: {
    subdomain: toUtf8Bytes(subdomain),
    snapshotKey: toUtf8Bytes(snapshotKey),
    snapshotValue: toUtf8Bytes(snapshotValue),
  },
});

export default createChildDaoConfig;
