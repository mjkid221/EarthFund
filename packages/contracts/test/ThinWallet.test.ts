import { deployments, ethers } from "hardhat";
import { EarthToken, ThinWallet } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import { TRANSFER_ADMIN } from "../constants/thinWalletRoles";

const { deploy } = deployments;

describe.only("Thin Wallet", async () => {
  let EarthToken: EarthToken,
    ThinWallet: ThinWallet,
    deployer: SignerWithAddress;
  beforeEach(async () => {
    [deployer] = await ethers.getSigners();
    await deployments.fixture("_ThinWallet");
    EarthToken = await ethers.getContract("EarthToken");
    ThinWallet = await ethers.getContract("ThinWallet");
  });

  describe("Initialize Thin Wallet", async () => {
    it("should not deploy with zero address admin", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await expect(
        testDeploy.initialize(ethers.constants.AddressZero, [deployer.address])
      ).to.be.revertedWith("admin address cannot be 0x0");
    });

    it("should not deploy with zero address owner", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await expect(
        testDeploy.initialize(deployer.address, [ethers.constants.AddressZero])
      ).to.be.revertedWith("owner cannot be 0x0");
    });
  });

  describe("Thin Wallet Access Control", async () => {
    it("should give admin TRANSFER_ADMIN role", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        ethers.constants.AddressZero,
      ]);
      await expect(testDeploy.hasRole(TRANSFER_ADMIN, deployer.address));
    });
  });
});
