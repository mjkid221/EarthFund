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
import { ethers, providers, Wallet } from "ethers";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import PageContainer from "../components/PageContainer";
import {
  IGovernor,
  IENSController,
  IENSRegistrar,
} from "contracts/typechain-types";
import GovernorArtifact from "contracts/artifacts/contracts/implementations/Governor.sol/Governor.json";
import ENSControllerArtifact from "contracts/artifacts/contracts/vendors/IENSController.sol/IENSController.json";
import ENSRegistrarArtifact from "contracts/artifacts/contracts/vendors/IENSRegistrar.sol/IENSRegistrar.json";
import ContractAddresses from "contracts/constants/contractAddresses";
import buyEarthFundEns from "../requests/contracts/buyEarthFundEns";
import governorAddEnsDomain from "../requests/contracts/governorAddEnsDomain";

const Form = () => {
  const toast = useToast();
  const [wallet, setWallet] = useState<Wallet | undefined>();
  const [governor, setGovernor] = useState<IGovernor | undefined>();
  const [ensController, setEnsController] = useState<
    IENSController | undefined
  >();
  const [ensRegistrar, setEnsRegistrar] = useState<IENSRegistrar | undefined>();

  // instantiate a wallet for the 0th account (the account used to deploy the contracts) in the hardhat network and get the contracts
  useEffect(() => {
    (async () => {
      const webProvider = (await detectEthereumProvider({
        mustBeMetaMask: true,
      })) as providers.ExternalProvider | providers.JsonRpcFetchFunc;
      const ethersProvider = new providers.Web3Provider(webProvider);

      const wallet = new ethers.Wallet(
        process.env.NEXT_PUBLIC_DEPLOYER_ACCOUNT_PRIVATE_KEY,
        ethersProvider
      );
      setWallet(wallet);

      // get the Governor contract
      const governor: IGovernor = new ethers.Contract(
        process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ADDRESS,
        GovernorArtifact.abi,
        wallet
      ) as IGovernor;
      setGovernor(governor);

      // get the ENS controller contract
      const ensController: IENSController = new ethers.Contract(
        ContractAddresses["31337"].ENSController,
        ENSControllerArtifact.abi,
        wallet
      ) as IENSController;
      setEnsController(ensController);

      // get the ENS registrar contract
      const ensRegistrar: IENSRegistrar = new ethers.Contract(
        ContractAddresses["31337"].ENSRegistrar,
        ENSRegistrarArtifact.abi,
        wallet
      ) as IENSRegistrar;
      setEnsRegistrar(ensRegistrar);
    })();
  }, [detectEthereumProvider, providers, setWallet]);

  // hook form
  const {
    control,
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<DaoCreationForm>({
    defaultValues: {
      childDaoTokenName: "",
      childDaoTokenSymbol: "",
      gnosisSafeTokenName: "",
      gnosisSafeTokenSymbol: "",
    },
  });

  // submit handler
  const onSubmit = async (data: DaoCreationForm) => {
    // early return if no signer or data assigned
    if (
      !wallet ||
      !governor ||
      !ensController ||
      !ensRegistrar ||
      !data.childDaoTokenName ||
      !data.childDaoTokenSymbol ||
      !data.gnosisSafeTokenName ||
      !data.gnosisSafeTokenSymbol
    )
      return;

    try {
      // setup ENS Domain if it hasn't already been
      const currentENSDomainNFTId = await governor.ensDomainNFTId();
      if (currentENSDomainNFTId.eq(ethers.utils.parseEther("0"))) {
        // buy an ens domain for the dao being created
        const ensDomainToken = await buyEarthFundEns(wallet, ensController);
        await governorAddEnsDomain(ensDomainToken, governor, ensRegistrar);
      }

      toast({
        title: "Success",
        description: "Done",
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
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

  if (!wallet)
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
          isDisabled={!wallet}
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
