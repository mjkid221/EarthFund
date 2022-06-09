import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import config from "../deployment.config";
import setupNetwork from "../helpers/setupNetwork";
import { IENSRegistrar, IGovernor } from "../typechain-types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    let deployer: SignerWithAddress;
    [deployer] = await ethers.getSigners();

    if (!config.childDaoConfig.chainId) {
        throw new Error("no chain id provided in the deployment config");
    }

    const governor = (await ethers.getContract(
        "Governor"
    )) as IGovernor;

    // create ENS subdomain if local network
    if (config.childDaoConfig.chainId === 31337) {
        let tokenId: string;
        let ensRegistrar: IENSRegistrar;

        [, , , ensRegistrar, tokenId] = await setupNetwork("earthfund-test", deployer);

        await ensRegistrar.approve(governor.address, tokenId);
        await governor.addENSDomain(tokenId);
    }

    // throw error if governor has no ENS domain set
    if ((await governor.ensDomainNFTId()).isZero()) {
        throw new Error("governor has no ens domain set");
    }

    // 2. create child doa config using helper function

    // 3. call create child dao on the governor contract using the created config
};

export default func;
func.tags = ["_CreateChildDao"]; // TODO: figure out whether to add to `testbed` tag
