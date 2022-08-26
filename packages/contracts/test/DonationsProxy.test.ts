import { ethers, deployments } from "hardhat";
import { parseEther } from "ethers/lib/utils";
import { expect } from "chai";

import { DonationsProxy, ERC20 } from "../typechain-types";
import "dotenv/config";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

const { deploy } = deployments;
const ZERO_ADDRESS = ethers.constants.AddressZero;

describe("Donations Proxy", () => {
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
    await deployments.fixture("_donationsProxyTesting");
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

  describe("Deploy Donations Proxy", async () => {
    it("should not initialize with a zero address for weth", async () => {
      await expect(
        deploy("TestDeploy", {
          from: deployer.address,
          log: false,
          contract: "DonationsProxy",
          args: [ZERO_ADDRESS, USDTContract.address],
        })
      ).to.be.revertedWith("CannotBeZeroAddress");
    });
    it("should not initialize with a zero address for base token", async () => {
      await expect(
        deploy("TestDeploy", {
          from: deployer.address,
          log: false,
          contract: "DonationsProxy",
          args: [WETHContract.address, ZERO_ADDRESS],
        })
      ).to.be.revertedWith("CannotBeZeroAddress");
    });
  });
  describe("Donations Proxy - Token Swaps", async () => {
    it("should be able to swap eth to usdt", async () => {
      const sellAmount = parseEther("0.01").toString();
      expect(await USDTContract.balanceOf(deployer.address)).to.eq(0);
      const quote = {
        to: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
        data: "0xd9627aa40000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000002386f26fc100000000000000000000000000000000000000000000000000000000000000fb712900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7869584cd00000000000000000000000010000000000000000000000000000000000000110000000000000000000000000000000000000000000000d6715a944a6306cf2d",
        buyTokenAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        allowanceTarget: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
        gasPrice: BigNumber.from("16651500000"),
        buyAmount: BigNumber.from("16644955"),
        sellAmount: BigNumber.from("10000000000000000"),
      };
      await donationsProxy.depositETH(
        quote.buyTokenAddress,
        quote.sellAmount,
        deployer.address,
        quote.allowanceTarget,
        quote.to,
        quote.data,
        {
          gasPrice: quote.gasPrice,
          value: BigNumber.from(sellAmount),
        }
      );
      // there is variability in the amount that ends up being swapped, this gives the swap 3% leeway.
      // (3% is hardcoded due to underflow errors in decimal multiplication of BigNumbers in ethers)
      expect(
        await await USDTContract.balanceOf(deployer.address)
      ).to.be.closeTo(quote.buyAmount, 499348);
    });

    it("should be able to swap an erc20 to usdt", async () => {
      expect(await USDTContract.balanceOf(deployer.address)).to.eq(0);
      const quote = {
        buyTokenAddress: "0xdac17f958d2ee523a2206206994597c13d831ec7",
        sellTokenAddress: "0x6b175474e89094c44da98b954eedeac495271d0f",
        allowanceTarget: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
        sellAmount: BigNumber.from("10000000000000000000"),
        buyAmount: BigNumber.from("9964573"),
        to: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
        data: "0xd9627aa400000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000008ac7230489e8000000000000000000000000000000000000000000000000000000000000009686df000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7869584cd000000000000000000000000100000000000000000000000000000000000001100000000000000000000000000000000000000000000005311e3758c6306cf2f",
      };
      await DAIContract.approve(
        donationsProxy.address,
        ethers.constants.MaxUint256
      );

      await donationsProxy.depositERC20(
        quote.sellTokenAddress,
        quote.buyTokenAddress,
        quote.sellAmount,
        deployer.address,
        quote.allowanceTarget,
        quote.to,
        quote.data
      );
      // there is variability in the amount that ends up being swapped, this gives the swap 2% leeway.
      expect(
        await await USDTContract.balanceOf(deployer.address)
      ).to.be.closeTo(quote.buyAmount, 200000);
    });

    it("should not be able to swap an erc20 to another erc20", async () => {
      const sellAmount = parseEther("10").toString();
      const quote = {
        to: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
        data: "0x6af479b20000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000002386f26fc10000000000000000000000000000000000000000000000000000e7084819861ed4620000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002bc02aaa39b223fe8d0a0e5c4f27ead9083c756cc20001f46b175474e89094c44da98b954eedeac495271d0f000000000000000000000000000000000000000000869584cd00000000000000000000000010000000000000000000000000000000000000110000000000000000000000000000000000000000000000aef5c7cd916306d30c",
        buyTokenAddress: "0x6b175474e89094c44da98b954eedeac495271d0f",
        sellTokenAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        buyAmount: "16815793229329887000",
        sellAmount: "10000000000000000",
        allowanceTarget: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
      };
      await DAIContract.approve(
        donationsProxy.address,
        ethers.constants.MaxUint256
      );

      await expect(
        donationsProxy.depositERC20(
          quote.sellTokenAddress,
          quote.buyTokenAddress,
          quote.sellAmount,
          deployer.address,
          quote.allowanceTarget,
          quote.to,
          quote.data
        )
      ).to.be.revertedWith("IncorrectBuyToken");
    });

    it("should not be able to swap eth to erc20", async () => {
      const sellAmount = parseEther("0.01").toString();
      expect(await USDTContract.balanceOf(deployer.address)).to.eq(0);
      const quote = {
        to: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
        data: "0xd9627aa400000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000008ac7230489e800000000000000000000000000000000000000000000000000000014ea828929065e000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000006b175474e89094c44da98b954eedeac495271d0f000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2869584cd000000000000000000000000100000000000000000000000000000000000001100000000000000000000000000000000000000000000002b9822788e6306d30a",
        gasPrice: "14375000000",
        buyTokenAddress: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        buyAmount: "5946814042452912",
        sellAmount: "10000000000000000000",
        allowanceTarget: "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
      };
      await expect(
        donationsProxy.depositETH(
          quote.buyTokenAddress,
          quote.sellAmount,
          deployer.address,
          quote.allowanceTarget,
          quote.to,
          quote.data,
          {
            gasPrice: quote.gasPrice,
            value: BigNumber.from(sellAmount),
          }
        )
      ).to.be.revertedWith("IncorrectBuyToken");
    });
  });
});
