import { IENSController } from "contracts/typechain-types";
import { ethers, Wallet } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import convertToSeconds from "contracts/helpers/convertToSeconds";

const buyEnsDomain = async (
  wallet: Wallet,
  ensController: IENSController
): Promise<string> => {
  try {
    // append timestamp to the domain name so that it doesn't throw already existing domain error
    const domain = `labrysturbotestdomain-${Date.now().toString()}`;

    // fat salt
    const secret = keccak256(ethers.utils.randomBytes(32));
    const commitment = await ensController.makeCommitment(
      domain,
      await wallet.getAddress(),
      secret
    );

    // rent the domain for 45 days
    const duration = convertToSeconds({ days: 45 });
    await ensController.commit(commitment, { gasLimit: 50000 }); // gas limit was estimated by reading the hardhat logs

    // register after sixty seconds, need to wait for some blocks to be mined
    return await new Promise((resolve, reject) =>
      setTimeout(async () => {
        try {
          const tx = await (
            await ensController.register(
              domain,
              await wallet.getAddress(),
              duration,
              secret,
              {
                gasLimit: 300000, // gas limit was estimated by reading the hardhat logs
                value: ethers.utils.parseEther("1"),
              }
            )
          ).wait();

          resolve(
            tx.events?.find(
              (el: any) =>
                el.eventSignature ===
                "NameRegistered(string,bytes32,address,uint256,uint256)"
            )?.args?.label
          );
        } catch (error) {
          reject(error);
        }
      }, 60000)
    );
  } catch (error) {
    throw error;
  }
};

export default buyEnsDomain;
