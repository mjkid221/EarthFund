/// Generating bytes initializer: https://github.com/gnosis/gnosis-py/blob/8dd7647da56c015486e3b7a5272a63a152cfeba3/gnosis/safe/safe.py#L132

import { ethers, deployments, network } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import {
  IENSController,
  ERC20Singleton,
  IGovernor,
  IERC721,
  IGnosisSafe,
  IENSRegistry,
  IENSRegistrar,
} from "../typechain-types";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import ContractAddresses from "../constants/contractAddresses";
import convertToSeconds from "../helpers/convertToSeconds";
import { isAddress, keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { createGnosisSetupTx } from "../helpers/gnosisInitializer";

import { ContractReceipt } from "ethers";
import { solidity } from "ethereum-waffle";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const childDaoConfig = async (
  owners: string[],
  tokenName = "Test",
  tokenSymbol = "TEST",
  subdomain = "subtest",
  snapshotKey = "A",
  snapshotValue = "B"
) => ({
  _tokenData: {
    tokenName: toUtf8Bytes(tokenName),
    tokenSymbol: toUtf8Bytes(tokenSymbol),
  },
  _safeData: {
    initializer:
      (await createGnosisSetupTx(
        owners,
        1,
        ethers.constants.AddressZero,
        [],
        ContractAddresses["31337"].GnosisFallbackHandler,
        ethers.constants.AddressZero,
        0,
        ethers.constants.AddressZero
      )) || [],
  },
  _subdomain: {
    subdomain: toUtf8Bytes(subdomain),
    snapshotKey: toUtf8Bytes(snapshotKey),
    snapshotValue: toUtf8Bytes(snapshotValue),
  },
});
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

describe("Governor", () => {
  let deployer: SignerWithAddress, alice: SignerWithAddress;
  let token: ERC20Singleton, governor: IGovernor, ensController: IENSController;
  let ensRegistrar: IENSRegistrar;
  let tokenId: string;
  const domain = "earthfundTurboTestDomain31337";

  before(async () => {
    [deployer, alice] = await ethers.getSigners();
  });
  describe("Add ENS Domain", () => {
    beforeEach(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);
    });
    it("should transfer the ENS nft and set the label", async () => {
      expect(await ensRegistrar.ownerOf(ethers.BigNumber.from(tokenId))).to.eq(
        deployer.address
      );

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(ethers.BigNumber.from(tokenId));

      expect(await ensRegistrar.ownerOf(ethers.BigNumber.from(tokenId))).to.eq(
        governor.address
      );
    });

    it("should set the ensDomainId", async () => {
      expect(await governor.ensDomainNFTId()).to.eq(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(ethers.BigNumber.from(tokenId));

      expect(await governor.ensDomainNFTId()).to.eq(tokenId);

      it("should revert on child creation if an NFT isn't set", async () => {
        await expect(
          governor.createChildDAO(
            {
              tokenName: toUtf8Bytes("Test"),
              tokenSymbol: toUtf8Bytes("TEST"),
            },
            { initializer: toUtf8Bytes("test") },
            {
              subdomain: toUtf8Bytes("subtest"),
              snapshotKey: toUtf8Bytes("a"),
              snapshotValue: toUtf8Bytes("B"),
            }
          )
        ).to.be.revertedWith("ENS domain unavailable");
      });
    });
  });
  describe("Gnosis Safe", () => {
    let safe: IGnosisSafe;

    beforeEach(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId);
      const { _tokenData, _safeData, _subdomain } = await childDaoConfig([
        alice.address,
      ]);
      const safeTx = await (
        await governor.createChildDAO(_tokenData, _safeData, _subdomain)
      ).wait();
      safe = await ethers.getContractAt(
        "IGnosisSafe",
        safeTx.events?.find((el) => el.event === "ChildDaoCreated")?.args?.safe
      );
    });
    it("should create a gnosis safe", async () => {
      expect(await safe.isOwner(alice.address)).to.eq(true);
    });
    it("should set the owners of the safe", async () => {
      expect((await safe.getOwners()).length).to.eq(1);
    });
    it("should set the safe threshold", async () => {
      expect((await safe.getThreshold()).toNumber()).to.eq(1);
    });
  });
  describe("ERC20 Token", () => {
    const tokenName = "Test",
      tokenSymbol = "TEST";
    let childToken: ERC20Singleton, safe: string;
    let tokenSalt: number;
    before(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId);
      const { _tokenData, _safeData, _subdomain } = await childDaoConfig(
        [alice.address],
        tokenName,
        tokenSymbol
      );
      tokenSalt = (await governor.tokenSalt()).toNumber();
      const daoTx = await (
        await governor.createChildDAO(_tokenData, _safeData, _subdomain)
      ).wait();

      expect(
        isAddress(
          daoTx.events?.find(
            (el) =>
              el.eventSignature === "ChildDaoCreated(address,address,bytes32)"
          )?.args?.token
        )
      ).to.eq(true);
      safe = daoTx.events?.find(
        (el) => el.eventSignature === "ChildDaoCreated(address,address,bytes32)"
      )?.args?.safe;
      childToken = await ethers.getContractAt(
        "ERC20Singleton",
        daoTx.events?.find(
          (el) =>
            el.eventSignature === "ChildDaoCreated(address,address,bytes32)"
        )?.args?.token
      );
    });
    it("should create an ERC20 token", async () => {
      expect(await childToken.name()).to.eq(tokenName);
      expect(await childToken.symbol()).to.eq(tokenSymbol);
    });
    it("should set the safe as the owner of the ERC20 token", async () => {
      expect(await childToken.owner()).to.eq(safe);
    });
    it("should initialize the ERC20 token proxy", async () => {
      await expect(
        childToken.initialize(
          toUtf8Bytes("New token"),
          toUtf8Bytes("NEW"),
          deployer.address
        )
      ).to.be.rejectedWith("Initializable: contract is already initialized");
    });
    it("should increment the token salt", async () => {
      expect(await governor.tokenSalt()).to.eq(tokenSalt + 1);
      const { _tokenData, _safeData, _subdomain } = await childDaoConfig(
        [alice.address],
        tokenName,
        tokenSymbol
      );

      await (
        await governor.createChildDAO(
          { tokenName: toUtf8Bytes("test"), tokenSymbol: toUtf8Bytes("test") },
          _safeData,
          _subdomain
        )
      ).wait();
      expect(await governor.tokenSalt()).to.eq(tokenSalt + 2);
    });
  });
  describe("ENS Subdomain", () => {
    let childNode: string;
    before(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId);
      const { _tokenData, _safeData, _subdomain } = await childDaoConfig([
        alice.address,
      ]);

      const daoTx = await (
        await governor.createChildDAO(_tokenData, _safeData, _subdomain)
      ).wait();

      childNode = daoTx.events?.find(
        (el) => el.eventSignature === "ChildDaoCreated(address,address,bytes32)"
      )?.args?.node;
    });
    it("should create an ENS subdomain", async () => {
      throw new Error("implement");
    });
    it("should revert if the subdomain exists", async () => {
      throw new Error("implement");
    });
    it("should set the ETH address for the subdomain to the Gnosis safe", async () => {
      throw new Error("implement");
    });
    it("should set a text record for the subdomain", async () => {
      /// ## Use ethers for checking ens text record
      throw new Error("implement");
    });
  });
  // describe("General requirements", () => {
  //   before(async () => {
  //     // approve and transfer the NFT
  //   });
  //   it("should emit an event", async () => {
  //     throw new Error("implement");
  //     expect.emitWithArgs
  //   });

  // });
});

// it("should ", async () => {throw new Error("implement");});
