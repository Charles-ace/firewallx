import React, { useEffect, useState } from 'react';
import { RefreshCw, Radio, ExternalLink, Wifi, WifiOff, Activity, Layers } from 'lucide-react';
import { OnChainEvent, IndexerStatus, globalOnChainIndexer } from '../engine/onChainIndexer';
import { BOTCHAIN_TESTNET, BOTCHAIN_MAINNET } from '../config/botchain';

const CONTRACT_LABEL: Record<string, string> = {
  registry: 'Registry',
  auditor: 'Auditor',
  guard: 'Guard',
  testTarget: 'TestTarget',
};

const CONTRACT_BADGE_CLS: Record<string, string> = {
  registry: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  auditor: 'bg-sky-100 text-sky-700 ring-sky-200',
  guard: 'bg-violet-100 text-violet-700 ring-violet-200',
  testTarget: 'bg-amber-100 text-amber-700 ring-amber-200',
};

export const OnChainFeed: React.FC = () => {
  const [events, setEvents] = useState<OnChainEvent[]>(globalOnChainIndexer.getEvents());
  const [status, setStatus] = useState<IndexerStatus>(globalOnChainIndexer.getStatus());
  const [syncing, setSyncing] = useState(false);
  const [networkFilter, setNetworkFilter] = useState<'ALL' | 'testnet' | 'mainnet'>('ALL');

  useEffect(() => {
    globalOnChainIndexer.start();
    const unsubEvents = globalOnChainIndexer.subscribeOnChainEvents(setEvents);
    const unsubStatus = globalOnChainIndexer.subscribeStatus(setStatus);
    return () => {
      unsubEvents();
      unsubStatus();
    };
  }, []);

  const handleRefresh = async () => {
    setSyncing(true);
    await globalOnChainIndexer.refresh();
    setSyncing(false);
  };

  const filteredEvents = events.filter((e) => {
    if (networkFilter === 'ALL') return true;
    return e.network === networkFilter;
  });

  const lastSync = status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString() : '—';

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
      {/* Header — clearly separated from the simulation feed */}
      <div className="px-4 py-3 bg-emerald-600/5 border-b border-emerald-200 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-600 text-white">
            <Radio className="w-4 h-4" />
          </span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 font-mono flex items-center gap-2">
              <span>On-Chain Sentinel Event Feed</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 font-mono">MULTI-CHAIN</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Mainnet (677) & Testnet (968) live smart contract logs
            </div>
          </div>
        </div>

        {/* Network Filter Pills */}
        <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-[10px] font-mono">
          <button
            onClick={() => setNetworkFilter('ALL')}
            className={`px-2 py-0.5 rounded-md font-bold transition-all ${
              networkFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All Chains ({events.length})
          </button>
          <button
            onClick={() => setNetworkFilter('mainnet')}
            className={`px-2 py-0.5 rounded-md font-bold transition-all ${
              networkFilter === 'mainnet' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Mainnet 677 ({events.filter(e => e.network === 'mainnet').length})
          </button>
          <button
            onClick={() => setNetworkFilter('testnet')}
            className={`px-2 py-0.5 rounded-md font-bold transition-all ${
              networkFilter === 'testnet' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Testnet 968 ({events.filter(e => e.network === 'testnet').length})
          </button>
        </div>

        <div className="flex items-center gap-2 ml-auto text-[11px] font-mono text-slate-500">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              status.error
                ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'
                : status.running
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                  : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
            }`}
          >
            {status.error ? <WifiOff className="w-3 h-3" /> : status.running ? <Wifi className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
            {status.error ? 'RPC ERROR' : 'LIVE'}
          </span>
          <span className="hidden sm:inline">sync {lastSync}</span>
          <button
            onClick={handleRefresh}
            disabled={syncing}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 text-[11px] font-bold"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {status.error && (
        <div className="px-4 py-2 bg-rose-50 border-b border-rose-100 text-[11px] font-mono text-rose-600">
          Indexer error: {status.error}
        </div>
      )}

      {filteredEvents.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="text-xs font-mono text-slate-400 mb-1">No events matching the active network filter.</div>
          <div className="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
            This feed watches the deployed Registry, Auditor, Guard, and TestTarget contracts on BOT Chain.
            Transactions fired from the Attack Sandbox appear here in real time.
          </div>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
          {filteredEvents.map((e) => {
            const explorerUrl = e.network === 'mainnet'
              ? `${BOTCHAIN_MAINNET.blockExplorerUrls[0]}/tx/${e.txHash}`
              : `${BOTCHAIN_TESTNET.blockExplorerUrls[0]}/tx/${e.txHash}`;

            return (
              <div key={e.id} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-slate-50/80 transition-colors">
                {/* Network Label Badge */}
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono ${
                    e.network === 'mainnet'
                      ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'
                      : 'bg-blue-100 text-blue-800 ring-1 ring-blue-300'
                  }`}
                >
                  {e.network === 'mainnet' ? 'MAINNET 677' : 'TESTNET 968'}
                </span>

                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ring-1 font-mono ${
                    CONTRACT_BADGE_CLS[e.contract] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
                  }`}
                >
                  {CONTRACT_LABEL[e.contract]}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-[10px] font-mono font-bold">
                  {e.eventName}
                </span>
                <span className="text-[12px] text-slate-700 font-mono truncate max-w-full flex-1 min-w-[220px]">
                  {e.summary}
                </span>
                <span className="text-[10px] font-mono text-slate-400">#{e.blockNumber}</span>
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 text-[10px] font-mono hover:underline font-bold ${
                    e.network === 'mainnet' ? 'text-amber-700' : 'text-blue-700'
                  }`}
                  title={e.txHash}
                >
                  {e.txHash.slice(0, 8)}…{e.txHash.slice(-6)}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>Verified on-chain events — indexed directly from deployed contracts on BOT Chain.</span>
        <span>{filteredEvents.length} displayed</span>
      </div>
    </div>
  );
};