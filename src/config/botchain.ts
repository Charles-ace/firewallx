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
    registry: '0x271b7549524fa569317f8abaa0EB4504C280F4AD',
    auditor: '0x0E969975A150AC0Fc8874dd6f68c0fE5c0b7EbAa',
    guard: '0x84d6d903045D686550D4B2bA01003aDF5917f114',
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
