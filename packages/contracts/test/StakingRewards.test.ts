import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { parseEther } from "ethers/lib/utils";
import { solidity } from "ethereum-waffle";
import { deployments, ethers } from "hardhat";


import convertToSeconds from "../helpers/convertToSeconds";
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
  const rewardAmount = ethers.utils.parseUnits("1000", 6);
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
  describe("Lockup Period", () => {
    beforeEach(async () => {
      const contracts = await setupEnvironment(deployer, alice);
      rewardToken = contracts.rewardToken;
      staking = contracts.staking;
      daoA = contracts.daoA;
      daoB = contracts.daoB;
    });
    it("should deploy and have a lockup period of zero", async () => {
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from("0"));
    })
    it("should set the lock up period to one day", async () => {
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from("0"));
      await staking.setLockupPeriod(ethers.BigNumber.from(convertToSeconds({ days: 1 })));
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from(convertToSeconds({ days: 1 })));
    })
    it("should set the lock up period to one month", async () => {
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from("0"));
      await staking.setLockupPeriod(ethers.BigNumber.from(convertToSeconds({ months: 1 })));
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from(convertToSeconds({ months: 1 })));
    })
    it("should set the lock up period to one year", async () => {
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from("0"));
      await staking.setLockupPeriod(ethers.BigNumber.from(convertToSeconds({ years: 1 })));
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from(convertToSeconds({ years: 1 })));
    })
    it("should be able to set the lock up period back to zero", async () => {
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from("0"));
      await staking.setLockupPeriod(ethers.BigNumber.from(convertToSeconds({ days: 1 })));
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from(convertToSeconds({ days: 1 })));
      await staking.setLockupPeriod(ethers.BigNumber.from(0));
      expect(await staking.lockupPeriod()).to.be.eq(ethers.BigNumber.from("0"));
    })
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
    it("should not allow a user to unstake more than they have", async () => {
      await expect(
        staking.unstake(
          daoA.address,
          ethers.constants.MaxUint256,
          deployer.address
        )
      ).to.be.revertedWith("invalid unstake amount");
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

      await staking.pendingRewards(deployer.address, daoA.address);
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
    it("should check the dao token address", async () => {
      await expect(
        staking.distributeRewards(ethers.constants.AddressZero, 0)
      ).to.be.revertedWith("invalid dao");
    });
    it("should check the destination address", async () => {
      await expect(
        staking.distributeRewards(daoA.address, 0)
      ).to.be.revertedWith("invalid amount");
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
      expect((await staking.daoRewards(daoA.address)).totalStake).to.eq(
        stakeAmount
      );

      await staking.distributeRewards(daoA.address, rewardAmount);

      expect((await staking.daoRewards(daoA.address)).rewardPerToken).to.eq(
        rewardAmount.mul(parseEther("1")).mul(parseEther("1")).div(stakeAmount)
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
      await staking.distributeRewards(daoB.address, rewardAmount);
    });
    it("should check the dao token address", async () => {
      await expect(
        staking.claimRewards(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("invalid dao token");
    });
    it("should check the destination address", async () => {
      await expect(
        staking.claimRewards(daoA.address, ethers.constants.AddressZero)
      ).to.be.revertedWith("invalid destination");
    });
    it("should transfer the user's entitlement", async () => {
      const amount = await staking.pendingRewards(
        deployer.address,
        daoA.address
      );
      const balance = await rewardToken.balanceOf(deployer.address);
      await staking.claimRewards(daoA.address, deployer.address);
      expect(await rewardToken.balanceOf(deployer.address)).to.eq(
        balance.add(amount)
      );
    });
    it("should not affect another user's entitlement", async () => {
      const amount = await staking.pendingRewards(alice.address, daoA.address);

      await staking.claimRewards(daoA.address, deployer.address);
      expect(await staking.pendingRewards(alice.address, daoA.address)).to.eq(
        amount
      );
    });
    it("should prevent a user from claiming the same entitlement twice", async () => {
      const amount = await staking.pendingRewards(
        deployer.address,
        daoA.address
      );
      const balance = await rewardToken.balanceOf(deployer.address);
      await staking.claimRewards(daoA.address, deployer.address);
      expect(await rewardToken.balanceOf(deployer.address)).to.eq(
        balance.add(amount)
      );
      await staking.claimRewards(daoA.address, deployer.address);
      expect(await rewardToken.balanceOf(deployer.address)).to.eq(
        balance.add(amount)
      );
    });
    it("should not affect a user's stake in another dao", async () => {
      await staking.stake(daoB.address, stakeAmount);
      const amount = await staking.pendingRewards(
        deployer.address,
        daoA.address
      );
      const balance = await rewardToken.balanceOf(deployer.address);

      await staking.claimRewards(daoA.address, deployer.address);
      expect(await rewardToken.balanceOf(deployer.address)).to.eq(
        balance.add(amount)
      );
      expect(
        await staking.pendingRewards(deployer.address, daoB.address)
      ).to.eq(rewardAmount);
    });
    it("should transfer rewards to the specified address", async () => {
      const amount = await staking.pendingRewards(
        deployer.address,
        daoA.address
      );
      const balance = await rewardToken.balanceOf(alice.address);
      await staking.claimRewards(daoA.address, alice.address);
      expect(await rewardToken.balanceOf(alice.address)).to.eq(
        balance.add(amount)
      );
    });
    it("should set the user's reward point", async () => {
      const rewardEntry = (
        await staking.userStakes(daoA.address, deployer.address)
      ).rewardEntry;
      const rpt = (await staking.daoRewards(daoA.address)).rewardPerToken;
      expect(rewardEntry).to.be.lt(rpt);
      await staking.claimRewards(daoA.address, deployer.address);
      expect(
        (await staking.userStakes(daoA.address, deployer.address)).rewardEntry
      ).to.eq(rpt);
    });
  });
  describe("Emergency eject", () => {
    beforeEach(async () => {
      const contracts = await setupEnvironment(deployer, alice);
      rewardToken = contracts.rewardToken;
      staking = contracts.staking;
      daoA = contracts.daoA;
      daoB = contracts.daoB;
      await staking.stake(daoA.address, stakeAmount);
      await staking.stake(daoB.address, stakeAmount);
      await staking.connect(alice).stake(daoA.address, stakeAmount);
      await staking.distributeRewards(daoA.address, stakeAmount);
      await staking.distributeRewards(daoB.address, rewardAmount);
    });
    it("should check the dao token address", async () => {
      await expect(
        staking.emergencyEject(
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("invalid dao token");
    });
    it("should check the destination address", async () => {
      await expect(
        staking.emergencyEject(daoA.address, ethers.constants.AddressZero)
      ).to.be.revertedWith("invalid destination");
    });
    it("should return the user's stake tokens", async () => {
      const balance = await daoA.balanceOf(deployer.address);
      const stake = (await staking.userStakes(daoA.address, deployer.address))
        .stakedAmount;
      await staking.emergencyEject(daoA.address, deployer.address);
      expect(await daoA.balanceOf(deployer.address)).to.eq(balance.add(stake));
    });
    it("should reduce the user's pending rewards to 0", async () => {
      await staking.unstake(daoA.address, parseEther("1"), deployer.address);
      expect(
        (await staking.userStakes(daoA.address, deployer.address))
          .pendingRewards
      ).to.be.gt(0);
      await staking.emergencyEject(daoA.address, deployer.address);
      expect(
        (await staking.userStakes(daoA.address, deployer.address))
          .pendingRewards
      ).to.eq(0);
    });
    it("should not grant the user their previous entitlement if they immediately restake", async () => {
      await staking.unstake(daoA.address, parseEther("1"), deployer.address);
      expect(
        (await staking.userStakes(daoA.address, deployer.address))
          .pendingRewards
      ).to.be.gt(0);
      await staking.emergencyEject(daoA.address, deployer.address);
      await staking.stake(daoA.address, stakeAmount);
      expect(
        (await staking.userStakes(daoA.address, deployer.address))
          .pendingRewards
      ).to.eq(0);
    });
    it("should not affect any other stakes the user has", async () => {
      await staking.unstake(daoB.address, parseEther("1"), deployer.address);
      expect(
        (await staking.userStakes(daoB.address, deployer.address))
          .pendingRewards
      ).to.be.gt(0);
      await staking.emergencyEject(daoA.address, deployer.address);
      expect(
        (await staking.userStakes(daoB.address, deployer.address))
          .pendingRewards
      ).to.be.gt(0);
    });
    it("should not affect other users stakes", async () => {
      await staking
        .connect(alice)
        .unstake(daoA.address, parseEther("1"), alice.address);
      const before = (await staking.userStakes(daoA.address, alice.address))
        .pendingRewards;
      await staking.emergencyEject(daoA.address, deployer.address);
      expect(
        (await staking.userStakes(daoA.address, alice.address)).pendingRewards
      ).to.be.eq(before);
    });
    it("should distribute the user's unclaimed entitlement to all other users", async () => {
      const rpt = (await staking.daoRewards(daoA.address)).rewardPerToken;
      const pending = await staking.pendingRewards(
        deployer.address,
        daoA.address
      );
      await staking.emergencyEject(daoA.address, deployer.address);
      expect((await staking.daoRewards(daoA.address)).rewardPerToken).to.eq(
        rpt.add(
          pending
            .mul(parseEther("1"))
            .mul(parseEther("1"))
            .div((await staking.daoRewards(daoA.address)).totalStake)
        )
      );
    });
    it("should set the reward per token to 0 if the last guy ejects", async () => {
      expect((await staking.daoRewards(daoB.address)).rewardPerToken).to.be.gt(
        0
      );
      await staking.emergencyEject(daoB.address, deployer.address);
      expect((await staking.daoRewards(daoB.address)).rewardPerToken).to.be.eq(
        0
      );
    });
  });
  describe("Pending rewards", () => {
    beforeEach(async () => {
      const contracts = await setupEnvironment(deployer, alice);
      rewardToken = contracts.rewardToken;
      staking = contracts.staking;
      daoA = contracts.daoA;
    });
    it("should return 0 if the user has no rewards", async () => {
      expect(
        await staking.pendingRewards(deployer.address, daoA.address)
      ).to.eq(0);
    });
    it("should return the user's pending entitlement", async () => {
      await staking.stake(daoA.address, stakeAmount);

      await staking.distributeRewards(daoA.address, rewardAmount);

      expect(
        await staking.pendingRewards(deployer.address, daoA.address)
      ).to.eq(rewardAmount);
    });
  });
});
