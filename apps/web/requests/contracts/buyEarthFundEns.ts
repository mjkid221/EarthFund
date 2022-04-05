import { IENSController } from "contracts/typechain-types/IENSController";
import ENSControllerArtifact from "contracts/artifacts/contracts/vendors/IENSController.sol/IENSController.json";
import { ethers } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import convertToSeconds from "contracts/helpers/convertToSeconds";

const buyEarthFundEns = async (
  signer: ethers.providers.JsonRpcSigner
): Promise<string> => {
  try {
    const ENSControllerAddress = "0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5";

    const ensController: IENSController = new ethers.Contract(
      ENSControllerAddress,
      ENSControllerArtifact.abi,
      signer
    ) as IENSController;

    // append timestamp to the domain name so that it doesn't throw already existing domain error
    const domain = `earthfundtest-${Date.now().toString()}`;

    // fat salt
    const secret = keccak256(ethers.utils.randomBytes(32));
    const commitment = await ensController.makeCommitment(
      domain,
      await signer.getAddress(),
      secret
    );

    // rent the domain for 45 days
    const duration = convertToSeconds({ days: 45 });
    await ensController.commit(commitment);

    // register after sixty seconds, need to wait for some blocks to be mined
    return await new Promise((resolve, reject) =>
      setTimeout(async () => {
        try {
          const tx = await (
            await ensController.register(
              domain,
              await signer.getAddress(),
              duration,
              secret,
              {
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

export default buyEarthFundEns;
