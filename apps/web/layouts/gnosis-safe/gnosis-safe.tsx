import * as React from "react";
import {
  Stack,
  Heading,
  Input,
  FormControl,
  FormHelperText,
  FormLabel,
} from "@chakra-ui/react";

export const GnosisSafe = ({ register }) => {
  return (
    <Stack direction="column">
      <Heading>Gnosis Safe settings</Heading>
      <FormControl>
        <FormLabel htmlFor="tokenName">DAO token name</FormLabel>
        <Input
          placeholder="Child DAO Token"
          id="tokenName"
          type="text"
          {...register("tokenName", { required: true })}
        />
        <FormHelperText>The name you want for the token</FormHelperText>
      </FormControl>
      <FormControl>
        <FormLabel htmlFor="tokenSymbol">DAO token symbol</FormLabel>
        <Input
          placeholder="CHILD-DAO"
          id="tokenSymbol"
          type="text"
          {...register("tokenSymbol", {
            required: true,
            setValueAs: (v: string) => v.toUpperCase(),
          })}
        />
        <FormHelperText>The symbol you want for the token</FormHelperText>
      </FormControl>
    </Stack>
  );
};
