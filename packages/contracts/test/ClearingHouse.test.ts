import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import createChildDaoConfig from "../helpers/createChildDaoConfig";

import setupNetwork from "../helpers/setupNetwork";
import {
  ERC20Singleton,
  IGovernor,
  IENSRegistrar,
  IENSController,
  IClearingHouse,
  ERC20,
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
    earthToken: ERC20,
    clearingHouse: IClearingHouse;

  let tokenId: string;
  const domain = "earthfundTurboTestDomain31337";

  before(async () => {
    [deployer, alice] = await ethers.getSigners();
  });

  // helper function that deploys and gets all the contracts and creates a test child dao
  const setupTestEnv = async () => {
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

    earthToken = await ethers.getContract("EarthToken");
    clearingHouse = await ethers.getContract("ClearingHouse");
  };

  /*//////////////////////////////////////////////////////
                  CREATING CHILD DAO TESTS
  //////////////////////////////////////////////////////*/
  describe("Creating Child DAO", () => {
    beforeEach(async () => {
      await setupTestEnv();
    });

    it("should make the clearing house contract the owner of the child dao token contract", async () => {
      expect(await childDaoToken.owner()).to.eq(clearingHouse.address);
      expect(await childDaoToken.owner()).to.not.eq(deployer.address);
      expect(await childDaoToken.owner()).to.not.eq(alice.address);
    });

    it("should be able to register the child dao token contract into the clearing house register", async () => {
      expect(await clearingHouse.registerChildDao(childDaoToken.address)).to.eq(
        true
      );
    });

    it("should revert when trying to register an already registered child dao token contract", async () => {
      await clearingHouse.registerChildDao(childDaoToken.address);
      expect(
        await clearingHouse.registerChildDao(childDaoToken.address)
      ).to.be.revertedWith("ALREADY REGISTERED THIS CONTRACT!!!");
    });
  });

  /*//////////////////////////////////////////////////////
                SWAP FOR DAO TOKENS TESTS
  //////////////////////////////////////////////////////*/
  describe("Swap for child dao tokens", () => {
    beforeEach(async () => {
      await setupTestEnv();

      // transfer alice and the clearing house contract 500 1Earth tokens each
      await earthToken
        .connect(deployer)
        .transfer(alice.address, ethers.utils.parseEther("500"));
      await earthToken
        .connect(deployer)
        .transfer(clearingHouse.address, ethers.utils.parseEther("500"));
    });

    // little helper to make sure all the balances are correct after the swap
    const checkBalances = async (amountTransferred: number) => {
      const aliceEarthBalance = await earthToken.balanceOf(alice.address);
      expect(aliceEarthBalance).to.be.eq(
        ethers.utils
          .parseEther("500")
          .sub(ethers.BigNumber.from(amountTransferred))
      );

      const chEarthBalance = await earthToken.balanceOf(clearingHouse.address);
      expect(chEarthBalance).to.be.eq(
        ethers.utils
          .parseEther("500")
          .add(ethers.BigNumber.from(amountTransferred))
      );

      const aliceChildDaoBalance = await childDaoToken.balanceOf(alice.address);
      expect(aliceChildDaoBalance).to.be.eq(
        ethers.utils
          .parseEther("0")
          .add(ethers.BigNumber.from(amountTransferred))
      );

      const chChildDaoBalance = await childDaoToken.balanceOf(
        clearingHouse.address
      );
      expect(chChildDaoBalance).to.be.eq(ethers.utils.parseEther("0"));

      const childDaoTotalSupply = await childDaoToken.totalSupply();
      expect(childDaoTotalSupply).to.be.eq(
        ethers.BigNumber.from(amountTransferred)
      );
    };

    it("should transfer one 1Earth token to the clearing house contract and mint one child dao token to the user", async () => {
      const swapAmount = 1;
      await checkBalances(0);
      await clearingHouse.swapEarthForChildDao(
        childDaoToken.address,
        ethers.utils.parseEther(swapAmount.toString())
      );
      await checkBalances(swapAmount);
    });
  });

  /*//////////////////////////////////////////////////////
                SWAP FOR 1EARTH TOKENS TESTS
  //////////////////////////////////////////////////////*/
  describe("Swap for 1Earth tokens", () => {
    beforeEach(async () => {
      await setupTestEnv();
    });

    it("should...", async () => {
      throw new Error("implement");
    });
  });

  // TODO test swap dao tokens for dao tokens...

  // it("should ", async () => {
  //   throw new Error("implement");
  // });
});
