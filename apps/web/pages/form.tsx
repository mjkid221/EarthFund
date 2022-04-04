import { Button, Text, Stack, Spinner } from "@chakra-ui/react";
import detectEthereumProvider from "@metamask/detect-provider";
import { IENSController } from "contracts/typechain-types";
import ENSControllerArtifact from "contracts/artifacts/contracts/vendors/IENSController.sol/IENSController.json";
import { ethers, providers } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import React, { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";
import convertToSeconds from "contracts/helpers/convertToSeconds";

// TODO: move this to it's own file...
const buyEns = async (signer: ethers.providers.JsonRpcSigner) => {
  try {
    const ENSControllerAddress = "0x283Af0B28c62C092C9727F1Ee09c02CA627EB7F5";

    const ensController: IENSController = new ethers.Contract(
      ENSControllerAddress,
      ENSControllerArtifact.abi,
      signer
    ) as IENSController;

    const domain = "earthfundtest";

    // fat salt
    const secret = keccak256(ethers.utils.randomBytes(32));
    const commitment = await ensController.makeCommitment(
      domain,
      await signer.getAddress(),
      secret
    );

    const duration = convertToSeconds({ days: 45 });

    await ensController.commit(commitment);

    // register after sixty seconds
    await new Promise(() =>
      setTimeout(async () => {
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

        const tokenId = tx.events?.find(
          (el: any) =>
            el.eventSignature ===
            "NameRegistered(string,bytes32,address,uint256,uint256)"
        )?.args?.label;

        console.log({ tokenId });
      }, 60000)
    );
  } catch (error) {
    console.log(error);
  }
};

const Form = () => {
  const [signer, setSigner] = useState<providers.JsonRpcSigner | undefined>();

  // get web provider
  useEffect(() => {
    (async () => {
      const webProvider = (await detectEthereumProvider({
        mustBeMetaMask: true,
      })) as providers.ExternalProvider | providers.JsonRpcFetchFunc;

      const ethersProvider = new providers.Web3Provider(webProvider);

      setSigner(ethersProvider.getSigner());
    })();
  }, [detectEthereumProvider, providers, setSigner]);

  if (!signer)
    return (
      <PageContainer>
        <Spinner />
      </PageContainer>
    );

  return (
    <PageContainer>
      <Stack align="center">
        <Text>Connected</Text>
        <Button colorScheme="blue" onClick={() => buyEns(signer)}>
          Buy ENS domain
        </Button>
      </Stack>
    </PageContainer>
  );
};

export default Form;
