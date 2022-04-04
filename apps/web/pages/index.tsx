import { Center, Container, Heading, Stack } from "@chakra-ui/react";
import { Tokens } from "../layouts/tokens";
import { useForm } from "react-hook-form";
import { GnosisSafe } from "../layouts/gnosis-safe";

export default function Web() {
  const { register, handleSubmit } = useForm();
  return (
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
  );
}
