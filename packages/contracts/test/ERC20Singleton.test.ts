import { ethers, deployments, network } from "hardhat";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ERC20Singleton } from "../typechain-types";
import { parseEther } from "@ethersproject/units";
import { toUtf8Bytes } from "ethers/lib/utils";

chai.use(chaiAsPromised);
const { expect } = chai;

const mintAmount = parseEther("50");

describe("ERC20Singleton", () => {
  let deployer: SignerWithAddress, alice: SignerWithAddress;
  let token: ERC20Singleton;
  const name = "Singleton Base";
  const symbol = "BASE";
  beforeEach(async () => {
    [deployer, alice] = await ethers.getSigners();
    await deployments.fixture(["_ERC20Singleton"]);
    token = await ethers.getContract("ERC20Singleton");
  });
  it("should prevent initialization of the base singleton", async () => {
    await expect(
      token.initialize(toUtf8Bytes(name), toUtf8Bytes(symbol), alice.address)
    ).to.be.rejectedWith("Initializable: contract is already initialized");
  });
  it("should have the correct name and symbol", async () => {
    expect(await token.name()).to.eq(name);
    expect(await token.symbol()).to.eq(symbol);
  });
  it("should allow the owner to mint tokens", async () => {
    expect(await token.balanceOf(alice.address)).to.eq(0);

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x0000000000000000000000000000000000000001"],
    });
    const owner = await ethers.getSigner(
      "0x0000000000000000000000000000000000000001"
    );

    await token.connect(owner).mint(alice.address, mintAmount);
    expect(await token.balanceOf(alice.address)).to.eq(mintAmount);
  });

  it("should prevent unauthorized minting", async () => {
    await expect(
      token.connect(alice).mint(alice.address, mintAmount)
    ).to.be.rejectedWith("Ownable: caller is not the owner");
  });
});
