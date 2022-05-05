import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import createChildDaoConfig from "../helpers/createChildDaoConfig";

import setupNetwork from "../helpers/setupNetwork";
import {
  ERC20Singleton,
  IGovernor,
  IENSRegistrar,
  IENSController,
  IClearingHouse,
  ERC20,
  ReflectiveToken,
} from "../typechain-types";

describe("Clearing House", function () {
  /*//////////////////////////////////////////////////////
                      TEST VARIABLES
  //////////////////////////////////////////////////////*/
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    token: ERC20Singleton,
    governor: IGovernor,
    ensRegistrar: IENSRegistrar,
    ensController: IENSController,
    childDaoToken: ERC20Singleton,
    childDaoToken2: ERC20Singleton,
    earthToken: ERC20,
    clearingHouse: IClearingHouse;

  let tokenId: string;
  const domain = "earthfundTurboTestDomain31337";

  before(async () => {
    [deployer, alice] = await ethers.getSigners();
  });

  // helper function that deploys and gets all the contracts and creates a test child dao
  const setupTestEnv = async (secondChildDao?: boolean) => {
    [token, governor, ensController, ensRegistrar, tokenId] =
      await setupNetwork(domain, deployer); // contract deployments are done here

    await ensRegistrar.approve(governor.address, tokenId);
    await governor.addENSDomain(tokenId);
    const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig([
      alice.address,
    ]);
    const createChildDaoTx = await (
      await governor.createChildDAO(_tokenData, _safeData, _subdomain)
    ).wait();
    childDaoToken = await ethers.getContractAt(
      "ERC20Singleton",
      createChildDaoTx.events?.find((el) => el.event === "ChildDaoCreated")
        ?.args?.token
    );

    if (secondChildDao) {
      const {
        _tokenData: _tokenData2,
        _safeData: _safeData2,
        _subdomain: _subdomain2,
      } = await createChildDaoConfig(
        [alice.address],
        "Test2",
        "TEST2",
        "subtest2",
        "C",
        "D"
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

    earthToken = await ethers.getContract("EarthToken");
    clearingHouse = await ethers.getContract("ClearingHouse");
  };

  /*//////////////////////////////////////////////////////
                  CREATING CHILD DAO TESTS
  //////////////////////////////////////////////////////*/
  describe("Creating Child DAO", () => {
    beforeEach(async () => {
      await setupTestEnv();

      // make the deployer account the governor in the clearing house contract for testing purposes
      await clearingHouse.connect(deployer).addGovernor(deployer.address);
    });

    it("should make the clearing house contract the owner of the child dao token contract", async () => {
      expect(await childDaoToken.owner()).to.eq(clearingHouse.address);
      expect(await childDaoToken.owner()).to.not.eq(deployer.address);
      expect(await childDaoToken.owner()).to.not.eq(alice.address);
    });

    it("should register the child dao token contract into the clearing house when create dao is called on the governor contract", async () => {
      expect(await clearingHouse.childDaoRegistry(childDaoToken.address)).to.eq(
        true
      );
    });

    it("should revert when trying to register a child dao token contract and no governor is set", async () => {
      // set the governor in the clearing house to the zero address
      await clearingHouse
        .connect(deployer)
        .addGovernor(ethers.constants.AddressZero);

      await expect(
        clearingHouse.connect(deployer).registerChildDao(childDaoToken.address)
      ).to.be.revertedWith("governor not set");
    });

    it("should revert when trying to register child dao token contract as an account that is not the governor", async () => {
      await expect(
        clearingHouse.connect(alice).registerChildDao(childDaoToken.address)
      ).to.be.revertedWith("caller is not the governor");
    });

    it("should revert when trying to register an already registered child dao token contract", async () => {
      await expect(
        clearingHouse.connect(deployer).registerChildDao(childDaoToken.address)
      ).to.be.revertedWith("child dao already registered");
    });

    it("should revert when trying to register the 1Earth token contract", async () => {
      await expect(
        clearingHouse.connect(deployer).registerChildDao(earthToken.address)
      ).to.be.revertedWith("cannot register 1Earth token");
    });
  });

  /*//////////////////////////////////////////////////////
                SWAP FOR DAO TOKENS TESTS
  //////////////////////////////////////////////////////*/
  describe("Swap for child dao tokens", () => {
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
          ethers.utils.parseEther(swapAmount.toString())
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
          ethers.utils.parseEther(swapAmount.toString())
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
          ethers.utils.parseEther(swapAmount.toString())
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
          ethers.utils.parseEther(swapAmount.toString())
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
            ethers.utils.parseEther(swapAmount.toString())
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
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("not enough 1Earth tokens");
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
          ethers.utils.parseEther("500")
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
          ethers.utils.parseEther("500")
        );

      // swap five hundred 1Earth tokens to child dao 2 tokens for alice
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken2.address,
          ethers.utils.parseEther("500")
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
      const { deploy } = deployments;
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

      // register the two ref tokens in the clearing house contract
      await clearingHouse
        .connect(deployer)
        .registerChildDao(reflectiveTokenOne.address);
      await clearingHouse
        .connect(deployer)
        .registerChildDao(reflectiveTokenTwo.address);
    });

    it("should revert with '1Earth token transfer failed'", async () => {
      // need to redeploy the the clearing house contract with reflective token three as the earth token
      const { deploy } = deployments;
      const clearingHouseDeployResult = await deploy("ClearingHouse", {
        from: deployer.address,
        args: [reflectiveTokenThree.address],
        log: true,
      });

      clearingHouse = await ethers.getContractAt(
        clearingHouseDeployResult.abi,
        clearingHouseDeployResult.address
      );

      // make the deployer account the governor in this new clearing house contract for testing purposes
      await clearingHouse.connect(deployer).addGovernor(deployer.address);

      // need to register the reflective tokens again in this newly deployed clearing house contract
      await clearingHouse
        .connect(deployer)
        .registerChildDao(reflectiveTokenOne.address);
      await clearingHouse
        .connect(deployer)
        .registerChildDao(reflectiveTokenTwo.address);

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
            ethers.utils.parseEther(swapAmount.toString())
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
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(alice)
          .swapEarthForChildDao(
            reflectiveTokenOne.address,
            ethers.utils.parseEther(swapAmount.toString())
          )
      ).to.be.revertedWith("child dao token mint error");

      // swap 1Earth tokens for child dao tokens for alice
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString())
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
      const swapAmount = 1;

      // swap some 1Earth tokens for child dao tokens so that the clearing house contract has some 1Earth tokens and mint alice some reflective token one tokens
      await clearingHouse
        .connect(alice)
        .swapEarthForChildDao(
          childDaoToken.address,
          ethers.utils.parseEther(swapAmount.toString())
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
        clearingHouse.connect(deployer).registerChildDao(childDaoToken.address)
      ).to.be.revertedWith("Pausable: paused");

      // unpause and try to finish action
      await clearingHouse.connect(deployer).unpause();
      await clearingHouse.connect(deployer).addGovernor(deployer.address);
      await expect(
        clearingHouse.connect(deployer).registerChildDao(childDaoToken.address)
      ).to.be.revertedWith("child dao already registered");
    });

    it("should not be able to swap 1Earth tokens for child dao tokens when paused", async () => {
      const swapAmount = 1;
      await expect(
        clearingHouse
          .connect(deployer)
          .swapEarthForChildDao(
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
          ethers.utils.parseEther(swapAmount.toString())
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
          ethers.utils.parseEther(swapAmount.toString())
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
          ethers.utils.parseEther(swapAmount.toString())
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

  // it("should ", async () => {
  //   throw new Error("implement");
  // });
});
