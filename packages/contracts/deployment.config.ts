import { ethers } from "ethers";
export default {
  childDaoConfig: {
    chainId: 5,
    owners: [
      "0x0C56c62ecf7Cd3965A57B5D9A7974EeE578714C3",
      "0xc2f86d571543921fbaDcf050e0cFb1532a033936",
    ],
    tokenName: "Test",
    tokenSymbol: "TEST",
    snapshotKey: "test-snapshot-key",
    snapshotValue: "test-snapshot-value",
    subdomain: "test-subdomain",
    safeThreshold: 1, // NOTE: must be less than or equal to the number of owners, will throw error in script if owners array length is less
    zodiacParams: {
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
    },
    maxSupply: 1000,
    maxSwap: 7500,
    release: 0,
    autoStaking: false,
    kycRequired: false,
    rewardPercentage: 10 ** 16, // 1%
    mintingAmount: 1,
    KYCId: "",
    expiry: 0,
    signature: "",
  },
};
