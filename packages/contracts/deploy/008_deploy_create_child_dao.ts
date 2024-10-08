import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import ContractAddresses from "../constants/contractAddresses";
import config from "../deployment.config";
import createChildDaoConfig from "../helpers/createChildDaoConfig";
import setupNetwork from "../helpers/setupNetwork";
import { IENSRegistrar, IGovernor } from "../typechain-types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  let deployer: SignerWithAddress;
  [deployer] = await ethers.getSigners();

  if (!config?.childDaoConfig?.chainId) {
    throw new Error("no chain id provided in the deployment config");
  }

  const governor = (await ethers.getContract("Governor")) as IGovernor;

  // create ENS subdomain if local network
  if (config?.childDaoConfig?.chainId === 31337) {
    let tokenId: string;
    let ensRegistrar: IENSRegistrar;

    [, , , ensRegistrar, tokenId] = await setupNetwork(
      "earthfund-test",
      deployer
    );

    await ensRegistrar.approve(governor.address, tokenId);
    await governor.addENSDomain(tokenId);
  }

  // throw error if governor has no ENS domain set
  if ((await governor.ensDomainNFTId()).isZero()) {
    throw new Error("governor has no ens domain set");
  }

  // make sure the config chain id is one of the supported ones
  if (!ContractAddresses[config?.childDaoConfig?.chainId.toString()]) {
    throw new Error("unsupported chain id");
  }

  // check if config owners array is empty
  if (!config?.childDaoConfig?.owners?.length) {
    throw new Error("child dao config owners array is empty");
  }

  // check safe threshold is less than or equal to the owners array length
  if (
    config?.childDaoConfig?.safeThreshold >
    config?.childDaoConfig?.owners?.length
  ) {
    throw new Error(
      "safe threshold must be less than or equal to the owners array in the deployment config"
    );
  }

  // create child doa config using helper function
  const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig(
    config.childDaoConfig.owners,
    config.childDaoConfig.tokenName,
    config.childDaoConfig.tokenSymbol,
    config.childDaoConfig.subdomain,
    config.childDaoConfig.snapshotKey,
    config.childDaoConfig.snapshotValue,
    config.childDaoConfig.chainId.toString(),
    config.childDaoConfig.safeThreshold,
    config.childDaoConfig.zodiacParams,
    config.childDaoConfig.maxSupply,
    config.childDaoConfig.maxSwap,
    config.childDaoConfig.release,
    config.childDaoConfig.autoStaking,
    config.childDaoConfig.kycRequired,
    config.childDaoConfig.rewardPercentage,
    config.childDaoConfig.mintingAmount,
    config.childDaoConfig.KYCId,
    config.childDaoConfig.expiry,
    config.childDaoConfig.signature
  );

  // Approve earth token transfer for initial mint
  const earthToken = await ethers.getContract("EarthToken");
  await (
    await earthToken.increaseAllowance(
      governor.address,
      ethers.utils.parseEther(String(config.childDaoConfig.mintingAmount))
    )
  ).wait(6);

  // call create child dao on the governor contract using the created config
  const createChildDaoTx = await (
    await governor.createChildDAO(_tokenData, _safeData, _subdomain)
  ).wait();

  const childDaoSafe = await ethers.getContractAt(
    "IGnosisSafe",
    createChildDaoTx.events?.find((el) => el.event === "ChildDaoCreated")?.args
      ?.safe
  );

  const childDaoToken = await ethers.getContractAt(
    "ERC20Singleton",
    createChildDaoTx.events?.find((el) => el.event === "ChildDaoCreated")?.args
      ?.token
  );

  console.log({ childDaoSafeAddress: childDaoSafe.address });
  console.log({ childDaoToken: childDaoToken.address });
};

export default func;
func.tags = ["_CreateChildDao"];
