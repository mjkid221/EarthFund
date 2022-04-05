import {
  Button,
  Stack,
  Spinner,
  useToast,
  Heading,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  FormErrorMessage,
} from "@chakra-ui/react";
import detectEthereumProvider from "@metamask/detect-provider";
import { providers } from "ethers";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
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

  // hook form
  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<DaoCreationForm>();

  // submit handler
  const onSubmit = async (data: DaoCreationForm) => {
    // early return if no signer or data assigned
    if (
      !signer ||
      !data.childDaoTokenName ||
      !data.childDaoTokenSymbol ||
      !data.gnosisSafeTokenName ||
      !data.gnosisSafeTokenSymbol
    )
      return;

    try {
      // buy an ens domain for the dao being created
      const ensDomainToken = await buyEarthFundEns(signer);
      console.log(ensDomainToken);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message ?? "Unexpected error.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });

      console.log(error);
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
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack align="center">
          <Heading>Child DAO Token</Heading>

          <FormControl isInvalid={errors?.childDaoTokenName !== undefined}>
            <FormLabel htmlFor="tokenName">DAO token name</FormLabel>
            <Input
              placeholder="Child DAO Token"
              type="text"
              {...register("childDaoTokenName", {
                required: "Token name is required",
              })}
            />
            {errors?.childDaoTokenName?.message ? (
              <FormErrorMessage>
                {errors.childDaoTokenName.message}
              </FormErrorMessage>
            ) : (
              <FormHelperText>The name you want for the token</FormHelperText>
            )}
          </FormControl>

          <FormControl isInvalid={errors?.childDaoTokenSymbol !== undefined}>
            <FormLabel htmlFor="tokenSymbol">DAO token symbol</FormLabel>
            <Controller
              control={control}
              name="childDaoTokenSymbol"
              rules={{ required: "Token symbol is required" }}
              render={({ field: { onChange, value, ref } }) => (
                <Input
                  placeholder="CHILD-DAO"
                  type="text"
                  value={value}
                  onChange={(e: any) =>
                    onChange((e.target.value as string).toLocaleUpperCase())
                  }
                  ref={ref}
                />
              )}
            />
            {errors?.childDaoTokenSymbol?.message ? (
              <FormErrorMessage>
                {errors.childDaoTokenSymbol.message}
              </FormErrorMessage>
            ) : (
              <FormHelperText>The symbol you want for the token</FormHelperText>
            )}
          </FormControl>

          <Button
            colorScheme="blue"
            isDisabled={!signer}
            isLoading={isSubmitting}
            type="submit"
          >
            Create DAO
          </Button>
        </Stack>
      </form>
    </PageContainer>
  );
};

export default Form;
