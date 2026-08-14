import React from 'react';
import { Activity, Terminal, KeyRound, Radio, Code2 } from 'lucide-react';
import { useWallet } from '../context/useWallet';

export type ActiveTab = 'home' | 'telemetry' | 'incident' | 'simulator' | 'policy' | 'audit';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenSDKModal: () => void;
  trippedCount: number;
}

interface TabItem {
  key: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { key: 'telemetry', label: 'Live Telemetry', icon: Activity },
  { key: 'simulator', label: 'Attack Sandbox', icon: Terminal },
  { key: 'policy', label: 'Policy Studio', icon: KeyRound },
  { key: 'audit', label: 'Audit Log', icon: Radio },
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSDKModal,
  trippedCount,
}) => {
  const { account, balance, isCorrectNetwork, connectWallet, disconnectWallet, switchToBotChain } = useWallet();

  const renderChip = (tab: TabItem) => {
    if (tab.key === 'policy' && trippedCount > 0) {
      return (
        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-rose-50 text-rose-600 border border-rose-200 animate-pulse">
          {trippedCount} TRIPPED
        </span>
      );
    }
    return null;
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
<div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('home')}>
              <img
                src="/logo.svg"
                alt="FirewallX"
                className="w-9 h-9 transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3"
                draggable={false}
              />
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
                FirewallX
              </span>
            </div>

          {/* Navigation Tabs — flat 2D underline style */}
          <nav className="hidden md:flex items-center -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`group relative flex items-center px-3.5 py-3 text-sm border-b-2 transition-all duration-200 hover:-translate-y-px after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:origin-left after:bg-blue-600 after:scale-x-0 after:transition-transform after:duration-200 group-hover:after:scale-x-100 ${
                  activeTab === tab.key
                    ? 'text-slate-900 font-medium border-blue-600'
                    : 'text-slate-500 hover:text-slate-900 border-transparent hover:border-slate-300'
                }`}
              >
                <tab.icon
                  className={`w-4 h-4 mr-1.5 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-6 ${
                    activeTab === tab.key ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'
                  }`}
                />
                <span>{tab.label}</span>
                {renderChip(tab)}
              </button>
            ))}
          </nav>

          {/* Right Action Area */}
          <div className="flex items-center space-x-2.5">
            {/* SDK Code Snippet Modal Trigger */}
            <button onClick={onOpenSDKModal} className="btn-secondary group hidden lg:flex !px-4 !py-2">
              <Code2 className="w-3.5 h-3.5 text-blue-600 transition-transform duration-200 group-hover:rotate-12 group-hover:scale-110" />
              <span>SDK</span>
            </button>

            {/* Network Badge */}
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-mono shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-slate-500 text-[11px]">BOT Testnet</span>
            </div>

            {/* Wallet Connect — fixed min-width so the header never shifts on connect */}
            {account ? (
              <div className="flex items-center justify-end space-x-2 h-9">
                {!isCorrectNetwork && (
                  <button onClick={switchToBotChain} className="btn-pill px-3 py-2 text-xs font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition">
                    Switch to BOT Testnet
                  </button>
                )}
                <div className="flex items-center justify-between gap-2 px-3.5 h-9 w-[170px] rounded-full bg-white border border-slate-200 text-xs font-mono shadow-sm">
                  <span className="text-blue-600 font-semibold truncate">{balance} tBOT</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-600 truncate" title={account}>
                    {account.substring(0, 6)}...{account.substring(account.length - 4)}
                  </span>
                  <button
                    onClick={disconnectWallet}
                    className="text-slate-400 hover:text-rose-500 ml-0.5 text-xs"
                    title="Disconnect"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={connectWallet} className="btn-dark !px-5 !py-2 text-sm min-w-[170px] justify-center">
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden overflow-x-auto py-2.5 space-x-2 border-t border-slate-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap border transition-all duration-150 hover:-translate-y-px active:scale-95 ${
                activeTab === tab.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};