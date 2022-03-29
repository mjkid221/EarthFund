import { ethers, deployments } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ERC20Singleton } from "../typechain-types";
import { parseEther } from "@ethersproject/units";

chai.use(chaiAsPromised);
const { expect } = chai;

const mintAmount = parseEther("50");

describe("ERC20Singleton", () => {
  let deployer: SignerWithAddress, alice: SignerWithAddress;
  let token: ERC20Singleton;
  const name = "DAO Token";
  const symbol = "DAO";
  beforeEach(async () => {
    [deployer, alice] = await ethers.getSigners();
    await deployments.fixture(["testbed"]);
    /// Spin up a child DAO
    /// Set token
  });
  it("should have the correct name and symbol", async () => {
    expect(await token.name()).to.eq("DAO Token");
    expect(await token.symbol()).to.eq("DAO");
  });
  it("should allow the owner to mint tokens", async () => {
    expect(await token.balanceOf(alice.address)).to.eq(0);
    await token.connect(deployer).mint(alice.address, mintAmount);
    expect(await token.balanceOf(alice.address)).to.eq(mintAmount);
  });

  it("should prevent unauthorized minting", async () => {
    await expect(
      token.connect(alice).mint(alice.address, mintAmount)
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });
});
