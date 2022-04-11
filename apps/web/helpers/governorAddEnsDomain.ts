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
        gasLimit: 60000,
      }
    )
  ).wait();
  await (
    await governor.addENSDomain(ethers.BigNumber.from(ensDomainToken), {
      gasLimit: 130000,
    })
  ).wait();
};

export default governorAddEnsDomain;
