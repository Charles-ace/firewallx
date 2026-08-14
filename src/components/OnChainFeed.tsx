import React, { useEffect, useState } from 'react';
import { RefreshCw, Radio, ExternalLink, Wifi, WifiOff, Activity } from 'lucide-react';
import { OnChainEvent, IndexerStatus, globalOnChainIndexer } from '../engine/onChainIndexer';
import { BOTCHAIN_TESTNET } from '../config/botchain';

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
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 font-mono">
              On-Chain Sentinel Events
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              indexed from {BOTCHAIN_TESTNET.chainName} · rpc.bohr.life
            </div>
          </div>
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
          <span className="hidden sm:inline">block #{status.lastSyncBlock}</span>
          <span className="hidden sm:inline">· sync {lastSync}</span>
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

      {events.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="text-xs font-mono text-slate-400 mb-1">No on-chain events indexed yet.</div>
          <div className="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
            This feed watches the deployed Registry, Auditor, Guard and TestTarget contracts for real events.
            Trigger one from the chain (e.g. call{' '}
            <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-600">TestTargetContract.setKeyValue</code> or
            register an agent) and it will appear here within the next poll cycle (~20s).
          </div>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100">
          {events.map((e) => (
            <div key={e.id} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 hover:bg-emerald-50/40">
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ring-1 font-mono ${
                  CONTRACT_BADGE_CLS[e.contract] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
                }`}
              >
                {CONTRACT_LABEL[e.contract]}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-[10px] font-mono">
                {e.eventName}
              </span>
              <span className="text-[12px] text-slate-700 font-mono truncate max-w-full flex-1 min-w-[220px]">
                {e.summary}
              </span>
              <span className="text-[10px] font-mono text-slate-400">#{e.blockNumber}</span>
              <a
                href={`${BOTCHAIN_TESTNET.blockExplorerUrls[0]}/tx/${e.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-700 hover:underline"
                title={e.txHash}
              >
                {e.txHash.slice(0, 10)}…{e.txHash.slice(-6)}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>Real chain events — independent of the in-browser simulation engine.</span>
        <span>{events.length} indexed</span>
      </div>
    </div>
  );
};