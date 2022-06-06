import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { deployments, ethers } from "hardhat";

import { solidity } from "ethereum-waffle";

import {
  StakingRewards__factory,
  ERC20,
  TestStaking,
  IStakingRewards,
  DAOToken__factory,
} from "../typechain-types";

chai.use(solidity);
chai.use(chaiAsPromised);
const { expect } = chai;

const setupEnvironment = async () => {
  await deployments.fixture(["_EarthToken", "_stakingRewards"]);
  const rewardToken: ERC20 = await ethers.getContract("EarthToken");
  const staking: IStakingRewards = await ethers.getContract("StakingRewards");
  const factory: DAOToken__factory = await ethers.getContractFactory(
    "DAOToken"
  );
  const daoA = (await factory.deploy(
    ethers.constants.MaxUint256
  )) as unknown as ERC20;
  const daoB = (await factory.deploy(
    ethers.constants.MaxUint256
  )) as unknown as ERC20;

  return { rewardToken, staking, daoA, daoB };
};
describe("Staking Rewards", () => {
  let deployer: SignerWithAddress, alice: SignerWithAddress;
  let rewardToken: ERC20, staking: IStakingRewards, daoA: ERC20, daoB: ERC20;
  const rewardAmount = ethers.utils.parseEther("100");
  const stakeAmount = ethers.utils.parseEther("100");

  before(async () => {
    [deployer, alice] = await ethers.getSigners();
  });
  describe("Constructor", () => {
    let factory: StakingRewards__factory;
    before(async () => {
      factory = await ethers.getContractFactory("StakingRewards");
    });
    it("should fail to deploy if reward token address isn't set", async () => {
      await expect(
        factory.deploy(ethers.constants.AddressZero)
      ).to.be.rejectedWith("invalid reward token");
    });
  });
  describe("Stake", () => {
    beforeEach(async () => {
      const contracts = await setupEnvironment();
      rewardToken = contracts.rewardToken;
      staking = contracts.staking;
      daoA = contracts.daoA;
      daoB = contracts.daoB;
      const startAmount = ethers.utils.parseEther("100000");
      await daoA.transfer(alice.address, startAmount);
      await daoB.transfer(alice.address, startAmount);
      await daoA.approve(staking.address, ethers.constants.MaxUint256);
      await daoB.approve(staking.address, ethers.constants.MaxUint256);
      await daoA
        .connect(alice)
        .approve(staking.address, ethers.constants.MaxUint256);
      await daoB
        .connect(alice)
        .approve(staking.address, ethers.constants.MaxUint256);
      await rewardToken.approve(staking.address, ethers.constants.MaxUint256);
    });
    it("should increase the user's staked amount", async () => {
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).stakedAmount
      ).to.be.eq(0);
      await staking.stake(daoA.address, stakeAmount);
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).stakedAmount
      ).to.be.eq(stakeAmount);
    });
    it("should transfer dao tokens from the user", async () => {
      const before = await daoA.balanceOf(deployer.address);
      await staking.stake(daoA.address, stakeAmount);
      expect(await daoA.balanceOf(deployer.address)).to.eq(
        before.sub(stakeAmount)
      );
    });
    it("should increase total amount of dao tokens staked", async () => {
      expect((await staking.daoRewards(daoA.address)).totalStake).to.eq(0);
      await staking.stake(daoA.address, stakeAmount);
      expect((await staking.daoRewards(daoA.address)).totalStake).to.eq(
        stakeAmount
      );
      await staking.connect(alice).stake(daoA.address, stakeAmount);
      expect((await staking.daoRewards(daoA.address)).totalStake).to.eq(
        stakeAmount.mul(2)
      );
    });
    it("should allow the user to increase stake without overwriting unclaimed rewards", async () => {
      await staking.stake(daoA.address, stakeAmount);
      expect(
        await staking.pendingRewards(deployer.address, daoA.address)
      ).to.eq(0);
      await staking.distributeRewards(daoA.address, rewardAmount);
      expect(
        await staking.pendingRewards(deployer.address, daoA.address)
      ).to.eq(rewardAmount);
      await staking.stake(daoA.address, stakeAmount);
      expect(
        await staking.pendingRewards(deployer.address, daoA.address)
      ).to.eq(rewardAmount);
    });
    it("should allow two users to stake at the same time", async () => {
      throw new Error("Implement");
    });
    it("should allow a user to stake in two different daos without issue", async () => {
      throw new Error("Implement");
    });
    it("should allow the first user to stake to claim any rewards that have been distributed pre staking", async () => {
      throw new Error("Implement");
    });
    it("should emit an event", async () => {
      throw new Error("Implement");
    });
    it("should validate input parameters", async () => {
      throw new Error("Implement");
    });
  });
  describe("Unstake", () => {
    beforeEach(async () => {});
    it("should transfer staked tokens to the user", async () => {
      throw new Error("Implement");
    });
    it("should adjust the user's stake record", async () => {
      throw new Error("Implement");
    });
    it("should not affect the user's pending rewards", async () => {
      throw new Error("Implement");
    });
    it("should allow user A to unstake without affecting rewards for user B", async () => {
      throw new Error("Implement");
    });
    it("should allow a user to unstake from Dao A, while preserving their stake in Dao B", async () => {
      throw new Error("Implement");
    });
    it("should validate input parameters", async () => {
      throw new Error("Implement");
    });
  });
  describe("Distribute rewards", () => {
    beforeEach(async () => {});
    it("should ", async () => {
      throw new Error("Implement");
    });
    it("should update the dao's reward per token rate", async () => {
      throw new Error("Implement");
    });
    it("should require that the tokens have been transferred into the contract before calling", async () => {
      throw new Error("Implement");
    });
    it("should accept a distribution even if there are no stakers", async () => {
      throw new Error("Implement");
    });
    it("should allocate all previous rewards to the very first staker in the dao", async () => {
      throw new Error("Implement");
    });
    it("should increase the pending rewards amount for a staker", async () => {
      throw new Error("Implement");
    });
  });
  describe("Claim rewards", () => {
    beforeEach(async () => {});
    it("should transfer the user's entitlement", async () => {
      throw new Error("Implement");
    });
    it("should not affect another user's entitlement", async () => {
      throw new Error("Implement");
    });
    it("should prevent a user from claiming the same entitlement twice", async () => {
      throw new Error("Implement");
    });
    it("should not affect a user's stake in another dao", async () => {
      throw new Error("Implement");
    });
    it("should transfer rewards to the specified address", async () => {
      throw new Error("Implement");
    });
    it("should set the user's reward point", async () => {
      throw new Error("Implement");
    });
  });
  describe("Emergency eject", () => {
    beforeEach(async () => {});
    it("should return the user's stake tokens", async () => {
      throw new Error("Implement");
    });
    it("should reduce the user's pending rewards to 0", async () => {
      throw new Error("Implement");
    });
    it("should not grant the user their previous entitlement if they immediately restake", async () => {
      throw new Error("Implement");
    });
    it("should not affect any other stakes the user has", async () => {
      throw new Error("Implement");
    });
    it("should not affect other users stakes", async () => {
      throw new Error("Implement");
    });
    it("should distribute the user's unclaimed entitlement to all other users", async () => {
      throw new Error("Implement");
    });
  });
  describe("Pending rewards", () => {
    it("should return 0 if the user has no rewards", async () => {
      throw new Error("Implement");
    });
    it("should return the user's pending entitlement", async () => {
      throw new Error("Implement");
    });
  });
});
