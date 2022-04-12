import { ChakraProvider } from "@chakra-ui/react";
import { MetaMaskProvider, useMetaMask } from "metamask-react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import theme from "../theme";

const App = ({ Component, pageProps }) => {
  const router = useRouter();
  const { status } = useMetaMask();

  // navigate to form page if wallet is connected, or the connect page if not connected
  useEffect(() => {
    if (status === "connected") {
      router.push("/form");
    } else {
      router.push("/");
    }
  }, [status]);

  return <Component {...pageProps} />;
};

const AppWithContext = ({ Component, pageProps }) => {
  return (
    <ChakraProvider theme={theme}>
      <MetaMaskProvider>
        <App Component={Component} pageProps={pageProps} />
      </MetaMaskProvider>
    </ChakraProvider>
  );
};

export default AppWithContext;
