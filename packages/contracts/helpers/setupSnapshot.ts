import snapshot from "@snapshot-labs/snapshot.js";
import pinataSdk from "@pinata/sdk";
import axios from "axios";

interface Settings {
  name: string;
  about: string;
  symbol?: string;
  admins: string[];
  github?: string;
  twitter?: string;
  avatar?: string;
  members: string[];
  network?: string;
  plugins?: {};
  strategies?: {
    name: string;
    network: string;
    params: { [key: string]: any };
  }[];
  filters?: {
    minScore: number;
    onlyMembers: boolean;
  };
  validation?: { name: string; params: {} };
}

interface DAOParams {
  tokenSymbol: string;
  tokenAddress: string;
  realityModuleAddress: string;
}

export const createSnapshotKeyValue = async (
  spaceParams: Settings,
  daoParams: DAOParams
): Promise<{
  snapshotKey: string;
  snapshotValue: string;
}> => {
  const keyPair = { snapshotKey: "snapshot", snapshotValue: "" };
  const settings: Settings = { ...spaceParams };

  settings.symbol = spaceParams?.symbol || daoParams.tokenSymbol;
  settings.network = spaceParams?.network || "1";
  settings.validation = spaceParams?.validation || {
    name: "basic",
    params: {},
  };
  settings.filters = spaceParams?.filters || {
    minScore: 200000,
    onlyMembers: false,
  };
  settings.plugins = spaceParams?.plugins || {
    safeSnap: {
      safes: [
        {
          network: spaceParams?.network || "1",
          realityAddress: daoParams.realityModuleAddress,
        },
      ],
    },
  };
  settings.strategies = spaceParams?.strategies || [
    {
      name: "erc20-balance-of",
      network: spaceParams?.network || "1",
      params: {
        symbol: daoParams.tokenSymbol,
        address: daoParams.tokenAddress,
        decimals: 18,
      },
    },
  ];

  const valid = snapshot.utils.validateSchema(snapshot.schemas.space, settings);
  if (valid === true) {
    keyPair.snapshotValue = await uploadSettings(settings);
    return keyPair;
  } else {
    throw new Error(JSON.stringify(valid));
  }
};

const uploadSettings = async (settings: Settings): Promise<string> => {
  const pinata = pinataSdk(
    process.env.PINATA_KEY || "",
    process.env.PINATA_SECRET || ""
  );
  const resp = await pinata.pinJSONToIPFS(settings);
  return `ipfs://${resp.IpfsHash}`;
};

export const createSnapshotSpace = async (ensDomain: string) => {
  await axios.get(`https://hub.snapshot.org/api/spaces/${ensDomain}/poke`);
};

const exampleSettingsFile = {
  name: "",
  skin: "index",
  about: "",
  admins: ["0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00"],
  avatar:
    "https://pbs.twimg.com/profile_images/1431587138202701826/lpgblc4h_400x400.jpg",
  github: "lootproject",
  symbol: "LOOT",
  filters: {
    minScore: 1,
    onlyMembers: false,
  },
  members: [],
  network: "1",
  plugins: {},
  twitter: "lootproject",
  strategies: [
    {
      name: "erc721",
      params: {
        symbol: "LOOT",
        address: "0xff9c1b15b16263c61d017ee9f65c50e4ae0113d7",
      },
    },
  ],
  validation: {
    name: "basic",
    params: {},
  },
};

const sushi = {
  id: "sushigov.eth",
  name: "Sushi",
  about: "Sushi Governance Snapshot",
  network: "1",
  symbol: "SUSHIPOWAH",
  terms: null,
  skin: "sushi",
  avatar: "ipfs://QmT1Ban8im8JQm2gqYSoMGaLZTgxR8nFyrYBF7MgWvRKFh",
  twitter: "SushiSwap",
  website: null,
  github: "sushiswap",
  private: false,
  domain: "vote.sushi.com",
  members: [
    "0x4bb4c1B0745ef7B4642fEECcd0740deC417ca0a0",
    "0x1C0Aa8cCD568d90d61659F060D1bFb1e6f855A20",
    "0x19B3Eb3Af5D93b77a5619b047De0EED7115A19e7",
  ],
  admins: [
    "0x4bb4c1B0745ef7B4642fEECcd0740deC417ca0a0",
    "0x1C0Aa8cCD568d90d61659F060D1bFb1e6f855A20",
    "0x19B3Eb3Af5D93b77a5619b047De0EED7115A19e7",
  ],
  categories: [],
  plugins: {
    hal: {},
    poap: {},
    quorum: {
      total: 5000000,
      strategy: "static",
    },
  },
  followersCount: 40812,
  parent: null,
  children: [],
  voting: {
    delay: null,
    period: null,
    type: null,
    quorum: null,
    hideAbstain: false,
  },
  strategies: [
    {
      name: "erc20-balance-of",
      network: "1",
      params: {
        symbol: "SUSHIPOWAH",
        address: "0x62d11bc0652e9D9B66ac0a4c419950eEb9cFadA6",
        decimals: 18,
      },
    },
    {
      name: "delegation",
      network: "1",
      params: {
        symbol: "SUSHIPOWAH (delegated)",
        strategies: [
          {
            name: "erc20-balance-of",
            params: {
              symbol: "SUSHIPOWAH",
              address: "0x62d11bc0652e9D9B66ac0a4c419950eEb9cFadA6",
              decimals: 18,
            },
          },
        ],
      },
    },
    {
      name: "multichain",
      network: "137",
      params: {
        symbol: "polygon-xSUSHI",
        strategies: [
          {
            name: "erc20-balance-of",
            params: {
              address: "0x6811079E3c63ED96Eb005384d7E7ec8810E3D521",
              decimals: 18,
            },
            network: "137",
          },
        ],
      },
    },
  ],
  validation: {
    name: "basic",
    params: {},
  },
  filters: {
    minScore: 200000,
    onlyMembers: false,
  },
  treasuries: [
    {
      name: "Sushi Treasury",
      address: "0xe94b5eec1fa96ceecbd33ef5baa8d00e4493f4f3",
      network: "1",
    },
  ],
};
