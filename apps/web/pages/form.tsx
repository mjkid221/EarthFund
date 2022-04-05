import { Button, Text, Stack, Spinner, useToast } from "@chakra-ui/react";
import detectEthereumProvider from "@metamask/detect-provider";
import { providers } from "ethers";
import React, { useEffect, useState } from "react";
import PageContainer from "../components/PageContainer";
import buyEarthFundEns from "../requests/contracts/buyEarthFundEns";

const Form = () => {
  const toast = useToast();
  const [signer, setSigner] = useState<providers.JsonRpcSigner | undefined>();

  // should be safe to do this here, won't be in this page without a connected metamask account anyways
  useEffect(() => {
    (async () => {
      const webProvider = (await detectEthereumProvider({
        mustBeMetaMask: true,
      })) as providers.ExternalProvider | providers.JsonRpcFetchFunc;

      const ethersProvider = new providers.Web3Provider(webProvider);

      setSigner(ethersProvider.getSigner());
    })();
  }, [detectEthereumProvider, providers, setSigner]);

  // submit handler
  const onSubmit = async () => {
    // early return if no signer assigned
    if (!signer) return;

    try {
      const ensDomainToken = await buyEarthFundEns(signer);
      console.log(ensDomainToken);
    } catch (error: any) {
      if (error.code === 4001) {
        toast({
          title: "Error",
          description: error?.message ?? "Unexpected error.",
          status: "error",
          duration: 5000,
          isClosable: true,
          position: "top-right",
        });
      }
    }
  };

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
        <Button colorScheme="blue" onClick={onSubmit}>
          Buy ENS domain
        </Button>
      </Stack>
    </PageContainer>
  );
};

export default Form;
