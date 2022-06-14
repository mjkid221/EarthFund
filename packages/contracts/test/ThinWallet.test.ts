import { deployments, ethers } from "hardhat";
import { EarthToken, ThinWallet } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

const { deploy } = deployments;

describe("Thin Wallet", async () => {
  let EarthToken: EarthToken,
    ThinWallet: ThinWallet,
    deployer: SignerWithAddress;
  beforeEach(async () => {
    [deployer] = await ethers.getSigners();
    await deployments.fixture("_ThinWallet");
    EarthToken = await ethers.getContract("EarthToken");
    ThinWallet = await ethers.getContract("ThinWallet");
  });

  describe.only("Initialize Thin Wallet", async () => {
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
});
