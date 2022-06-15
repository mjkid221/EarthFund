import { deployments, ethers } from "hardhat";
import { EarthToken, ThinWallet } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";

import { TRANSFER_ADMIN, DEFAULT_ADMIN_ROLE, TRANSFER } from "../constants/thinWalletRoles";

const { deploy } = deployments;

interface TokenMovement {
  token : string;
  recipient : string;
  amount : BigNumber;
}

interface EtherPaymentTransfer {
  recipient : string;
  amount : BigNumber;
}

describe("Thin Wallet", async () => {
  let EarthToken: EarthToken,
    ThinWallet: ThinWallet,
    deployer: SignerWithAddress,
    userA : SignerWithAddress,
    userB : SignerWithAddress;

  beforeEach(async () => {
    [deployer, userA, userB] = await ethers.getSigners();
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

  describe("Thin Wallet Contract : RECEIVE function", async () => {
    it("should properly receieve ether", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);
  
      const amountToTransfer : BigNumber = (await ethers.provider.getBalance(deployer.address)).div(2);
      const initialBalance : BigNumber = await ethers.provider.getBalance(testDeploy.address);

      await deployer.sendTransaction({
        to: testDeploy.address,
        value: amountToTransfer
      });

      expect (await ethers.provider.getBalance(testDeploy.address)).to.be.eq(initialBalance.add(amountToTransfer));
    });
  });

  describe("Thin Wallet Access Control", async () => {
    it("should give admin TRANSFER_ADMIN role", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);
      await expect(testDeploy.hasRole(TRANSFER_ADMIN, deployer.address));
    });

    it("should give admin DEFAULT_TRANSFER role", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);
      await expect(testDeploy.hasRole(DEFAULT_ADMIN_ROLE, deployer.address));
    });

    it("should give owners TRANSFER_ROLE role", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);
      await expect(testDeploy.hasRole(TRANSFER, userA.address));
    })

    it("should give owners TRANSFER_ADMIN_ROLE role", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);
      await expect(testDeploy.hasRole(TRANSFER_ADMIN, userA.address));
    })
  });

  describe("Thin Wallet Transfer : Success cases", async () => {
    it("should transfer ERC20 token successfully by admin", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);

      // Send some EarthToken to contract for testing
      await EarthToken.connect(deployer).transfer(testDeploy.address, (await EarthToken.balanceOf(deployer.address)))
      
      const amountToTransfer : BigNumber = (await EarthToken.balanceOf(deployer.address)).div(2)
      const tokenTransfer : TokenMovement = {
        token: EarthToken.address,
        recipient: userB.address,
        amount: amountToTransfer
      };

      await testDeploy.connect(deployer).transferERC20([tokenTransfer]);
      expect (await EarthToken.balanceOf(userB.address)).to.be.eq(amountToTransfer)
    });

    it("should transfer ERC20 token successfully by an owner with TRANSFER_ROLE permission", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);

      // Send some EarthToken to contract for testing
      await EarthToken.connect(deployer).transfer(testDeploy.address, (await EarthToken.balanceOf(deployer.address)))
      
      const amountToTransfer : BigNumber = (await EarthToken.balanceOf(deployer.address)).div(2)
      const tokenTransfer : TokenMovement = {
        token: EarthToken.address,
        recipient: userB.address,
        amount: amountToTransfer
      };

      await testDeploy.connect(userA).transferERC20([tokenTransfer]);
      expect (await EarthToken.balanceOf(userB.address)).to.be.eq(amountToTransfer)
    });

    it("should transfer ether successfully by admin", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);

      const amountToTransfer : BigNumber = (await ethers.provider.getBalance(deployer.address)).div(2);
      const initialBalance : BigNumber = await ethers.provider.getBalance(userB.address);

      await deployer.sendTransaction({
        to: testDeploy.address,
        value: amountToTransfer
      })

      const EtherTransfer : EtherPaymentTransfer = {
        recipient: userB.address,
        amount: amountToTransfer
      }
      await testDeploy.transferEther([EtherTransfer]);

      expect (await ethers.provider.getBalance(userB.address)).to.be.eq(initialBalance.add(amountToTransfer));
    });

    it("should transfer ether successfully by an owner", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);
  
      const amountToTransfer : BigNumber = (await ethers.provider.getBalance(deployer.address)).div(2);
      const initialBalance : BigNumber = await ethers.provider.getBalance(userB.address);
  
      await deployer.sendTransaction({
        to: testDeploy.address,
        value: amountToTransfer
      })
  
      const EtherTransfer : EtherPaymentTransfer = {
        recipient: userB.address,
        amount: amountToTransfer
      }
      await testDeploy.connect(userA).transferEther([EtherTransfer]);
  
      expect (await ethers.provider.getBalance(userB.address)).to.be.eq(initialBalance.add(amountToTransfer));
    });

    it("should handle multiple ERC20 token transfers", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);

      // Send some EarthToken to contract for testing
      const amountToTransfer : BigNumber = ethers.utils.parseEther("1000000")
      await EarthToken.connect(deployer).transfer(testDeploy.address, amountToTransfer)
      
      const userAInitialBalance : BigNumber = await EarthToken.balanceOf(userA.address);
      const userBInitialBalance : BigNumber = await EarthToken.balanceOf(userB.address);

      let tokenTransfers : TokenMovement[] = [];
      for (let i = 0; i < 4; i++){
        let tokenTransfer : TokenMovement
        if (i <= 1){
          tokenTransfer = {
            token: EarthToken.address,
            recipient: userB.address,
            amount: amountToTransfer.div(4)
          };
          tokenTransfers.push(tokenTransfer);
        }else{
          tokenTransfer = {
            token: EarthToken.address,
            recipient: userA.address,
            amount: amountToTransfer.div(4)
          };
          tokenTransfers.push(tokenTransfer);
        }
      }
      await testDeploy.transferERC20(tokenTransfers);
      expect (await EarthToken.balanceOf(userA.address)).to.be.eq(userAInitialBalance.add(amountToTransfer.div(2)));
      expect (await EarthToken.balanceOf(userB.address)).to.be.eq(userBInitialBalance.add(amountToTransfer.div(2)));
    });

    it("should handle multiple ether transfers", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);

      const amountToTransfer : BigNumber = ethers.utils.parseEther("1000");
      const userAInitialBalance : BigNumber = await ethers.provider.getBalance(userA.address);
      const userBInitialBalance : BigNumber = await ethers.provider.getBalance(userB.address);
  
      await deployer.sendTransaction({
        to: testDeploy.address,
        value: amountToTransfer
      })

      let etherTransfers : EtherPaymentTransfer[] = [];
      for (let i = 0; i < 4; i++){
        let etherTransfer : EtherPaymentTransfer;
        if (i <= 1){
          etherTransfer = {
            recipient: userB.address,
            amount: amountToTransfer.div(4)
          };
          etherTransfers.push(etherTransfer);
        }else{
          etherTransfer = {
            recipient: userA.address,
            amount: amountToTransfer.div(4)
          };
          etherTransfers.push(etherTransfer);
        }
      }
    
      await testDeploy.transferEther(etherTransfers);
  
      expect (await ethers.provider.getBalance(userA.address)).to.be.eq(userAInitialBalance.add(amountToTransfer.div(2)));
      expect (await ethers.provider.getBalance(userB.address)).to.be.eq(userBInitialBalance.add(amountToTransfer.div(2)));
    });
  });

  describe("Thin Wallet Transfer : Fail cases", async () => {
    it("should fail to transfer ERC20 token from call by non-admin or non-owner", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);

      // Send some EarthToken to contract for testing
      await EarthToken.connect(deployer).transfer(testDeploy.address, (await EarthToken.balanceOf(deployer.address)))
      
      const amountToTransfer : BigNumber = (await EarthToken.balanceOf(deployer.address)).div(2)
      const tokenTransfer : TokenMovement = {
        token: EarthToken.address,
        recipient: userB.address,
        amount: amountToTransfer
      };

      const expectedErrorMsg = `InvalidPermissions("${userB.address}")`;
      await expect (testDeploy.connect(userB).transferERC20([tokenTransfer])).to.be.revertedWith(expectedErrorMsg);
    });
    it("should fail to transfer ether from call by non-admin or non-owner ", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);
  
      const amountToTransfer : BigNumber = (await ethers.provider.getBalance(deployer.address)).div(2);
  
      await deployer.sendTransaction({
        to: testDeploy.address,
        value: amountToTransfer
      })
  
      const EtherTransfer : EtherPaymentTransfer = {
        recipient: userB.address,
        amount: amountToTransfer
      }
      
      const expectedErrorMsg = `InvalidPermissions("${userB.address}")`;
      await expect(testDeploy.connect(userB).transferEther([EtherTransfer])).to.be.revertedWith(expectedErrorMsg);
    });

    it("should fail to transfer ether when the contract has not enough ether balance", async () => {
      await deploy("TestDeploy", {
        from: deployer.address,
        log: false,
        contract: "ThinWallet",
        args: [],
        autoMine: true,
      });
      const testDeploy = (await ethers.getContract("TestDeploy")) as ThinWallet;
      await testDeploy.initialize(deployer.address, [
        userA.address,
      ]);
  
      const amountToTransfer : BigNumber = (await ethers.provider.getBalance(deployer.address)).div(2);
  
      await deployer.sendTransaction({
        to: testDeploy.address,
        value: amountToTransfer
      })
  
      const EtherTransfer : EtherPaymentTransfer = {
        recipient: userB.address,
        amount: amountToTransfer.mul(3)
      }
      
      const expectedErrorMsg = `failed to send ether`;
      await expect(testDeploy.connect(userA).transferEther([EtherTransfer])).to.be.revertedWith(expectedErrorMsg);
    });
  });
});
