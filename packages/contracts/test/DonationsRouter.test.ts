import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { deployments, ethers } from "hardhat";

import { solidity } from "ethereum-waffle";

import {
  DonationsRouter__factory,
  ERC20,
  IDonationsRouter,
  TestStaking,
} from "../typechain-types";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

describe("Donations Router", () => {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress;
  let token: ERC20, router: IDonationsRouter, staking: TestStaking;
  const donationAmount = ethers.utils.parseEther("100");
  /**
   * Deployer == Platform Owner
   * Alice == Donor
   * Bob == DAO Safe
   */
  before(async () => {
    [deployer, alice, bob] = await ethers.getSigners();
  });
  describe("Constructor", () => {
    let factory: DonationsRouter__factory;
    before(async () => {
      factory = await ethers.getContractFactory("DonationsRouter");
    });
    it("should revert if owner is invalid", async () => {
      await expect(
        factory.deploy(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero,
          0,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        )
      ).to.be.rejectedWith("invalid owner");
    });
    it("should revert if registrar is invalid", async () => {
      await expect(
        factory.deploy(
          deployer.address,
          ethers.constants.AddressZero,
          0,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        )
      ).to.be.rejectedWith("invalid registrar");
    });
    it("should revert if base token is invalid", async () => {
      await expect(
        factory.deploy(
          deployer.address,
          deployer.address,
          0,
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        )
      ).to.be.rejectedWith("invalid base token");
    });
    it("should revert if staking contract is invalid", async () => {
      await expect(
        factory.deploy(
          deployer.address,
          deployer.address,
          0,
          deployer.address,
          ethers.constants.AddressZero
        )
      ).to.be.rejectedWith("invalid staking");
    });
    it("should transfer ownership if required", async () => {
      const contract = await factory.deploy(
        alice.address,
        deployer.address,
        0,
        deployer.address,
        deployer.address
      );
      expect(await contract.owner()).to.eq(alice.address);
    });
  });
  describe("Donate", () => {
    beforeEach(async () => {
      await deployments.fixture([
        "_EarthToken",
        "_TestStaking",
        "_DonationsRouter",
      ]);
      token = await ethers.getContract("EarthToken");
      router = await ethers.getContract("DonationsRouter");
      staking = await ethers.getContract("TestStaking");
      await token.transfer(
        alice.address,
        await token.balanceOf(deployer.address)
      );
      await router.registerDao(
        bob.address,
        alice.address,
        ethers.utils.parseEther("0.07").toString()
      );
      await token
        .connect(alice)
        .approve(router.address, ethers.constants.MaxUint256);
    });
    it("should transfer the net amount to the dao", async () => {
      const balanceDonorBefore = await token.balanceOf(alice.address);
      expect(await token.balanceOf(bob.address)).to.eq(0);
      await router.connect(alice).donate(bob.address, donationAmount);
      expect(await token.balanceOf(bob.address)).to.eq(
        donationAmount.sub(donationAmount.div(10))
      );
      expect(await token.balanceOf(alice.address)).to.eq(
        balanceDonorBefore.sub(donationAmount)
      );
    });
    it("should transfer platform fee to the owner", async () => {
      expect(await token.balanceOf(deployer.address)).to.eq(0);
      await router.connect(alice).donate(bob.address, donationAmount);
      expect(await token.balanceOf(deployer.address)).to.eq(
        donationAmount.div(100).mul(3)
      );
    });
    it("should transfer the reward amount to the staking contract", async () => {
      expect(await token.balanceOf(staking.address)).to.eq(0);
      await router.connect(alice).donate(bob.address, donationAmount);
      expect(await token.balanceOf(staking.address)).to.eq(
        donationAmount.div(100).mul(7)
      );
    });
    it("should call the staking contract", async () => {
      await expect(router.connect(alice).donate(bob.address, donationAmount))
        .to.to.emit(staking, "Distribution")
        .withArgs(alice.address, donationAmount.div(100).mul(7));
    });
    it("should work when platform fee is 0", async () => {
      await router.setFee(1, 0);

      expect(await token.balanceOf(deployer.address)).to.eq(0);
      expect(await token.balanceOf(bob.address)).to.eq(0);
      expect(await token.balanceOf(staking.address)).to.eq(0);

      const balanceBefore = await token.balanceOf(alice.address);
      await router.connect(alice).donate(bob.address, donationAmount);

      expect(await token.balanceOf(deployer.address)).to.eq(0);
      expect(await token.balanceOf(staking.address)).to.eq(
        donationAmount.div(100).mul(7)
      );
      expect(await token.balanceOf(bob.address)).to.eq(
        donationAmount.sub(donationAmount.div(100).mul(7))
      );
      expect(await token.balanceOf(alice.address)).to.eq(
        balanceBefore.sub(donationAmount)
      );
    });
    it("should work when reward fee is 0", async () => {
      await router.connect(bob).setFee(0, 0);

      expect(await token.balanceOf(deployer.address)).to.eq(0);
      expect(await token.balanceOf(bob.address)).to.eq(0);
      expect(await token.balanceOf(staking.address)).to.eq(0);

      const balanceBefore = await token.balanceOf(alice.address);
      await router.connect(alice).donate(bob.address, donationAmount);

      expect(await token.balanceOf(deployer.address)).to.eq(
        donationAmount.div(100).mul(3)
      );
      expect(await token.balanceOf(bob.address)).to.eq(
        donationAmount.sub(donationAmount.div(100).mul(3))
      );
      expect(await token.balanceOf(staking.address)).to.eq(0);
      expect(await token.balanceOf(alice.address)).to.eq(
        balanceBefore.sub(donationAmount)
      );
    });
    it("should work when all fees are 0", async () => {
      await router.connect(bob).setFee(0, 0);
      await router.setFee(1, 0);

      expect(await token.balanceOf(deployer.address)).to.eq(0);
      expect(await token.balanceOf(bob.address)).to.eq(0);
      expect(await token.balanceOf(staking.address)).to.eq(0);

      const balanceBefore = await token.balanceOf(alice.address);
      await router.connect(alice).donate(bob.address, donationAmount);

      expect(await token.balanceOf(deployer.address)).to.eq(0);
      expect(await token.balanceOf(staking.address)).to.eq(0);
      expect(await token.balanceOf(alice.address)).to.eq(
        balanceBefore.sub(donationAmount)
      );
      expect(await token.balanceOf(bob.address)).to.eq(donationAmount);
    });
    it("should emit an event", async () => {
      await expect(router.connect(alice).donate(bob.address, donationAmount))
        .to.emit(router, "Donate")
        .withArgs(
          alice.address,
          bob.address,
          donationAmount.sub(donationAmount.div(10)),
          donationAmount.div(100).mul(3),
          donationAmount.div(100).mul(7)
        );
    });
  });
  describe("Register Dao", () => {
    beforeEach(async () => {
      await deployments.fixture([
        "_EarthToken",
        "_TestStaking",
        "_DonationsRouter",
      ]);
      router = await ethers.getContract("DonationsRouter");
    });
    it("should register a dao", async () => {
      await expect(router.registerDao(bob.address, alice.address, 5))
        .to.emit(router, "RegisterDao")
        .withArgs(bob.address, alice.address, 5);

      const registration = await router.daoRegistry(bob.address);
      expect(registration.daoToken).to.eq(alice.address);
      expect(registration.rewardRate).to.eq(5);
    });
    it("should revert if the caller isn't the registrar", async () => {
      await expect(
        router.connect(alice).registerDao(bob.address, alice.address, 0)
      ).to.be.rejectedWith("not a registrar");
    });
    it("should revert if the safe address is invalid", async () => {
      await expect(
        router.registerDao(ethers.constants.AddressZero, alice.address, 0)
      ).to.be.rejectedWith("invalid safe");
    });
    it("should revert if the token address is invalid", async () => {
      await expect(
        router.registerDao(alice.address, ethers.constants.AddressZero, 0)
      ).to.be.rejectedWith("invalid token");
    });
  });
  describe("Set Registrar", () => {
    beforeEach(async () => {
      await deployments.fixture([
        "_EarthToken",
        "_TestStaking",
        "_DonationsRouter",
      ]);
      router = await ethers.getContract("DonationsRouter");
    });
    it("should allow the owner to set a registrar", async () => {
      await expect(router.setRegistrar(bob.address))
        .to.emit(router, "SetRegistrar")
        .withArgs(bob.address);
      expect(await router.registrar()).to.eq(bob.address);
    });
    it("should prevent unauthorized use", async () => {
      await expect(
        router.connect(alice).setRegistrar(bob.address)
      ).to.be.rejectedWith("Ownable: caller is not the owner");
    });
    it("should revert if new registrar is the 0 address", async () => {
      await expect(
        router.setRegistrar(ethers.constants.AddressZero)
      ).to.be.rejectedWith("invalid registrar");
    });
  });
  describe("Set Fee", () => {
    beforeEach(async () => {
      await deployments.fixture([
        "_EarthToken",
        "_TestStaking",
        "_DonationsRouter",
      ]);
      router = await ethers.getContract("DonationsRouter");
    });
    const afterRate = ethers.utils.parseEther("0.5");
    it("should allow a dao to set their reward rate", async () => {
      const beforeRate = ethers.utils.parseEther("0.07");

      await router.registerDao(bob.address, alice.address, beforeRate);
      expect((await router.daoRegistry(bob.address)).rewardRate).to.eq(
        beforeRate
      );
      await router.connect(bob).setFee(0, afterRate);
      expect((await router.daoRegistry(bob.address)).rewardRate).to.eq(
        afterRate
      );
    });
    it("should allow the owner to set the platform fee", async () => {
      expect(await router.platformFee()).to.not.eq(afterRate);
      await router.setFee(1, afterRate);
      expect(await router.platformFee()).to.eq(afterRate);
    });
    it("should revert if a non-registered dao tries to set their reward rate", async () => {
      await expect(router.connect(bob).setFee(0, afterRate)).to.be.rejectedWith(
        "invalid dao"
      );
    });
    it("should revert if a non-owner tries to set the platform fee", async () => {
      await expect(router.connect(bob).setFee(1, 0)).to.be.rejectedWith(
        "not the owner"
      );
    });
    it("should emit an event", async () => {
      await expect(router.setFee(1, afterRate))
        .to.emit(router, "SetFee")
        .withArgs(1, afterRate.toString());
      await router.registerDao(bob.address, alice.address, 0);
      await expect(router.connect(bob).setFee(0, afterRate))
        .emit(router, "SetFee")
        .withArgs(0, afterRate.toString());
    });
  });
});
