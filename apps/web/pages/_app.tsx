import { ChakraProvider } from "@chakra-ui/react";
import { MetaMaskProvider } from "metamask-react";
import theme from "../theme";

const App = ({ Component, pageProps }) => {
  return (
    <ChakraProvider theme={theme}>
      <MetaMaskProvider>
        <Component {...pageProps} />
      </MetaMaskProvider>
    </ChakraProvider>
  );
};

export default App;
