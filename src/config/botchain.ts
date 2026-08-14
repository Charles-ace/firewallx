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
    registry: '0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1',
    auditor: '0x3F9f55ff8c3C5090b8321E9ecB8B6c02a13a055A',
    guard: '0xa9c078278a1164838Ab449e6019A779242605758',
    testTarget: '0x35810D68685f11a792438E2Fd237A10313015228',
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
