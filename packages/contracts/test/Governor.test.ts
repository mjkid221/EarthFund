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
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { createGnosisSetupTx } from "../helpers/gnosisInitializer";

import { ContractReceipt } from "ethers";

chai.use(chaiAsPromised);
const { expect } = chai;

const setupNetwork = async (domain: string, deployer: SignerWithAddress) => {
  await deployments.fixture("testbed");
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

  const parentNode = tx.events?.find(
    (el: any) => el.eventSignature === "NewOwner(bytes32,bytes32,address)"
  )?.args?.node;

  return [token, governor, ensController, ensRegistrar, tokenId, parentNode];
};

describe("Governor", () => {
  let deployer: SignerWithAddress, alice: SignerWithAddress;
  let token: ERC20Singleton, governor: IGovernor, ensController: IENSController;
  let ensRegistrar: IERC721;
  let tokenId: string;
  const domain = "earthfundTurboTestDomain31337";

  before(async () => {
    [deployer, alice] = await ethers.getSigners();
  });
  // describe("Add ENS Domain", () => {
  //   beforeEach(async () => {
  //     [token, governor, ensController, ensRegistrar, tokenId] =
  //       await setupNetwork(domain, deployer);
  //   });
  //   it("should transfer the ENS nft and set the label", async () => {
  //     expect(await ensRegistrar.ownerOf(ethers.BigNumber.from(tokenId))).to.eq(
  //       deployer.address
  //     );
  //     expect(await governor.label()).to.eq(
  //       "0x0000000000000000000000000000000000000000000000000000000000000000"
  //     );
  //     await ensRegistrar.approve(governor.address, tokenId);
  //     await governor.addENSDomain(
  //       ethers.BigNumber.from(tokenId),
  //       keccak256(toUtf8Bytes(domain))
  //     );

  //     expect(await ensRegistrar.ownerOf(ethers.BigNumber.from(tokenId))).to.eq(
  //       governor.address
  //     );
  //     expect(await governor.label()).to.eq(keccak256(toUtf8Bytes(domain)));
  //   });
  //   it("should set the label", async () => {
  //     expect(await governor.label()).to.eq(
  //       "0x0000000000000000000000000000000000000000000000000000000000000000"
  //     );
  //     await ensRegistrar.approve(governor.address, tokenId);
  //     await governor.addENSDomain(
  //       ethers.BigNumber.from(tokenId),
  //       keccak256(toUtf8Bytes(domain))
  //     );

  //     expect(await governor.label()).to.eq(keccak256(toUtf8Bytes(domain)));
  //   });
  //   it("should set the ensDomainId", async () => {
  //     expect(await governor.ensDomainNFTId()).to.eq(
  //       "0x0000000000000000000000000000000000000000000000000000000000000000"
  //     );
  //     await ensRegistrar.approve(governor.address, tokenId);
  //     await governor.addENSDomain(
  //       ethers.BigNumber.from(tokenId),
  //       keccak256(toUtf8Bytes(domain))
  //     );

  //     expect(await governor.ensDomainNFTId()).to.eq(tokenId);

  //     it("should revert on child creation if an NFT isn't set", async () => {
  //       await expect(
  //         governor.createChildDAO(
  //           {
  //             tokenName: toUtf8Bytes("Test"),
  //             tokenSymbol: toUtf8Bytes("TEST"),
  //           },
  //           { initializer: toUtf8Bytes("test") },
  //           {
  //             subdomain: toUtf8Bytes("subtest"),
  //             snapshotKey: toUtf8Bytes("a"),
  //             snapshotValue: toUtf8Bytes("B"),
  //           }
  //         )
  //       ).to.be.revertedWith("ENS domain unavailable");
  //     });
  //   });
  // });
  describe("Gnosis Safe", () => {
    let safe: IGnosisSafe;
    let parentNode: string, safeTx: ContractReceipt;
    beforeEach(async () => {
      [token, governor, ensController, ensRegistrar, tokenId, parentNode] =
        await setupNetwork(domain, deployer);

      await ensRegistrar.approve(governor.address, tokenId);
      await governor.addENSDomain(tokenId, parentNode);
      safeTx = await (
        await governor.createChildDAO(
          {
            tokenName: toUtf8Bytes("Test"),
            tokenSymbol: toUtf8Bytes("TEST"),
          },
          {
            initializer:
              (await createGnosisSetupTx(
                [alice.address],
                1,
                ethers.constants.AddressZero,
                [],
                ContractAddresses["31337"].GnosisFallbackHandler,
                ethers.constants.AddressZero,
                0,
                ethers.constants.AddressZero
              )) || [],
          },
          {
            subdomain: toUtf8Bytes("subtest"),
            snapshotKey: toUtf8Bytes("A"),
            snapshotValue: toUtf8Bytes("B"),
          }
        )
      ).wait();
    });
    it("should create a gnosis safe", async () => {
      const safeAddress = safeTx.events?.find(
        (el) => el.event === "ChildDaoCreated"
      )?.args?.safe;
      expect(
        await (
          (await ethers.getContractAt(
            "IGnosisSafe",
            safeAddress
          )) as IGnosisSafe
        ).isOwner(alice.address)
      ).to.eq(true);
    });
    it("should set the owners of the safe", async () => {
      const safeAddress = safeTx.events?.find(
        (el) => el.event === "ChildDaoCreated"
      )?.args?.safe;
      expect(
        (
          await (
            (await ethers.getContractAt(
              "IGnosisSafe",
              safeAddress
            )) as IGnosisSafe
          ).getOwners()
        ).length
      ).to.eq(1);
    });
    it("should set the safe threshold", async () => {
      const safeAddress = safeTx.events?.find(
        (el) => el.event === "ChildDaoCreated"
      )?.args?.safe;
      expect(
        (
          await (
            (await ethers.getContractAt(
              "IGnosisSafe",
              safeAddress
            )) as IGnosisSafe
          ).getThreshold()
        ).toNumber()
      ).to.eq(1);
    });
  });
  // describe("ERC20 Token", () => {
  //   before(async () => {
  //     // approve and transfer the NFT
  //   });
  //   it("should create an ERC20 token", async () => {
  //     throw new Error("implement");
  //   });
  //   it("should set the safe as the owner of the ERC20 token", async () => {
  //     throw new Error("implement");
  //   });
  //   it("should initialize the ERC20 token proxy", async () => {
  //     throw new Error("implement");
  //   });
  // });
  // describe("ENS Subdomain", () => {
  //   before(async () => {
  //     // approve and transfer the NFT
  //   });
  //   it("should create an ENS subdomain", async () => {
  //     throw new Error("implement");
  //   });
  //   it("should revert if the subdomain exists", async () => {
  //     throw new Error("implement");
  //   });
  //   it("should set the ETH address for the subdomain to the Gnosis safe", async () => {
  //     throw new Error("implement");
  //   });
  //   it("should set a text record for the subdomain", async () => {
  //     /// ## Use ethers for checking ens text record
  //     throw new Error("implement");
  //   });
  // });
  // describe("General requirements", () => {
  //   before(async () => {
  //     // approve and transfer the NFT
  //   });
  //   it("should emit an event", async () => {
  //     throw new Error("implement");
  //   });
  // });
});

// it("should ", async () => {throw new Error("implement");});
