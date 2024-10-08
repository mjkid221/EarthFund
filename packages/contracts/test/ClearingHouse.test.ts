import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { parseEther, toUtf8Bytes } from "ethers/lib/utils";
import { deployments, ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { createKYCSignature } from "../helpers/createKYCSignature";
import createChildDaoConfig from "../helpers/createChildDaoConfig";
import setupNetwork from "../helpers/setupNetwork";
import {
  ERC20,
  ERC20Singleton,
  ClearingHouse,
  IENSRegistrar,
  IDonationsRouter,
  IGovernor,
  IStakingRewards,
  ReflectiveToken,
} from "../typechain-types";

const { deploy } = deployments;

describe("Clearing House", function () {
  /*//////////////////////////////////////////////////////
                      TEST VARIABLES
  //////////////////////////////////////////////////////*/
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    governor: IGovernor,
    ensRegistrar: IENSRegistrar,
    childDaoToken: ERC20Singleton,
    childDaoToken2: ERC20Singleton,
    earthToken: ERC20,
    clearingHouse: ClearingHouse,
    stakingRewards: IStakingRewards,
    router: IDonationsRouter;

  let tokenId: string;
  const domain = "earthfundTurboTestDomain31337";

  before(async () => {
    [deployer, alice] = await ethers.getSigners();
  });

  // helper function that deploys and gets all the contracts and creates a test child dao
  const setupTestEnv = async (secondChildDao?: boolean) => {
    [, governor, , ensRegistrar, tokenId] = await setupNetwork(
      domain,
      deployer
    ); // contract deployments are done here
    earthToken = await ethers.getContract("EarthToken");
    await earthToken.increaseAllowance(
      governor.address,
      ethers.constants.MaxInt256
    );
    await earthToken
      .connect(alice)
      .increaseAllowance(governor.address, ethers.constants.MaxInt256);

    await ensRegistrar.approve(governor.address, tokenId);
    await governor.addENSDomain(tokenId);
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
      undefined,
      0
    );
    const createChildDaoTx = await (
      await governor.createChildDAO(_tokenData, _safeData, _subdomain)
    ).wait();
    childDaoToken = await ethers.getContractAt(
      "ERC20Singleton",
      createChildDaoTx.events?.find((el) => el.event === "ChildDaoCreated")
        ?.args?.token
    );

    router = await ethers.getContract("DonationsRouter");

    if (secondChildDao) {
      const {
        _tokenData: _tokenData2,
        _safeData: _safeData2,
        _subdomain: _subdomain2,
      } = createChildDaoConfig(
        [alice.address],
        "Test2",
        "TEST2",
        "subtest2",
        "C",
        "D",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        0
      );

      const createChildDaoTx2 = await (
        await governor.createChildDAO(_tokenData2, _safeData2, _subdomain2)
      ).wait();
      childDaoToken2 = await ethers.getContractAt(
        "ERC20Singleton",
        createChildDaoTx2.events?.find((el) => el.event === "ChildDaoCreated")
          ?.args?.token
      );
    }

    clearingHouse = await ethers.getContract("ClearingHouse");
    stakingRewards = await ethers.getContract("StakingRewards");
  };
  /*//////////////////////////////////////////////////////
                    CONSTRUCTOR TESTS
  //////////////////////////////////////////////////////*/
  describe("Constructor", () => {
    beforeEach(async () => {
      await setupTestEnv();
      await clearingHouse.connect(deployer).addGovernor(deployer.address);
    });

    it("should have deployed the clearing house with the earth token contract as the default earth token state", async () => {
      expect(await clearingHouse.earthToken()).to.be.eq(earthToken.address);
    });

    it("should have deployed the clearing house with the staking reward contract as the default staking state", async () => {
      expect(await clearingHouse.staking()).to.be.eq(stakingRewards.address);
    });

    it("should revert when deploying the clearing house contract with the zero address for the earth token", async () => {
      // redeploy the clearing house contract with the zero address for the earth token
      await expect(
        deploy("ClearingHouse", {
          from: deployer.address,
          args: [
            ethers.constants.AddressZero,
            stakingRewards.address,
            deployer.address,
          ],
          log: true,
        })
      ).to.be.revertedWith("invalid earth token address");
    });

    it("should revert when donations router is not set", async () => {
      const deployment = await deploy("newClearingHouse", {
        contract: "ClearingHouse",
        from: deployer.address,
        args: [earthToken.address, stakingRewards.address, deployer.address],
        log: true,
      });

      const newClearingHouse = await ethers.getContractAt(
        deployment.abi,
        deployment.address
      );
      expect(
        newClearingHouse.setAutoStake(childDaoToken.address, true)
      ).to.be.revertedWith("donations router is not set");
    });

    it("should revert when deploying the clearing house contract with the zero address for the staking contract", async () => {
      // redeploy the clearing house contract with the zero address for the staking contract
      await expect(
        deploy("ClearingHouse", {
          from: deployer.address,
          args: [
            earthToken.address,
            ethers.constants.AddressZero,
            deployer.address,
          ],
          log: true,
        })
      ).to.be.revertedWith("invalid staking address");
    });
  });

  /*//////////////////////////////////////////////////////
                  CREATING CHILD DAO TESTS
  //////////////////////////////////////////////////////*/
  describe("Creating Child DAO", () => {
    let reflectiveTokenOne: Contract;

    beforeEach(async () => {
      await setupTestEnv();

      // make the deployer account the governor in the clearing house contract for testing purposes
      await clearingHouse.connect(deployer).addGovernor(deployer.address);

      const refOneDeployResult = await deploy("ReflectiveToken", {
        from: deployer.address,
        args: ["Reflective One", "REF1"],
        log: true,
      });

      reflectiveTokenOne = await ethers.getContractAt(
        refOneDeployResult.abi,
        refOneDeployResult.address
      );

      // transfer ownership of the reflective token contracts to the newly deployed clearing house contract
      await reflectiveTokenOne
        .connect(deployer)
        .transferOwnership(clearingHouse.address);
    });

    it("should make the clearing house contract the owner of the child dao token contract", async () => {
      expect(await childDaoToken.owner()).to.eq(clearingHouse.address);
      expect(await childDaoToken.owner()).to.not.eq(deployer.address);
      expect(await childDaoToken.owner()).to.not.eq(alice.address);
    });

    it("should register the child dao token contract into the clearing house when create dao is called on the governor contract", async () => {
      expect(
        (await clearingHouse.causeInformation(childDaoToken.address))
          .childDaoRegistry
      ).to.eq(true);
    });

    it("should set the staking contract's allowance to the max int in the child dao token for the clearing house contract", async () => {
      expect(
        await childDaoToken.allowance(
          clearingHouse.address,
          stakingRewards.address
        )
      ).to.eq(ethers.constants.MaxUint256);
    });

    it("should revert when trying to register a child dao token contract and no governor is set", async () => {
      // set the governor in the clearing house to the zero address
      await clearingHouse
        .connect(deployer)
        .addGovernor(ethers.constants.AddressZero);

      await expect(
        clearingHouse
          .connect(deployer)
          .registerChildDao(
            childDaoToken.address,
            false,
            false,
            10000,
            10000,
            0
          )
      ).to.be.revertedWith("governor not set");
    });

    it("should revert when trying to register child dao token contract as an account that is not the governor", async () => {
      await expect(
        clearingHouse
          .connect(alice)
          .registerChildDao(
            childDaoToken.address,
            false,
            false,
            10000,
            10000,
            0
          )
      ).to.be.revertedWith("caller is not the governor");
    });

    it("should revert when trying to register the 1Earth token contract", async () => {
      await expect(
        clearingHouse
          .connect(deployer)
          .registerChildDao(earthToken.address, false, false, 10000, 10000, 0)
      ).to.be.revertedWith("cannot register 1Earth token");
    });

    it("should not be able to register cause with 0 max supply", async () => {
      // need to register the reflective tokens again in this newly deployed clearing house contract
      await expect(
        clearingHouse
          .connect(deployer)
          .registerChildDao(
            reflectiveTokenOne.address,
            true,
            false,
            0,
            10000,
            0
          )
      ).to.be.revertedWith("max supply cannot be 0");
    });

    it("should not be able to register cause with 0 max swap", async () => {
      // need to register the reflective tokens again in this newly deployed clearing house contract
      await expect(
        clearingHouse
          .connect(deployer)
          .registerChildDao(
            reflectiveTokenOne.address,
            true,
            false,
            10000,
            0,
            0
          )
      ).to.be.revertedWith("max swap cannot be 0");
    });

    it("should be able to register child dao with autostaking set to true", async () => {
      // need to register the reflective tokens again in this newly deployed clearing house contract
      await clearingHouse
        .connect(deployer)
        .registerChildDao(
          reflectiveTokenOne.address,
          true,
          false,
          10000,
          10000,
          0
        );
    });

    it("should be able to register child dao with kyc enabled set to true", async () => {
      // need to register the reflective tokens again in this newly deployed clearing house contract
      await clearingHouse
        .connect(deployer)
        .registerChildDao(
          reflectiveTokenOne.address,
          false,
          true,
          10000,
          10000,
          0
        );
    });

    it("should be able to register a child dao with a release time", async () => {
      // need to register the reflective tokens again in this newly deployed clearing house contract
      await clearingHouse
        .connect(deployer)
        .registerChildDao(
          reflectiveTokenOne.address,
          true,
          false,
          10000,
          10000,
          parseEther("10")
        );
      expect(
        (await clearingHouse.causeInformation(reflectiveTokenOne.address))
          .release
      ).to.be.eq(parseEther("10"));
      await expect(
        clearingHouse.swapEarthForChildDao(
          reflectiveTokenOne.address,
          10,
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        )
      ).to.be.revertedWith("cause release has not passed");
    });

    it("should revert when trying to register child dao token contract that is not owned by the clearing house", async () => {
      const refTwoDeployResult = await deploy("ReflectiveToken", {
        from: deployer.address,
        args: ["Reflective Two", "REF2"],
        log: true,
      });
      const reflectiveTokenTwo = await ethers.getContractAt(
        refTwoDeployResult.abi,
        refTwoDeployResult.address
      );

      await expect(
        clearingHouse
          .connect(deployer)
          .registerChildDao(
            reflectiveTokenTwo.address,
            false,
            false,
            10000,
            10000,
            0
          )
      ).to.be.revertedWith("token not owned by contract");
    });

    it("should revert when trying to register an already registered child dao token contract", async () => {
      await expect(
        clearingHouse
          .connect(deployer)
          .registerChildDao(
            childDaoToken.address,
            false,
            false,
            10000,
            10000,
            0
          )
      ).to.be.revertedWith("child dao already registered");
    });
  });

  /*//////////////////////////////////////////////////////
                AUTO STAKE LOGIC TESTS 
  //////////////////////////////////////////////////////*/
  describe("Auto stake logic", () => {
    beforeEach(async () => {
      await setupTestEnv();
    });

    it("should update the staking state to the passed in address", async () => {
      expect(await clearingHouse.staking()).to.be.eq(stakingRewards.address);
      await clearingHouse.setStaking(deployer.address);
      expect(await clearingHouse.staking()).to.be.eq(deployer.address);
    });

    it("should revert when trying to update the staking state with the zero address", async () => {
      expect(await clearingHouse.staking()).to.be.eq(stakingRewards.address);
      await expect(
        clearingHouse.setStaking(ethers.constants.AddressZero)
      ).to.be.revertedWith("invalid staking address");
    });
  });

  /*//////////////////////////////////////////////////////
                SWAP FOR DAO TOKENS TESTS
  //////////////////////////////////////////////////////*/
  describe("Swap for child dao tokens", () => {
    let daoToken: Contract;

    beforeEach(async () => {
      await setupTestEnv();
      await deploy("DAOToken", {
        from: alice.address,
        log: false,
        args: [ethers.utils.parseEther("1000000")],
      });

      daoToken = await ethers.getContract("DAOToken");
      await router.registerCause({
        owner: alice.address,
        rewardPercentage: BigNumber.from((10 ** 16).toString()), // 1%,
        daoToken: daoToken.address,
      });

      // transfer alice five hundred 1Earth tokens
      await earthToken.transfer(alice.address, ethers.utils.parseEther("500"));

      // approve the clearing house contract in the earth token contract for alice
      await earthToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);
    });

    // little helper to make sure all the balances are correct after the swap
    const checkBalancesAfterDaoTokenSwap = async (
      amountTransferred: number
    ) => {
      const aliceEarthBalance = await earthToken.balanceOf(alice.address);
      expect(aliceEarthBalance).to.be.eq(
        ethers.utils
          .parseEther("500")
          .sub(ethers.utils.parseEther(amountTransferred.toString()))
      );

      const chEarthBalance = await earthToken.balanceOf(clearingHouse.address);
      expect(chEarthBalance).to.be.eq(
        ethers.utils
          .parseEther("0")
          .add(ethers.utils.parseEther(amountTransferred.toString()))
      );

      const aliceChildDaoBalance = await childDaoToken.balanceOf(alice.address);
      expect(aliceChildDaoBalance).to.be.eq(
        ethers.utils
          .parseEther("0")
          .add(ethers.utils.parseEther(amountTransferred.toString()))
      );

      const chChildDaoBalance = await childDaoToken.balanceOf(
        clearingHouse.address
      );
      expect(chChildDaoBalance).to.be.eq(ethers.utils.parseEther("0"));

      const childDaoTotalSupply = await childDaoToken.totalSupply();
      expect(childDaoTotalSupply).to.be.eq(chEarthBalance);
    };

    it("should initialise 1Earth token and child dao token balances properly", async () => {
      await checkBalancesAfterDaoTokenSwap(0);
    });

    it("should transfer one 1Earth token to the clearing house contract and mint one child dao token to the user", async () => {
      const swapAmount = 1;
      await checkBalancesAfterDaoTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );
      await checkBalancesAfterDaoTokenSwap(swapAmount);
    });

    it("should transfer half a 1Earth token to the clearing house contract and mint half a child dao token to the user", async () => {
      const swapAmount = 0.5;
      await checkBalancesAfterDaoTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );
      await checkBalancesAfterDaoTokenSwap(swapAmount);
    });

    it("should transfer one hundred 1Earth tokens to the clearing house contract and mint one hundred child dao tokens to the user", async () => {
      const swapAmount = 100;
      await checkBalancesAfterDaoTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );
      await checkBalancesAfterDaoTokenSwap(swapAmount);
    });

    it("should transfer five hundred 1Earth tokens to the clearing house contract and mint five hundred child dao tokens to the user", async () => {
      const swapAmount = 500;
      await checkBalancesAfterDaoTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );
      await checkBalancesAfterDaoTokenSwap(swapAmount);
    });

    it("should revert when trying to swap 1Earth tokens for an invalid child dao token", async () => {
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            deployer.address,
            ethers.utils.parseEther(swapAmount.toString()),
            toUtf8Bytes("0"),
            0,
            toUtf8Bytes("0")
          )
      ).to.be.revertedWith("invalid child dao address");
    });

    it("should revert when user does not have enough 1Earth tokens", async () => {
      const swapAmount = 501; // alice should have 500 1Earth tokens to start
      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            childDaoToken.address,
            ethers.utils.parseEther(swapAmount.toString()),
            toUtf8Bytes("0"),
            0,
            toUtf8Bytes("0")
          )
      ).to.be.revertedWith("not enough 1Earth tokens");
    });

    it("should not be able to update auto stake if not owner", async () => {
      expect(
        (await clearingHouse.causeInformation(daoToken.address)).autoStaking
      ).to.be.eq(false);
      expect(
        clearingHouse.setAutoStake(daoToken.address, true)
      ).to.be.revertedWith("sender not owner");
    });

    it("should update the auto stake state to true", async () => {
      expect(
        (await clearingHouse.causeInformation(daoToken.address)).autoStaking
      ).to.be.eq(false);
      await clearingHouse.connect(alice).setAutoStake(daoToken.address, true);
      expect(
        (await clearingHouse.causeInformation(daoToken.address)).autoStaking
      ).to.be.eq(true);
    });

    it("should update the auto stake state to false", async () => {
      expect(
        (await clearingHouse.causeInformation(daoToken.address)).autoStaking
      ).to.be.eq(false);
      await clearingHouse.connect(alice).setAutoStake(daoToken.address, true);
      expect(
        (await clearingHouse.causeInformation(daoToken.address)).autoStaking
      ).to.be.eq(true);
      await clearingHouse.connect(alice).setAutoStake(daoToken.address, false);
      expect(
        (await clearingHouse.causeInformation(daoToken.address)).autoStaking
      ).to.be.eq(false);
    });

    it("should stake the dao tokens when auto stake is on", async () => {
      const swapAmount = 500;
      const childDaoCauseID = await router.tokenCauseIds(childDaoToken.address);
      const childDaoOwner = (await router.causeRecords(childDaoCauseID)).owner;

      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [childDaoOwner],
      });

      const signer = ethers.provider.getSigner(childDaoOwner);

      const tx = await deployer.sendTransaction({
        to: childDaoOwner,
        value: ethers.utils.parseEther("10.0"),
      });

      await tx.wait();

      // use alice, alice should have 500 earth tokens to start
      expect(await earthToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils.parseEther(swapAmount.toString())
      );
      expect(
        (await stakingRewards.userStakes(childDaoToken.address, alice.address))
          .stakedAmount
      ).to.be.eq(0);

      await clearingHouse
        .connect(signer)
        .setAutoStake(childDaoToken.address, true);

      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );
      expect(await earthToken.balanceOf(alice.address)).to.be.eq(0);
      expect(
        (await stakingRewards.userStakes(childDaoToken.address, alice.address))
          .stakedAmount
      ).to.be.eq(ethers.utils.parseEther(swapAmount.toString()));
      expect(await earthToken.balanceOf(clearingHouse.address)).to.be.eq(
        ethers.utils.parseEther(swapAmount.toString())
      );
      expect(await childDaoToken.balanceOf(clearingHouse.address)).to.be.eq(0);
      expect(await earthToken.balanceOf(stakingRewards.address)).to.be.eq(0);
      expect(await childDaoToken.balanceOf(stakingRewards.address)).to.be.eq(
        ethers.utils.parseEther(swapAmount.toString())
      );
    });

    it("should allow the owner to set the max supply", async () => {
      await expect(
        clearingHouse
          .connect(alice)
          .setMaxSupply(parseEther("1000"), daoToken.address)
      )
        .to.emit(clearingHouse, "MaxSupplySet")
        .withArgs(parseEther("1000"), daoToken.address);
    });

    it("should allow the owner to set the max swap", async () => {
      await expect(
        clearingHouse
          .connect(alice)
          .setMaxSwap(parseEther("1000"), daoToken.address)
      )
        .to.emit(clearingHouse, "MaxSwapSet")
        .withArgs(parseEther("1000"), daoToken.address);
    });
    it("should not allow set the max supply if not owner", async () => {
      await expect(
        clearingHouse.setMaxSupply(parseEther("1000"), daoToken.address)
      ).to.be.revertedWith("sender not owner");
    });

    it("should not allow set the max swap if not owner", async () => {
      await expect(
        clearingHouse.setMaxSwap(parseEther("1000"), daoToken.address)
      ).to.be.revertedWith("sender not owner");
    });
  });

  /*//////////////////////////////////////////////////////
                SWAP FOR 1EARTH TOKENS TESTS
  //////////////////////////////////////////////////////*/
  describe("Swap for 1Earth tokens", () => {
    beforeEach(async () => {
      await setupTestEnv();

      // transfer alice five hundred 1Earth tokens
      await earthToken
        .connect(deployer)
        .transfer(alice.address, ethers.utils.parseEther("500"));

      // approve the clearing house contract in the earth token contract for alice
      await earthToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);

      // swap 500 1Earth tokens for alice
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther("500"),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );
    });

    // little helper to make sure all the balances are correct after the swap
    const checkBalancesAfter1EarthTokenSwap = async (
      amountTransferred: number
    ) => {
      const aliceEarthBalance = await earthToken.balanceOf(alice.address);
      expect(aliceEarthBalance).to.be.eq(
        ethers.utils
          .parseEther("0")
          .add(ethers.utils.parseEther(amountTransferred.toString()))
      );

      const chEarthBalance = await earthToken.balanceOf(clearingHouse.address);
      expect(chEarthBalance).to.be.eq(
        ethers.utils
          .parseEther("500")
          .sub(ethers.utils.parseEther(amountTransferred.toString()))
      );

      const aliceChildDaoBalance = await childDaoToken.balanceOf(alice.address);
      expect(aliceChildDaoBalance).to.be.eq(
        ethers.utils
          .parseEther("500")
          .sub(ethers.utils.parseEther(amountTransferred.toString()))
      );

      const chChildDaoBalance = await childDaoToken.balanceOf(
        clearingHouse.address
      );
      expect(chChildDaoBalance).to.be.eq(ethers.utils.parseEther("0"));

      const childDaoTotalSupply = await childDaoToken.totalSupply();
      expect(childDaoTotalSupply).to.be.eq(chEarthBalance);
    };

    it("should initialise 1Earth token and child dao token balances properly", async () => {
      await checkBalancesAfter1EarthTokenSwap(0);
    });

    it("should burn one child dao token and receive one 1Earth token from the clearing house contract", async () => {
      const swapAmount = 1;
      await checkBalancesAfter1EarthTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapChildDaoForEarth(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString())
        );
      await checkBalancesAfter1EarthTokenSwap(swapAmount);
    });

    it("should burn half a child dao token and receive half a 1Earth token from the clearing house contract", async () => {
      const swapAmount = 0.5;
      await checkBalancesAfter1EarthTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapChildDaoForEarth(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString())
        );
      await checkBalancesAfter1EarthTokenSwap(swapAmount);
    });

    it("should burn fifty child dao tokens and receive fifty 1Earth tokens from the clearing house contract", async () => {
      const swapAmount = 50;
      await checkBalancesAfter1EarthTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapChildDaoForEarth(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString())
        );
      await checkBalancesAfter1EarthTokenSwap(swapAmount);
    });

    it("should burn one hundred child dao tokens and receive one hundred 1Earth tokens from the clearing house contract", async () => {
      const swapAmount = 100;
      await checkBalancesAfter1EarthTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapChildDaoForEarth(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString())
        );
      await checkBalancesAfter1EarthTokenSwap(swapAmount);
    });

    it("should revert when trying to swap an invalid child dao token", async () => {
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForEarth(
            deployer.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("invalid child dao address");
    });

    it("should revert when user does not have enough child dao tokens", async () => {
      const swapAmount = 501; // alice should have 500 child dao tokens to start
      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForEarth(
            childDaoToken.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("not enough child dao tokens");
    });
  });

  /*//////////////////////////////////////////////////////
            SWAP DAO TOKENS FOR DAO TOKENS TESTS
  //////////////////////////////////////////////////////*/
  describe("Swap child dao tokens for child dao tokens", () => {
    beforeEach(async () => {
      await setupTestEnv(true); // will create a second child dao

      // transfer alice one thousand 1Earth tokens
      await earthToken
        .connect(deployer)
        .transfer(alice.address, ethers.utils.parseEther("1000"));

      // approve the clearing house contract in the earth token contract for alice
      await earthToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);

      // swap five hundred 1Earth tokens to child dao 1 tokens for alice
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther("500"),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );

      // swap five hundred 1Earth tokens to child dao 2 tokens for alice
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken2.address,
          ethers.utils.parseEther("500"),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );
    });

    const checkBalancesAfterChildDaoTokenToChildDaoTokenSwap = async (
      amountTransferred: number
    ) => {
      const aliceEarthBalance = await earthToken.balanceOf(alice.address);
      expect(aliceEarthBalance).to.be.eq(ethers.utils.parseEther("0"));

      const chEarthBalance = await earthToken.balanceOf(clearingHouse.address);
      expect(chEarthBalance).to.be.eq(ethers.utils.parseEther("1000"));

      const aliceChildDaoBalance = await childDaoToken.balanceOf(alice.address);
      expect(aliceChildDaoBalance).to.be.eq(
        ethers.utils
          .parseEther("500")
          .sub(ethers.utils.parseEther(amountTransferred.toString()))
      );

      const aliceChildDao2Balance = await childDaoToken2.balanceOf(
        alice.address
      );
      expect(aliceChildDao2Balance).to.be.eq(
        ethers.utils
          .parseEther("500")
          .add(ethers.utils.parseEther(amountTransferred.toString()))
      );

      const childDaoTotalSupply = await childDaoToken.totalSupply();
      const childDao2TotalSupply = await childDaoToken2.totalSupply();
      expect(chEarthBalance).to.be.eq(
        childDaoTotalSupply.add(childDao2TotalSupply)
      );
    };

    it("should initialise 1Earth token, child dao token and child dao token 2 balances properly", async () => {
      await checkBalancesAfterChildDaoTokenToChildDaoTokenSwap(0);
    });

    it("should burn one child dao token and mint one child dao 2 token", async () => {
      const swapAmount = 1;
      await checkBalancesAfterChildDaoTokenToChildDaoTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapChildDaoForChildDao(
          childDaoToken.address,
          childDaoToken2.address,
          ethers.utils.parseEther(swapAmount.toString())
        );
      await checkBalancesAfterChildDaoTokenToChildDaoTokenSwap(swapAmount);
    });

    it("should burn half a child dao token and mint half a child dao 2 token", async () => {
      const swapAmount = 0.5;
      await checkBalancesAfterChildDaoTokenToChildDaoTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapChildDaoForChildDao(
          childDaoToken.address,
          childDaoToken2.address,
          ethers.utils.parseEther(swapAmount.toString())
        );
      await checkBalancesAfterChildDaoTokenToChildDaoTokenSwap(swapAmount);
    });

    it("should burn one hundred child dao tokens and mint one hundred child dao 2 tokens", async () => {
      const swapAmount = 100;
      await checkBalancesAfterChildDaoTokenToChildDaoTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapChildDaoForChildDao(
          childDaoToken.address,
          childDaoToken2.address,
          ethers.utils.parseEther(swapAmount.toString())
        );
      await checkBalancesAfterChildDaoTokenToChildDaoTokenSwap(swapAmount);
    });

    it("should burn five hundred child dao tokens and mint five hundred child dao 2 tokens", async () => {
      const swapAmount = 500;
      await checkBalancesAfterChildDaoTokenToChildDaoTokenSwap(0);
      await clearingHouse
        .connect(alice)
        .swapChildDaoForChildDao(
          childDaoToken.address,
          childDaoToken2.address,
          ethers.utils.parseEther(swapAmount.toString())
        );
      await checkBalancesAfterChildDaoTokenToChildDaoTokenSwap(swapAmount);
    });

    it("should revert when trying to swap the same child dao tokens", async () => {
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            childDaoToken.address,
            childDaoToken.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("cannot swap the same token");

      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            childDaoToken2.address,
            childDaoToken2.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("cannot swap the same token");
    });

    it("should revert when trying to swap an invalid child dao token", async () => {
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            deployer.address,
            deployer.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("invalid child dao address");

      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            deployer.address,
            childDaoToken.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("invalid child dao address");

      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            childDaoToken.address,
            deployer.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("invalid child dao address");
    });

    it("should revert when user does not have enough child dao tokens", async () => {
      const swapAmount = 501; // alice should have 500 child dao and child dao 2 tokens to start
      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            childDaoToken.address,
            childDaoToken2.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("not enough child dao tokens");

      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            childDaoToken2.address,
            childDaoToken.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("not enough child dao tokens");
    });
  });

  /*//////////////////////////////////////////////////////
                REFLECTIVE TOKENS TESTS
  //////////////////////////////////////////////////////*/
  describe("Swap with reflective tokens", () => {
    let reflectiveTokenOne: ReflectiveToken,
      reflectiveTokenTwo: ReflectiveToken,
      reflectiveTokenThree: ReflectiveToken;

    beforeEach(async () => {
      await setupTestEnv();

      // transfer alice five hundred 1Earth tokens
      await earthToken
        .connect(deployer)
        .transfer(alice.address, ethers.utils.parseEther("500"));

      // approve the clearing house contract in the earth token contract for alice
      await earthToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);

      // deploy three reflective tokens for testing
      const refOneDeployResult = await deploy("ReflectiveToken", {
        from: deployer.address,
        args: ["Reflective One", "REF1"],
        log: true,
      });
      const refTwoDeployResult = await deploy("ReflectiveToken", {
        from: deployer.address,
        args: ["Reflective Two", "REF2"],
        log: true,
      });
      const refThreeDeployResult = await deploy("ReflectiveToken", {
        from: deployer.address,
        args: ["Reflective Three", "REF3"],
        log: true,
      });

      reflectiveTokenOne = await ethers.getContractAt(
        refOneDeployResult.abi,
        refOneDeployResult.address
      );
      reflectiveTokenTwo = await ethers.getContractAt(
        refTwoDeployResult.abi,
        refTwoDeployResult.address
      );
      reflectiveTokenThree = await ethers.getContractAt(
        refThreeDeployResult.abi,
        refThreeDeployResult.address
      );

      // make the deployer account the governor in the clearing house contract for testing purposes
      await clearingHouse.connect(deployer).addGovernor(deployer.address);
    });

    it("should revert with '1Earth token transfer failed'", async () => {
      // need to redeploy the the clearing house contract with reflective token three as the earth token
      const clearingHouseDeployResult = await deploy("ClearingHouse", {
        from: deployer.address,
        args: [
          reflectiveTokenThree.address,
          stakingRewards.address,
          deployer.address,
        ],
        log: true,
      });

      clearingHouse = await ethers.getContractAt(
        clearingHouseDeployResult.abi,
        clearingHouseDeployResult.address
      );

      // make the deployer account the governor in this new clearing house contract for testing purposes
      await clearingHouse.connect(deployer).addGovernor(deployer.address);

      // transfer ownership of the reflective token contracts to the newly deployed clearing house contract
      await reflectiveTokenOne
        .connect(deployer)
        .transferOwnership(clearingHouse.address);
      await reflectiveTokenTwo
        .connect(deployer)
        .transferOwnership(clearingHouse.address);
      await reflectiveTokenThree
        .connect(deployer)
        .transferOwnership(clearingHouse.address);

      const registrationRequest = {
        owner: deployer.address,
        rewardPercentage: 1,
        daoToken: reflectiveTokenOne.address,
      };

      await clearingHouse.addDonationsRouter(router.address);

      await router.registerCause(registrationRequest);

      // need to register the reflective tokens again in this newly deployed clearing house contract
      await clearingHouse
        .connect(deployer)
        .registerChildDao(
          reflectiveTokenOne.address,
          false,
          false,
          parseEther("10000"),
          parseEther("10000"),
          0
        );

      await clearingHouse
        .connect(deployer)
        .registerChildDao(
          reflectiveTokenTwo.address,
          false,
          false,
          parseEther("10000"),
          parseEther("10000"),
          0
        );

      // mint alice five hundred REF3 tokens
      await reflectiveTokenThree
        .connect(deployer)
        .mint(alice.address, ethers.utils.parseEther("500"));

      // approve the clearing house contract in the reflective token three contract for alice
      await reflectiveTokenThree
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);

      // call the swaps
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            reflectiveTokenOne.address,
            ethers.utils.parseEther(swapAmount.toString()),
            toUtf8Bytes("0"),
            0,
            toUtf8Bytes("0")
          )
      ).to.be.revertedWith("1Earth token transfer failed");

      // mint the new clearing house contract some reflective token three tokens and mint alice some reflective token one tokens
      await reflectiveTokenThree
        .connect(deployer)
        .mint(clearingHouse.address, ethers.utils.parseEther("100"));

      await reflectiveTokenOne
        .connect(deployer)
        .mint(alice.address, ethers.utils.parseEther("100"));

      // try to let alice redeem some REF1 tokens
      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForEarth(
            reflectiveTokenOne.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("1Earth token transfer failed");
    });

    it("should revert with 'child dao token mint error'", async () => {
      // transfer ownership of the reflective token contracts to the clearing house contract
      await reflectiveTokenOne
        .connect(deployer)
        .transferOwnership(clearingHouse.address);
      await reflectiveTokenTwo
        .connect(deployer)
        .transferOwnership(clearingHouse.address);
      await reflectiveTokenThree
        .connect(deployer)
        .transferOwnership(clearingHouse.address);

      // register the two ref tokens in the clearing house contract
      await clearingHouse
        .connect(deployer)
        .registerChildDao(
          reflectiveTokenOne.address,
          false,
          false,
          parseEther("10000"),
          parseEther("10000"),
          0
        );
      await clearingHouse
        .connect(deployer)
        .registerChildDao(
          reflectiveTokenTwo.address,
          false,
          false,
          parseEther("10000"),
          parseEther("10000"),
          0
        );

      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            reflectiveTokenOne.address,
            ethers.utils.parseEther(swapAmount.toString()),
            toUtf8Bytes("0"),
            0,
            toUtf8Bytes("0")
          )
      ).to.be.revertedWith("child dao token mint error");

      // swap 1Earth tokens for child dao tokens for alice
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );

      // try to swap child dao tokens for reflective token one tokens
      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            childDaoToken.address,
            reflectiveTokenOne.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("child dao token mint error");
    });

    it("should revert with 'child dao token burn error'", async () => {
      // transfer ownership of the reflective token contracts to the clearing house contract
      await reflectiveTokenOne
        .connect(deployer)
        .transferOwnership(clearingHouse.address);
      await reflectiveTokenTwo
        .connect(deployer)
        .transferOwnership(clearingHouse.address);
      await reflectiveTokenThree
        .connect(deployer)
        .transferOwnership(clearingHouse.address);

      // register the two ref tokens in the clearing house contract
      await clearingHouse
        .connect(deployer)
        .registerChildDao(
          reflectiveTokenOne.address,
          false,
          false,
          10000,
          10000,
          0
        );
      await clearingHouse
        .connect(deployer)
        .registerChildDao(
          reflectiveTokenTwo.address,
          false,
          false,
          10000,
          10000,
          0
        );

      const swapAmount = 1;

      // swap some 1Earth tokens for child dao tokens so that the clearing house contract has some 1Earth tokens and mint alice some reflective token one tokens
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );

      await reflectiveTokenOne.mint(
        alice.address,
        ethers.utils.parseEther("100")
      );

      // try to swap reflective token one tokens for 1Earth tokens
      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForEarth(
            reflectiveTokenOne.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("child dao token burn error");

      // try to swap reflective token one tokens for child dao tokens
      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            reflectiveTokenOne.address,
            childDaoToken.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("child dao token burn error");
    });
  });

  /*//////////////////////////////////////////////////////
                    PAUSABLE TESTS
  //////////////////////////////////////////////////////*/
  describe("Paused contract", () => {
    beforeEach(async () => {
      await setupTestEnv(true);
      await clearingHouse.connect(deployer).pause();
    });

    it("should not be able to add governor when paused", async () => {
      await expect(
        clearingHouse.connect(deployer).addGovernor(deployer.address)
      ).to.be.revertedWith("Pausable: paused");

      // unpause and try to finish action
      await clearingHouse.connect(deployer).unpause();
      await clearingHouse.connect(deployer).addGovernor(deployer.address);
      expect(await (clearingHouse as any).governor()).to.be.eq(
        deployer.address
      );
    });

    it("should not be able to register a token contract when paused", async () => {
      await expect(
        clearingHouse
          .connect(deployer)
          .registerChildDao(
            childDaoToken.address,
            false,
            false,
            10000,
            10000,
            0
          )
      ).to.be.revertedWith("Pausable: paused");

      // unpause and try to finish action
      await clearingHouse.connect(deployer).unpause();
      await clearingHouse.connect(deployer).addGovernor(deployer.address);
      await expect(
        clearingHouse
          .connect(deployer)
          .registerChildDao(
            childDaoToken.address,
            false,
            false,
            10000,
            10000,
            0
          )
      ).to.be.revertedWith("child dao already registered");
    });

    it("should not be able to swap 1Earth tokens for child dao tokens when paused", async () => {
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(deployer)
          .swapEarthForChildDao(
            childDaoToken.address,
            ethers.utils.parseEther(swapAmount.toString()),
            toUtf8Bytes("0"),
            0,
            toUtf8Bytes("0")
          )
      ).to.be.revertedWith("Pausable: paused");

      // unpause and try to finish action
      await clearingHouse.connect(deployer).unpause();

      // transfer alice five hundred 1Earth tokens
      await earthToken
        .connect(deployer)
        .transfer(alice.address, ethers.utils.parseEther("500"));

      // approve the clearing house contract in the earth token contract for alice
      await earthToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);

      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );

      expect(await earthToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils
          .parseEther("500")
          .sub(ethers.utils.parseEther(swapAmount.toString()))
      );

      expect(await childDaoToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils.parseEther(swapAmount.toString())
      );
    });

    it("should not be able to swap child dao tokens for 1Earth tokens when paused", async () => {
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(deployer)
          .swapChildDaoForEarth(
            childDaoToken.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("Pausable: paused");

      // unpause and try to finish action
      await clearingHouse.connect(deployer).unpause();

      // transfer alice five hundred 1Earth tokens
      await earthToken
        .connect(deployer)
        .transfer(alice.address, ethers.utils.parseEther("500"));

      // approve the clearing house contract in the earth token contract for alice
      await earthToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);

      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );

      expect(await earthToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils
          .parseEther("500")
          .sub(ethers.utils.parseEther(swapAmount.toString()))
      );

      expect(await childDaoToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils.parseEther(swapAmount.toString())
      );

      await clearingHouse
        .connect(alice)
        .swapChildDaoForEarth(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString())
        );

      expect(await earthToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils.parseEther("500")
      );

      expect(await childDaoToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils.parseEther("0")
      );
    });

    it("should not be able to swap child dao tokens for another child dao token when paused", async () => {
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(deployer)
          .swapChildDaoForChildDao(
            childDaoToken.address,
            childDaoToken2.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("Pausable: paused");

      // unpause and try to finish action
      await clearingHouse.connect(deployer).unpause();
      await clearingHouse.connect(deployer).addGovernor(deployer.address);

      // transfer alice five hundred 1Earth tokens
      await earthToken
        .connect(deployer)
        .transfer(alice.address, ethers.utils.parseEther("500"));

      // approve the clearing house contract in the earth token contract for alice
      await earthToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);

      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString()),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        );

      expect(await earthToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils
          .parseEther("500")
          .sub(ethers.utils.parseEther(swapAmount.toString()))
      );

      expect(await childDaoToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils.parseEther(swapAmount.toString())
      );

      await clearingHouse
        .connect(alice)
        .swapChildDaoForChildDao(
          childDaoToken.address,
          childDaoToken2.address,
          ethers.utils.parseEther(swapAmount.toString())
        );

      expect(await childDaoToken.balanceOf(alice.address)).to.be.eq(
        ethers.utils.parseEther("0")
      );

      expect(await childDaoToken2.balanceOf(alice.address)).to.be.eq(
        ethers.utils.parseEther(swapAmount.toString())
      );
    });
  });

  /*//////////////////////////////////////////////////////
                CAUSE TOKEN LIMITS TESTS
  //////////////////////////////////////////////////////*/
  describe("Cause token limits", () => {
    beforeEach(async () => {
      await setupTestEnv(true);

      // make the deployer account the governor in the clearing house contract for testing purposes
      await clearingHouse.connect(deployer).addGovernor(deployer.address);
      await earthToken.transfer(alice.address, parseEther("100000000"));
      await earthToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);
      await childDaoToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);
      await earthToken.approve(
        clearingHouse.address,
        ethers.constants.MaxUint256
      );
      await childDaoToken.approve(
        clearingHouse.address,
        ethers.constants.MaxUint256
      );
    });

    it("should prevent minting past the maximum supply", async () => {
      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            childDaoToken.address,
            parseEther("100000000"),
            toUtf8Bytes("0"),
            0,
            toUtf8Bytes("0")
          )
      ).to.be.revertedWith("exceeds max supply");
    });

    it("should prevent swapping more than the maximum swap amount", async () => {
      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            childDaoToken.address,
            parseEther("10000"),
            toUtf8Bytes("0"),
            0,
            toUtf8Bytes("0")
          )
      ).to.be.revertedWith("exceeds max swap per tx");

      await clearingHouse.swapEarthForChildDao(
        childDaoToken.address,
        parseEther("6000"),
        toUtf8Bytes("0"),
        0,
        toUtf8Bytes("0")
      );

      await childDaoToken.transfer(alice.address, parseEther("6000"));

      await expect(
        clearingHouse
          .connect(alice)
          .swapChildDaoForChildDao(
            childDaoToken.address,
            childDaoToken2.address,
            parseEther("9000")
          )
      ).to.be.revertedWith("exceeds max swap per tx");
    });

    it("should allow the owner to mint beyond the swap limit", async () => {
      expect(await childDaoToken.balanceOf(deployer.address)).to.eq(0);
      await clearingHouse.swapEarthForChildDao(
        childDaoToken.address,
        parseEther("10000"),
        toUtf8Bytes("0"),
        0,
        toUtf8Bytes("0")
      );
      expect(await childDaoToken.balanceOf(deployer.address)).to.be.eq(
        parseEther("10000")
      );
    });

    it("should prevent the owner from minting past the max supply", async () => {
      await expect(
        clearingHouse.swapEarthForChildDao(
          childDaoToken.address,
          parseEther("100000000"),
          toUtf8Bytes("0"),
          0,
          toUtf8Bytes("0")
        )
      ).to.be.revertedWith("exceeds max supply");
    });
  });
  describe("KYC Approval", () => {
    let childDaoCauseID: number;

    interface SigValues {
      KYCId: string;
      user: string;
      causeId: number;
      expiry: number;
    }

    beforeEach(async () => {
      await setupTestEnv();
      await clearingHouse.connect(deployer).addGovernor(deployer.address);
      childDaoCauseID = (
        await router.tokenCauseIds(childDaoToken.address)
      ).toNumber();
      const childDaoOwner = (await router.causeRecords(childDaoCauseID)).owner;

      await network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [childDaoOwner],
      });

      const signer = ethers.provider.getSigner(childDaoOwner);

      const tx = await deployer.sendTransaction({
        to: childDaoOwner,
        value: ethers.utils.parseEther("10.0"),
      });

      await tx.wait();
      await clearingHouse
        .connect(signer)
        .setKYCEnabled(childDaoToken.address, true);
      // transfer alice five hundred 1Earth tokens
      await earthToken.transfer(alice.address, ethers.utils.parseEther("2000"));
      // approve the clearing house contract in the earth token contract for alice
      await earthToken
        .connect(alice)
        .approve(clearingHouse.address, ethers.constants.MaxUint256);
    });

    it("should be able to create signature and swap earth for child dao", async () => {
      const sigValues = {
        KYCId: "test",
        user: alice.address,
        causeId: childDaoCauseID,
        expiry: 0,
      } as SigValues;
      const args = Object.values(sigValues) as [string, string, number, number];
      const signature = await createKYCSignature(deployer, ...args);

      expect(await childDaoToken.balanceOf(alice.address)).to.eq(0);

      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          1000,
          toUtf8Bytes(sigValues.KYCId),
          sigValues.expiry,
          signature
        );

      expect(await childDaoToken.balanceOf(alice.address)).to.eq(1000);
    });
    it("should revert if expiry has passed", async () => {
      const sigValues = {
        KYCId: "test",
        user: alice.address,
        causeId: childDaoCauseID,
        expiry: 1, // 1 second after 1970 would be expired, it ignores expiry if it is 0
      } as SigValues;
      const args = Object.values(sigValues) as [string, string, number, number];
      const signature = await createKYCSignature(deployer, ...args);

      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            childDaoToken.address,
            parseEther("1000"),
            toUtf8Bytes(sigValues.KYCId),
            sigValues.expiry,
            signature
          )
      ).to.be.revertedWith("ApprovalExpired");
    });
    it("should revert if signed by invalid address", async () => {
      const sigValues = {
        KYCId: "test",
        user: alice.address,
        causeId: childDaoCauseID,
        expiry: 0,
      } as SigValues;
      const args = Object.values(sigValues) as [string, string, number, number];
      const signature = await createKYCSignature(alice, ...args);

      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            childDaoToken.address,
            parseEther("1000"),
            toUtf8Bytes(sigValues.KYCId),
            sigValues.expiry,
            signature
          )
      ).to.be.revertedWith("InvalidSignature");
    });
    it("should revert if user attempts to withdraw more than max swap amount", async () => {
      const sigValues = {
        KYCId: "test",
        user: alice.address,
        causeId: childDaoCauseID,
        expiry: 0,
      } as SigValues;
      const args = Object.values(sigValues) as [string, string, number, number];
      const signature = await createKYCSignature(deployer, ...args);

      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          parseEther("1000"),
          toUtf8Bytes(sigValues.KYCId),
          sigValues.expiry,
          signature
        );

      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            childDaoToken.address,
            parseEther("1000"),
            toUtf8Bytes(sigValues.KYCId),
            sigValues.expiry,
            signature
          )
      ).to.be.revertedWith("UserAmountExceeded");
    });
  });

  // it("should ", async () => {
  //   throw new Error("implement");
  // });
});
