import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { BOTCHAIN_TESTNET } from '../config/botchain';

interface WalletContextType {
  account: string | null;
  chainId: number | null;
  balance: string;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
  connectionError: string | null;
  isWalletModalOpen: boolean;
  setIsWalletModalOpen: (open: boolean) => void;
  connectWallet: () => Promise<void>;
  connectInjected: () => Promise<boolean>;
  connectDemo: () => Promise<void>;
  disconnectWallet: () => void;
  switchToBotChain: () => Promise<void>;
  clearError: () => void;
}

export const WalletContext = createContext<WalletContextType>({
  account: null,
  chainId: null,
  balance: '0',
  isConnecting: false,
  isCorrectNetwork: false,
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

/**
 * Wallets (notably Rabby) have historically returned accounts from
 * eth_requestAccounts / eth_accounts as a plain string, a single-account
 * object, or { accounts: [...] }. Normalize every shape to a string array.
 */
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

/**
 * eth_chainId may arrive as "0x3c8", 968, "968", or a bigint depending on
 * the wallet. Normalize to a decimal number (NaN when unparseable).
 */
const normalizeChainId = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    if (!value) return NaN;
    return value.startsWith('0x') ? parseInt(value.slice(2), 16) : parseInt(value, 10);
  }
  return NaN;
};

/**
 * Some wallets (Rabby popup swallowed, MetaMask SPA edge cases) never
 * resolve the request promise. Never leave the user stuck: surface a clear
 * error instead of hanging silently.
 */
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

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);

  const isCorrectNetwork = chainId === BOTCHAIN_TESTNET.chainId;
  const accountRef = useRef<string | null>(null);
  useEffect(() => {
    accountRef.current = account;
  }, [account]);

  const getInjectedProvider = (): Eip1193Provider | null => {
    if (typeof window === 'undefined') return null;
    const eth = (window as any).ethereum as Eip1193Provider | undefined;
    if (!eth) return null;
    if (eth.providers?.length) {
      // Multiple extensions installed — prefer a known wallet, else first
      return eth.providers.find((p) => p.isMetaMask || p.isRabby) || eth.providers[0];
    }
    return eth;
  };

  const isRabbyProvider = (eth: Eip1193Provider | null): boolean => {
    if (!eth) return false;
    if (eth.isRabby) return true;
    if (eth.providers?.length) return eth.providers.some((p) => p.isRabby);
    return false;
  };

  const fetchRpcBalance = useCallback(async (address: string) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(BOTCHAIN_TESTNET.rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getBalance',
            params: [address, 'latest'],
          }),
          signal: controller.signal,
        });
        const json = await res.json();
        if (json.result) {
          const balInWei = BigInt(json.result);
          setBalance((Number(balInWei) / 1e18).toFixed(4));
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      console.warn('RPC balance query fallback failed:', err);
      setBalance('0.0000');
    }
  }, []);

  const updateChainAndBalance = useCallback(async (address: string) => {
    const eth = getInjectedProvider();
    if (eth) {
      try {
        const chainResult = await withTimeout(
          eth.request({ method: 'eth_chainId' }),
          10000,
          'chain id'
        );
        const currentChain = normalizeChainId(chainResult);
        if (!Number.isNaN(currentChain)) {
          setChainId(currentChain);
        }

        // If connected to BOT Chain Testnet or fallback to RPC
        const balanceHex = await eth.request({
          method: 'eth_getBalance',
          params: [address, 'latest'],
        });
        const balInWei = BigInt(balanceHex || '0x0');
        const balInBot = (Number(balInWei) / 1e18).toFixed(4);
        setBalance(balInBot);
      } catch (err) {
        console.error('Error fetching balance from wallet:', err);
        // Fallback direct RPC query
        fetchRpcBalance(address);
      }
    } else {
      fetchRpcBalance(address);
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

      // Check if network needs switching (never blocks on wallet hang)
      const chainResult = await eth
        .request({ method: 'eth_chainId' })
        .catch(() => null);
      const chain = chainResult === null ? NaN : normalizeChainId(chainResult);
      if (!Number.isNaN(chain) && chain !== BOTCHAIN_TESTNET.chainId) {
        await switchToBotChain();
      }

      // Fetch balance in background — never block connection on RPC latency
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
          // Request resolved but no accounts — check for a pre-existing session
          const existing = normalizeAccounts(
            await eth.request({ method: 'eth_accounts' }).catch(() => null)
          );
          if (existing.length > 0) {
            return await finalizeConnection(existing[0]);
          }
          lastError = new Error('Wallet returned no accounts.');
          break;
        } catch (err: any) {
          // Some wallets (older Rabby builds) don't support eth_requestAccounts
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

          // Explicit user rejection — do not auto-retry
          if (err?.code === 4001) {
            setConnectionError(
              rabby
                ? 'Rabby did not approve the connection. If no popup appeared, click the Rabby extension icon and try again.'
                : 'Connection request was declined in your wallet. If no popup appeared, unlock your wallet and try again.'
            );
            return false;
          }

          lastError = err;
          // Transient pending/internal errors — retry once before giving up
          // (timeouts are NOT retried: the wallet popup was never shown)
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
      } else if (err?.code === -32002) {
        setConnectionError('A wallet connection request is already pending. Open your wallet extension and approve it there.');
      } else if (err?.code === 4001) {
        setConnectionError(rabby
          ? 'Rabby did not approve the connection. If no popup appeared, click the Rabby extension icon and try again.'
          : 'Connection request was declined in your wallet.');
      } else {
        setConnectionError(err?.message || 'Failed to connect wallet. Please try again.');
      }
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const connectDemo = async () => {
    setConnectionError(null);
    setIsConnecting(true);
    const demoAddress = '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df';
    setAccount(demoAddress);
    setChainId(BOTCHAIN_TESTNET.chainId);
    setIsWalletModalOpen(false);
    setIsConnecting(false);
    // Fetch balance in background — never block connection on RPC latency
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

  const switchToBotChain = async () => {
    const eth = getInjectedProvider();
    if (!eth) return;
    const targetChainIdHex = `0x${BOTCHAIN_TESTNET.chainId.toString(16)}`;

    try {
      await withTimeout(
        eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainIdHex }],
        }),
        CHAIN_SWITCH_TIMEOUT_MS,
        'network switch'
      );
      setChainId(BOTCHAIN_TESTNET.chainId);
    } catch (switchError: any) {
      if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
        try {
          await withTimeout(
            eth.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: targetChainIdHex,
                  chainName: BOTCHAIN_TESTNET.chainName,
                  rpcUrls: [BOTCHAIN_TESTNET.rpcUrl],
                  nativeCurrency: BOTCHAIN_TESTNET.nativeCurrency,
                  blockExplorerUrls: BOTCHAIN_TESTNET.blockExplorerUrls,
                },
              ],
            }),
            CHAIN_SWITCH_TIMEOUT_MS,
            'network add'
          );
          setChainId(BOTCHAIN_TESTNET.chainId);
        } catch (addError: any) {
          console.error('Failed to add BOT Chain network:', addError);
          setConnectionError('Failed to add BOT Chain Testnet to wallet: ' + (addError.message || ''));
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
