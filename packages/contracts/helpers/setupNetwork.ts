import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers, deployments, network } from "hardhat";
import { keccak256 } from "ethers/lib/utils";

import convertToSeconds from "./convertToSeconds";
import ContractAddresses from "../constants/contractAddresses";

import { IENSRegistrar } from "../typechain-types";

const setupNetwork = async (domain: string, deployer: SignerWithAddress) => {
  await deployments.fixture(["testbed"]);
  const token = await ethers.getContract("ERC20Singleton");
  const governor = await ethers.getContract("Governor");
  const ensController = await ethers.getContractAt(
    "IENSController",
    ContractAddresses["31337"].ENSController
  );
  const ensRegistrar: IENSRegistrar = await ethers.getContractAt(
    "IENSRegistrar",
    ContractAddresses["31337"].ENSRegistrar
  );

  /// Create an ENS subdomain
  //    Call Controller, make commitment
  const secret = keccak256(ethers.utils.randomBytes(32));

  const commitment = await ensController.makeCommitment(
    domain,
    deployer.address,
    secret
  );
  const duration = convertToSeconds({ days: 45 });

  await ensController.commit(commitment);

  //    Fast forward chain time >= 1 minute
  await network.provider.send("evm_increaseTime", [
    convertToSeconds({ minutes: 2 }),
  ]);

  //    Register name
  const tx = await (
    await ensController.register(domain, deployer.address, duration, secret, {
      value: ethers.utils.parseEther("1"),
    })
  ).wait();

  const tokenId = tx.events?.find(
    (el: any) =>
      el.eventSignature ===
      "NameRegistered(string,bytes32,address,uint256,uint256)"
  )?.args?.label;

  return [token, governor, ensController, ensRegistrar, tokenId];
};

export default setupNetwork;
