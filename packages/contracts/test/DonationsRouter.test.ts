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

import { setUpRegistration } from "../helpers/setUpTestDonationRouterRegistration";

const { deploy } = deployments;

interface CauseRegistrationRequest {
  owner: string;
  rewardPercentage: BigNumber;
  daoToken: string;
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
  thinWalletId : string;
}

describe("Donations Router", () => {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    jake: SignerWithAddress;
  let platformOwner : SignerWithAddress,
    ownerOfCause : SignerWithAddress;
  let token: ERC20, 
    router: IDonationsRouter, 
    staking: StakingRewards, 
    wallet: ThinWallet,
    daoToken : ERC20;
  const donationAmount : BigNumber= ethers.utils.parseEther("100");
  let platformFee : BigNumber= ethers.utils.parseEther("0.03");
  let rewardPercentage : BigNumber = BigNumber.from((10 ** 16).toString()); // 1%
  let expectedErrMsg : string = "";
  const address0 : string = ethers.constants.AddressZero;
  let registrationRequest : CauseRegistrationRequest;
  const abiCoder : AbiCoder = ethers.utils.defaultAbiCoder;

  beforeEach(async () => {
    [deployer, alice, bob, jake] = await ethers.getSigners();
    await deployments.fixture(["_EarthToken", "_StakingRewards", "_ThinWallet"]);

    token = await ethers.getContract("EarthToken");
    staking = await ethers.getContract("StakingRewards");
    wallet = await ethers.getContract("ThinWallet");

    await deploy ("DAOToken", {
      from: alice.address,
      log: false,
      args : [
        ethers.utils.parseEther("1000000")
      ]
    });

    daoToken = await ethers.getContract("DAOToken");

    platformOwner = alice;
    ownerOfCause = alice;
    registrationRequest = {
      owner : platformOwner.address,
      rewardPercentage : rewardPercentage,
      daoToken : daoToken.address
    };
  });
  describe("Constructor", () => {
    it("should transfer ownership from the deployer to the address in the owner parameter", async () => {
      await deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          alice.address,
          wallet.address,
        ]
      });

      router = await ethers.getContract("DonationsRouter");

      expectedErrMsg = "Ownable: caller is not the owner";
      await expect (router.connect(deployer).setPlatformFee(platformFee)).to.be.revertedWith(expectedErrMsg);
      await expect (router.connect(platformOwner).setPlatformFee(platformFee));
    });

    it("should validate the base token address", async () => {
      expectedErrMsg = "invalid base token";
      await expect (deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          address0,
          staking.address,
          alice.address,
          wallet.address,
        ]
      })).to.be.revertedWith(expectedErrMsg);
    });

    it("should validate the staking contract address", async () => {
      expectedErrMsg = "invalid staking contract";
      await expect (deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          address0,
          alice.address,
          wallet.address,
        ]
      })).to.be.revertedWith(expectedErrMsg);
    });
    it("should validate the owner address ", async () => {
      expectedErrMsg = "invalid owner";
      await expect (deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          address0,
          wallet.address,
        ]
      })).to.be.revertedWith(expectedErrMsg);
    });
    it("should validate the wallet implementation address", async () => {
      expectedErrMsg = "invalid implementation";
      await expect (deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          alice.address,
          address0,
        ]
      })).to.be.revertedWith(expectedErrMsg);
    });
  });
  describe("Donations", () => {
    beforeEach(async () => {
      await deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          alice.address,
          wallet.address,
        ]
      });
      router = await ethers.getContract("DonationsRouter");
    });
    it("should allow users to donate to a thin wallet that hasn't been deployed", async () => {
      const causeID : BigNumber = ethers.BigNumber.from("1");
      
      const walletId : ThinWalletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.toHexString(), 32)
      }
      const thinWalletClone : string = await router.calculateThinWallet(walletId);

      const codePromise = await ethers.provider.getCode(thinWalletClone);
      expect(codePromise.length).to.be.eq(2);

      const amountToTransfer : BigNumber = ethers.utils.parseEther("100"); 
      expect(await daoToken.connect(platformOwner).transfer(thinWalletClone, amountToTransfer));
    
    });
    it("should be able to receive ERC20 token donations", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      const cause : CauseRecord = await router.causeRecords(causeID);

      const thinWalletClone = cause.defaultWallet;
      expect((await daoToken.balanceOf(thinWalletClone))).to.be.eq(0);
      
      const amountToTransfer : BigNumber = ethers.utils.parseEther("100"); 
      await daoToken.connect(platformOwner).transfer(thinWalletClone, amountToTransfer);

      expect((await daoToken.balanceOf(thinWalletClone))).to.be.eq(amountToTransfer);
    });
    it("should be able to receive ether donations", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      const cause : CauseRecord = await router.causeRecords(causeID);

      const thinWalletClone = cause.defaultWallet;
      expect (await ethers.provider.getBalance(thinWalletClone)).to.be.eq(0);
      const amountToTransfer : BigNumber = ethers.utils.parseEther("100"); 
      expect(await alice.sendTransaction({
        to: thinWalletClone,
        value: amountToTransfer
      }));
      expect (await ethers.provider.getBalance(thinWalletClone)).to.be.eq(amountToTransfer);
    });
    it("should receive donations after a thin wallet has been deployed", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      const cause : CauseRecord = await router.causeRecords(causeID);
      const thinWalletClone = cause.defaultWallet;

      const codePromise = await ethers.provider.getCode(thinWalletClone);
      expect(codePromise.length).to.be.gt(2);

      expect((await daoToken.balanceOf(thinWalletClone))).to.be.eq(0);
      const amountToTransfer : BigNumber = ethers.utils.parseEther("100"); 
      await daoToken.connect(platformOwner).transfer(thinWalletClone, amountToTransfer);
      expect(await daoToken.balanceOf(thinWalletClone)).to.be.eq(amountToTransfer);
    });
  });
  describe("Register cause", () => {
    beforeEach(async () => {
      await deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          alice.address,
          wallet.address,
        ]
      });

      router = await ethers.getContract("DonationsRouter");
    });
    it("should assign an ID of 1 to the first cause registered", async () => {
      expect (await router.causeId()).to.be.eq(0);
      await router.registerCause(registrationRequest);

      const causeID : BigNumber = await router.causeId();
      expect(causeID).to.be.eq(1);
    });

    it("should increment the cause id", async () => {
      expect (await router.causeId()).to.be.eq(0);
      await router.registerCause(registrationRequest);
      const initialCauseID : BigNumber = await router.causeId();
      
      await router.registerCause(registrationRequest);
      const newCauseID : BigNumber = await router.causeId();
      expect(newCauseID).to.be.gt(initialCauseID);
      expect(newCauseID).to.be.eq(initialCauseID.add(1));
    });

    it("should validate the cause owner address", async () => {
      expect (await router.causeId()).to.be.eq(0);
      const registrationRequest : CauseRegistrationRequest = {
        owner : address0,
        rewardPercentage : rewardPercentage,
        daoToken : daoToken.address
      }

      expectedErrMsg = "invalid owner";
      await expect(router.registerCause(registrationRequest)).to.be.revertedWith(expectedErrMsg);      
    });

    it("should validate the dao token address", async () => {
      expect (await router.causeId()).to.be.eq(0);
      const registrationRequest : CauseRegistrationRequest = {
        owner : alice.address,
        rewardPercentage : rewardPercentage,
        daoToken : address0
      }
      expectedErrMsg = "invalid token"
      await expect(router.registerCause(registrationRequest)).to.be.revertedWith(expectedErrMsg);
    });

    it("should save a record for the new cause", async () => {
      expect (await router.causeId()).to.be.eq(0);

      const causeIdToGet : string = "1";
      let cause : CauseRecord = await router.causeRecords(causeIdToGet);
      expect (cause.owner).to.be.eq(address0);
      expect (cause.rewardPercentage).to.be.eq(address0);
      expect (cause.daoToken).to.be.eq(address0);

      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      expect(causeID).to.be.eq(causeIdToGet);

      cause = await router.causeRecords(causeID);
      expect (cause.owner).to.be.eq(registrationRequest.owner);
      expect (cause.rewardPercentage).to.be.eq(registrationRequest.rewardPercentage);
      expect (cause.daoToken).to.be.eq(registrationRequest.daoToken);
    });

    it("should allow multiple causes to register with the same dao token", async () => {
      expect (await router.causeId()).to.be.eq(0);
      const amountOfRegistrations = 10;
      for (let i = 0 ; i < amountOfRegistrations; i++){
        await router.registerCause(registrationRequest);
      }

      const causeID : BigNumber = await router.causeId();
      expect(causeID).to.be.eq(amountOfRegistrations);
      
      const cause : CauseRecord = await router.causeRecords(causeID);
      expect (cause.owner).to.be.eq(registrationRequest.owner);
      expect (cause.rewardPercentage).to.be.eq(registrationRequest.rewardPercentage);
      expect (cause.daoToken).to.be.eq(registrationRequest.daoToken);
    });
    it("should emit an event", async () => {
      expect (await router.causeId()).to.be.eq(0);
      const tx = await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      const cause : CauseRecord = await router.causeRecords(causeID);
      await expect (tx).to.emit(router, "RegisterCause").withArgs(cause);
    });
    it("should deploy a clone thin wallet for the default cause wallet", async () => {
      expect (await router.causeId()).to.be.eq(0);
      let causeID : BigNumber = ethers.BigNumber.from("1");
      const walletId : ThinWalletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.toHexString(), 32)
      }
      const calculatedThinWalletClone : string = await router.calculateThinWallet(walletId);
      let codePromise = await ethers.provider.getCode(calculatedThinWalletClone);
      expect(codePromise).to.be.eq("0x");

      await router.registerCause(registrationRequest);
      causeID = await router.causeId();
      const cause : CauseRecord = await router.causeRecords(causeID);
      const thinWalletClone : string = cause.defaultWallet;
      expect(thinWalletClone).to.be.eq(calculatedThinWalletClone);

      codePromise = await ethers.provider.getCode(thinWalletClone);
      expect(codePromise).to.not.eq("0x");
    
      const encoded = abiCoder.encode(["tuple(uint256, bytes)"],[[walletId.causeId, walletId.thinWalletId]])
      const salt = ethers.utils.keccak256(encoded);
      const deployedWalletAddress = await router.deployedWallets(salt);
      expect(deployedWalletAddress).to.be.eq(calculatedThinWalletClone);
    });
  });
  describe("Update cause", () => {
    let updatedCauseRegistration : CauseRegistrationRequest;
    beforeEach(async () => {
      await deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          alice.address,
          wallet.address,
        ]
      });

      router = await ethers.getContract("DonationsRouter");

      updatedCauseRegistration = {
        owner: bob.address,
        rewardPercentage : rewardPercentage,
        daoToken: daoToken.address
      } 
    });
    it("should revert if the cause doesn't exist", async () => {
      let causeID : BigNumber = ethers.BigNumber.from("1");
      await expect(router.updateCause(causeID, updatedCauseRegistration)).to.be.revertedWith("invalid cause");
    });
    it("should revert if the caller isn't the cause owner", async () => {
      await router.registerCause(registrationRequest);
      const causeID = await router.causeId();
      await expect(router.connect(bob).updateCause(causeID, updatedCauseRegistration)).to.be.revertedWith("not authorized");
    });
    it("should allow the cause owner to update the cause record", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      let cause : CauseRecord = await router.causeRecords(causeID);
      expect(cause.owner).to.be.equal(alice.address);

      expect(await router.connect(platformOwner).updateCause(causeID, updatedCauseRegistration));

      cause = await router.causeRecords(causeID);
      expect(cause.owner).to.be.equal(bob.address);
    });
    it("should validate the new cause owner", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();

      updatedCauseRegistration = {
        owner: address0,
        rewardPercentage : rewardPercentage,
        daoToken: daoToken.address
      } 
      await expect(router.connect(platformOwner).updateCause(causeID, updatedCauseRegistration)).to.be.revertedWith("invalid owner");
    });
    it("should validate the new cause token", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();

      updatedCauseRegistration = {
        owner: bob.address,
        rewardPercentage : rewardPercentage,
        daoToken: address0
      } 
      await expect(router.connect(platformOwner).updateCause(causeID, updatedCauseRegistration)).to.be.revertedWith("invalid token");
    });
    it("should emit an event", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      const tx = await router.connect(platformOwner).updateCause(causeID, updatedCauseRegistration);

      const updatedCause : CauseRecord = await router.causeRecords(causeID);
      await expect (tx).to.emit(router, "UpdateCause").withArgs(updatedCause);
    });
    it("should update the allowance of a new cause token", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      updatedCauseRegistration = {
        owner: bob.address,
        rewardPercentage : rewardPercentage,
        daoToken: token.address
      } 
      const initialAllowance = await token.allowance(router.address, staking.address);
      await router.connect(platformOwner).updateCause(causeID, updatedCauseRegistration);

      const newAllowance = await token.allowance(router.address, staking.address);
      expect(newAllowance).to.be.gt(initialAllowance);
    })
  });
  describe("Calculate thin wallet address", () => {
    beforeEach(async () => {
      await deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          alice.address,
          wallet.address,
        ]
      });

      router = await ethers.getContract("DonationsRouter");
    });
    it("should return a valid ethereum address", async () => {
      const causeID : BigNumber = (await router.causeId()).add(1);
      const walletId : ThinWalletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.toHexString(), 32)
      }
      const thinWalletClone : string = await router.calculateThinWallet(walletId);
      expect(ethers.utils.isAddress(thinWalletClone)).to.be.true;
    });
    it("should not revert even if the cause doesn't exist", async () => {
      expect(await router.causeId()).to.be.eq(0);
      const causeID : BigNumber = (await router.causeId()).add(1);

      const cause = await router.causeRecords(causeID);
      expect(cause.owner).to.equal(address0);
      expect(cause.defaultWallet).to.equal(address0);
      expect(cause.daoToken).to.equal(address0);
      expect(cause.rewardPercentage).to.equal(0);

      const walletId : ThinWalletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.toHexString(), 32)
      }
      expect(await router.calculateThinWallet(walletId));
    });
  });
  describe("Register thin wallet", () => {
    let walletId : ThinWalletId
    beforeEach(async () => {
      await deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          alice.address,
          wallet.address,
        ]
      });
      router = await ethers.getContract("DonationsRouter");
    });
    it("should revert if the cause doesn't exist", async () => {
      const causeID : BigNumber = (await router.causeId()).add(1);
      walletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.toHexString(), 32)
      }
      const owners = [bob.address];
      expect(router.registerThinWallet(walletId, owners)).to.be.revertedWith("invalid cause");
    });
    it("should revert if the caller isn't the cause owner", async () => {
      await router.registerCause(registrationRequest);

      const causeID : BigNumber = ethers.BigNumber.from("0");
      walletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.toHexString(), 32)
      }
      const owners = [bob.address];
      await expect(router.registerThinWallet(walletId, owners)).to.be.revertedWith("unauthorized");
    });
    it("should deploy a clone if the caller is the cause owner", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();

      const walletId : ThinWalletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.add(1).toHexString(), 32)
      }

      const newThinWalletClone = await router.calculateThinWallet(walletId);
      expect(await ethers.provider.getCode(newThinWalletClone)).to.eq("0x");

      const owners : string[] = [bob.address, jake.address];
      await router.connect(alice).registerThinWallet(walletId, owners);
      expect(await ethers.provider.getCode(newThinWalletClone)).to.not.eq("0x");
    });
    it("should save the clone address", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();

      const walletId : ThinWalletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.add(1).toHexString(), 32)
      }

      const newThinWalletClone = await router.calculateThinWallet(walletId);
      const owners : string[] = [bob.address, jake.address];
      await router.connect(alice).registerThinWallet(walletId, owners);

      const encoded = abiCoder.encode(["tuple(uint256, bytes)"],[[walletId.causeId, walletId.thinWalletId]])
      const salt = ethers.utils.keccak256(encoded);
      const createdCloneAddress = await router.deployedWallets(salt);
      expect(createdCloneAddress).to.eq(newThinWalletClone);
    });
    it("should emit an event", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();

      const walletId : ThinWalletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.add(1).toHexString(), 32)
      }

      const newThinWalletClone = await router.calculateThinWallet(walletId);
      const owners : string[] = [bob.address, jake.address];
      const tx = await router.connect(alice).registerThinWallet(walletId, owners);
      await expect (tx).to.emit(router, "RegisterWallet").withArgs(newThinWalletClone, [walletId.causeId, walletId.thinWalletId])
    });
    it("should fail if the wallet to register is already deployed", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();

      const walletId : ThinWalletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.toHexString(), 32)
      }
      const owners : string[] = [bob.address, jake.address];
      expect(router.connect(alice).registerThinWallet(walletId, owners)).to.be.revertedWith("already deployed");
    });
    it("should fail if there are no owners", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();

      const walletId : ThinWalletId = {
        causeId : causeID,
        thinWalletId : ethers.utils.hexZeroPad(causeID.add("1").toHexString(), 32)
      }
      const owners : string[] = [];
      expect(router.connect(alice).registerThinWallet(walletId, owners)).to.be.revertedWith("invalid owners");
    })
  });
  describe("Withdraw from thin wallet", () => {
    let walletId : ThinWalletId
    beforeEach(async () => {
      await deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          alice.address,
          wallet.address,
        ]
      });
      router = await ethers.getContract("DonationsRouter");
    });
    it("should emit an event", async () => {
      await router.registerCause(registrationRequest);

      const returnConfig = await setUpRegistration(router, registrationRequest, deployer, token);
      const walletId = returnConfig[0] as ThinWalletId;

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: token.address,
        recipient: alice.address,
        amount : amountToWithdraw
      }
      const tx = await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);    
      await expect (tx).to.emit(router, "WithdrawFromWallet").withArgs(
        [
          walletId.causeId,
          walletId.thinWalletId
        ], 
        [
          withdrawalRequest.token,
          withdrawalRequest.recipient,
          withdrawalRequest.amount
        ]
      );
    });
    it("should validate the input parameters", async () => {
      await router.registerCause(registrationRequest);
      const causeID = (await router.causeId()).add("1");
      const walletId : ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.toHexString(), 32)
      }
      
      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: token.address,
        recipient: alice.address,
        amount : amountToWithdraw
      }
      expect(router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest)).to.be.revertedWith("invalid cause");
    });
    it("should revert if the caller isn't the cause owner", async () => {
      const returnConfig = await setUpRegistration(router, registrationRequest, deployer, token);
      const walletId = returnConfig[0] as ThinWalletId;

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: token.address,
        recipient: alice.address,
        amount : amountToWithdraw
      }
      expect(router.connect(bob).withdrawFromThinWallet(walletId, withdrawalRequest)).to.be.revertedWith("unauthorized");
    });
    it("should transfer platform fee to platform owner", async () => {
      expect(await token.balanceOf(platformOwner.address)).to.eq(0);
      const returnConfig = await setUpRegistration(router, registrationRequest, deployer, token);
      const walletId = returnConfig[0] as ThinWalletId;

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: token.address,
        recipient: bob.address,
        amount : amountToWithdraw
      }

      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);
      
      const amountToGet : BigNumber = amountToWithdraw.mul(platformFee).div(ethers.constants.WeiPerEther);
      const balanceOfOwner = await token.balanceOf(platformOwner.address); 
      expect(balanceOfOwner).to.eq(amountToGet);
    });
    it("should transfer requested amount net of fees to the recipient", async () => {
      expect(await token.balanceOf(bob.address)).to.eq(0);
      const returnConfig = await setUpRegistration(router, registrationRequest, deployer, token);
      const walletId = returnConfig[0] as ThinWalletId;
      const cause = returnConfig[1] as CauseRecord;

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: token.address,
        recipient: bob.address,
        amount : amountToWithdraw
      }

      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);

      const feeAmount : BigNumber = amountToWithdraw.mul(platformFee).div(ethers.constants.WeiPerEther);
      const rewardAmount = amountToWithdraw.mul(cause.rewardPercentage).div(ethers.constants.WeiPerEther);
      const amountToGet = amountToWithdraw.sub(feeAmount.add(rewardAmount));

      const balanceOfRecipient = await token.balanceOf(bob.address); 
      expect(balanceOfRecipient).to.eq(amountToGet);
    });
    it("should distribute the reward fee to dao token stakers", async () => {
      expect(await token.balanceOf(staking.address)).to.eq(0);
      const returnConfig = await setUpRegistration(router, registrationRequest, deployer, token);
      const walletId = returnConfig[0] as ThinWalletId;
      const cause = returnConfig[1] as CauseRecord;

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: token.address,
        recipient: bob.address,
        amount : amountToWithdraw
      }
      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);

      const rewardAmountToGet = amountToWithdraw.mul(cause.rewardPercentage).div(ethers.constants.WeiPerEther);
      expect(await token.balanceOf(staking.address)).to.eq(rewardAmountToGet);
    });
    it("should calculate the platform fee correctly", async () => {
      const returnConfig = await setUpRegistration(router, registrationRequest, deployer, token);
      const initialPlatformOwnerTokenBalance = await token.balanceOf(alice.address);
      expect(initialPlatformOwnerTokenBalance).to.eq(0);
      const walletId = returnConfig[0] as ThinWalletId;

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: token.address,
        recipient: bob.address,
        amount : amountToWithdraw
      }
      platformFee = ethers.utils.parseEther("0.75");
      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);    
      const platformFeeToReceive : BigNumber = amountToWithdraw.mul(platformFee).div(ethers.constants.WeiPerEther);

      const platformOwnerTokenBalance = await token.balanceOf(platformOwner.address);
      const platformOwnerFeeReceived = platformOwnerTokenBalance.sub(initialPlatformOwnerTokenBalance);
      expect(platformOwnerFeeReceived).to.eq(platformFeeToReceive);
      expect(platformFee).to.eq(platformOwnerFeeReceived.mul(ethers.constants.WeiPerEther).div(amountToWithdraw));
    });
    it("should calculate the reward fee correctly", async () => {
      const returnConfig = await setUpRegistration(router, registrationRequest, deployer, token);
      const initialStakingTokenBalance = await token.balanceOf(staking.address);

      const walletId = returnConfig[0] as ThinWalletId;
      const cause = returnConfig[1] as CauseRecord;
      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: token.address,
        recipient: bob.address,
        amount : amountToWithdraw
      }
      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);
      
      const expectedRewardFeeToReceive = amountToWithdraw.mul(cause.rewardPercentage).div(ethers.constants.WeiPerEther);
      const stakingRewardsTokenBalance : BigNumber= await token.balanceOf(staking.address);
      const rewardFeeReceived : BigNumber = stakingRewardsTokenBalance.sub(initialStakingTokenBalance);
      expect(rewardFeeReceived).to.eq(expectedRewardFeeToReceive);
    });
    it("should not take fees for transfers not in the base token", async () => {
      const returnConfig = await setUpRegistration(router, registrationRequest, deployer, token);
      const walletId = returnConfig[0] as ThinWalletId;
      const thinWalletClone = returnConfig[2] as string;

      const initialThinWalletBalance = await token.balanceOf(thinWalletClone);
      const initialBobTokenBalance = await token.balanceOf(bob.address);
      expect(initialBobTokenBalance).to.be.eq(0);
      
      const amountToWithdrawWithoutFees = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: daoToken.address,
        recipient: bob.address,
        amount : amountToWithdrawWithoutFees
      }

      await router.connect(platformOwner).setPlatformFee(platformFee);
      await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);

      expect (await token.balanceOf(bob.address)).to.be.eq(initialBobTokenBalance.add(amountToWithdrawWithoutFees));
      expect (await token.balanceOf(thinWalletClone)).to.be.eq(initialThinWalletBalance.sub(amountToWithdrawWithoutFees));
    });
    it("should deploy a thin wallet if one doesn't exist", async () => {
      const initialBobBalance = await token.balanceOf(bob.address);
      expect(initialBobBalance).to.eq(0);
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      const walletId : ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.add("1").toHexString(), 32)
      }

      const calculatedWalletAddress = await router.calculateThinWallet(walletId);
      expect(await ethers.provider.getCode(calculatedWalletAddress)).to.eq("0x");

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: daoToken.address,
        recipient: bob.address,
        amount : amountToWithdraw
      }

      // Sending some tokens to router and wallet for testing
      const rewardTokenToSend = (await token.balanceOf(deployer.address)).div(2);
      await token.connect(deployer).transfer(router.address, rewardTokenToSend);
      await token.connect(deployer).transfer(calculatedWalletAddress, rewardTokenToSend);
      await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);

      expect(await token.balanceOf(bob.address)).to.eq(initialBobBalance.add(amountToWithdraw));
    });
    it("should emit an event if it deploys a thin wallet", async () => {
      await router.registerCause(registrationRequest);
      const causeID : BigNumber = await router.causeId();
      const walletId : ThinWalletId = {
        causeId: causeID,
        thinWalletId: ethers.utils.hexZeroPad(causeID.add("1").toHexString(), 32)
      }

      const calculatedWalletAddress = await router.calculateThinWallet(walletId);
      expect(await ethers.provider.getCode(calculatedWalletAddress)).to.eq("0x");

      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: daoToken.address,
        recipient: bob.address,
        amount : amountToWithdraw
      }

      // Sending some tokens to router and wallet for testing
      const rewardTokenToSend = (await token.balanceOf(deployer.address)).div(2);
      await token.connect(deployer).transfer(router.address, rewardTokenToSend);
      await token.connect(deployer).transfer(calculatedWalletAddress, rewardTokenToSend);
      
      await router.connect(platformOwner).setPlatformFee(platformFee);
      const tx = await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);
      await expect (tx).to.emit(router, "RegisterWallet").withArgs(calculatedWalletAddress, [walletId.causeId, walletId.thinWalletId]);
    });
    it("should reuse an existing thin wallet if it's already deployed", async () => {
      const returnConfig = await setUpRegistration(router, registrationRequest, deployer, token);
      const walletId = returnConfig[0] as ThinWalletId;
      const amountToWithdraw = ethers.utils.parseEther("100");
      const withdrawalRequest : WithdrawalRequest= {
        token: daoToken.address,
        recipient: bob.address,
        amount : amountToWithdraw
      }
      await router.connect(platformOwner).setPlatformFee(platformFee);
      const tx = await router.connect(platformOwner).withdrawFromThinWallet(walletId, withdrawalRequest);

      await expect (tx).to.not.emit(router, "RegisterWallet");
    });
  });
  describe("Set platform fee", () => {
    beforeEach(async () => {
      await deploy ("DonationsRouter", {
        from : deployer.address,
        log: false,
        args: [
          token.address,
          staking.address,
          alice.address,
          wallet.address,
        ]
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
      expectedErrMsg = "Ownable: caller is not the owner"
      expect(router.connect(bob).setPlatformFee(platformFee)).to.be.revertedWith(expectedErrMsg);
    });
  });
});