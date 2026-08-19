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

export type NetworkMode = 'testnet' | 'mainnet' | 'sandbox';

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
    registry: '0xbbEAf8B3445dBa8e2cC468Da27675A65e59D8fEf',
    auditor: '0x8ff7236490Cf597ABD9a8233138EcFe195Df474D',
    guard: '0x03c368fE89B7A7a75f3FCE186554F01a18FDAb0e',
    testTarget: '0x92078F723b8E557EF011C40e1c4413445574C158',
  },
};

export function getNetworkConfig(mode: 'testnet' | 'mainnet'): NetworkConfig {
  return mode === 'mainnet' ? BOTCHAIN_MAINNET : BOTCHAIN_TESTNET;
}

export const CURRENT_NETWORK = BOTCHAIN_TESTNET;
