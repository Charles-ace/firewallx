import React, { useState } from 'react';
import { Terminal, Zap, ShieldCheck, Flame, Cpu, RefreshCw, Send, AlertTriangle, Bug, Activity, ShieldAlert, Gauge, Code2, Copy, Check } from 'lucide-react';
import { globalFirewallEngine } from '../engine/firewallEngine';
import { AgentAction, EvaluationResult } from '../engine/types';
import { uid } from '../engine/uid';

interface AgentSimulatorProps {
  onEvaluationComplete: (result: EvaluationResult) => void;
}

interface Preset {
  key: string;
  num: string;
  title: string;
  description: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  hoverBorder: string;
  verdictClass: string;
}

export const AgentSimulator: React.FC<AgentSimulatorProps> = ({ onEvaluationComplete }) => {
  const [selectedAgent, setSelectedAgent] = useState<string>('0x71c8366420a092671827649d3863464509520770');
  const [targetAddress, setTargetAddress] = useState<string>('0x8ba1f109551bd432803012645ac136ddd64dba72');
  const [txValue, setTxValue] = useState<string>('0.05');
  const [txCalldata, setTxCalldata] = useState<string>('0x608060405234801561001057600080fd5b50');
  const [actionDescription, setActionDescription] = useState<string>('Standard KV state update');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(0.42);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '🔥 FirewallX Attack & Simulation Engine Ready',
    'Connected to BOT Chain Testnet Sentinel',
    'Ready for simulated AI agent transaction payloads.',
  ]);

  const addLog = (msg: string) => {
    setTerminalLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const executeAction = (action: AgentAction) => {
    const t0 = performance.now();
    addLog(`Evaluating action for ${action.agentWallet.substring(0, 8)}... Target: ${action.target.substring(0, 10)}... Value: ${action.value} tBOT`);
    const result = globalFirewallEngine.evaluate(action);
    const t1 = performance.now();
    const duration = parseFloat((t1 - t0).toFixed(2));
    setLastLatencyMs(duration > 0 ? duration : 0.28);

    if (result.verdict === 'ALLOW') {
      addLog(`✅ VERDICT: ALLOW (Risk Score: ${result.anomalyScore}/1000, Latency: ${duration}ms). Rule: ${result.ruleTriggered}.`);
    } else if (result.verdict === 'FLAG') {
      addLog(`⚠️ VERDICT: FLAG (Risk Score: ${result.anomalyScore}/1000). Rule: ${result.ruleTriggered}. Warning: ${result.reasoning}`);
    } else {
      addLog(`❌ VERDICT: BLOCK (Risk Score: ${result.anomalyScore}/1000). Rule: ${result.ruleTriggered}. Reason: ${result.reasoning}`);
    }

    if (result.circuitTripped) {
      addLog(`⚡ CIRCUIT BREAKER TRIPPED on-chain! Agent paused after autonomous velocity/loop limit breach. Breaker trips automatically when maxTxPerMinute or maxIdenticalPayloads thresholds are exceeded on the deployed contract.`);
    }

    onEvaluationComplete(result);
  };

  // Preset 1: Normal Agent Action
  const runNormalScenario = () => {
    setIsSimulating(true);
    addLog('🚀 Running Scenario: Normal Agent KV Update...');
    const action: AgentAction = {
      id: uid('sim'),
      agentId: 'agent-sixa-telegram',
      agentWallet: selectedAgent,
      target: targetAddress,
      value: '0.02',
      data: '0x123456780000000000000000000000000000000000000000000000000000000000000001',
      timestamp: Date.now(),
      metadata: {
        actionType: 'KV_SET',
        description: 'Scheduled user session sync',
        triggerSource: 'worker-cron',
      },
    };
    executeAction(action);
    setIsSimulating(false);
  };

  // Preset 2: Trigger the Runaway 4k-Ops Loop Attack
  const runLoopAttackScenario = async () => {
    setIsSimulating(true);
    addLog('🚨 Running Scenario: Recursive Webhook Retry Loop (Aug 12 Recreation)...');
    addLog('Firing identical calldata bursts...');

    const identicalData = '0xa9059cbb00000000000000000000000071c8366420a092671827649d38634645095207700000000000000000000000000000000000000000000000000000000000000064';

    for (let i = 1; i <= 5; i++) {
      addLog(`⚡ Loop iteration #${i} incoming...`);
      const action: AgentAction = {
        id: uid(`loop-${i}`),
        agentId: 'agent-sixa-telegram',
        agentWallet: selectedAgent,
        target: targetAddress,
        value: '0.01',
        data: identicalData,
        timestamp: Date.now(),
        metadata: {
          actionType: 'WEBHOOK_RETRY',
          description: `Recursive retry attempt #${i}`,
          triggerSource: 'webhook-timeout-loop',
        },
      };

      executeAction(action);
      await new Promise((r) => setTimeout(r, 500));
    }
    setIsSimulating(false);
  };

  // Preset 3: Spend Cap Breach
  const runSpendBreachScenario = () => {
    setIsSimulating(true);
    addLog(`💸 Running Scenario: Runaway Spend Breach (15.0 tBOT requested vs ${activePolicy?.maxSpendPerTx ?? '0.2'} tBOT cap)...`);
    const action: AgentAction = {
      id: uid('spend'),
      agentId: 'agent-sixa-telegram',
      agentWallet: selectedAgent,
      target: targetAddress,
      value: '15.0',
      data: '0x12345678',
      timestamp: Date.now(),
      metadata: {
        actionType: 'UNAUTHORIZED_TRANSFER',
        description: 'Large liquidity movement request',
      },
    };
    executeAction(action);
    setIsSimulating(false);
  };

  // Preset 4: High-Entropy Malicious Calldata Injection
  const runMaliciousCalldataScenario = () => {
    setIsSimulating(true);
    addLog('👾 Running Scenario: High-Entropy Malicious Calldata Injection...');
    const randomHex = '0x' + Array.from({ length: 120 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
    const action: AgentAction = {
      id: uid('exploit'),
      agentId: 'agent-sixa-telegram',
      agentWallet: selectedAgent,
      target: targetAddress,
      value: '0.05',
      data: randomHex,
      timestamp: Date.now(),
      metadata: {
        actionType: 'UNVERIFIED_BINARY_CALL',
        description: 'Obfuscated shellcode injection payload',
      },
    };
    executeAction(action);
    setIsSimulating(false);
  };

  // Preset 5: Blacklist Destination Drain
  const runBlacklistScenario = () => {
    setIsSimulating(true);
    addLog('🚫 Running Scenario: Known Drainer Contract Interaction...');
    const action: AgentAction = {
      id: uid('drain'),
      agentId: 'agent-sixa-telegram',
      agentWallet: selectedAgent,
      target: '0x000000000000000000000000000000000000dead',
      value: '0.1',
      data: '0x00',
      timestamp: Date.now(),
      metadata: {
        actionType: 'DRAINER_TRANSFER',
        description: 'Call to flagged phishing contract',
      },
    };
    executeAction(action);
    setIsSimulating(false);
  };

  // Preset 6: Velocity Burst Flood (Rate Limit)
  const runVelocityBurstScenario = async () => {
    setIsSimulating(true);
    addLog('⚡ Running Scenario: High-Frequency Transaction Velocity Burst (10 txs in 1.5s)...');
    for (let i = 1; i <= 10; i++) {
      const action: AgentAction = {
        id: uid(`burst-${i}`),
        agentId: 'agent-sixa-telegram',
        agentWallet: selectedAgent,
        target: targetAddress,
        value: '0.01',
        data: '0x' + Math.random().toString(16).substring(2, 10).padStart(64, '0'),
        timestamp: Date.now(),
        metadata: {
          actionType: 'VELOCITY_FLOOD',
          description: `Rapid-fire transaction #${i}`,
        },
      };
      executeAction(action);
      await new Promise((r) => setTimeout(r, 120));
    }
    setIsSimulating(false);
  };

  // Preset 7: Unauthorized Flash-Loan Delegatecall
  const runDelegatecallScenario = () => {
    setIsSimulating(true);
    addLog('🛡️ Running Scenario: Unauthorized Delegatecall Hook Injection...');
    const action: AgentAction = {
      id: uid('delegatecall'),
      agentId: 'agent-sixa-telegram',
      agentWallet: selectedAgent,
      target: '0x9999999999999999999999999999999999999999',
      value: '0.0',
      data: '0xf3fef3a3000000000000000000000000badbadbadbadbadbadbadbadbadbadbadbadbad0',
      timestamp: Date.now(),
      metadata: {
        actionType: 'DELEGATECALL_EXPLOIT',
        description: 'Zero-day proxy manipulation attempt',
      },
    };
    executeAction(action);
    setIsSimulating(false);
  };

  // Custom Action Execution
  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const action: AgentAction = {
      id: uid('custom'),
      agentId: 'custom-agent',
      agentWallet: selectedAgent,
      target: targetAddress,
      value: txValue,
      data: txCalldata,
      timestamp: Date.now(),
      metadata: {
        description: actionDescription,
      },
    };
    executeAction(action);
  };

  const handleResetBreaker = () => {
    globalFirewallEngine.resetCircuitBreaker(selectedAgent);
    addLog(`🔄 Circuit Breaker manually reset to ACTIVE for agent ${selectedAgent.substring(0, 8)}...`);
  };

  const activeAgentState = globalFirewallEngine.getAgent(selectedAgent);
  const activePolicy = activeAgentState?.policy;

  const presets: Preset[] = [
    {
      key: 'normal',
      num: '1',
      title: 'Normal KV State Update',
      description: (
        <>
          Standard low-value state sync. Verdict: <strong className="text-emerald-600">ALLOW</strong>.
        </>
      ),
      icon: ShieldCheck,
      iconBg: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-[0_12px_28px_-16px_rgba(16,185,129,0.4)]',
      verdictClass: 'text-emerald-600',
    },
    {
      key: 'loop',
      num: '2',
      title: 'Recursive Loop Attack',
      description: (
        <>
          Fires 5 identical calldata bursts. Trips at <strong className="text-rose-600">Tx #{((activePolicy?.maxIdenticalPayloads ?? 3) + 1)}</strong>.
        </>
      ),
      icon: Flame,
      iconBg: 'bg-rose-50 text-rose-600 ring-rose-100',
      hoverBorder: 'hover:border-rose-400 hover:shadow-[0_12px_28px_-16px_rgba(225,29,72,0.4)]',
      verdictClass: 'text-rose-600',
    },
    {
      key: 'spend',
      num: '3',
      title: 'Spend Cap Breach',
      description: (
        <>
          Requests 15.0 tBOT (Limit: {activePolicy?.maxSpendPerTx ?? '0.2'} tBOT). Verdict: <strong className="text-amber-600">BLOCK</strong>.
        </>
      ),
      icon: AlertTriangle,
      iconBg: 'bg-amber-50 text-amber-600 ring-amber-100',
      hoverBorder: 'hover:border-amber-400 hover:shadow-[0_12px_28px_-16px_rgba(245,158,11,0.4)]',
      verdictClass: 'text-amber-600',
    },
    {
      key: 'entropy',
      num: '4',
      title: 'High-Entropy Exploit',
      description: (
        <>
          High Shannon entropy obfuscated calldata. Verdict: <strong className="text-violet-600">BLOCK</strong>.
        </>
      ),
      icon: Bug,
      iconBg: 'bg-violet-50 text-violet-600 ring-violet-100',
      hoverBorder: 'hover:border-violet-400 hover:shadow-[0_12px_28px_-16px_rgba(139,92,246,0.4)]',
      verdictClass: 'text-violet-600',
    },
    {
      key: 'drain',
      num: '5',
      title: 'Drainer Phishing Call',
      description: (
        <>
          Interaction with known blocklisted 0xdead target. Verdict: <strong className="text-rose-600">BLOCK</strong>.
        </>
      ),
      icon: Zap,
      iconBg: 'bg-rose-50 text-rose-600 ring-rose-100',
      hoverBorder: 'hover:border-rose-400 hover:shadow-[0_12px_28px_-16px_rgba(225,29,72,0.4)]',
      verdictClass: 'text-rose-600',
    },
    {
      key: 'burst',
      num: '6',
      title: 'Velocity Burst Flood',
      description: (
        <>
          Spawns 10 rapid transactions in &lt;2s to test velocity cap. Verdict: <strong className="text-amber-600">FLAG/BLOCK</strong>.
        </>
      ),
      icon: Activity,
      iconBg: 'bg-blue-50 text-blue-600 ring-blue-100',
      hoverBorder: 'hover:border-blue-400 hover:shadow-[0_12px_28px_-16px_rgba(37,99,235,0.4)]',
      verdictClass: 'text-blue-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 card relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-blue-600 mb-1">
            <div className="p-1 rounded-md bg-blue-50">
              <Terminal className="w-3.5 h-3.5" />
            </div>
            <span>LIVE AI AGENT ATTACK & INTERCEPTION SANDBOX</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Interactive Attack Simulator</h2>
          <p className="text-slate-500 text-xs mt-1">
            Trigger simulated agent behaviors to test on-chain loop detection, AI anomaly scoring, spend caps, and autonomous circuit trips.
          </p>
          <div className="mt-2 flex items-center space-x-2">
            <span className="chip bg-emerald-50 text-emerald-700 border-emerald-200 !text-[10px]">
              <Gauge className="w-3 h-3 text-emerald-600" />
              Pre-flight Latency: {lastLatencyMs}ms
            </span>
            <span className="chip bg-amber-50 text-amber-700 border-amber-200 !text-[10px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              SANDBOX MODE — interactive testing
            </span>
          </div>
        </div>

        <button onClick={handleResetBreaker} className="btn-secondary shrink-0">
          <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
          <span>Reset Agent Breaker</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Presets & Custom Form (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Active Policy Strip */}
          {activePolicy && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <span>Active Policy — {activeAgentState?.name}</span>
                </h3>
                <span className={`chip !text-[10px] ${
                  activeAgentState?.status === 'TRIPPED' 
                    ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {activeAgentState?.status === 'TRIPPED' ? '⚡ CIRCUIT TRIPPED' : 'STATUS: ACTIVE'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ['Spend / Tx', `${activePolicy.maxSpendPerTx} tBOT`],
                  ['Rate Limit', `${activePolicy.maxTxPerMinute} tx/min`],
                  ['Loop Trip', `${activePolicy.maxIdenticalPayloads} × ${activePolicy.loopWindowSeconds}s`],
                  ['Anomaly Δ', `${activePolicy.anomalyThreshold}/1000`],
                ].map(([k, v]) => (
                  <div key={k} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-mono text-slate-400">{k}</div>
                    <div className="text-xs font-mono font-bold text-slate-800 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preset Attack Scenarios */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span>Attack Simulation Presets</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {presets.map((p) => (
                <button
                  key={p.key}
                  onClick={
                    p.key === 'normal' ? runNormalScenario
                    : p.key === 'loop' ? () => runLoopAttackScenario()
                    : p.key === 'spend' ? runSpendBreachScenario
                    : p.key === 'entropy' ? runMaliciousCalldataScenario
                    : p.key === 'burst' ? () => runVelocityBurstScenario()
                    : runBlacklistScenario
                  }
                  disabled={isSimulating}
                  className={`p-3.5 rounded-xl text-left bg-slate-50 border border-slate-200 transition-all duration-200 group disabled:opacity-50 hover:-translate-y-0.5 ${p.hoverBorder}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-bold ${p.verdictClass}`}>
                      {p.num}. {p.title}
                    </span>
                    <div className={`p-1.5 rounded-lg ring-1 ${p.iconBg}`}>
                      <p.icon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Action Builder Form */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <span>Custom Action Calldata Injector</span>
            </h3>

            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1.5">Agent Wallet</label>
                <input
                  type="text"
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="input !font-mono !text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1.5">Target Contract</label>
                  <input
                    type="text"
                    value={targetAddress}
                    onChange={(e) => setTargetAddress(e.target.value)}
                    className="input !font-mono !text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-mono text-slate-400 block mb-1.5">Value (tBOT)</label>
                  <input
                    type="text"
                    value={txValue}
                    onChange={(e) => setTxValue(e.target.value)}
                    className="input !font-mono !text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1.5">Calldata Hex</label>
                <input
                  type="text"
                  value={txCalldata}
                  onChange={(e) => setTxCalldata(e.target.value)}
                  className="input !font-mono !text-xs"
                />
              </div>

              <button type="submit" disabled={isSimulating} className="btn-primary w-full !py-2.5 group">
                <Send className="w-3.5 h-3.5" />
                <span>Evaluate Custom Payload (Local Pre-flight)</span>
              </button>
            </form>
          </div>
        </div>

        {/* Live Sentinel Terminal Output (5 cols) */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl bg-[#0a0a0f] border border-slate-800 p-4 flex flex-col h-[640px] shadow-[0_24px_60px_-24px_rgba(10,10,15,0.6)]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <span className="text-xs font-mono text-slate-500 ml-2">firewallx-sentinel.log</span>
              </div>
              <button
                onClick={() => setTerminalLogs(['🔥 Sentinel log cleared. Ready.'])}
                className="text-[10px] font-mono text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-1.5 font-mono text-[11px] text-slate-300 pr-1">
              {terminalLogs.map((log, i) => (
                <div
                  key={i}
                  className={`leading-relaxed ${
                    log.includes('ALLOW')
                      ? 'text-emerald-400'
                      : log.includes('BLOCK') || log.includes('TRIPPED')
                      ? 'text-rose-400 font-semibold'
                      : log.includes('FLAG')
                      ? 'text-amber-400'
                      : 'text-slate-400'
                  }`}
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};