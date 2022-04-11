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
  HStack,
  IconButton,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon } from "@chakra-ui/icons";
import detectEthereumProvider from "@metamask/detect-provider";
import { ethers, providers, Wallet } from "ethers";
import React, { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import validator from "validator";

import {
  IGovernor,
  IENSController,
  IENSRegistrar,
} from "contracts/typechain-types";
import GovernorArtifact from "contracts/artifacts/contracts/implementations/Governor.sol/Governor.json";
import ENSControllerArtifact from "contracts/artifacts/contracts/vendors/IENSController.sol/IENSController.json";
import ENSRegistrarArtifact from "contracts/artifacts/contracts/vendors/IENSRegistrar.sol/IENSRegistrar.json";
import ContractAddresses from "contracts/constants/contractAddresses";

import PageContainer from "../components/PageContainer";
import buyEnsDomain from "../helpers/buyEnsDomain";
import governorAddEnsDomain from "../helpers/governorAddEnsDomain";
import createChildDaoConfig from "../helpers/createChildDaoConfig";

const Form = () => {
  const toast = useToast();
  const [wallet, setWallet] = useState<Wallet | undefined>();
  const [governor, setGovernor] = useState<IGovernor | undefined>();
  const [ensController, setEnsController] = useState<
    IENSController | undefined
  >();
  const [ensRegistrar, setEnsRegistrar] = useState<IENSRegistrar | undefined>();

  const buttonsDisabled =
    !wallet || !governor || !ensController || !ensRegistrar;

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
        ContractAddresses["5"].ENSController,
        ENSControllerArtifact.abi,
        wallet
      ) as IENSController;
      setEnsController(ensController);

      // get the ENS registrar contract
      const ensRegistrar: IENSRegistrar = new ethers.Contract(
        ContractAddresses["5"].ENSRegistrar,
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
    getValues,
    reset,
  } = useForm<DaoCreationForm>({
    defaultValues: {
      childDaoTokenName: "",
      childDaoTokenSymbol: "",
      childDaoSubDomain: "",
      gnosisOwners: [{ address: "" }],
      gnosisThreshold: 1,
    },
  });

  // owners hook form field array
  const { fields, append, remove } = useFieldArray({
    control,
    name: "gnosisOwners",
  });

  // submit handler
  const onSubmit = async (data: DaoCreationForm) => {
    // early return if no signer or data assigned
    if (
      buttonsDisabled ||
      !data.childDaoTokenName ||
      !data.childDaoTokenSymbol ||
      !data.childDaoSubDomain ||
      !data.gnosisOwners.length ||
      !data.gnosisThreshold ||
      data.gnosisOwners.length < data.gnosisThreshold
    )
      return;

    try {
      // setup ENS Domain if it hasn't already been
      const currentENSDomainNFTId = await governor.ensDomainNFTId();
      if (currentENSDomainNFTId.eq(ethers.utils.parseEther("0"))) {
        // buy an ens domain for the dao being created
        const ensDomainToken = await buyEnsDomain(wallet, ensController);
        await governorAddEnsDomain(ensDomainToken, governor, ensRegistrar);
      }

      // create the child dao config
      const { _tokenData, _safeData, _subdomain } = await createChildDaoConfig(
        data.gnosisOwners.map((owner) => owner.address),
        data.gnosisThreshold,
        data.childDaoTokenName,
        data.childDaoTokenSymbol,
        data.childDaoSubDomain
      );

      const safeTx = await (
        await governor.createChildDAO(_tokenData, _safeData, _subdomain, {
          gasLimit: 600000,
        })
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

      reset({
        childDaoTokenName: "",
        childDaoTokenSymbol: "",
        childDaoSubDomain: "",
        gnosisOwners: [{ address: "" }],
        gnosisThreshold: 1,
      });
    } catch (error: any) {
      let errorMessage: string;

      // check if the error is for creating a dao with the same token name
      if (
        error?.error?.data?.message ===
          "Error: VM Exception while processing transaction: reverted with reason string 'Create2 call failed'" ||
        error?.error?.data?.message ===
          "Error: VM Exception while processing transaction: reverted with reason string 'ERC1167: create2 failed'"
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
            isInvalid={errors?.childDaoSubDomain !== undefined}
          >
            <FormLabel>DAO subdomain</FormLabel>
            <Input
              placeholder="Child DAO Subdomain"
              type="text"
              {...register("childDaoSubDomain", {
                required: "Subdomain is required",
              })}
            />
            {errors?.childDaoSubDomain?.message ? (
              <FormErrorMessage>
                {errors.childDaoSubDomain.message}
              </FormErrorMessage>
            ) : (
              <FormHelperText>The subdomain for this child DAO</FormHelperText>
            )}
          </FormControl>
        </Stack>

        {/* child dao gnosis safe inputs */}
        <Stack align="center" my="50px">
          <Heading>Gnosis Safe Settings</Heading>

          {fields.map((field, index) => (
            <FormControl
              key={field.id}
              isDisabled={isSubmitting}
              isInvalid={errors["gnosisOwners"]?.[index]?.address !== undefined}
            >
              {index === 0 && <FormLabel>Safe owners</FormLabel>}
              <HStack>
                <Input
                  placeholder="Ethereum address"
                  type="text"
                  {...register(`gnosisOwners.${index}.address`, {
                    required: "Address is required",
                    validate: (value) => {
                      if (!validator.isEthereumAddress(value))
                        return "Invalid ethereum address";
                      if (
                        getValues("gnosisOwners")
                          .map((addresses) => addresses.address)
                          .filter((address) => address === value).length > 1
                      )
                        // checks if this address has already been inputted
                        return "Address already inputted";
                      return true;
                    },
                  })}
                />
                {index !== 0 && !isSubmitting && (
                  <IconButton
                    aria-label="Remove address input button"
                    icon={<DeleteIcon />}
                    variant="ghost"
                    onClick={() => remove(index)}
                  />
                )}
              </HStack>
              {errors["gnosisOwners"]?.[index]?.address ? (
                <FormErrorMessage>
                  {errors["gnosisOwners"][index].address.message}
                </FormErrorMessage>
              ) : (
                <FormHelperText>
                  Ethereum address for an owner of the child DAO gnosis safe
                </FormHelperText>
              )}
            </FormControl>
          ))}
          {!isSubmitting && (
            <Button
              isDisabled={buttonsDisabled}
              isLoading={isSubmitting}
              rightIcon={<AddIcon />}
              onClick={() => append({ address: "" })}
              size="sm"
              variant="ghost"
            >
              Add
            </Button>
          )}

          <FormControl
            isDisabled={isSubmitting}
            isInvalid={errors?.gnosisThreshold !== undefined}
          >
            <FormLabel>Safe threshold</FormLabel>
            <Input
              placeholder="Gnosis safe threshold"
              type="number"
              {...register("gnosisThreshold", {
                required: "Threshold is required",
                validate: (value) => {
                  if (value < 1) return "Threshold must be at least 1";
                  if (value > fields.length)
                    return "Threshold must be less than or equal to the amount of owners";
                  return true;
                },
              })}
            />
            {errors?.gnosisThreshold?.message ? (
              <FormErrorMessage>
                {errors.gnosisThreshold.message}
              </FormErrorMessage>
            ) : (
              <FormHelperText>The threshold for the gnosis safe</FormHelperText>
            )}
          </FormControl>
        </Stack>

        <FormControl>
          <Button
            colorScheme="blue"
            isDisabled={buttonsDisabled}
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
