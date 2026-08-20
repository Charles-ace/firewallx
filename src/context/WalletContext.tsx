import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { BOTCHAIN_TESTNET, BOTCHAIN_MAINNET, NetworkConfig, getNetworkConfig } from '../config/botchain';
import { globalOnChainClient } from '../engine/onChainClient';

export type ActiveNetworkMode = 'testnet' | 'mainnet';

interface WalletContextType {
  account: string | null;
  chainId: number | null;
  balance: string;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
  networkMode: ActiveNetworkMode;
  setNetworkMode: (mode: ActiveNetworkMode) => void;
  activeNetworkConfig: NetworkConfig;
  connectionError: string | null;
  isWalletModalOpen: boolean;
  setIsWalletModalOpen: (open: boolean) => void;
  connectWallet: () => Promise<void>;
  connectInjected: () => Promise<boolean>;
  connectDemo: () => Promise<void>;
  disconnectWallet: () => void;
  switchToBotChain: (targetChainId?: number) => Promise<void>;
  clearError: () => void;
}

export const WalletContext = createContext<WalletContextType>({
  account: null,
  chainId: null,
  balance: '0',
  isConnecting: false,
  isCorrectNetwork: false,
  networkMode: 'testnet',
  setNetworkMode: () => {},
  activeNetworkConfig: BOTCHAIN_TESTNET,
  connectionError: null,
  isWalletModalOpen: false,
  setIsWalletModalOpen: () => {},
  connectWallet: async () => {},
  connectInjected: async () => false,
  connectDemo: async () => {},
  disconnectWallet: () => {},
  switchToBotChain: async () => {},
  clearError: () => {},
});

const CONNECT_TIMEOUT_MS = 45000;
const CHAIN_SWITCH_TIMEOUT_MS = 30000;
const MAX_CONNECT_ATTEMPTS = 2;

interface Eip1193Provider {
  isMetaMask?: boolean;
  isRabby?: boolean;
  providers?: Eip1193Provider[];
  request: (args: { method: string; params?: unknown[] | object }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

const isValidAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);

const normalizeAccounts = (result: unknown): string[] => {
  if (!result) return [];
  if (isValidAddress(result)) return [result];
  if (Array.isArray(result)) return result.filter(isValidAddress);
  if (typeof result === 'object') {
    const obj = result as { accounts?: unknown; account?: unknown; address?: unknown };
    if (Array.isArray(obj.accounts)) return obj.accounts.filter(isValidAddress);
    if (isValidAddress(obj.account)) return [obj.account];
    if (isValidAddress(obj.address)) return [obj.address];
  }
  return [];
};

const normalizeChainId = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    if (!value) return NaN;
    return value.startsWith('0x') ? parseInt(value.slice(2), 16) : parseInt(value, 10);
  }
  return NaN;
};

const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`No response from your wallet (${label} timed out). If no popup appeared, open your wallet extension and try again.`) as Error & { code?: string };
      err.code = 'WALLET_TIMEOUT';
      reject(err);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
};

const isRabbyProvider = (p: Eip1193Provider | undefined): boolean => {
  if (!p) return false;
  if (p.isRabby) return true;
  if (Array.isArray(p.providers)) return p.providers.some((sub) => sub.isRabby);
  return false;
};

const getInjectedProvider = (): Eip1193Provider | undefined => {
  if (typeof window === 'undefined') return undefined;
  const w = window as { ethereum?: Eip1193Provider };
  if (!w.ethereum) return undefined;
  if (Array.isArray(w.ethereum.providers)) {
    return w.ethereum.providers.find((p) => p.isRabby) || w.ethereum.providers.find((p) => p.isMetaMask) || w.ethereum.providers[0];
  }
  return w.ethereum;
};

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [networkMode, setNetworkModeState] = useState<ActiveNetworkMode>('testnet');

  const accountRef = useRef<string | null>(null);
  accountRef.current = account;

  const activeNetworkConfig = getNetworkConfig(networkMode);
  const isCorrectNetwork = chainId === activeNetworkConfig.chainId;

  const isDemoAccount = (addr: string | null) =>
    addr?.toLowerCase() === '0x9965507d1a55bcc2695c58ba16fb37d819b0a4df' ||
    addr?.toLowerCase() === '0x0760635ee48d744199198d4c0b1da7d14c1f386b';

  const fetchRpcBalance = useCallback(async (address: string, customRpcUrl?: string) => {
    try {
      const rpcUrl = customRpcUrl || activeNetworkConfig.rpcUrl;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
      });
      const data = await res.json();
      if (data.result) {
        const balWei = BigInt(data.result);
        const integerPart = (balWei / 10n ** 18n).toString();
        const remainder = (balWei % 10n ** 18n).toString().padStart(18, '0');
        const formatted = `${integerPart}.${remainder.substring(0, 4)}`;
        setBalance(formatted);
      }
    } catch (e) {
      console.warn('Could not fetch RPC balance:', e);
    }
  }, [activeNetworkConfig.rpcUrl]);

  const updateChainAndBalance = useCallback(async (address: string) => {
    if (isDemoAccount(address)) {
      fetchRpcBalance(address);
      return;
    }

    const eth = getInjectedProvider();
    if (eth) {
      try {
        const cIdRaw = await eth.request({ method: 'eth_chainId' });
        const cId = normalizeChainId(cIdRaw);
        if (!Number.isNaN(cId)) setChainId(cId);

        const balRaw = await eth.request({ method: 'eth_getBalance', params: [address, 'latest'] });
        if (balRaw) {
          const balWei = BigInt(balRaw);
          const integerPart = (balWei / 10n ** 18n).toString();
          const remainder = (balWei % 10n ** 18n).toString().padStart(18, '0');
          const formatted = `${integerPart}.${remainder.substring(0, 4)}`;
          setBalance(formatted);
        }
      } catch {
        fetchRpcBalance(address);
      }
    } else {
      fetchRpcBalance(address);
    }
  }, [fetchRpcBalance]);

  const setNetworkMode = useCallback((mode: ActiveNetworkMode) => {
    setNetworkModeState(mode);
    globalOnChainClient.setNetwork(mode);
    const targetConfig = getNetworkConfig(mode);
    // If connected to demo account, switch demo address to match network
    if (isDemoAccount(accountRef.current)) {
      const demoAddress = mode === 'mainnet' ? '0x0760635eE48D744199198d4c0b1Da7D14C1F386b' : '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df';
      setAccount(demoAddress);
      setChainId(targetConfig.chainId);
      fetchRpcBalance(demoAddress, targetConfig.rpcUrl);
    } else if (accountRef.current) {
      fetchRpcBalance(accountRef.current, targetConfig.rpcUrl);
    }
  }, [fetchRpcBalance]);

  useEffect(() => {
    // Check if already connected on load
    const eth = getInjectedProvider();
    if (eth) {
      eth
        .request({ method: 'eth_accounts' })
        .then((result) => {
          const accounts = normalizeAccounts(result);
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            updateChainAndBalance(accounts[0]);
          }
        })
        .catch(() => {});

      const handleAccountsChanged = (result: unknown) => {
        const accounts = normalizeAccounts(result);
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          updateChainAndBalance(accounts[0]);
        } else {
          setAccount(null);
          setBalance('0');
        }
      };

      const handleChainChanged = (_chainId: unknown) => {
        const parsed = normalizeChainId(_chainId);
        if (!Number.isNaN(parsed)) {
          setChainId(parsed);
          if (accountRef.current) {
            updateChainAndBalance(accountRef.current);
          }
        }
      };

      eth.on?.('accountsChanged', handleAccountsChanged);
      eth.on?.('chainChanged', handleChainChanged);

      return () => {
        eth.removeListener?.('accountsChanged', handleAccountsChanged);
        eth.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, [updateChainAndBalance]);

  // Immediately refresh balance when switching between Testnet and Mainnet
  useEffect(() => {
    if (account) {
      updateChainAndBalance(account);
    }
  }, [networkMode, account, updateChainAndBalance]);

  const connectInjected = async (): Promise<boolean> => {
    setConnectionError(null);
    const eth = getInjectedProvider();

    if (!eth) {
      setConnectionError('No Web3 wallet extension detected in browser. Please install MetaMask/Rabby or use Demo Sentinel Wallet.');
      return false;
    }

    const rabby = isRabbyProvider(eth);

    const finalizeConnection = async (address: string) => {
      setAccount(address);
      setIsWalletModalOpen(false);

      const chainResult = await eth
        .request({ method: 'eth_chainId' })
        .catch(() => null);
      const chain = chainResult === null ? NaN : normalizeChainId(chainResult);
      if (!Number.isNaN(chain) && chain !== activeNetworkConfig.chainId) {
        await switchToBotChain(activeNetworkConfig.chainId);
      }

      updateChainAndBalance(address);
      return true;
    };

    setIsConnecting(true);
    let lastError: any = null;
    try {
      for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
        try {
          const result = await withTimeout(
            eth.request({ method: 'eth_requestAccounts', params: [] }),
            CONNECT_TIMEOUT_MS,
            'wallet approval'
          );
          const accounts = normalizeAccounts(result);
          if (accounts.length > 0) {
            return await finalizeConnection(accounts[0]);
          }
          const existing = normalizeAccounts(
            await eth.request({ method: 'eth_accounts' }).catch(() => null)
          );
          if (existing.length > 0) {
            return await finalizeConnection(existing[0]);
          }
          lastError = new Error('Wallet returned no accounts.');
          break;
        } catch (err: any) {
          if (err?.code === 4100 || err?.code === -32601 || err?.code === 4200) {
            try {
              await withTimeout(
                eth.request({
                  method: 'wallet_requestPermissions',
                  params: [{ eth_accounts: {} }],
                }),
                CONNECT_TIMEOUT_MS,
                'wallet permission request'
              );
              const accounts = normalizeAccounts(
                await eth.request({ method: 'eth_accounts' })
              );
              if (accounts.length > 0) {
                return await finalizeConnection(accounts[0]);
              }
            } catch (permErr: any) {
              lastError = permErr;
            }
            break;
          }

          if (err?.code === 4001) {
            setConnectionError(
              rabby
                ? 'Rabby did not approve the connection. If no popup appeared, click the Rabby extension icon and try again.'
                : 'Connection request was declined in your wallet. If no popup appeared, unlock your wallet and try again.'
            );
            return false;
          }

          lastError = err;
          if (attempt === 1 && (err?.code === -32002 || err?.code === -32603)) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          break;
        }
      }
      throw lastError || new Error('Failed to connect wallet.');
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      if (err?.code === 'WALLET_TIMEOUT') {
        setConnectionError(err.message);
      } else {
        setConnectionError(err.message || 'Failed to connect wallet.');
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const connectDemo = async () => {
    setConnectionError(null);
    setIsConnecting(true);
    const demoAddress = networkMode === 'mainnet' ? '0x0760635eE48D744199198d4c0b1Da7D14C1F386b' : '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df';
    const targetChain = networkMode === 'mainnet' ? BOTCHAIN_MAINNET.chainId : BOTCHAIN_TESTNET.chainId;
    setAccount(demoAddress);
    setChainId(targetChain);
    setIsWalletModalOpen(false);
    setIsConnecting(false);
    fetchRpcBalance(demoAddress);
  };

  const connectWallet = async () => {
    setIsWalletModalOpen(true);
  };

  const disconnectWallet = () => {
    setAccount(null);
    setChainId(null);
    setBalance('0');
    setConnectionError(null);
  };

  const switchToBotChain = async (targetChainId?: number) => {
    const eth = getInjectedProvider();
    if (!eth) return;

    const targetConfig = targetChainId === BOTCHAIN_MAINNET.chainId || (!targetChainId && networkMode === 'mainnet')
      ? BOTCHAIN_MAINNET
      : BOTCHAIN_TESTNET;

    const targetChainIdHex = `0x${targetConfig.chainId.toString(16)}`;

    try {
      await withTimeout(
        eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainIdHex }],
        }),
        CHAIN_SWITCH_TIMEOUT_MS,
        'network switch'
      );
      setChainId(targetConfig.chainId);
    } catch (switchError: any) {
      if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
        try {
          await withTimeout(
            eth.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: targetChainIdHex,
                  chainName: targetConfig.chainName,
                  rpcUrls: [targetConfig.rpcUrl],
                  nativeCurrency: targetConfig.nativeCurrency,
                  blockExplorerUrls: targetConfig.blockExplorerUrls,
                },
              ],
            }),
            CHAIN_SWITCH_TIMEOUT_MS,
            'network add'
          );
          setChainId(targetConfig.chainId);
        } catch (addError: any) {
          console.error('Failed to add BOT Chain network:', addError);
          setConnectionError(`Failed to add ${targetConfig.chainName} to wallet: ${addError.message || ''}`);
        }
      } else if (switchError.code !== 'WALLET_TIMEOUT') {
        console.error('Failed to switch network:', switchError);
        setConnectionError('Failed to switch network: ' + (switchError.message || ''));
      }
    }
  };

  const clearError = () => setConnectionError(null);

  return (
    <WalletContext.Provider
      value={{
        account,
        chainId,
        balance,
        isConnecting,
        isCorrectNetwork,
        networkMode,
        setNetworkMode,
        activeNetworkConfig,
        connectionError,
        isWalletModalOpen,
        setIsWalletModalOpen,
        connectWallet,
        connectInjected,
        connectDemo,
        disconnectWallet,
        switchToBotChain,
        clearError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export { useWallet } from './useWallet';
