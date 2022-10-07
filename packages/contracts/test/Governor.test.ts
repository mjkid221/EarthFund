/// Generating bytes initializer: https://github.com/gnosis/gnosis-py/blob/8dd7647da56c015486e3b7a5272a63a152cfeba3/gnosis/safe/safe.py#L132

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { deployments, ethers } from "hardhat";
import { BigNumber, providers } from "ethers";
import {
  isAddress,
  keccak256,
  solidityKeccak256,
  solidityPack,
  toUtf8Bytes,
} from "ethers/lib/utils";
import { solidity } from "ethereum-waffle";

import ContractAddresses, { mainnet } from "../constants/contractAddresses";
import createChildDaoConfig from "../helpers/createChildDaoConfig";
import setupNetwork from "../helpers/setupNetwork";
import {
  ERC20Singleton,
  IGovernor,
  IGnosisSafe,
  IENSRegistry,
  IENSRegistrar,
  PublicResolver,
  Governor__factory,
  IClearingHouse,
  IDonationsRouter,
  ERC20,
  IRealityETH,
  IZodiacModule,
  EarthToken,
  IENSController,
} from "../typechain-types";
import { AddressOne } from "@gnosis.pm/safe-contracts";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

describe("Governor", () => {
  let deployer: SignerWithAddress, alice: SignerWithAddress;
  let token: ERC20Singleton,
    governor: IGovernor,
    donationsRouter: IDonationsRouter;
  let ensRegistrar: IENSRegistrar, ensController: IENSController;
  let tokenId: string;

  const domain = "earthfundTurboTestDomain31337";

  before(async () => {
    [deployer, alice] = await ethers.getSigners();
  });
  describe("Add ENS Domain to Dao Governor", () => {
    beforeEach(async () => {
      [, governor, , ensRegistrar, tokenId] = await setupNetwork(
        domain,
        deployer
      );
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
        const { _tokenData, _safeData, _subdomain } =
          await createChildDaoConfig([alice.address]);
        expect(
          governor.createChildDAO(_tokenData, _safeData, _subdomain)
        ).to.be.revertedWith("ENS domain unavailable");
      });
    });
  });
  describe("Withdraw ENS Domain from the Dao Governor", () => {
    beforeEach(async () => {
      [, governor, , ensRegistrar, tokenId] = await setupNetwork(
        domain,
        deployer
      );
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
    let earthToken: EarthToken;
    beforeEach(async () => {
      [, governor, , ensRegistrar, tokenId] = await setupNetwork(
        domain,
        deployer
      );

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId);
      const { _tokenData, _safeData, _subdomain } = createChildDaoConfig([
        alice.address,
      ]);
      earthToken = await ethers.getContract("EarthToken");
      await earthToken.increaseAllowance(
        governor.address,
        ethers.constants.MaxInt256
      );

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
    let earthToken: EarthToken;
    before(async () => {
      [, governor, , ensRegistrar, tokenId] = await setupNetwork(
        domain,
        deployer
      );
      earthToken = await ethers.getContract("EarthToken");
      await earthToken.increaseAllowance(
        governor.address,
        ethers.constants.MaxInt256
      );

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId);
      const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig(
        [alice.address],
        tokenName,
        tokenSymbol,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        false
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
      expect(
        (await clearingHouse.causeInformation(childToken.address)).autoStaking
      ).to.eq(false);
    });
    it("should initialize the ERC20 token proxy", async () => {
      await expect(
        childToken.initialize(
          toUtf8Bytes("New token"),
          toUtf8Bytes("NEW"),
          toUtf8Bytes("1000"),
          deployer.address
        )
      ).to.be.rejectedWith("Initializable: contract is already initialized");
    });
  });
  describe("ENS Subdomain", () => {
    let childNode: string, safe: string;
    let ensRegistry: IENSRegistry, ensResolver: PublicResolver;
    let earthToken: EarthToken;
    before(async () => {
      [, governor, , ensRegistrar, tokenId] = await setupNetwork(
        domain,
        deployer
      );
      earthToken = await ethers.getContract("EarthToken");
      await earthToken.increaseAllowance(
        governor.address,
        ethers.constants.MaxInt256
      );

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
      [, governor, , ensRegistrar, tokenId] = await setupNetwork(
        domain,
        deployer
      );
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
          donationsRouter: ethers.constants.AddressZero,
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
          donationsRouter: ethers.constants.AddressZero,
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
          donationsRouter: ethers.constants.AddressZero,
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
          donationsRouter: ethers.constants.AddressZero,
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
          donationsRouter: ethers.constants.AddressZero,
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
          donationsRouter: ethers.constants.AddressZero,
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
          donationsRouter: ethers.constants.AddressZero,
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
          donationsRouter: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid clearing house address");
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
          clearingHouse: ethers.utils.hexlify(ethers.utils.randomBytes(20)),
          donationsRouter: ethers.constants.AddressZero,
        })
      ).to.be.revertedWith("invalid donations router address");
    });
  });
  describe("Create Cause", () => {
    let token: ERC20;
    beforeEach(async () => {
      [, governor, , ensRegistrar, tokenId] = await setupNetwork(
        domain,
        deployer
      );
      donationsRouter = await ethers.getContract("DonationsRouter");
    });
    it("should create a dao and mint to safe successfully", async () => {
      const earthToken = await ethers.getContract("EarthToken");
      const clearingHouse = await ethers.getContract("ClearingHouse");

      expect(await donationsRouter.causeId()).to.eq(0);
      expect(await earthToken.balanceOf(clearingHouse.address)).to.eq(
        ethers.utils.parseEther("0")
      );

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(ethers.BigNumber.from(tokenId));

      const amountToMint = 100;
      const rewardPercentage = 10 ** 16;

      const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig(
        [alice.address],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        rewardPercentage,
        amountToMint,
        undefined,
        undefined,
        undefined
      );
      await earthToken.increaseAllowance(
        governor.address,
        ethers.utils.parseEther(String(amountToMint))
      );
      const safeTx = await (
        await governor.createChildDAO(_tokenData, _safeData, _subdomain)
      ).wait();

      const event: any = safeTx.events?.filter((x) => {
        return x.event == "ChildDaoCreated";
      })?.[0].args;
      const { safe, token } = event;

      const childDaoToken = await ethers.getContractAt("ERC20", token);

      const causeId = await donationsRouter.tokenCauseIds(token);
      expect(causeId).to.eq(1);

      // Check that the cause is created correctly in donation router
      const cause = await donationsRouter.causeRecords(causeId);

      expect(cause.owner).to.eq(safe);
      expect(cause.rewardPercentage.toString()).to.eq(
        rewardPercentage.toString()
      );
      expect(cause.daoToken.toString()).to.eq(token.toString());
      expect(await ethers.provider.getCode(cause.defaultWallet)).to.not.eq(
        "0x"
      );

      // Check that balances are correct for earthtokens and daotoken
      const amountExpected = ethers.utils.parseEther(String(amountToMint));
      expect(await earthToken.balanceOf(clearingHouse.address)).to.eq(
        amountExpected
      );

      expect(await childDaoToken.balanceOf(safe)).to.eq(amountExpected);
      expect(await childDaoToken.balanceOf(deployer.address)).to.eq(0);
    });
  });
  describe("Zodiac module", () => {
    let tokenData: IGovernor.TokenStruct,
      safeData: IGovernor.SafeStruct,
      subdomain: IGovernor.SubdomainStruct;
    let earthToken: EarthToken;
    beforeEach(async () => {
      [token, governor, ensController, ensRegistrar, tokenId] =
        await setupNetwork(domain, deployer);

      earthToken = await ethers.getContract("EarthToken");
      await earthToken.increaseAllowance(
        governor.address,
        ethers.constants.MaxInt256
      );

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId);
      const { _tokenData, _safeData, _subdomain } = createChildDaoConfig([
        alice.address,
      ]);
      tokenData = _tokenData;
      safeData = _safeData;
      subdomain = _subdomain;
    });
    it("should emit an event with the zodiac module details", async () => {
      const moduleAddress = "0xb61673afCb924D6a2C294896e28DaCc12B6dFc82";
      expect(await ethers.provider.getCode(moduleAddress)).to.eq("0x");

      const reality: IRealityETH = await ethers.getContractAt(
        "IRealityETH",
        ContractAddresses["1"].RealityOracle
      );
      expect(await reality.template_hashes(71)).to.eq(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      await expect(governor.createChildDAO(tokenData, safeData, subdomain))
        .to.emit(governor, "ZodiacModuleEnabled")
        .withArgs(
          ethers.utils.getAddress("0x51Db5638094666e8C01D37411A4672cC1341D3A7"),
          moduleAddress,
          71
        );
    });
    it("should deploy a gnosis zodiac module", async () => {
      const moduleAddress = "0xb61673afCb924D6a2C294896e28DaCc12B6dFc82";
      expect(await ethers.provider.getCode(moduleAddress)).to.eq("0x");

      const reality: IRealityETH = await ethers.getContractAt(
        "IRealityETH",
        ContractAddresses["1"].RealityOracle
      );
      expect(await reality.template_hashes(71)).to.eq(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      await governor.createChildDAO(tokenData, safeData, subdomain);

      expect(await ethers.provider.getCode(moduleAddress)).to.not.eq("0x");
    });
    it("should enable the module on the safe", async () => {
      const safeTx = await (
        await governor.createChildDAO(tokenData, safeData, subdomain)
      ).wait();
      const module: IGnosisSafe = await ethers.getContractAt(
        "IGnosisSafe",
        safeTx.events?.find((el) => el.event === "ChildDaoCreated")?.args?.safe
      );
      expect(
        await module.isModuleEnabled(
          safeTx.events?.find((el) => el.event === "ZodiacModuleEnabled")?.args
            ?.module
        )
      ).to.eq(true);
    });
    it("should remove the governor from the safe", async () => {
      const tx = await (
        await governor.createChildDAO(tokenData, safeData, subdomain)
      ).wait();
      const safe: IGnosisSafe = await ethers.getContractAt(
        "IGnosisSafe",
        tx.events?.find((el) => el.event === "ChildDaoCreated")?.args?.safe
      );
      expect(await safe.isOwner(governor.address)).to.eq(false);
    });
    it("should create a reality.eth template if required", async () => {
      const reality: IRealityETH = await ethers.getContractAt(
        "IRealityETH",
        ContractAddresses["1"].RealityOracle
      );
      expect(await reality.template_hashes(71)).to.eq(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      await governor.createChildDAO(tokenData, safeData, subdomain);
      expect(await reality.template_hashes(71)).to.eq(
        keccak256(toUtf8Bytes(safeData.zodiac.template))
      );
    });
    it("should reuse an existing reality.eth template if provided", async () => {
      const reality: IRealityETH = await ethers.getContractAt(
        "IRealityETH",
        ContractAddresses["1"].RealityOracle
      );
      expect(await reality.template_hashes(70)).to.not.eq(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
      safeData.zodiac.template = "";
      safeData.zodiac.templateId = 70;
      const safeTx = await (
        await governor.createChildDAO(tokenData, safeData, subdomain)
      ).wait();
      const module: IZodiacModule = await ethers.getContractAt(
        "IZodiacModule",
        safeTx.events?.find((el) => el.event === "ZodiacModuleEnabled")?.args
          ?.module
      );

      expect(await module.template()).to.eq(70);
    });

    it("should set the safe threshold correctly", async () => {
      const tx = await (
        await governor.createChildDAO(tokenData, safeData, subdomain)
      ).wait();
      const safe: IGnosisSafe = await ethers.getContractAt(
        "IGnosisSafe",
        tx.events?.find((el) => el.event === "ChildDaoCreated")?.args?.safe
      );
      expect(await safe.getThreshold()).to.eq(safeData.safe.threshold);
    });
  });
});

// it("should ", async () => {throw new Error("implement");});
