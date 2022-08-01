import { deployments, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { AbiCoder } from "ethers/lib/utils";
import {
  ERC20,
  IDonationsRouter,
  StakingRewards,
  ThinWallet,
} from "../typechain-types";

import { setUpRegistration } from "../helpers/setupTestDonationRouterRegistration";

const { deploy } = deployments;

interface CauseRegistrationRequest {
  owner: string;
  rewardPercentage: BigNumber;
  daoToken: string;
}
interface CauseUpdateRequest {
  owner: string;
  rewardPercentage: BigNumber;
}

interface CauseRecord {
  owner: string;
  defaultWallet: string;
  daoToken: string;
  rewardPercentage: BigNumber;
}

interface WithdrawalRequest {
  token: string;
  recipient: string;
  amount: BigNumber;
}

interface ThinWalletId {
  causeId: BigNumber;
  thinWalletId: string;
}

interface QueueItem {
  next: BigNumber;
  previous: BigNumber;
  id: string;
  isUnclaimed: boolean;
}

describe.only("Donations Router", () => {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    jake: SignerWithAddress;
  let platformOwner: SignerWithAddress, ownerOfCause: SignerWithAddress;
  let token: ERC20,
    router: IDonationsRouter,
    staking: StakingRewards,
    wallet: ThinWallet,
    daoToken: ERC20;
  const donationAmount: BigNumber = ethers.utils.parseEther("100");
  let platformFee: BigNumber = ethers.utils.parseEther("0.03");
  let rewardPercentage: BigNumber = BigNumber.from((10 ** 16).toString()); // 1%
  let expectedErrMsg: string = "";
  const address0: string = ethers.constants.AddressZero;
  let registrationRequest: CauseRegistrationRequest;
  const abiCoder: AbiCoder = ethers.utils.defaultAbiCoder;

  beforeEach(async () => {
    [deployer, alice, bob, jake] = await ethers.getSigners();
    await deployments.fixture([
      "_EarthToken",
      "_StakingRewards",
      "_ThinWallet",
    ]);

    token = await ethers.getContract("EarthToken");
    staking = await ethers.getContract("StakingRewards");
    wallet = await ethers.getContract("ThinWallet");

    await deploy("DAOToken", {
      from: alice.address,
      log: false,
      args: [ethers.utils.parseEther("1000000")],
    });

    daoToken = await ethers.getContract("DAOToken");

    platformOwner = alice;
    ownerOfCause = alice;
    registrationRequest = {
      owner: platformOwner.address,
      rewardPercentage: rewardPercentage,
      daoToken: daoToken.address,
    };
  });
  describe("Constructor", () => {
    it("should transfer ownership from the deployer to the address in the owner parameter", async () => {
      await deploy("DonationsRouter", {
        from: deployer.address,
        log: false,
        args: [token.address, staking.address, alice.address, wallet.address],
      });

      router = await ethers.getContract("DonationsRouter");

      expectedErrMsg = "Ownable: caller is not the owner";
      await expect(
        router.connect(deployer).setPlatformFee(platformFee)
      ).to.be.revertedWith(expectedErrMsg);
      await expect(router.connect(platformOwner).setPlatformFee(platformFee));
    });

    it("should validate the base token address", async () => {
      expectedErrMsg = "invalid base token";
      await expect(
        deploy("DonationsRouter", {
          from: deployer.address,
          log: false,
          args: [address0, staking.address, alice.address, wallet.address],
        })
      ).to.be.revertedWith(expectedErrMsg);
    });

    it("should validate the staking contract address", async () => {
      expectedErrMsg = "invalid staking contract";
      await expect(
        deploy("DonationsRouter", {
          from: deployer.address,
          log: false,
          args: [token.address, address0, alice.address, wallet.address],
        })
      ).to.be.revertedWith(expectedErrMsg);
    });
    it("should validate the owner address ", async () => {
      expectedErrMsg = "invalid owner";
      await expect(
        deploy("DonationsRouter", {
          from: deployer.address,
          log: false,
          args: [token.address, staking.address, address0, wallet.address],
        })
      ).to.be.revertedWith(expectedErrMsg);
    });
    it("should validate the wallet implementation address", async () => {
      expectedErrMsg = "invalid implementation";
      await expect(
        deploy("DonationsRouter", {
          from: deployer.address,
          log: false,
          args: [token.address, staking.address, alice.address, address0],
        })
      ).to.be.revertedWith(expectedErrMsg);
    });
  });
  describe("Donations", () => {
    beforeEach(async () => {
      await deploy("DonationsRouter", {
        from: deployer.address,
        log: false,
        args: [token.address, staking.address, alice.address, wallet.address],
      });
      router = await ethers.getContract("DonationsRouter");
    });
    it("should allow users to donate to a thin wallet that hasn't been deployed", async () => {
      const causeID: BigNumber = ethers.BigNumber.from("1");

      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.toHexString(), 32),
      };
      const thinWalletClone: string = await router.calculateThinWallet(
        walletId
      );
      expect(await daoToken.balanceOf(thinWalletClone)).to.eq(0);

      const codePromise = await ethers.provider.getCode(thinWalletClone);
      expect(codePromise).to.eq("0x");

      const amountToTransfer: BigNumber = ethers.utils.parseEther("100");
      await daoToken
        .connect(platformOwner)
        .transfer(thinWalletClone, amountToTransfer);

      expect(await daoToken.balanceOf(thinWalletClone)).to.eq(amountToTransfer);
    });
    it("should be able to receive ERC20 token donations", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      const cause: CauseRecord = await router.causeRecords(causeID);

      const thinWalletClone = cause.defaultWallet;
      expect(await daoToken.balanceOf(thinWalletClone)).to.be.eq(0);

      const amountToTransfer: BigNumber = ethers.utils.parseEther("100");
      await daoToken
        .connect(platformOwner)
        .transfer(thinWalletClone, amountToTransfer);

      expect(await daoToken.balanceOf(thinWalletClone)).to.be.eq(
        amountToTransfer
      );
    });
    it("should be able to receive ether donations", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      const cause: CauseRecord = await router.causeRecords(causeID);

      const thinWalletClone = cause.defaultWallet;
      expect(await ethers.provider.getBalance(thinWalletClone)).to.be.eq(0);
      const amountToTransfer: BigNumber = ethers.utils.parseEther("100");
      await alice.sendTransaction({
        to: thinWalletClone,
        value: amountToTransfer,
      });
      expect(await ethers.provider.getBalance(thinWalletClone)).to.be.eq(
        amountToTransfer
      );
    });
    it("should receive donations after a thin wallet has been deployed", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      const cause: CauseRecord = await router.causeRecords(causeID);
      const thinWalletClone = cause.defaultWallet;

      const codePromise = await ethers.provider.getCode(thinWalletClone);
      expect(codePromise.length).to.be.gt(2);

      expect(await daoToken.balanceOf(thinWalletClone)).to.be.eq(0);
      const amountToTransfer: BigNumber = ethers.utils.parseEther("100");
      await daoToken
        .connect(platformOwner)
        .transfer(thinWalletClone, amountToTransfer);
      expect(await daoToken.balanceOf(thinWalletClone)).to.be.eq(
        amountToTransfer
      );
    });
  });
  describe("Register cause", () => {
    beforeEach(async () => {
      registrationRequest = {
        owner: platformOwner.address,
        rewardPercentage: rewardPercentage,
        daoToken: daoToken.address,
      };
      await deployments.fixture([
        "_EarthToken",
        "_StakingRewards",
        "_ThinWallet",
        "_DonationsRouter",
      ]);
      router = await ethers.getContract("DonationsRouter");
    });
    it("should assign an ID of 1 to the first cause registered", async () => {
      expect(await router.causeId()).to.be.eq(0);
      await router.registerCause(registrationRequest);

      const causeID: BigNumber = await router.causeId();
      expect(causeID).to.be.eq(1);
    });

    it("should increment the cause id", async () => {
      expect(await router.causeId()).to.be.eq(0);
      await router.registerCause(registrationRequest);
      const initialCauseID: BigNumber = await router.causeId();

      registrationRequest.owner = bob.address;
      await router.registerCause(registrationRequest);
      const newCauseID: BigNumber = await router.causeId();
      expect(newCauseID).to.be.eq(initialCauseID.add(1));
    });

    it("should validate the cause owner address", async () => {
      expect(await router.causeId()).to.be.eq(0);
      const registrationRequest: CauseRegistrationRequest = {
        owner: address0,
        rewardPercentage: rewardPercentage,
        daoToken: daoToken.address,
      };

      expectedErrMsg = "invalid owner";
      await expect(
        router.registerCause(registrationRequest)
      ).to.be.revertedWith(expectedErrMsg);
    });

    it("should validate the dao token address", async () => {
      expect(await router.causeId()).to.be.eq(0);
      const registrationRequest: CauseRegistrationRequest = {
        owner: alice.address,
        rewardPercentage: rewardPercentage,
        daoToken: address0,
      };
      expectedErrMsg = "invalid token";
      await expect(
        router.registerCause(registrationRequest)
      ).to.be.revertedWith(expectedErrMsg);
    });

    it("should save a record for the new cause", async () => {
      expect(await router.causeId()).to.be.eq(0);

      const causeIdToGet: string = "1";
      let cause: CauseRecord = await router.causeRecords(causeIdToGet);
      expect(cause.owner).to.be.eq(address0);
      expect(cause.rewardPercentage).to.be.eq(address0);
      expect(cause.daoToken).to.be.eq(address0);

      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      expect(causeID).to.be.eq(causeIdToGet);

      cause = await router.causeRecords(causeID);
      expect(cause.owner).to.be.eq(registrationRequest.owner);
      expect(cause.rewardPercentage).to.be.eq(
        registrationRequest.rewardPercentage
      );
      expect(cause.daoToken).to.be.eq(registrationRequest.daoToken);
    });

    it("should prevent multiple causes registering with the same owner/token pair", async () => {
      await router.registerCause(registrationRequest);
      await expect(
        router.registerCause(registrationRequest)
      ).to.be.revertedWith("cause exists");
    });
    it("should emit an event", async () => {
      expect(await router.causeId()).to.be.eq(0);
      const tx = await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      const cause: CauseRecord = await router.causeRecords(causeID);
      await expect(tx)
        .to.emit(router, "RegisterCause")
        .withArgs(cause.owner, cause.daoToken, causeID);
    });
    it("should deploy a clone thin wallet for the default cause wallet", async () => {
      expect(await router.causeId()).to.be.eq(0);
      let causeID: BigNumber = ethers.BigNumber.from("1");
      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.toHexString(), 32),
      };
      const calculatedThinWalletClone: string =
        await router.calculateThinWallet(walletId);
      let codePromise = await ethers.provider.getCode(
        calculatedThinWalletClone
      );
      expect(codePromise).to.be.eq("0x");

      await router.registerCause(registrationRequest);
      causeID = await router.causeId();
      const cause: CauseRecord = await router.causeRecords(causeID);
      const thinWalletClone: string = cause.defaultWallet;
      expect(thinWalletClone).to.be.eq(calculatedThinWalletClone);

      codePromise = await ethers.provider.getCode(thinWalletClone);
      expect(codePromise).to.not.eq("0x");

      const encoded = abiCoder.encode(
        ["tuple(uint256, bytes)"],
        [[walletId.causeId, walletId.thinWalletId]]
      );
      const salt = ethers.utils.keccak256(encoded);
      const deployedWalletAddress = await router.deployedWallets(salt);
      expect(deployedWalletAddress).to.be.eq(calculatedThinWalletClone);
    });
  });
  describe("Update cause", () => {
    let updatedCauseRegistration: CauseUpdateRequest;
    beforeEach(async () => {
      await deploy("DonationsRouter", {
        from: deployer.address,
        log: false,
        args: [token.address, staking.address, alice.address, wallet.address],
      });

      router = await ethers.getContract("DonationsRouter");

      updatedCauseRegistration = {
        owner: bob.address,
        rewardPercentage: rewardPercentage,
      };
    });
    it("should revert if the cause doesn't exist", async () => {
      let causeID: BigNumber = ethers.BigNumber.from("1");
      await expect(
        router.updateCause(causeID, updatedCauseRegistration)
      ).to.be.revertedWith("invalid cause");
    });
    it("should revert if the caller isn't the cause owner", async () => {
      await router.registerCause(registrationRequest);
      const causeID = await router.causeId();
      await expect(
        router.connect(bob).updateCause(causeID, updatedCauseRegistration)
      ).to.be.revertedWith("not authorized");
    });
    it("should allow the cause owner to update the cause record", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      let cause: CauseRecord = await router.causeRecords(causeID);
      expect(cause.owner).to.be.equal(alice.address);

      await router
        .connect(platformOwner)
        .updateCause(causeID, updatedCauseRegistration);

      cause = await router.causeRecords(causeID);
      expect(cause.owner).to.be.equal(bob.address);
    });
    it("should validate the new cause owner", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();

      updatedCauseRegistration = {
        owner: address0,
        rewardPercentage: rewardPercentage,
      };
      await expect(
        router
          .connect(platformOwner)
          .updateCause(causeID, updatedCauseRegistration)
      ).to.be.revertedWith("invalid owner");
    });

    it("should emit an event", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      const tx = await router
        .connect(platformOwner)
        .updateCause(causeID, updatedCauseRegistration);

      const updatedCause: CauseRecord = await router.causeRecords(causeID);
      await expect(tx).to.emit(router, "UpdateCause").withArgs(updatedCause);
    });
  });
  describe("Calculate thin wallet address", () => {
    beforeEach(async () => {
      await deploy("DonationsRouter", {
        from: deployer.address,
        log: false,
        args: [token.address, staking.address, alice.address, wallet.address],
      });

      router = await ethers.getContract("DonationsRouter");
    });
    it("should return a valid ethereum address", async () => {
      const causeID: BigNumber = (await router.causeId()).add(1);
      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.toHexString(), 32),
      };
      const thinWalletClone: string = await router.calculateThinWallet(
        walletId
      );
      expect(ethers.utils.isAddress(thinWalletClone)).to.be.true;
    });
    it("should not revert even if the cause doesn't exist", async () => {
      expect(await router.causeId()).to.be.eq(0);
      const causeID: BigNumber = (await router.causeId()).add(1);

      const cause = await router.causeRecords(causeID);
      expect(cause.owner).to.equal(address0);
      expect(cause.defaultWallet).to.equal(address0);
      expect(cause.daoToken).to.equal(address0);
      expect(cause.rewardPercentage).to.equal(0);

      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.toHexString(), 32),
      };
      expect(ethers.utils.isAddress(await router.calculateThinWallet(walletId)))
        .to.be.true;
    });
  });
  describe("Register thin wallet", () => {
    let walletId: ThinWalletId;
    beforeEach(async () => {
      await deploy("DonationsRouter", {
        from: deployer.address,
        log: false,
        args: [token.address, staking.address, alice.address, wallet.address],
      });
      router = await ethers.getContract("DonationsRouter");
    });
    it("should revert if the cause doesn't exist", async () => {
      const causeID: BigNumber = (await router.causeId()).add(1);
      walletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.toHexString(), 32),
      };
      const owners = [bob.address];
      expect(router.registerThinWallet(walletId, owners)).to.be.revertedWith(
        "invalid cause"
      );
    });
    it("should revert if the caller isn't the cause owner", async () => {
      await router.registerCause(registrationRequest);

      const causeID: BigNumber = ethers.BigNumber.from("0");
      walletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.toHexString(), 32),
      };
      const owners = [bob.address];
      await expect(
        router.registerThinWallet(walletId, owners)
      ).to.be.revertedWith("unauthorized");
    });
    it("should deploy a clone if the caller is the cause owner", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();

      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.add(1).toHexString(), 32),
      };

      const newThinWalletClone = await router.calculateThinWallet(walletId);
      expect(await ethers.provider.getCode(newThinWalletClone)).to.eq("0x");

      const owners: string[] = [bob.address, jake.address];
      await router.connect(alice).registerThinWallet(walletId, owners);
      expect(await ethers.provider.getCode(newThinWalletClone)).to.not.eq("0x");
    });
    it("should save the clone address", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();

      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.add(1).toHexString(), 32),
      };

      const newThinWalletClone = await router.calculateThinWallet(walletId);
      const owners: string[] = [bob.address, jake.address];
      await router.connect(alice).registerThinWallet(walletId, owners);

      const encoded = abiCoder.encode(
        ["tuple(uint256, bytes)"],
        [[walletId.causeId, walletId.thinWalletId]]
      );
      const salt = ethers.utils.keccak256(encoded);
      const createdCloneAddress = await router.deployedWallets(salt);
      expect(createdCloneAddress).to.eq(newThinWalletClone);
    });
    it("should emit an event", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();

      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.add(1).toHexString(), 32),
      };

      const newThinWalletClone = await router.calculateThinWallet(walletId);
      const owners: string[] = [bob.address, jake.address];
      const tx = await router
        .connect(alice)
        .registerThinWallet(walletId, owners);
      await expect(tx)
        .to.emit(router, "RegisterWallet")
        .withArgs(newThinWalletClone, [
          walletId.causeId,
          walletId.thinWalletId,
        ]);
    });
    it("should fail if the wallet to register is already deployed", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();

      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.toHexString(), 32),
      };
      const owners: string[] = [bob.address, jake.address];
      expect(
        router.connect(alice).registerThinWallet(walletId, owners)
      ).to.be.revertedWith("already deployed");
    });
    it("should fail if there are no owners", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();

      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(
          causeID.add("1").toHexString(),
          32
        ),
      };
      const owners: string[] = [];
      expect(
        router.connect(alice).registerThinWallet(walletId, owners)
      ).to.be.revertedWith("invalid owners");
    });
  });
  describe("Withdraw from thin wallet", () => {
    let walletId: ThinWalletId;
    const exampleProposalId_1 =
      "0xf345990c2f726e43bd821ebe52a3f3dca1e35145c131d559fdfcdec52dd0bfc2";

    beforeEach(async () => {
      const result = await deploy("DonationsRouter", {
        from: deployer.address,
        log: false,
        args: [token.address, staking.address, alice.address, wallet.address],
      });
      router = await ethers.getContractAt("DonationsRouter", result.address);
    });
    it("should emit an event", async () => {
      // await router.registerCause(registrationRequest);

      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeID = walletId.causeId.toString();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: alice.address,
        amount: amountToWithdraw,
      };

      const tx = await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );
      await expect(tx)
        .to.emit(router, "WithdrawFromWallet")
        .withArgs(
          [walletId.causeId, walletId.thinWalletId],
          [
            withdrawalRequest.token,
            withdrawalRequest.recipient,
            withdrawalRequest.amount,
          ]
        );
    });
    it("should validate the input parameters", async () => {
      await router.registerCause(registrationRequest);
      const causeID = (await router.causeId()).add("1");
      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.toHexString(), 32),
      };

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: alice.address,
        amount: amountToWithdraw,
      };
      expect(
        router
          .connect(alice)
          .withdrawFromThinWallet(
            walletId,
            withdrawalRequest,
            exampleProposalId_1
          )
      ).to.be.revertedWith("invalid cause");
    });
    it("should revert if the caller isn't the cause owner", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeID: string = walletId.causeId.toString();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: alice.address,
        amount: amountToWithdraw,
      };
      expect(
        router
          .connect(bob)
          .withdrawFromThinWallet(
            walletId,
            withdrawalRequest,
            exampleProposalId_1
          )
      ).to.be.revertedWith("unauthorized");
    });
    it("should transfer platform fee to platform owner", async () => {
      expect(await token.balanceOf(platformOwner.address)).to.eq(0);
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeID: string = walletId.causeId.toString();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: bob.address,
        amount: amountToWithdraw,
      };

      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );

      const amountToGet: BigNumber = amountToWithdraw
        .mul(platformFee)
        .div(ethers.constants.WeiPerEther);
      const balanceOfOwner = await token.balanceOf(platformOwner.address);
      expect(balanceOfOwner).to.eq(amountToGet);
    });
    it("should transfer requested amount net of fees to the recipient", async () => {
      expect(await token.balanceOf(bob.address)).to.eq(0);
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const cause = returnConfig[1] as CauseRecord;
      const causeID: string = walletId.causeId.toString();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: bob.address,
        amount: amountToWithdraw,
      };

      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );

      const feeAmount: BigNumber = amountToWithdraw
        .mul(platformFee)
        .div(ethers.constants.WeiPerEther);
      const rewardAmount = amountToWithdraw
        .mul(cause.rewardPercentage)
        .div(ethers.constants.WeiPerEther);
      const amountToGet = amountToWithdraw.sub(feeAmount.add(rewardAmount));

      const balanceOfRecipient = await token.balanceOf(bob.address);
      expect(balanceOfRecipient).to.eq(amountToGet);
    });
    it("should distribute the reward fee to dao token stakers", async () => {
      expect(await token.balanceOf(staking.address)).to.eq(0);
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const cause = returnConfig[1] as CauseRecord;
      const causeID: string = walletId.causeId.toString();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: bob.address,
        amount: amountToWithdraw,
      };
      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );

      const rewardAmountToGet = amountToWithdraw
        .mul(cause.rewardPercentage)
        .div(ethers.constants.WeiPerEther);
      expect(await token.balanceOf(staking.address)).to.eq(rewardAmountToGet);
    });
    it("should calculate the platform fee correctly", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const initialPlatformOwnerTokenBalance = await token.balanceOf(
        alice.address
      );
      expect(initialPlatformOwnerTokenBalance).to.eq(0);
      const walletId = returnConfig[0] as ThinWalletId;
      const causeID: string = walletId.causeId.toString();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: bob.address,
        amount: amountToWithdraw,
      };
      platformFee = ethers.utils.parseEther("0.75");
      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );
      const platformFeeToReceive: BigNumber = amountToWithdraw
        .mul(platformFee)
        .div(ethers.constants.WeiPerEther);

      const platformOwnerTokenBalance = await token.balanceOf(
        platformOwner.address
      );
      const platformOwnerFeeReceived = platformOwnerTokenBalance.sub(
        initialPlatformOwnerTokenBalance
      );
      expect(platformOwnerFeeReceived).to.eq(platformFeeToReceive);
      expect(platformFee).to.eq(
        platformOwnerFeeReceived
          .mul(ethers.constants.WeiPerEther)
          .div(amountToWithdraw)
      );
    });
    it("should calculate the reward fee correctly", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const initialStakingTokenBalance = await token.balanceOf(staking.address);

      const walletId = returnConfig[0] as ThinWalletId;
      const cause = returnConfig[1] as CauseRecord;
      const causeID: string = walletId.causeId.toString();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: bob.address,
        amount: amountToWithdraw,
      };
      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );

      const expectedRewardFeeToReceive = amountToWithdraw
        .mul(cause.rewardPercentage)
        .div(ethers.constants.WeiPerEther);
      const stakingRewardsTokenBalance: BigNumber = await token.balanceOf(
        staking.address
      );
      const rewardFeeReceived: BigNumber = stakingRewardsTokenBalance.sub(
        initialStakingTokenBalance
      );
      expect(rewardFeeReceived).to.eq(expectedRewardFeeToReceive);
    });
    it("should not take fees for transfers not in the base token", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeID: string = walletId.causeId.toString();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);

      const thinWalletClone = returnConfig[2] as string;

      const initialThinWalletBalance = await token.balanceOf(thinWalletClone);
      const initialBobTokenBalance = await token.balanceOf(bob.address);
      expect(initialBobTokenBalance).to.be.eq(0);

      const amountToWithdrawWithoutFees = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: daoToken.address,
        recipient: bob.address,
        amount: amountToWithdrawWithoutFees,
      };

      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );

      expect(await token.balanceOf(bob.address)).to.be.eq(
        initialBobTokenBalance.add(amountToWithdrawWithoutFees)
      );
      expect(await token.balanceOf(thinWalletClone)).to.be.eq(
        initialThinWalletBalance.sub(amountToWithdrawWithoutFees)
      );
    });
    it("should deploy a thin wallet if one doesn't exist", async () => {
      const initialBobBalance = await token.balanceOf(bob.address);
      expect(initialBobBalance).to.eq(0);
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();

      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(
          causeID.add("1").toHexString(),
          32
        ),
      };
      await router
        .connect(alice)
        .addToQueue(walletId.causeId.toString(), exampleProposalId_1);

      const calculatedWalletAddress = await router.calculateThinWallet(
        walletId
      );
      expect(await ethers.provider.getCode(calculatedWalletAddress)).to.eq(
        "0x"
      );

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: daoToken.address,
        recipient: bob.address,
        amount: amountToWithdraw,
      };

      // Sending some tokens to router and wallet for testing
      const rewardTokenToSend = (await token.balanceOf(deployer.address)).div(
        2
      );
      await token.connect(deployer).transfer(router.address, rewardTokenToSend);
      await token
        .connect(deployer)
        .transfer(calculatedWalletAddress, rewardTokenToSend);
      await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );

      expect(await token.balanceOf(bob.address)).to.eq(
        initialBobBalance.add(amountToWithdraw)
      );
    });
    it("should emit an event if it deploys a thin wallet", async () => {
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      const walletId: ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(
          causeID.add("1").toHexString(),
          32
        ),
      };

      await router
        .connect(alice)
        .addToQueue(walletId.causeId.toString(), exampleProposalId_1);

      const calculatedWalletAddress = await router.calculateThinWallet(
        walletId
      );
      expect(await ethers.provider.getCode(calculatedWalletAddress)).to.eq(
        "0x"
      );

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: daoToken.address,
        recipient: bob.address,
        amount: amountToWithdraw,
      };

      // Sending some tokens to router and wallet for testing
      const rewardTokenToSend = (await token.balanceOf(deployer.address)).div(
        2
      );
      await token.connect(deployer).transfer(router.address, rewardTokenToSend);
      await token
        .connect(deployer)
        .transfer(calculatedWalletAddress, rewardTokenToSend);

      await router.connect(platformOwner).setPlatformFee(platformFee);
      const tx = await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );
      await expect(tx)
        .to.emit(router, "RegisterWallet")
        .withArgs(calculatedWalletAddress, [
          walletId.causeId,
          walletId.thinWalletId,
        ]);
    });
    it("should reuse an existing thin wallet if it's already deployed", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      await router
        .connect(alice)
        .addToQueue(walletId.causeId.toString(), exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: daoToken.address,
        recipient: bob.address,
        amount: amountToWithdraw,
      };
      await router.connect(platformOwner).setPlatformFee(platformFee);
      const tx = await router
        .connect(platformOwner)
        .withdrawFromThinWallet(
          walletId,
          withdrawalRequest,
          exampleProposalId_1
        );

      await expect(tx).to.not.emit(router, "RegisterWallet");
    });
  });

  describe.only("Facilitate queue", () => {
    const exampleProposalId_1 =
      "0xf345990c2f726e43bd821ebe52a3f3dca1e35145c131d559fdfcdec52dd0bfc2";
    const exampleProposalId_2 =
      "0xa32424082313a0624b80b1d199de5d047afc4170b0066be45d5796b7546e925b";
    beforeEach(async () => {
      await deploy("DonationsRouter", {
        from: deployer.address,
        log: false,
        args: [token.address, staking.address, alice.address, wallet.address],
      });

      router = await ethers.getContract("DonationsRouter");
    });

    it("should be able to withdraw funds when queue is head of queue", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeId = walletId.causeId.toString();

      await router.connect(alice).addToQueue(causeId, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: alice.address,
        amount: amountToWithdraw,
      };

      expect(
        router
          .connect(alice)
          .withdrawFromThinWallet(
            walletId,
            withdrawalRequest,
            exampleProposalId_1
          )
      ).to.not.be.reverted;
    });

    it("should not be able to withdraw funds when queue does not exist", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeId = walletId.causeId.toString();

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: alice.address,
        amount: amountToWithdraw,
      };
      expect(
        router
          .connect(alice)
          .withdrawFromThinWallet(
            walletId,
            withdrawalRequest,
            exampleProposalId_1
          )
      ).to.be.revertedWith("not head of queue");
    });
    it("should not be able to withdraw funds when queue is not head of queue", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeId = walletId.causeId.toString();

      await router.connect(alice).addToQueue(causeId, exampleProposalId_1);
      await router.connect(alice).addToQueue(causeId, exampleProposalId_2);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: alice.address,
        amount: amountToWithdraw,
      };

      expect(
        router
          .connect(alice)
          .withdrawFromThinWallet(
            walletId,
            withdrawalRequest,
            exampleProposalId_2
          )
      ).to.be.revertedWith("not head of queue");
    });
    it("should validate proposal id when adding to queue", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeId = walletId.causeId.toString();

      const invalidProposalId: string = ethers.constants.HashZero;
      expect(
        router.connect(alice).addToQueue(causeId, invalidProposalId)
      ).to.be.revertedWith("invalid proposal id");
    });
    it("should validate proposal id when withdrawing funds", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeId = walletId.causeId.toString();

      const invalidProposalId: string = ethers.constants.HashZero;
      await router.connect(alice).addToQueue(causeId, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: alice.address,
        amount: amountToWithdraw,
      };
      expect(
        router
          .connect(alice)
          .withdrawFromThinWallet(
            walletId,
            withdrawalRequest,
            invalidProposalId
          )
      ).to.be.revertedWith("invalid proposal id");
    });
    it("should fail when user enqueuing is not owner", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeId = walletId.causeId.toString();

      const nonOwner: SignerWithAddress = bob;
      expect(
        router.connect(nonOwner).addToQueue(causeId, exampleProposalId_1)
      ).to.be.revertedWith("unauthorized");
    });

    it("should fail when caller is not cause owner when removing from queue", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeId = walletId.causeId.toString();

      const nonOwner: SignerWithAddress = bob;
      await router.connect(alice).addToQueue(causeId, exampleProposalId_1);

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest: WithdrawalRequest = {
        token: token.address,
        recipient: alice.address,
        amount: amountToWithdraw,
      };

      expect(
        router
          .connect(nonOwner)
          .withdrawFromThinWallet(
            walletId,
            withdrawalRequest,
            exampleProposalId_1
          )
      ).to.be.revertedWith("unauthorized");
    });

    it("should remove an item from an arbitrary location in the queue", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeId = walletId.causeId.toString();

      for (let i = 0; i < 5; i++) {
        await router.connect(alice).addToQueue(causeId, exampleProposalId_1);
      }

      const headOfQueue = await router.getFirstInQueue(causeId);
      const tailOfQueue = await router.getLastInQueue(causeId);
      const middleOfQueueToRemove = headOfQueue.add(tailOfQueue).div(2);

      await router
        .connect(alice)
        .removeFromQueue(causeId, exampleProposalId_1, middleOfQueueToRemove);

      const queueAtIndex = await router.getQueueAtIndex(
        causeId,
        middleOfQueueToRemove
      );
      const { next, previous, id, isUnclaimed }: QueueItem = queueAtIndex;
      expect(next).to.eq(BigNumber.from("0"));
      expect(previous).to.eq(BigNumber.from("0"));
      expect(id).to.eq(ethers.constants.HashZero);
      expect(isUnclaimed).to.eq(false);
    });

    it("should add an item to the front of the queue if the queue was empty", async () => {
      const returnConfig = await setUpRegistration(
        router,
        registrationRequest,
        deployer,
        token
      );
      const walletId = returnConfig[0] as ThinWalletId;
      const causeId = walletId.causeId.toString();

      let currentHead = await router.getFirstInQueue(causeId);
      let currentTail = await router.getLastInQueue(causeId);

      expect(currentHead).to.eq(0);
      expect(currentTail).to.eq(0);

      await router.connect(alice).addToQueue(causeId, exampleProposalId_1);

      currentHead = await router.getFirstInQueue(causeId);
      currentTail = await router.getLastInQueue(causeId);

      expect(currentHead).to.eq(1);
      expect(currentTail).to.eq(1);
    });

    it("should only add items to the calling cause's queue in multiple queues", async () => {
      const registrationRequest = {
        owner: alice.address,
        rewardPercentage: rewardPercentage,
        daoToken: daoToken.address,
      };
      const registrationRequest2 = {
        owner: bob.address,
        rewardPercentage: rewardPercentage,
        daoToken: daoToken.address,
      };
      await router.registerCause(registrationRequest);
      const firstCauseID: BigNumber = await router.causeId();
      for (let i = 0; i < 100; i++) {
        await router
          .connect(alice)
          .addToQueue(firstCauseID, exampleProposalId_1);
      }
      const firstCauseQueueTail = await router.getLastInQueue(firstCauseID);
      expect(firstCauseQueueTail).to.eq(100);

      await router.registerCause(registrationRequest2);
      const secondCauseID: BigNumber = await router.causeId();
      for (let i = 0; i < 50; i++) {
        await router
          .connect(bob)
          .addToQueue(secondCauseID, exampleProposalId_2);
      }
      const secondCauseQueueTail = await router.getLastInQueue(secondCauseID);
      expect(secondCauseQueueTail).to.eq(50);
    });
    it("should fail if a non cause owner attempts to remove from queue", async () => {
      const registrationRequest = {
        owner: alice.address,
        rewardPercentage: rewardPercentage,
        daoToken: daoToken.address,
      };
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);
      const indexToRemove = await router.getFirstInQueue(causeID);

      expect(
        router
          .connect(bob)
          .removeFromQueue(causeID, exampleProposalId_1, indexToRemove)
      ).to.be.revertedWith("unauthorized");
    });
    it("should fail if queue to remove has id that does not match", async () => {
      const registrationRequest = {
        owner: alice.address,
        rewardPercentage: rewardPercentage,
        daoToken: daoToken.address,
      };
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_2);
      const indexToRemove = await router.getFirstInQueue(causeID);

      expect(
        router
          .connect(alice)
          .removeFromQueue(causeID, exampleProposalId_1, indexToRemove)
      ).to.be.revertedWith("id does not match index item");
    });
    it("should check the queue item's queue id is correct", async() => {
      const registrationRequest = {
        owner: alice.address,
        rewardPercentage: rewardPercentage,
        daoToken: daoToken.address
      };
      await router.registerCause(registrationRequest);
      const causeID: BigNumber = await router.causeId();
      await router.connect(alice).addToQueue(causeID, exampleProposalId_1);

      await router.connect(alice).addToQueue(causeID, exampleProposalId_2);

      const firstIndex = await router.getFirstInQueue(causeID);
      const firstQueue = await router.getQueueAtIndex(causeID, firstIndex);
      const firstQueueId = firstQueue.id;

      const secondIndex = firstQueue.next;
      const secondQueue = await router.getQueueAtIndex(causeID, secondIndex);
      const secondQueueId = secondQueue.id;

      expect(firstQueueId).to.eq(
        ethers.utils.keccak256(
          abiCoder.encode(
            ["uint256", "bytes32"],
            [causeID.toString(), exampleProposalId_1]
          )
        )
      );
      expect(secondQueueId).to.eq(
        ethers.utils.keccak256(
          abiCoder.encode(
            ["uint256", "bytes32"],
            [causeID.toString(), exampleProposalId_2]
          )
        )
      );
      
      expect(firstQueueId).to.not.eq(secondQueueId);
    });
  });
  describe("Set platform fee", () => {
    beforeEach(async () => {
      await deploy("DonationsRouter", {
        from: deployer.address,
        log: false,
        args: [token.address, staking.address, alice.address, wallet.address],
      });

      router = await ethers.getContract("DonationsRouter");
    });
    it("should allow the platform owner to set a new fee", async () => {
      const currentPlatformFee = await router.platformFee();
      expect(currentPlatformFee).to.eq(0);

      await router.connect(platformOwner).setPlatformFee(platformFee);
      const updatedPlatformFee = await router.platformFee();
      expect(updatedPlatformFee).to.eq(platformFee);
    });
    it("should revert if the caller isn't the platform owner", async () => {
      const expectedErrMsg = "Ownable: caller is not the owner";
      expect(
        router.connect(bob).setPlatformFee(platformFee)
      ).to.be.revertedWith(expectedErrMsg);
    });
  });
});
