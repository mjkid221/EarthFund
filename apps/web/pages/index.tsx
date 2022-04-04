import { Button, Heading, Spinner, Stack } from "@chakra-ui/react";
import { useMetaMask } from "metamask-react";
import MetaMaskOnboarding from "@metamask/onboarding";
import Image from "next/image";

import MetaMaskFox from "../assets/icons/metamask-fox.svg";
import PageContainer from "../components/PageContainer";

const installMetaMask = () => {
  const onboarding = new MetaMaskOnboarding();
  onboarding.startOnboarding();
};

const Connect = () => {
  const { status, connect } = useMetaMask();

  return (
    <PageContainer>
      {status === "initializing" || (status === "connecting" && <Spinner />)}

      {/* MetMask not installed */}
      {status === "unavailable" && (
        <Stack>
          <Image src={MetaMaskFox} height="200px" width="200px" />
          <Heading>Please install MetaMask</Heading>
          <Button colorScheme="blue" onClick={installMetaMask}>
            Install
          </Button>
        </Stack>
      )}

      {/* MetaMask not connected */}
      {status === "notConnected" && (
        <Stack>
          <Image src={MetaMaskFox} height="200px" width="200px" />
          <Heading>Connect your MetaMask wallet</Heading>
          <Button colorScheme="blue" onClick={connect}>
            Connect Wallet
          </Button>
        </Stack>
      )}

      {status === "connected" && <>Connected</>}
    </PageContainer>
  );
};

export default Connect;
