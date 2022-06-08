/// Generating bytes initializer: https://github.com/gnosis/gnosis-py/blob/8dd7647da56c015486e3b7a5272a63a152cfeba3/gnosis/safe/safe.py#L132

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers } from "hardhat";
import { isAddress, keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { solidity } from "ethereum-waffle";

import ContractAddresses from "../constants/contractAddresses";
import createChildDaoConfig from "../helpers/createChildDaoConfig";
import setupNetwork from "../helpers/setupNetwork";
import {
  IENSController,
  ERC20Singleton,
  IGovernor,
  IGnosisSafe,
  IENSRegistry,
  IENSRegistrar,
  PublicResolver,
  Governor__factory,
  IClearingHouse,
} from "../typechain-types";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

describe("Governor", () => {
  let deployer: SignerWithAddress, alice: SignerWithAddress;
  let token: ERC20Singleton, governor: IGovernor;
  let ensRegistrar: IENSRegistrar, ensController: IENSController;
  let tokenId: string;
  let clearingHouse: IClearingHouse;
  const domain = "earthfundTurboTestDomain31337";

  before(async () => {
    [deployer, alice] = await ethers.getSigners();
  });
  describe("Add ENS Domain to Dao Governor", () => {
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
    it("should not allow NFT replacement", async () => {
      expect(await ensRegistrar.ownerOf(ethers.BigNumber.from(tokenId))).to.eq(
        deployer.address
      );

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(ethers.BigNumber.from(tokenId));

      expect(await ensRegistrar.ownerOf(ethers.BigNumber.from(tokenId))).to.eq(
        governor.address
      );
      await expect(
        governor.addENSDomain(ethers.BigNumber.from(tokenId))
      ).to.be.revertedWith("ens domain already set");
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
  describe("Withdraw ENS Domain from the Dao Governor", () => {
    beforeEach(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);
      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(ethers.BigNumber.from(tokenId));
    });
    it("should transfer the domain NFT to destination", async () => {
      expect(await ensRegistrar.ownerOf(tokenId)).to.be.eq(governor.address);
      await governor.withdrawENSDomain(alice.address);
      expect(await ensRegistrar.ownerOf(tokenId)).to.eq(alice.address);
    });
    it("should set the Governor token ID to 0 to prevent continued operation", async () => {
      expect(await governor.ensDomainNFTId()).to.be.gte(0);
      await governor.withdrawENSDomain(alice.address);
      expect(await governor.ensDomainNFTId()).to.eq(0);
    });
    it("should revert if there isn't a domain in the contract", async () => {
      await governor.withdrawENSDomain(alice.address);
      await expect(
        governor.withdrawENSDomain(alice.address)
      ).to.be.rejectedWith("ens domain not set");
    });
  });

  describe("Gnosis Safe", () => {
    let safe: IGnosisSafe;

    beforeEach(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId);
      const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig([
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
    let childToken: ERC20Singleton, clearingHouse: IClearingHouse;

    before(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId);
      const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig(
        [alice.address],
        tokenName,
        tokenSymbol
      );

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
      clearingHouse = await ethers.getContract("ClearingHouse");
      childToken = await ethers.getContractAt(
        "ERC20Singleton",
        daoTx.events?.find(
          (el) =>
            el.eventSignature === "ChildDaoCreated(address,address,bytes32)"
        )?.args?.token
      );

      clearingHouse = await ethers.getContract("ClearingHouse");
    });
    it("should create an ERC20 token", async () => {
      expect(await childToken.name()).to.eq(tokenName);
      expect(await childToken.symbol()).to.eq(tokenSymbol);
    });
    it("should set the safe as the owner of the ERC20 token", async () => {
      expect(await childToken.owner()).to.eq(clearingHouse.address);
    });
    it("should register the ERC20 token in the clearing house contract", async () => {
      expect(await clearingHouse.childDaoRegistry(childToken.address)).to.eq(
        true
      );
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
  });
  describe("ENS Subdomain", () => {
    let childNode: string, safe: string;
    let ensRegistry: IENSRegistry, ensResolver: PublicResolver;
    before(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);
      ensRegistry = await ethers.getContractAt(
        "IENSRegistry",
        ContractAddresses["31337"].ENSRegistry
      );

      ensResolver = await ethers.getContractAt(
        "PublicResolver",
        ContractAddresses["31337"].ENSResolver
      );

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId);
      const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig([
        alice.address,
      ]);

      expect(
        await ensRegistry.owner(
          ethers.utils.solidityKeccak256(
            ["bytes32", "bytes32"],
            [
              ethers.utils.solidityKeccak256(
                ["bytes32", "bytes32"],
                [await ensRegistrar.baseNode(), tokenId]
              ),
              keccak256(_subdomain.subdomain),
            ]
          )
        )
      ).to.eq(ethers.constants.AddressZero);

      const daoTx = await (
        await governor.createChildDAO(_tokenData, _safeData, _subdomain)
      ).wait();

      childNode = daoTx.events?.find(
        (el) => el.eventSignature === "ChildDaoCreated(address,address,bytes32)"
      )?.args?.node;
      safe = daoTx.events?.find(
        (el) => el.eventSignature === "ChildDaoCreated(address,address,bytes32)"
      )?.args?.safe;
    });
    it("should create an ENS subdomain", async () => {
      expect(await ensRegistry.owner(childNode)).to.eq(governor.address);
    });
    it("should revert if the subdomain exists", async () => {
      /// Gnosis will throw first, token name is used as salt
      const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig([
        deployer.address,
        alice.address,
      ]);
      await expect(
        governor.createChildDAO(_tokenData, _safeData, _subdomain)
      ).to.be.rejectedWith("ERC1167: create2 failed");
    });
    it("should set the ETH address for the subdomain to the Gnosis safe", async () => {
      expect(
        (await ensResolver.functions["addr(bytes32)"](childNode))[0]
      ).to.eq(safe);
    });
    it("should set a text record for the subdomain", async () => {
      /// ## Use ethers for checking ens text record
      expect((await ensResolver.functions.text(childNode, "A"))[0]).to.eq("B");
    });
  });
  describe("General requirements", () => {
    beforeEach(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);
    });

    it("should revert create dao if there isn't an NFT in the contract", async () => {
      const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig([
        alice.address,
      ]);
      await expect(
        governor.createChildDAO(_tokenData, _safeData, _subdomain)
      ).to.be.rejectedWith("ENS domain unavailable");
    });
    it("should revert deployment if parameters are bad", async () => {
      const factory: Governor__factory = await ethers.getContractFactory(
        "Governor"
      );

      await expect(
        factory.deploy({
          ensResolver: ethers.constants.AddressZero,
          ensRegistry: ethers.constants.AddressZero,
          ensRegistrar: ethers.constants.AddressZero,
          gnosisFactory: ethers.constants.AddressZero,
          gnosisSafeSingleton: ethers.constants.AddressZero,
          erc20Singleton: ethers.constants.AddressZero,
          parentDao: ethers.constants.AddressZero,
          clearingHouse: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid resolver address");
      await expect(
        factory.deploy({
          ensResolver: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistry: ethers.constants.AddressZero,
          ensRegistrar: ethers.constants.AddressZero,
          gnosisFactory: ethers.constants.AddressZero,
          gnosisSafeSingleton: ethers.constants.AddressZero,
          erc20Singleton: ethers.constants.AddressZero,
          parentDao: ethers.constants.AddressZero,
          clearingHouse: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid registry address");
      await expect(
        factory.deploy({
          ensResolver: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistry: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistrar: ethers.constants.AddressZero,
          gnosisFactory: ethers.constants.AddressZero,
          gnosisSafeSingleton: ethers.constants.AddressZero,
          erc20Singleton: ethers.constants.AddressZero,
          parentDao: ethers.constants.AddressZero,
          clearingHouse: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid registrar address");
      await expect(
        factory.deploy({
          ensResolver: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistry: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistrar: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          gnosisFactory: ethers.constants.AddressZero,
          gnosisSafeSingleton: ethers.constants.AddressZero,
          erc20Singleton: ethers.constants.AddressZero,
          parentDao: ethers.constants.AddressZero,
          clearingHouse: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid factory address");
      await expect(
        factory.deploy({
          ensResolver: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistry: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistrar: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          gnosisFactory: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          gnosisSafeSingleton: ethers.constants.AddressZero,
          erc20Singleton: ethers.constants.AddressZero,
          parentDao: ethers.constants.AddressZero,
          clearingHouse: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid safe singleton address");
      await expect(
        factory.deploy({
          ensResolver: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistry: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistrar: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          gnosisFactory: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          gnosisSafeSingleton: ethers.utils.hexlify(
            ethers.utils.randomBytes(20)
          ),
          erc20Singleton: ethers.constants.AddressZero,
          parentDao: ethers.constants.AddressZero,
          clearingHouse: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid token singleton address");
      await expect(
        factory.deploy({
          ensResolver: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistry: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistrar: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          gnosisFactory: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          gnosisSafeSingleton: ethers.utils.hexlify(
            ethers.utils.randomBytes(20)
          ),
          erc20Singleton: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          parentDao: ethers.constants.AddressZero,
          clearingHouse: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid owner");
      await expect(
        factory.deploy({
          ensResolver: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistry: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          ensRegistrar: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          gnosisFactory: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          gnosisSafeSingleton: ethers.utils.hexlify(
            ethers.utils.randomBytes(20)
          ),
          erc20Singleton: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          parentDao: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          clearingHouse: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid clearing house address");
    });
  });
});

// it("should ", async () => {throw new Error("implement");});
