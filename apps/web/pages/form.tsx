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
import { BigNumberish, ethers, providers, Wallet } from "ethers";
import { toUtf8Bytes } from "ethers/lib/utils";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import PageContainer from "../components/PageContainer";
import {
  IGovernor,
  IENSController,
  IENSRegistrar,
  IGnosisSafe,
} from "contracts/typechain-types";
import GovernorArtifact from "contracts/artifacts/contracts/implementations/Governor.sol/Governor.json";
import ENSControllerArtifact from "contracts/artifacts/contracts/vendors/IENSController.sol/IENSController.json";
import ENSRegistrarArtifact from "contracts/artifacts/contracts/vendors/IENSRegistrar.sol/IENSRegistrar.json";
import GnosisSafeArtifact from "contracts/artifacts/contracts/vendors/IGnosisSafe.sol/IGnosisSafe.json";
import ContractAddresses from "contracts/constants/contractAddresses";
import buyEarthFundEns from "../requests/contracts/buyEarthFundEns";
import governorAddEnsDomain from "../requests/contracts/governorAddEnsDomain";
import { BytesLike } from "ethers";

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
    ContractAddresses["31337"].GnosisSafeSingleton, // address isn't actually being used here, only for the sake of encoding the function call
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

// TODO: move this into it's own helper file
const createChildDaoConfig = async (
  owners: string[],
  tokenName: string,
  tokenSymbol: string,
  subdomain: string,
  snapshotKey = "A",
  snapshotValue = "B"
) => ({
  _tokenData: {
    tokenName: toUtf8Bytes(tokenName),
    tokenSymbol: toUtf8Bytes(tokenSymbol),
  },
  _safeData: {
    initializer:
      (await createGnosisSetupTx(
        owners,
        owners.length,
        ethers.constants.AddressZero,
        [],
        ContractAddresses["31337"].GnosisFallbackHandler,
        ethers.constants.AddressZero,
        0,
        ethers.constants.AddressZero
      )) || [],
  },
  _subdomain: {
    subdomain: toUtf8Bytes(subdomain),
    snapshotKey: toUtf8Bytes(snapshotKey),
    snapshotValue: toUtf8Bytes(snapshotValue),
  },
});

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
      !data.gnosisSubDomain
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

      // create the child dao config
      const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig(
        [wallet.address],
        data.childDaoTokenName,
        data.childDaoTokenSymbol,
        data.gnosisSubDomain
      );

      const safeTx = await (
        await governor.createChildDAO(_tokenData, _safeData, _subdomain)
      ).wait();

      const dao = safeTx.events?.find((el) => el.event === "ChildDaoCreated")
        ?.args?.safe;

      toast({
        title: "Child DAO Created",
        description: `Deployed at: ${dao}`,
        status: "success",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
    } catch (error: any) {
      let errorMessage: string;

      // check if the error is for creating a dao with the same token name
      if (
        error.error.data.message ===
        "Error: VM Exception while processing transaction: reverted with reason string 'Create2 call failed'"
      ) {
        errorMessage = "Child DAO with this token name already exists";
      }

      toast({
        title: "Error",
        description: errorMessage ?? error?.message ?? "Unexpected error.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
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

          <FormControl
            isDisabled={isSubmitting}
            isInvalid={errors?.childDaoTokenName !== undefined}
          >
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

          <FormControl
            isDisabled={isSubmitting}
            isInvalid={errors?.childDaoTokenSymbol !== undefined}
          >
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

          <FormControl
            isDisabled={isSubmitting}
            isInvalid={errors?.gnosisSubDomain !== undefined}
          >
            <FormLabel>DAO subdomain</FormLabel>
            <Input
              placeholder="Child DAO Subdomain"
              type="text"
              {...register("gnosisSubDomain", {
                required: "Subdomain is required",
              })}
            />
            {errors?.gnosisSubDomain?.message ? (
              <FormErrorMessage>
                {errors.gnosisSubDomain.message}
              </FormErrorMessage>
            ) : (
              <FormHelperText>The subdomain for this child DAO</FormHelperText>
            )}
          </FormControl>
        </Stack>

        {/* child dao gnosis safe inputs */}
        <Stack align="center" my="50px">
          <Heading>Gnosis Safe Settings</Heading>
        </Stack>

        <FormControl>
          <Button
            colorScheme="blue"
            isDisabled={!wallet}
            isLoading={isSubmitting}
            type="submit"
            width="100%"
          >
            Create DAO
          </Button>
          <FormHelperText>
            (Creating the first child DAO may take a moment, subsequent
            creations will not take as long)
          </FormHelperText>
        </FormControl>
      </form>
    </PageContainer>
  );
};

export default Form;
