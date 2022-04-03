import { ChakraProvider, Stack } from "@chakra-ui/react";
import { Center, Container, Heading } from "@chakra-ui/react";
import theme from "../theme";
import { Tokens } from "../layouts/tokens";
import { useForm } from "react-hook-form";
import { GnosisSafe } from "../layouts/gnosis-safe";

export default function Web() {
  const { register, handleSubmit } = useForm();
  return (
    <ChakraProvider theme={theme}>
      <Center>
        <Container>
          <Heading marginTop="5" textAlign="center">
            EarthFund DAO Creator
          </Heading>
          <Stack direction="column" marginTop="5">
            <Tokens register={register} />
            <GnosisSafe register={register} />
          </Stack>
        </Container>
      </Center>
    </ChakraProvider>
  );
}
