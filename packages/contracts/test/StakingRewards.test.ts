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

const setupEnvironment = async (
  deployer: SignerWithAddress,
  alice: SignerWithAddress
) => {
  await deployments.fixture(["_EarthToken", "_StakingRewards"]);
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

  return { rewardToken, staking, daoA, daoB };
};
describe("Staking Rewards", () => {
  let deployer: SignerWithAddress, alice: SignerWithAddress;
  let rewardToken: ERC20, staking: IStakingRewards, daoA: ERC20, daoB: ERC20;
  const rewardAmount = ethers.utils.parseUnits("10", 6);
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
      const contracts = await setupEnvironment(deployer, alice);
      rewardToken = contracts.rewardToken;
      staking = contracts.staking;
      daoA = contracts.daoA;
      daoB = contracts.daoB;
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

      await staking.distributeRewards(daoA.address, rewardAmount);
      expect(
        await staking.pendingRewards(deployer.address, daoA.address)
      ).to.eq(rewardAmount.mul(2));
    });
    it("should allow two users to stake at the same time", async () => {
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).stakedAmount
      ).to.eq(0);
      await staking.stake(daoA.address, stakeAmount);
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).stakedAmount
      ).to.eq(stakeAmount);
      expect(
        (await staking.userStakes(daoA.address, alice.address)).stakedAmount
      ).to.eq(0);
      await staking.connect(alice).stake(daoA.address, stakeAmount);
      expect(
        (await staking.userStakes(daoA.address, alice.address)).stakedAmount
      ).to.eq(stakeAmount);
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).stakedAmount
      ).to.eq(stakeAmount);
    });
    it("should allow a user to stake in two different daos without issue", async () => {
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).stakedAmount
      ).to.eq(0);
      await staking.stake(daoA.address, stakeAmount);
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).stakedAmount
      ).to.eq(stakeAmount);
      expect(
        (await staking.userStakes(daoB.address, deployer.address)).stakedAmount
      ).to.eq(0);
      await staking.stake(daoB.address, stakeAmount);
      expect(
        (await staking.userStakes(daoB.address, deployer.address)).stakedAmount
      ).to.eq(stakeAmount);
    });

    it("should allow the first user to stake to claim any rewards that have been distributed pre staking", async () => {
      await staking.distributeRewards(daoA.address, rewardAmount);
      expect(
        await staking.pendingRewards(deployer.address, daoA.address)
      ).to.eq(0);
      await staking.stake(daoA.address, stakeAmount);
      expect(
        await staking.pendingRewards(deployer.address, daoA.address)
      ).to.eq(rewardAmount);
    });
    it("should emit an event", async () => {
      await expect(staking.stake(daoA.address, stakeAmount))
        .to.emit(staking, "Stake")
        .withArgs(deployer.address, daoA.address, stakeAmount);
    });
    it("should validate input parameters", async () => {
      await expect(
        staking.stake(ethers.constants.AddressZero, stakeAmount)
      ).to.be.rejectedWith("invalid token");
      await expect(staking.stake(daoA.address, 0)).to.be.rejectedWith(
        "invalid amount"
      );
    });
  });
  describe("Unstake", () => {
    beforeEach(async () => {
      const contracts = await setupEnvironment(deployer, alice);
      rewardToken = contracts.rewardToken;
      staking = contracts.staking;
      daoA = contracts.daoA;
      daoB = contracts.daoB;
      await staking.stake(daoA.address, stakeAmount);
    });
    it("should transfer staked tokens to the user", async () => {
      const before = await daoA.balanceOf(deployer.address);
      await staking.unstake(daoA.address, stakeAmount.div(2), deployer.address);
      expect(await daoA.balanceOf(deployer.address)).to.eq(
        before.add(stakeAmount.div(2))
      );
    });
    it("should adjust the user's stake record", async () => {
      const recordBefore = await staking.userStakes(
        daoA.address,
        deployer.address
      );
      await staking.unstake(daoA.address, stakeAmount, deployer.address);
      const recordAfter = await staking.userStakes(
        daoA.address,
        deployer.address
      );

      expect(recordAfter.pendingRewards).to.eq(0);
      expect(recordAfter.stakedAmount).to.eq(
        recordBefore.stakedAmount.sub(stakeAmount)
      );
      expect(recordAfter.rewardEntry).to.eq(0);
    });
    it("should not affect the user's pending rewards", async () => {
      await staking.distributeRewards(daoA.address, rewardAmount);
      expect(
        (await staking.userStakes(daoA.address, deployer.address))
          .pendingRewards
      ).to.eq(0);

      await staking.unstake(daoA.address, stakeAmount, deployer.address);

      expect(
        (await staking.userStakes(daoA.address, deployer.address))
          .pendingRewards
      ).to.eq(rewardAmount);
    });
    it("should emit an event", async () => {
      await expect(staking.unstake(daoA.address, stakeAmount, deployer.address))
        .to.emit(staking, "Unstake")
        .withArgs(deployer.address, daoA.address, stakeAmount);
    });
    it("should allow user A to unstake without affecting rewards for user B", async () => {
      await staking.connect(alice).stake(daoA.address, stakeAmount);

      await staking.unstake(daoA.address, stakeAmount, deployer.address);

      expect(
        (await staking.userStakes(daoA.address, alice.address)).stakedAmount
      ).to.eq(stakeAmount);
    });
    it("should allow a user to unstake from Dao A, while preserving their stake in Dao B", async () => {
      await staking.stake(daoB.address, stakeAmount);
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).stakedAmount
      ).to.eq(stakeAmount);
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).stakedAmount
      ).to.eq(stakeAmount);
      expect(
        (await staking.userStakes(daoB.address, deployer.address)).stakedAmount
      ).to.eq(stakeAmount);

      await staking.unstake(daoA.address, stakeAmount, deployer.address);
      expect(
        (await staking.userStakes(daoB.address, deployer.address)).stakedAmount
      ).to.eq(stakeAmount);
    });
    it("should validate input parameters", async () => {
      await expect(
        staking.unstake(ethers.constants.AddressZero, 0, deployer.address)
      ).to.be.rejectedWith("invalid token");
      await expect(
        staking.unstake(daoA.address, 0, deployer.address)
      ).to.be.rejectedWith("invalid amount");
      await expect(
        staking.unstake(daoA.address, stakeAmount, ethers.constants.AddressZero)
      ).to.be.rejectedWith("invalid destination");
    });
  });
  describe("Distribute rewards", () => {
    beforeEach(async () => {
      const contracts = await setupEnvironment(deployer, alice);
      rewardToken = contracts.rewardToken;
      staking = contracts.staking;
      daoA = contracts.daoA;
      daoB = contracts.daoB;
    });

    it("should pull the reward tokens from the caller", async () => {
      const before = await rewardToken.balanceOf(deployer.address);
      await staking.distributeRewards(daoA.address, rewardAmount);
      expect(await rewardToken.balanceOf(deployer.address)).to.eq(
        before.sub(rewardAmount)
      );
      expect(await rewardToken.balanceOf(staking.address)).to.eq(rewardAmount);
    });
    it("should update the dao's reward per token rate", async () => {
      expect((await staking.daoRewards(daoA.address)).rewardPerToken).to.eq(0);
      await staking.distributeRewards(daoA.address, rewardAmount);
      expect((await staking.daoRewards(daoA.address)).rewardPerToken).to.eq(
        rewardAmount
      );
    });

    it("should increase the reward per token amount for current stakers", async () => {
      await staking.stake(daoA.address, stakeAmount);
      expect((await staking.daoRewards(daoA.address)).rewardPerToken).to.eq(0);

      await staking.distributeRewards(daoA.address, rewardAmount);
      expect((await staking.daoRewards(daoA.address)).rewardPerToken).to.eq(
        rewardAmount.div(stakeAmount)
      );
    });
  });
  describe("Claim rewards", () => {
    beforeEach(async () => {
      const contracts = await setupEnvironment(deployer, alice);
      rewardToken = contracts.rewardToken;
      staking = contracts.staking;
      daoA = contracts.daoA;
      daoB = contracts.daoB;
      await staking.stake(daoA.address, stakeAmount);
      await staking.connect(alice).stake(daoA.address, stakeAmount);
      await staking.distributeRewards(daoA.address, stakeAmount);
    });
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
  // describe("Emergency eject", () => {
  //   beforeEach(async () => {});
  //   it("should return the user's stake tokens", async () => {
  //     throw new Error("Implement");
  //   });
  //   it("should reduce the user's pending rewards to 0", async () => {
  //     throw new Error("Implement");
  //   });
  //   it("should not grant the user their previous entitlement if they immediately restake", async () => {
  //     throw new Error("Implement");
  //   });
  //   it("should not affect any other stakes the user has", async () => {
  //     throw new Error("Implement");
  //   });
  //   it("should not affect other users stakes", async () => {
  //     throw new Error("Implement");
  //   });
  //   it("should distribute the user's unclaimed entitlement to all other users", async () => {
  //     throw new Error("Implement");
  //   });
  // });
  // describe("Pending rewards", () => {
  //   it("should return 0 if the user has no rewards", async () => {
  //     throw new Error("Implement");
  //   });
  //   it("should return the user's pending entitlement", async () => {
  //     throw new Error("Implement");
  //   });
  // });
});
