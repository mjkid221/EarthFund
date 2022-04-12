import { IENSRegistrar, IGovernor } from "contracts/typechain-types";
import { ethers } from "ethers";

const governorAddEnsDomain = async (
  ensDomainToken: string,
  governor: IGovernor,
  ensRegistrar: IENSRegistrar
): Promise<void> => {
  // approve the governor contract to transfer the ens domain token
  await (
    await ensRegistrar.approve(
      governor.address,
      ethers.BigNumber.from(ensDomainToken),
      {
        gasLimit: 60000, // gas limit was estimated by reading the hardhat logs
      }
    )
  ).wait();
  await (
    await governor.addENSDomain(ethers.BigNumber.from(ensDomainToken), {
      gasLimit: 130000, // gas limit was estimated by reading the hardhat logs
    })
  ).wait();
};

export default governorAddEnsDomain;
