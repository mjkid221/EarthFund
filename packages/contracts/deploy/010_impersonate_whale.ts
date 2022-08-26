import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, network } from "hardhat";
import { ERC20__factory } from "../typechain-types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (!process.env.WETH_ADDRESS) throw new Error("WETH Address not in .env");
  if (!process.env.DAI_ADDRESS) throw new Error("DAI Address not in .env");

  /*//////////////////////////////////////
                TRANSFER ETH
    //////////////////////////////////////*/
  const { deployer, alice, bob } = await hre.getNamedAccounts();
  const devAccount = deployer;

  const aliceSigner = ethers.provider.getSigner(alice);
  const bobSigner = ethers.provider.getSigner(bob);

  await aliceSigner.sendTransaction({
    to: devAccount,
    value: ethers.utils.parseEther("1000"),
  });

  /*//////////////////////////////////////
                TRANSFER WETH
    //////////////////////////////////////*/
  const wethWhale = "0xd51a44d3fae010294c616388b506acda1bfaae46";

  await bobSigner.sendTransaction({
    to: wethWhale,
    value: ethers.utils.parseEther("100"),
  });

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [wethWhale],
  });

  const wethSigner = await ethers.getSigner(wethWhale);

  const wethContract = ERC20__factory.connect(
    process.env.WETH_ADDRESS,
    wethSigner
  );
  await wethContract.transfer(devAccount, ethers.utils.parseEther("1000"));

  // For distributing rewards
  await wethContract.transfer(alice, ethers.utils.parseEther("1000"));

  /*//////////////////////////////////////
                TRANSFER DAI
    //////////////////////////////////////*/
  const daiWhale = "0xc564ee9f21ed8a2d8e7e76c085740d5e4c5fafbe";

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [daiWhale],
  });

  const daiSigner = await ethers.getSigner(daiWhale);

  const daiContract = ERC20__factory.connect(
    process.env.DAI_ADDRESS,
    daiSigner
  );
  await daiContract.transfer(devAccount, ethers.utils.parseEther("1000"));
  await daiContract.approve(
    "0xCd7c00Ac6dc51e8dCc773971Ac9221cC582F3b1b",
    ethers.constants.MaxUint256
  );

  /*//////////////////////////////////////
                TRANSFER 1EARTH
    //////////////////////////////////////*/
  const oneEarthWhale = "0x738cF6903E6c4e699D1C2dd9AB8b67fcDb3121eA";

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [oneEarthWhale],
  });

  const oneEarthSigner = await ethers.getSigner(oneEarthWhale);

  const oneEarthContract = ERC20__factory.connect(
    "0x9e04F519b094F5F8210441e285f603f4d2b50084",
    oneEarthSigner
  );
  await oneEarthContract.transfer(
    devAccount,
    ethers.utils.parseEther("100000")
  );

  // For distributing rewards
  await oneEarthContract.transfer(alice, ethers.utils.parseEther("100000"));
};

export default func;
func.tags = ["_TransferFunds", "_donationsProxyTesting"];
