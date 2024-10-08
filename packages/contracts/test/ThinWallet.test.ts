import { deployments, ethers } from "hardhat";
import { EarthToken, ThinWallet } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";

import {
  TRANSFER_ADMIN,
  DEFAULT_ADMIN_ROLE,
  TRANSFER,
} from "../constants/thinWalletRoles";
import { parseEther } from "ethers/lib/utils";

const { deploy } = deployments;

interface TokenMovement {
  token: string;
  recipient: string;
  amount: BigNumber;
}

interface EtherPaymentTransfer {
  recipient: string;
  amount: BigNumber;
}

describe("Thin Wallet", async () => {
  let EarthToken: EarthToken,
    ThinWallet: ThinWallet,
    deployer: SignerWithAddress,
    userA: SignerWithAddress,
    userB: SignerWithAddress,
    userC: SignerWithAddress;

  beforeEach(async () => {
    [deployer, userA, userB, userC] = await ethers.getSigners();
    await deployments.fixture(["_EarthToken"]);
    EarthToken = await ethers.getContract("EarthToken");

    await deploy("ThinWallet", {
      from: deployer.address,
      log: false,
      args: [],
    });
  });

  describe("Initialize Thin Wallet", async () => {
    beforeEach(async () => {
      ThinWallet = await ethers.getContract("ThinWallet");

      await ThinWallet.initialize(deployer.address, [userA.address]);
    });

    it("should not deploy with zero address admin", async () => {
      await expect(
        ThinWallet.initialize(ethers.constants.AddressZero, [deployer.address])
      ).to.be.revertedWith("admin address cannot be 0x0");
    });

    it("should not deploy with zero address owner", async () => {
      await expect(
        ThinWallet.initialize(deployer.address, [ethers.constants.AddressZero])
      ).to.be.revertedWith("owner cannot be 0x0");
    });
  });

  describe("Thin Wallet Contract : RECEIVE function", async () => {
    beforeEach(async () => {
      ThinWallet = await ethers.getContract("ThinWallet");

      await ThinWallet.initialize(deployer.address, [userA.address]);
    });

    it("should properly receieve ether", async () => {
      const amountToTransfer: BigNumber = (
        await ethers.provider.getBalance(deployer.address)
      ).div(2);
      const initialBalance: BigNumber = await ethers.provider.getBalance(
        ThinWallet.address
      );

      await deployer.sendTransaction({
        to: ThinWallet.address,
        value: amountToTransfer,
      });

      expect(await ethers.provider.getBalance(ThinWallet.address)).to.be.eq(
        initialBalance.add(amountToTransfer)
      );
    });
  });

  describe("Thin Wallet Access Control", async () => {
    beforeEach(async () => {
      ThinWallet = await ethers.getContract("ThinWallet");

      await ThinWallet.initialize(deployer.address, [userA.address]);
    });

    it("should give admin TRANSFER_ADMIN role", async () => {
      await expect(ThinWallet.hasRole(TRANSFER_ADMIN, deployer.address));
    });

    it("should give admin DEFAULT_TRANSFER role", async () => {
      await expect(ThinWallet.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
    });

    it("should give owners TRANSFER_ROLE role", async () => {
      await expect(ThinWallet.hasRole(TRANSFER, userA.address));
    });

    it("should give owners TRANSFER_ADMIN_ROLE role", async () => {
      await expect(ThinWallet.hasRole(TRANSFER_ADMIN, userA.address));
    });
  });

  describe("Thin Wallet Transfer : Success cases", async () => {
    beforeEach(async () => {
      ThinWallet = await ethers.getContract("ThinWallet");

      await ThinWallet.initialize(deployer.address, [userA.address]);
    });

    it("should transfer ERC20 token successfully by admin", async () => {
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(0);

      // Send some EarthToken to contract for testing
      await EarthToken.connect(deployer).transfer(
        ThinWallet.address,
        await EarthToken.balanceOf(deployer.address)
      );

      const amountToTransfer: BigNumber = (
        await EarthToken.balanceOf(deployer.address)
      ).div(2);
      const tokenTransfer: TokenMovement = {
        token: EarthToken.address,
        recipient: userB.address,
        amount: amountToTransfer,
      };

      await ThinWallet.connect(deployer).transferERC20([tokenTransfer]);
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(
        amountToTransfer
      );
    });

    it("should transfer ERC20 token successfully by an owner with TRANSFER_ROLE permission", async () => {
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(0);

      // Send some EarthToken to contract for testing
      await EarthToken.connect(deployer).transfer(
        ThinWallet.address,
        await EarthToken.balanceOf(deployer.address)
      );

      const amountToTransfer: BigNumber = (
        await EarthToken.balanceOf(deployer.address)
      ).div(2);
      const tokenTransfer: TokenMovement = {
        token: EarthToken.address,
        recipient: userB.address,
        amount: amountToTransfer,
      };

      await ThinWallet.connect(userA).transferERC20([tokenTransfer]);
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(
        amountToTransfer
      );
    });

    it("should transfer ether successfully by admin", async () => {
      expect(await ethers.provider.getBalance(userB.address)).to.be.eq(
        ethers.utils.parseEther("10000")
      );

      const amountToTransfer: BigNumber = (
        await ethers.provider.getBalance(deployer.address)
      ).div(2);
      const initialBalance: BigNumber = await ethers.provider.getBalance(
        userB.address
      );

      await deployer.sendTransaction({
        to: ThinWallet.address,
        value: amountToTransfer,
      });

      const EtherTransfer: EtherPaymentTransfer = {
        recipient: userB.address,
        amount: amountToTransfer,
      };
      await ThinWallet.transferEther([EtherTransfer]);

      expect(await ethers.provider.getBalance(userB.address)).to.be.eq(
        initialBalance.add(amountToTransfer)
      );
    });

    it("should transfer ether successfully by an owner", async () => {
      expect(await ethers.provider.getBalance(userB.address)).to.be.eq(
        ethers.utils.parseEther("10000")
      );

      const amountToTransfer: BigNumber = (
        await ethers.provider.getBalance(deployer.address)
      ).div(2);
      const initialBalance: BigNumber = await ethers.provider.getBalance(
        userB.address
      );

      await deployer.sendTransaction({
        to: ThinWallet.address,
        value: amountToTransfer,
      });

      const EtherTransfer: EtherPaymentTransfer = {
        recipient: userB.address,
        amount: amountToTransfer,
      };
      await ThinWallet.connect(userA).transferEther([EtherTransfer]);

      expect(await ethers.provider.getBalance(userB.address)).to.be.eq(
        initialBalance.add(amountToTransfer)
      );
    });

    it("should handle multiple ERC20 token transfers", async () => {
      expect(await EarthToken.balanceOf(userC.address)).to.be.eq(0);
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(0);

      // Send some EarthToken to contract for testing
      const amountToTransfer: BigNumber = ethers.utils.parseEther("1000000");
      await EarthToken.connect(deployer).transfer(
        ThinWallet.address,
        amountToTransfer
      );

      const userCInitialBalance: BigNumber = await EarthToken.balanceOf(
        userC.address
      );
      const userBInitialBalance: BigNumber = await EarthToken.balanceOf(
        userB.address
      );

      let tokenTransfers: TokenMovement[] = [];
      for (let i = 0; i < 4; i++) {
        let tokenTransfer: TokenMovement;
        if (i <= 1) {
          tokenTransfer = {
            token: EarthToken.address,
            recipient: userB.address,
            amount: amountToTransfer.div(4),
          };
          tokenTransfers.push(tokenTransfer);
        } else {
          tokenTransfer = {
            token: EarthToken.address,
            recipient: userC.address,
            amount: amountToTransfer.div(4),
          };
          tokenTransfers.push(tokenTransfer);
        }
      }
      await ThinWallet.transferERC20(tokenTransfers);
      expect(await EarthToken.balanceOf(userC.address)).to.be.eq(
        userCInitialBalance.add(amountToTransfer.div(2))
      );
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(
        userBInitialBalance.add(amountToTransfer.div(2))
      );
    });

    it("should handle multiple ether transfers", async () => {
      expect(await ethers.provider.getBalance(userC.address)).to.be.eq(
        ethers.utils.parseEther("10000")
      );
      expect(await ethers.provider.getBalance(userB.address)).to.be.eq(
        ethers.utils.parseEther("10000")
      );

      const amountToTransfer: BigNumber = ethers.utils.parseEther("1000");
      const userCInitialBalance: BigNumber = await ethers.provider.getBalance(
        userC.address
      );
      const userBInitialBalance: BigNumber = await ethers.provider.getBalance(
        userB.address
      );

      await deployer.sendTransaction({
        to: ThinWallet.address,
        value: amountToTransfer,
      });

      let etherTransfers: EtherPaymentTransfer[] = [];
      for (let i = 0; i < 4; i++) {
        let etherTransfer: EtherPaymentTransfer;
        if (i <= 1) {
          etherTransfer = {
            recipient: userB.address,
            amount: amountToTransfer.div(4),
          };
          etherTransfers.push(etherTransfer);
        } else {
          etherTransfer = {
            recipient: userC.address,
            amount: amountToTransfer.div(4),
          };
          etherTransfers.push(etherTransfer);
        }
      }

      await ThinWallet.transferEther(etherTransfers);

      expect(await ethers.provider.getBalance(userC.address)).to.be.eq(
        userCInitialBalance.add(amountToTransfer.div(2))
      );
      expect(await ethers.provider.getBalance(userB.address)).to.be.eq(
        userBInitialBalance.add(amountToTransfer.div(2))
      );
    });
  });

  describe("Thin Wallet Transfer : Fail cases", async () => {
    beforeEach(async () => {
      ThinWallet = await ethers.getContract("ThinWallet");

      await ThinWallet.initialize(deployer.address, [userA.address]);
    });

    it("should fail to transfer ERC20 token from call by non-admin or non-owner", async () => {
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(0);

      // Send some EarthToken to contract for testing
      await EarthToken.connect(deployer).transfer(
        ThinWallet.address,
        await EarthToken.balanceOf(deployer.address)
      );

      const amountToTransfer: BigNumber = (
        await EarthToken.balanceOf(deployer.address)
      ).div(2);
      const tokenTransfer: TokenMovement = {
        token: EarthToken.address,
        recipient: userB.address,
        amount: amountToTransfer,
      };

      const expectedErrorMsg = `InvalidPermissions("${userB.address}")`;
      await expect(
        ThinWallet.connect(userB).transferERC20([tokenTransfer])
      ).to.be.revertedWith(expectedErrorMsg);
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(0);
    });
    it("should fail to transfer ether from call by non-admin or non-owner ", async () => {
      expect(await ethers.provider.getBalance(userC.address)).to.be.eq(
        ethers.utils.parseEther("10000")
      );

      const amountToTransfer: BigNumber = (
        await ethers.provider.getBalance(deployer.address)
      ).div(2);

      await deployer.sendTransaction({
        to: ThinWallet.address,
        value: amountToTransfer,
      });

      const EtherTransfer: EtherPaymentTransfer = {
        recipient: userB.address,
        amount: amountToTransfer,
      };

      const expectedErrorMsg = `InvalidPermissions("${userB.address}")`;
      await expect(
        ThinWallet.connect(userB).transferEther([EtherTransfer])
      ).to.be.revertedWith(expectedErrorMsg);
      expect(await ethers.provider.getBalance(userC.address)).to.be.eq(
        ethers.utils.parseEther("10000")
      );
    });

    it("should fail to transfer ether when the contract has not enough ether balance", async () => {
      expect(await ethers.provider.getBalance(userB.address)).to.be.eq(
        ethers.utils.parseEther("10000")
      );

      const amountToTransfer: BigNumber = (
        await ethers.provider.getBalance(deployer.address)
      ).div(2);

      await deployer.sendTransaction({
        to: ThinWallet.address,
        value: amountToTransfer,
      });

      const EtherTransfer: EtherPaymentTransfer = {
        recipient: userB.address,
        amount: amountToTransfer.mul(3),
      };

      const expectedErrorMsg = `failed to send ether`;
      await expect(
        ThinWallet.connect(userA).transferEther([EtherTransfer])
      ).to.be.revertedWith(expectedErrorMsg);
      expect(await ethers.provider.getBalance(userB.address)).to.be.eq(
        ethers.utils.parseEther("10000")
      );
    });

    it("should fail to transfer token when the contract has not enough token balance", async () => {
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(0);

      // Send some EarthToken to contract for testing
      const amountToTransfer: BigNumber = ethers.utils.parseEther("1000");
      await EarthToken.connect(deployer).transfer(
        ThinWallet.address,
        amountToTransfer
      );

      const excessAmountToTransfer = amountToTransfer.mul(2);
      const tokenTransfer: TokenMovement = {
        token: EarthToken.address,
        recipient: userB.address,
        amount: excessAmountToTransfer,
      };

      await expect(ThinWallet.connect(userA).transferERC20([tokenTransfer])).to
        .be.reverted;
      expect(await EarthToken.balanceOf(userB.address)).to.be.eq(0);
    });
  });
  describe("emergencyEjectERC20", () => {
    beforeEach(async () => {
      ThinWallet = await ethers.getContract("ThinWallet");

      await ThinWallet.initialize(deployer.address, [userA.address]);
    });
    it("should prevent unauthorised use", async () => {
      await expect(
        ThinWallet.connect(userB).emergencyEjectERC20(
          EarthToken.address,
          userB.address
        )
      ).to.be.revertedWith("InvalidPermissions");
    });
    it("should check the token address", async () => {
      await expect(
        ThinWallet.emergencyEjectERC20(
          ethers.constants.AddressZero,
          userB.address
        )
      ).to.be.revertedWith("InvalidAddress");
    });
    it("should check the destination account", async () => {
      await expect(
        ThinWallet.emergencyEjectERC20(
          EarthToken.address,
          ethers.constants.AddressZero
        )
      ).to.be.revertedWith("InvalidAddress");
    });
    it("should transfer the wallet's entire balance", async () => {
      await EarthToken.transfer(ThinWallet.address, parseEther("500"));
      expect(await EarthToken.balanceOf(ThinWallet.address)).to.be.eq(
        parseEther("500")
      );
      const userBBalance = await EarthToken.balanceOf(userB.address);
      await ThinWallet.emergencyEjectERC20(EarthToken.address, userB.address);
      expect(await EarthToken.balanceOf(userB.address)).to.eq(
        userBBalance.add(parseEther("500"))
      );
    });
  });
  describe("emergencyEjectEth", () => {
    beforeEach(async () => {
      ThinWallet = await ethers.getContract("ThinWallet");

      await ThinWallet.initialize(deployer.address, [userA.address]);
    });
    it("should prevent unauthorised use", async () => {
      await expect(
        ThinWallet.connect(userB).emergencyEjectEth(userB.address)
      ).to.be.revertedWith("InvalidPermissions");
    });

    it("should check the destination account", async () => {
      await expect(
        ThinWallet.emergencyEjectEth(ethers.constants.AddressZero)
      ).to.be.revertedWith("InvalidAddress");
    });
    it("should transfer the wallet's entire balance of ether", async () => {
      await userA.sendTransaction({
        value: parseEther("500"),
        to: ThinWallet.address,
      });
      expect(await ethers.provider.getBalance(ThinWallet.address)).to.be.gte(
        parseEther("500")
      );
      const userBalance = await userB.getBalance();
      const walletBalance = await ethers.provider.getBalance(
        ThinWallet.address
      );
      await ThinWallet.emergencyEjectEth(userB.address);
      expect(await userB.getBalance()).to.eq(userBalance.add(walletBalance));
    });
  });
});
