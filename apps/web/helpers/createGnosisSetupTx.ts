import ContractAddresses from "contracts/constants/contractAddresses";
import { IGnosisSafe } from "contracts/typechain-types";
import GnosisSafeArtifact from "contracts/artifacts/contracts/vendors/IGnosisSafe.sol/IGnosisSafe.json";
import { BigNumberish, BytesLike, ethers } from "ethers";

// TODO: move this into it's own helper file
const createGnosisSetupTx = async (
  owners: string[],
  threshold: BigNumberish,
  to: string,
  data: BytesLike,
  fallbackHandler: string,
  paymentToken: string,
  payment: BigNumberish,
  paymentReceiver: string
) => {
  const gnosisSafe: IGnosisSafe = new ethers.Contract(
    ContractAddresses["5"].GnosisSafeSingleton, // address isn't actually being used here, only for the sake of encoding the function call
    GnosisSafeArtifact.abi
  ) as IGnosisSafe;

  return (
    await gnosisSafe.populateTransaction.setup(
      owners,
      threshold,
      to,
      data,
      fallbackHandler,
      paymentToken,
      payment,
      paymentReceiver
    )
  ).data;
};

export default createGnosisSetupTx;
