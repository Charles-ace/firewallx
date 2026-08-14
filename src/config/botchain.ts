export interface NetworkConfig {
  chainId: number;
  chainName: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
  faucetUrl?: string;
  contracts: {
    registry: string;
    auditor: string;
    guard: string;
    testTarget: string;
  };
}

export const BOTCHAIN_TESTNET: NetworkConfig = {
  chainId: 968,
  chainName: 'BOT Chain Testnet',
  rpcUrl: 'https://rpc.bohr.life',
  nativeCurrency: {
    name: 'BOT',
    symbol: 'tBOT',
    decimals: 18,
  },
  blockExplorerUrls: ['https://scan.bohr.life'],
  faucetUrl: 'https://faucet.botchain.ai/basic',
  contracts: {
    registry: '0x8e55ac0a66E9E34376dcCb7D693FeBfF239C3145',
    auditor: '0x87432661f99EcbD0f1510Eda4a0AfAF5540C93bB',
    guard: '0x2985B6e0dE7F34c503a52F217927d23bb129aa67',
    testTarget: '0xc93932A69E2A9868AAAEC4CAaafB9B9DB508a555',
  },
};

export const BOTCHAIN_MAINNET: NetworkConfig = {
  chainId: 677,
  chainName: 'BOT Chain Mainnet',
  rpcUrl: 'https://rpc.botchain.ai',
  nativeCurrency: {
    name: 'BOT',
    symbol: 'BOT',
    decimals: 18,
  },
  blockExplorerUrls: ['https://scan.botchain.ai'],
  contracts: {
    registry: '0x0000000000000000000000000000000000000000',
    auditor: '0x0000000000000000000000000000000000000000',
    guard: '0x0000000000000000000000000000000000000000',
    testTarget: '0x0000000000000000000000000000000000000000',
  },
};

export const CURRENT_NETWORK = BOTCHAIN_TESTNET;
