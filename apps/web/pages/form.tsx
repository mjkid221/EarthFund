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
        {/* child dao token inputs */}
        <Stack align="center" my="50px">
          <Heading>Child DAO Token</Heading>

          <FormControl isInvalid={errors?.childDaoTokenName !== undefined}>
            <FormLabel>DAO token name</FormLabel>
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
            <FormLabel>DAO token symbol</FormLabel>
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
        </Stack>

        {/* child dao gnosis safe inputs */}
        <Stack align="center" my="50px">
          <Heading>Gnosis Safe settings</Heading>

          <FormControl isInvalid={errors?.gnosisSafeTokenName !== undefined}>
            <FormLabel>Safe token name</FormLabel>
            <Input
              placeholder="Gnosis safe token"
              type="text"
              {...register("gnosisSafeTokenName", {
                required: "Token name is required",
              })}
            />
            {errors?.gnosisSafeTokenName?.message ? (
              <FormErrorMessage>
                {errors.gnosisSafeTokenName.message}
              </FormErrorMessage>
            ) : (
              <FormHelperText>The name you want for the token</FormHelperText>
            )}
          </FormControl>

          <FormControl isInvalid={errors?.gnosisSafeTokenSymbol !== undefined}>
            <FormLabel>Safe token symbol</FormLabel>
            <Controller
              control={control}
              name="gnosisSafeTokenSymbol"
              rules={{ required: "Token symbol is required" }}
              render={({ field: { onChange, value, ref } }) => (
                <Input
                  placeholder="GNOSIS-SAFE"
                  type="text"
                  value={value}
                  onChange={(e: any) =>
                    onChange((e.target.value as string).toLocaleUpperCase())
                  }
                  ref={ref}
                />
              )}
            />
            {errors?.gnosisSafeTokenSymbol?.message ? (
              <FormErrorMessage>
                {errors.gnosisSafeTokenSymbol.message}
              </FormErrorMessage>
            ) : (
              <FormHelperText>The symbol you want for the token</FormHelperText>
            )}
          </FormControl>
        </Stack>

        <Button
          colorScheme="blue"
          isDisabled={!signer}
          isLoading={isSubmitting}
          type="submit"
          width="100%"
        >
          Create DAO
        </Button>
      </form>
    </PageContainer>
  );
};

export default Form;
