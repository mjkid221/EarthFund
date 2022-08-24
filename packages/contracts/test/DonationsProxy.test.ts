import { ethers, deployments } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { expect } from "chai";

import { DonationsProxy, ERC20 } from "../typechain-types";

import axios from "axios";
import "dotenv/config";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

const zeroXAxios = axios.create({ baseURL: "https://api.0x.org" });

describe.only("Donations Proxy", () => {
  let donationsProxy: DonationsProxy;
  let USDTContract: ERC20;
  let WETHContract: ERC20;
  let DAIContract: ERC20;
  let deployer: SignerWithAddress;

  beforeEach(async () => {
    if (!process.env.USDT_ADDRESS)
      throw new Error("USDT_ADDRESS required in env");
    if (!process.env.WETH_ADDRESS)
      throw new Error("WETH_ADDRESS required in env");
    if (!process.env.DAI_ADDRESS)
      throw new Error("DAI_ADDRESS required in env");
    await deployments.fixture("_donationsProxy");
    donationsProxy = await ethers.getContract("DonationsProxy");
    USDTContract = await ethers.getContractAt(
      "ERC20",
      process.env.USDT_ADDRESS
    );
    WETHContract = await ethers.getContractAt(
      "ERC20",
      process.env.WETH_ADDRESS
    );
    DAIContract = await ethers.getContractAt("ERC20", process.env.DAI_ADDRESS);
    [deployer] = await ethers.getSigners();
  });

  it("should be able to swap eth to usdt", async () => {
    const sellAmount = parseEther("0.01").toString();
    expect(await USDTContract.balanceOf(deployer.address)).to.eq(0);
    const { data } = await zeroXAxios("/swap/v1/quote", {
      params: {
        buyToken: "USDT",
        sellToken: "WETH",
        sellAmount,
      },
    });
    await donationsProxy.depositETH(
      data.buyTokenAddress,
      data.sellAmount,
      deployer.address,
      data.allowanceTarget,
      data.to,
      data.data,
      {
        gasPrice: data.gasPrice,
        value: BigNumber.from(sellAmount),
        //   .add(BigNumber.from(data.gasPrice))
        //   .toString(),
      }
    );
    // there is variability in the amount that ends up being swapped, this gives the swap 2% leeway.
    expect(await await USDTContract.balanceOf(deployer.address)).to.be.closeTo(
      data.buyAmount,
      Math.floor(data.buyAmount * 0.02)
    );
  });

  it("should be able to swap and erc20 to usdt", async () => {
    const sellAmount = parseEther("10").toString();
    expect(await USDTContract.balanceOf(deployer.address)).to.eq(0);
    const { data } = await zeroXAxios("/swap/v1/quote", {
      params: {
        buyToken: "USDT",
        sellToken: "DAI",
        sellAmount,
      },
    });
    await DAIContract.approve(
      donationsProxy.address,
      ethers.constants.MaxUint256
    );

    await donationsProxy.depositERC20(
      data.sellTokenAddress,
      data.buyTokenAddress,
      data.sellAmount,
      deployer.address,
      data.allowanceTarget,
      data.to,
      data.data
    );
    // there is variability in the amount that ends up being swapped, this gives the swap 2% leeway.
    expect(await await USDTContract.balanceOf(deployer.address)).to.be.closeTo(
      data.buyAmount,
      Math.floor(data.buyAmount * 0.02)
    );
  });
});
