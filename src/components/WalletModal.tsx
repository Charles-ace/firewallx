import React, { useState } from 'react';
import { 
  X, Wallet, CheckCircle2, AlertTriangle, ExternalLink, ShieldCheck, 
  Sparkles, RefreshCw, Layers, ArrowRight, Network 
} from 'lucide-react';
import { useWallet } from '../context/useWallet';

export const WalletModal: React.FC = () => {
  const { 
    isWalletModalOpen, 
    setIsWalletModalOpen, 
    connectInjected, 
    connectDemo, 
    isConnecting, 
    connectionError,
    clearError,
    switchToBotChain,
    isCorrectNetwork,
    networkMode,
    activeNetworkConfig,
    account,
    chainId
  } = useWallet();

  const [connectingOption, setConnectingOption] = useState<'injected' | 'demo' | null>(null);

  if (!isWalletModalOpen) return null;

  const handleConnectInjected = async () => {
    setConnectingOption('injected');
    await connectInjected();
    setConnectingOption(null);
  };

  const handleConnectDemo = async () => {
    setConnectingOption('demo');
    await connectDemo();
    setConnectingOption(null);
  };

  const hasInjected = typeof window !== 'undefined' && Boolean((window as any).ethereum);

  const detectedWallet = (() => {
    if (!hasInjected) return null;
    const eth = (window as any).ethereum;
    const provider = eth?.providers?.length ? eth.providers.find((p: any) => p.isMetaMask || p.isRabby) || eth.providers[0] : eth;
    if (provider?.isRabby) return 'Rabby';
    if (provider?.isMetaMask) return 'MetaMask';
    return 'Web3 wallet';
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Connect to FirewallX</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                {activeNetworkConfig.chainName} ({activeNetworkConfig.chainId})
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              clearError();
              setIsWalletModalOpen(false);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {/* Error Banner */}
          {connectionError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs space-y-1 animate-in fade-in">
              <div className="flex items-center space-x-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Connection Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-600">{connectionError}</p>
            </div>
          )}

          {/* Option 1: Browser Injected (MetaMask / Rabby / Phantom) */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1 font-semibold">
              Web3 Extensions
            </div>

            <button
              onClick={() => handleConnectInjected()}
              disabled={isConnecting || connectingOption !== null}
              className="w-full p-4 rounded-2xl border border-slate-200 bg-white hover:bg-blue-50/40 hover:border-blue-300 transition-all flex items-center justify-between group text-left shadow-sm disabled:opacity-60"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 ring-1 ring-orange-100 flex items-center justify-center shrink-0">
                  <Wallet className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 flex items-center space-x-1.5">
                    <span>Browser Wallet (MetaMask / Rabby)</span>
                    {hasInjected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Extension Detected" />
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {connectingOption === 'injected' ? (
                      <span className="text-blue-600 font-semibold flex items-center space-x-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Waiting for approval — check your wallet popup...</span>
                      </span>
                    ) : hasInjected ? (
                      `${detectedWallet} detected — auto switches to ${activeNetworkConfig.chainName}`
                    ) : 'Auto-prompts extension or fallback'}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>

          {/* Option 2: Demo Mode (1-Click Instant Connect) */}
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-1 font-semibold">
              Instant Demo Access
            </div>

            <button
              onClick={() => handleConnectDemo()}
              disabled={isConnecting || connectingOption !== null}
              className="w-full p-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-white hover:border-emerald-300 transition-all flex items-center justify-between group text-left shadow-sm disabled:opacity-60"
            >
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 ring-1 ring-emerald-200 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 flex items-center space-x-1.5">
                    <span>Demo Sentinel Wallet</span>
                    <span className="chip bg-emerald-100 text-emerald-800 border-emerald-300 !text-[9px] font-bold">
                      {networkMode === 'mainnet' ? 'MAINNET READY' : 'RECOMMENDED'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {connectingOption === 'demo' ? (
                      <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Connecting...</span>
                      </span>
                    ) : (
                      `Pre-configured ${networkMode} agent wallet · No extension required`
                    )}
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>

          {/* BOT Chain Network Info Guide */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600 font-medium">
              <span className="flex items-center space-x-1.5">
                <Network className="w-3.5 h-3.5 text-blue-600" />
                <span>{activeNetworkConfig.chainName} RPC</span>
              </span>
              <span className="text-[10px] font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                Chain ID {activeNetworkConfig.chainId}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
              <div>
                <span className="text-slate-400 block">RPC Endpoint</span>
                <span className="text-slate-700 truncate block">{activeNetworkConfig.rpcUrl}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Symbol</span>
                <span className="text-slate-700 block">{activeNetworkConfig.nativeCurrency.symbol} (18 decimals)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-400">
          <span>{networkMode === 'mainnet' ? 'BOT Chain Mainnet' : 'Need testnet tBOT?'}</span>
          <a
            href={activeNetworkConfig.blockExplorerUrls[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline flex items-center space-x-1"
          >
            <span>Block Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
