import React, { useState } from 'react';
import { 
  KeyRound, Zap, Plus, Trash2, RotateCcw, PauseCircle, PlayCircle, 
  ShieldCheck, Wallet, Sliders, Shield, Sparkles, Copy, Check, Code2, ShieldAlert
} from 'lucide-react';
import { globalFirewallEngine } from '../engine/firewallEngine';
import { AgentState, SecurityPolicy } from '../engine/types';

interface PolicyStudioProps {
  onPolicyUpdated?: () => void;
}

export const PolicyStudio: React.FC<PolicyStudioProps> = ({ onPolicyUpdated }) => {
  const [agents, setAgents] = useState<AgentState[]>(globalFirewallEngine.getAllAgents());
  const [selectedWallet, setSelectedWallet] = useState<string>(
    agents[0]?.agentWallet || '0x71c8366420a092671827649d3863464509520770'
  );
  const [newAllowlistAddr, setNewAllowlistAddr] = useState<string>('');
  const [newBlocklistAddr, setNewBlocklistAddr] = useState<string>('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [activeCodeTab, setActiveCodeTab] = useState<'ts' | 'py'>('ts');

  const selectedAgent = agents.find(
    (a) => a.agentWallet.toLowerCase() === selectedWallet.toLowerCase()
  ) || agents[0];

  const refreshAgents = () => {
    setAgents(globalFirewallEngine.getAllAgents());
  };

  const handlePolicyChange = (field: keyof SecurityPolicy, value: any) => {
    if (!selectedAgent) return;
    const updatedPolicy: SecurityPolicy = {
      ...selectedAgent.policy,
      [field]: value,
    };
    globalFirewallEngine.updatePolicy(selectedAgent.agentWallet, updatedPolicy);
    refreshAgents();
    setSaveMessage('Policy updated successfully');
    setTimeout(() => setSaveMessage(null), 2500);
    if (onPolicyUpdated) onPolicyUpdated();
  };

  const applyPreset = (presetName: string) => {
    if (!selectedAgent) return;
    let newPolicy: SecurityPolicy;

    switch (presetName) {
      case 'treasury':
        newPolicy = {
          maxSpendPerTx: '0.05',
          maxHourlySpend: '0.25',
          maxTxPerMinute: 4,
          loopWindowSeconds: 120,
          maxIdenticalPayloads: 2,
          anomalyThreshold: 450,
          enforceAllowlist: true,
          allowlist: selectedAgent.policy.allowlist.length > 0 ? selectedAgent.policy.allowlist : ['0x1111111111111111111111111111111111111111'],
          blocklist: selectedAgent.policy.blocklist,
        };
        break;
      case 'arbitrage':
        newPolicy = {
          maxSpendPerTx: '5.0',
          maxHourlySpend: '30.0',
          maxTxPerMinute: 25,
          loopWindowSeconds: 30,
          maxIdenticalPayloads: 3,
          anomalyThreshold: 750,
          enforceAllowlist: false,
          allowlist: selectedAgent.policy.allowlist,
          blocklist: selectedAgent.policy.blocklist,
        };
        break;
      case 'social':
        newPolicy = {
          maxSpendPerTx: '0.15',
          maxHourlySpend: '0.8',
          maxTxPerMinute: 8,
          loopWindowSeconds: 60,
          maxIdenticalPayloads: 3,
          anomalyThreshold: 700,
          enforceAllowlist: false,
          allowlist: selectedAgent.policy.allowlist,
          blocklist: selectedAgent.policy.blocklist,
        };
        break;
      case 'oracle':
        newPolicy = {
          maxSpendPerTx: '0.01',
          maxHourlySpend: '0.05',
          maxTxPerMinute: 12,
          loopWindowSeconds: 90,
          maxIdenticalPayloads: 2,
          anomalyThreshold: 500,
          enforceAllowlist: true,
          allowlist: selectedAgent.policy.allowlist,
          blocklist: selectedAgent.policy.blocklist,
        };
        break;
      default:
        return;
    }

    globalFirewallEngine.updatePolicy(selectedAgent.agentWallet, newPolicy);
    refreshAgents();
    setSaveMessage(`Loaded preset: ${presetName.toUpperCase()}`);
    setTimeout(() => setSaveMessage(null), 2500);
    if (onPolicyUpdated) onPolicyUpdated();
  };

  const handleAddAllowlist = () => {
    if (!newAllowlistAddr.trim() || !selectedAgent) return;
    const list = [...selectedAgent.policy.allowlist, newAllowlistAddr.trim()];
    handlePolicyChange('allowlist', list);
    setNewAllowlistAddr('');
  };

  const handleRemoveAllowlist = (addr: string) => {
    if (!selectedAgent) return;
    const list = selectedAgent.policy.allowlist.filter((a) => a.toLowerCase() !== addr.toLowerCase());
    handlePolicyChange('allowlist', list);
  };

  const handleAddBlocklist = () => {
    if (!newBlocklistAddr.trim() || !selectedAgent) return;
    const list = [...selectedAgent.policy.blocklist, newBlocklistAddr.trim()];
    handlePolicyChange('blocklist', list);
    setNewBlocklistAddr('');
  };

  const handleRemoveBlocklist = (addr: string) => {
    if (!selectedAgent) return;
    const list = selectedAgent.policy.blocklist.filter((a) => a.toLowerCase() !== addr.toLowerCase());
    handlePolicyChange('blocklist', list);
  };

  const handleResetBreaker = () => {
    if (!selectedAgent) return;
    globalFirewallEngine.resetCircuitBreaker(selectedAgent.agentWallet);
    refreshAgents();
    setSaveMessage(`Circuit Breaker RESET for ${selectedAgent.name}`);
    setTimeout(() => setSaveMessage(null), 2500);
    if (onPolicyUpdated) onPolicyUpdated();
  };

  const handleTogglePause = () => {
    if (!selectedAgent) return;
    if (selectedAgent.status === 'PAUSED') {
      globalFirewallEngine.resumeAgent(selectedAgent.agentWallet);
    } else {
      globalFirewallEngine.pauseAgent(selectedAgent.agentWallet);
    }
    refreshAgents();
    if (onPolicyUpdated) onPolicyUpdated();
  };

  // Calculate Dynamic Security Rigor Rating (0 - 100)
  const calculateSecurityScore = (p: SecurityPolicy) => {
    let score = 50;
    const spend = parseFloat(p.maxSpendPerTx || '0');
    if (spend <= 0.1) score += 15;
    else if (spend <= 1.0) score += 5;
    else score -= 10;

    if (p.enforceAllowlist) score += 15;
    if (p.anomalyThreshold <= 500) score += 12;
    else if (p.anomalyThreshold <= 700) score += 6;

    if (p.maxIdenticalPayloads <= 2) score += 8;
    return Math.min(99, Math.max(25, score));
  };

  const currentRigor = selectedAgent ? calculateSecurityScore(selectedAgent.policy) : 80;

  const sliders: { key: keyof SecurityPolicy; label: string; display: string; min: number; max: number; step: number; hint: string }[] = [
    {
      key: 'maxSpendPerTx',
      label: 'Max Spend Per Tx',
      display: `${selectedAgent?.policy.maxSpendPerTx} tBOT`,
      min: 0.05,
      max: 10.0,
      step: 0.05,
      hint: 'Blocks any single transaction exceeding this value limit.',
    },
    {
      key: 'maxTxPerMinute',
      label: 'Rate Limit (Txs / Min)',
      display: `${selectedAgent?.policy.maxTxPerMinute} tx/min`,
      min: 1,
      max: 60,
      step: 1,
      hint: 'Max allowed throughput before velocity burst warnings fire.',
    },
    {
      key: 'maxIdenticalPayloads',
      label: 'Loop Trip Limit',
      display: `${selectedAgent?.policy.maxIdenticalPayloads} calls / ${selectedAgent?.policy.loopWindowSeconds}s`,
      min: 2,
      max: 10,
      step: 1,
      hint: 'Auto-trips circuit breaker if identical payload exceeds count within window.',
    },
    {
      key: 'anomalyThreshold',
      label: 'AI Anomaly Threshold',
      display: `${selectedAgent?.policy.anomalyThreshold} / 1000`,
      min: 400,
      max: 950,
      step: 25,
      hint: 'Actions with composite anomaly score above this are blocked.',
    },
  ];

  const getStatusChip = (agent: AgentState) => {
    if (agent.status === 'TRIPPED') {
      return <span className="chip bg-rose-100 text-rose-700 border-rose-200 font-bold animate-pulse">⚡ TRIPPED</span>;
    }
    if (agent.status === 'PAUSED') {
      return <span className="chip bg-amber-100 text-amber-700 border-amber-200">PAUSED</span>;
    }
    return <span className="chip bg-emerald-100 text-emerald-700 border-emerald-200">ACTIVE</span>;
  };

  const getSDKCodeSnippet = () => {
    if (!selectedAgent) return '';
    if (activeCodeTab === 'ts') {
      return `import { FirewallXSDK } from '@firewallx/sdk';

const firewall = new FirewallXSDK({
  agentWallet: '${selectedAgent.agentWallet}',
  policy: ${JSON.stringify(selectedAgent.policy, null, 2)},
  network: 'botchain-testnet',
});

// Guard every outgoing transaction intent
const guardedTx = await firewall.guard({
  target: '0x8ba1f109551bd432803012645ac136ddd64dba72',
  value: '0.05',
  data: '0x...',
});`;
    } else {
      return `from firewallx import FirewallXSDK

firewall = FirewallXSDK(
    agent_wallet="${selectedAgent.agentWallet}",
    max_spend_per_tx=${selectedAgent.policy.maxSpendPerTx},
    rate_limit=${selectedAgent.policy.maxTxPerMinute},
    anomaly_threshold=${selectedAgent.policy.anomalyThreshold},
    enforce_allowlist=${selectedAgent.policy.enforceAllowlist ? 'True' : 'False'}
)

# Intercept and verify
verdict = firewall.evaluate_action(
    target="0x8ba1f109551bd432803012645ac136ddd64dba72",
    value="0.05",
    data="0x..."
)`;
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getSDKCodeSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 card relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-violet-600 mb-1">
            <div className="p-1 rounded-md bg-violet-50">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
            <span>AGENT REGISTRATION & CIRCUIT POLICY STUDIO</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Agent Policy & Breaker Management</h2>
          <p className="text-slate-500 text-xs mt-1">
            Configure spend caps, loop sliding windows, anomaly thresholds, and circuit breaker behavior — policies enforced on-chain by the Guard, configured via the Studio for agent registration.
          </p>
        </div>

        {saveMessage && (
          <div className="chip bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0 !text-xs animate-pulse">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            {saveMessage}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Agent Selector & Status (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="card p-4 space-y-3">
            <h3 className="eyebrow text-slate-500">
              Registered AI Agents ({agents.length})
            </h3>

            <div className="space-y-2">
              {agents.map((agent) => {
                const isSelected = agent.agentWallet.toLowerCase() === selectedWallet.toLowerCase();

                return (
                  <div
                    key={agent.agentWallet}
                    onClick={() => setSelectedWallet(agent.agentWallet)}
                    className={`p-3 rounded-xl transition-all duration-200 cursor-pointer border ${
                      isSelected
                        ? 'bg-gradient-to-b from-blue-50/80 to-white border-blue-400 ring-4 ring-blue-500/10 shadow-[0_8px_20px_-12px_rgba(37,99,235,0.4)]'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                        <Wallet className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{agent.name}</span>
                      </span>
                      {getStatusChip(agent)}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1.5 truncate">
                      {agent.agentWallet}
                    </div>
                    <div className="text-[10px] font-mono text-blue-600 mt-0.5">
                      AIDID: {agent.aidid}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Breaker Actions */}
          {selectedAgent && (
            <div className="card p-4 space-y-3">
              <h3 className="eyebrow text-slate-500">
                Circuit Breaker Controls
              </h3>

              {selectedAgent.status === 'TRIPPED' && (
                <div className="p-3.5 rounded-xl bg-gradient-to-b from-rose-50 to-white border border-rose-200 space-y-2">
                  <div className="text-xs font-bold text-rose-700 flex items-center">
                    <Zap className="w-4 h-4 mr-1.5 text-rose-600" />
                    Breaker Currently Tripped
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Reason: {selectedAgent.lastTripReason || 'Loop or Anomaly Threshold Exceeded'}
                  </p>
                  <button onClick={handleResetBreaker} className="btn-danger w-full !py-2">
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Circuit Breaker (Owner Auth)</span>
                  </button>
                </div>
              )}

              <button
                onClick={handleTogglePause}
                className={`w-full flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                  selectedAgent.status === 'PAUSED'
                    ? 'btn-success w-full'
                    : 'btn-secondary w-full !py-2.5'
                }`}
              >
                {selectedAgent.status === 'PAUSED' ? (
                  <>
                    <PlayCircle className="w-4 h-4 text-emerald-600" />
                    <span>Resume Agent</span>
                  </>
                ) : (
                  <>
                    <PauseCircle className="w-4 h-4 text-slate-600" />
                    <span>Pause Agent</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Policy Presets */}
          <div className="card p-4 space-y-2.5">
            <div className="text-xs font-semibold text-slate-900 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Policy Presets</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'treasury', label: '🛡️ Treasury Vault', desc: 'Strict & low spend' },
                { id: 'arbitrage', label: '⚡ Arbitrage Bot', desc: 'High frequency' },
                { id: 'social', label: '🤖 Social Worker', desc: 'Balanced safety' },
                { id: 'oracle', label: '🔍 Oracle Node', desc: 'Strict allowlist' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyPreset(t.id)}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-left transition-all group"
                >
                  <div className="text-xs font-bold text-slate-800 group-hover:text-blue-600">{t.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Policy Configuration Panel (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {selectedAgent && (
            <>
              <div className="card p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedAgent.name} Policy Matrix</h3>
                    <span className="text-xs font-mono text-blue-600">{selectedAgent.agentWallet}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-right">
                      <div className="text-[10px] font-mono text-slate-400">Security Rigor Rating</div>
                      <div className="flex items-center space-x-1.5 justify-end mt-0.5">
                        <Shield className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-bold text-blue-700">{currentRigor} / 100</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sliders Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {sliders.map((s) => (
                    <div key={s.key} className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex justify-between text-xs font-semibold text-slate-700">
                        <span>{s.label}</span>
                        <span className="font-mono text-blue-600 font-bold">{s.display}</span>
                      </div>
                      <input
                        type="range"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={selectedAgent.policy[s.key] as number}
                        onChange={(e) =>
                          handlePolicyChange(
                            s.key,
                            typeof s.min === 'number' && Number.isInteger(s.step) && !s.display.includes('tBOT')
                              ? parseInt(e.target.value)
                              : e.target.value
                          )
                        }
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-400 block">{s.hint}</span>
                    </div>
                  ))}
                </div>

                {/* Allowlists & Blocklists Management */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                  {/* Allowlist */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Destination Allowlist ({selectedAgent.policy.allowlist.length})</span>
                      <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-slate-500">
                        <input
                          type="checkbox"
                          checked={selectedAgent.policy.enforceAllowlist}
                          onChange={(e) => handlePolicyChange('enforceAllowlist', e.target.checked)}
                          className="rounded accent-blue-600 w-3.5 h-3.5"
                        />
                        <span>Strict Enforce</span>
                      </label>
                    </div>

                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="0x... Target Address"
                        value={newAllowlistAddr}
                        onChange={(e) => setNewAllowlistAddr(e.target.value)}
                        className="input !font-mono !text-xs flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddAllowlist()}
                      />
                      <button onClick={handleAddAllowlist} className="btn-dark !px-3.5 !py-1.5 shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {selectedAgent.policy.allowlist.map((addr) => (
                        <div
                          key={addr}
                          className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white text-xs font-mono text-slate-600 border border-slate-200 hover:border-slate-300 transition-colors"
                        >
                          <span className="truncate">{addr}</span>
                          <button onClick={() => handleRemoveAllowlist(addr)} className="text-slate-400 hover:text-rose-500 ml-2 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Blocklist */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700">
                      Destination Blocklist ({selectedAgent.policy.blocklist.length})
                    </div>

                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="0x... Phishing/Drainer Address"
                        value={newBlocklistAddr}
                        onChange={(e) => setNewBlocklistAddr(e.target.value)}
                        className="input !font-mono !text-xs flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddBlocklist()}
                      />
                      <button onClick={handleAddBlocklist} className="btn-danger !px-3.5 !py-1.5 shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                      {selectedAgent.policy.blocklist.map((addr) => (
                        <div
                          key={addr}
                          className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white text-xs font-mono text-rose-600 border border-rose-200 hover:border-rose-300 transition-colors"
                        >
                          <span className="truncate">{addr}</span>
                          <button onClick={() => handleRemoveBlocklist(addr)} className="text-slate-400 hover:text-rose-500 ml-2 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Export Policy to Agent SDK Code */}
              <div className="card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-slate-900">Export Policy to Agent SDK</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex bg-slate-100 rounded-lg p-0.5 text-[11px] font-mono">
                      <button
                        onClick={() => setActiveCodeTab('ts')}
                        className={`px-2 py-0.5 rounded ${activeCodeTab === 'ts' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500'}`}
                      >
                        TypeScript
                      </button>
                      <button
                        onClick={() => setActiveCodeTab('py')}
                        className={`px-2 py-0.5 rounded ${activeCodeTab === 'py' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-slate-500'}`}
                      >
                        Python
                      </button>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-mono flex items-center space-x-1 text-slate-700 transition-colors"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto">
                  <code>{getSDKCodeSnippet()}</code>
                </pre>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};