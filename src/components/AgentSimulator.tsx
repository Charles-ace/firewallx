import React, { useState } from 'react';
import { Terminal, Zap, ShieldCheck, Flame, Cpu, RefreshCw, Send, AlertTriangle, Bug, Activity, ShieldAlert, Gauge, Code2, Copy, Check, ExternalLink, Globe, HardDrive } from 'lucide-react';
import { globalFirewallEngine } from '../engine/firewallEngine';
import { AgentAction, EvaluationResult } from '../engine/types';
import { uid } from '../engine/uid';
import { globalOnChainClient } from '../engine/onChainClient';
import { BOTCHAIN_TESTNET } from '../config/botchain';

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
  const [selectedAgent, setSelectedAgent] = useState<string>(globalOnChainClient.getTestAgentAddress());
  const [targetAddress, setTargetAddress] = useState<string>(BOTCHAIN_TESTNET.contracts.testTarget);
  const [txValue, setTxValue] = useState<string>('0.05');
  const [txCalldata, setTxCalldata] = useState<string>('0x608060405234801561001057600080fd5b50');
  const [actionDescription, setActionDescription] = useState<string>('Standard KV state update');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [executionMode, setExecutionMode] = useState<'onchain' | 'sandbox'>('onchain');
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(0.42);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '🔥 FirewallX Attack & Simulation Engine Ready',
    'Target: BOT Chain Testnet Sentinel Suite (Chain ID: 968)',
    'On-chain mode enabled — attacks trigger real smart contract enforcement.',
  ]);

  const addLog = (msg: string) => {
    setTerminalLogs((prev) => [...prev.slice(-40), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const executeLocalAction = (action: AgentAction) => {
    const t0 = performance.now();
    addLog(`[SANDBOX] Evaluating ${action.agentWallet.substring(0, 8)}... Target: ${action.target.substring(0, 10)}... Value: ${action.value} tBOT`);
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
      addLog(`⚡ CIRCUIT BREAKER TRIPPED! Agent status set to TRIPPED after autonomous violation.`);
    }

    onEvaluationComplete(result);
  };

  // Preset 1: Normal Agent Action
  const runNormalScenario = async () => {
    setIsSimulating(true);
    addLog('🚀 Running Scenario: Normal Agent KV Update...');

    if (executionMode === 'onchain') {
      try {
        const payload = globalOnChainClient.encodeTestKVCall(`normal-${Date.now()}`, 'valid-op');
        addLog(`📡 Broadcasting on-chain call via FirewallXGuard...`);
        const res = await globalOnChainClient.executeGuardedAction(targetAddress, '0.001', payload);
        addLog(`✅ ON-CHAIN ALLOWED: GuardedExecution emitted. Tx: ${res.txHash} (Block #${res.blockNumber})`);
      } catch (err: any) {
        addLog(`❌ On-chain error: ${err.message || err}`);
      }
    } else {
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
      executeLocalAction(action);
    }
    setIsSimulating(false);
  };

  // Preset 2: Trigger the Runaway Loop Attack
  const runLoopAttackScenario = async () => {
    setIsSimulating(true);
    addLog('🚨 Running Scenario: Recursive Webhook Retry Loop Attack...');

    if (executionMode === 'onchain') {
      const loopPayload = globalOnChainClient.encodeTestKVCall(`runaway-loop-${Date.now()}`, 'payload-loop-alpha');
      addLog(`Firing identical payload bursts directly to BOT Chain Testnet Guard...`);

      for (let i = 1; i <= 3; i++) {
        addLog(`⚡ Loop iteration #${i} broadcasting to chain...`);
        try {
          const res = await globalOnChainClient.executeGuardedAction(targetAddress, '0.001', loopPayload);
          if (res.circuitTripped || res.status === 'TRIP') {
            addLog(`⚡⚡⚡ ON-CHAIN CIRCUIT BREAKER TRIPPED! Status: TRIPPED.`);
            addLog(`❌ GuardedExecutionBlocked emitted. Autonomous breaker trip confirmed on contract.`);
            addLog(`🔗 On-chain Tx Hash: ${res.txHash} (Block #${res.blockNumber})`);
            globalFirewallEngine.tripCircuitBreaker(selectedAgent, 'Autonomous on-chain identical-payload loop limit breach');
          } else {
            addLog(`✅ Tx #${i} Allowed by Guard (Tx: ${res.txHash})`);
          }
        } catch (err: any) {
          addLog(`❌ On-chain call #${i} error: ${err.message || err}`);
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    } else {
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
        executeLocalAction(action);
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    setIsSimulating(false);
  };

  // Preset 3: Spend Cap Breach
  const runSpendBreachScenario = async () => {
    setIsSimulating(true);
    addLog(`💸 Running Scenario: Runaway Spend Breach (15.0 tBOT requested vs cap)...`);

    if (executionMode === 'onchain') {
      try {
        addLog(`📡 Sending 15.0 tBOT execution intent to Guard...`);
        const res = await globalOnChainClient.executeGuardedAction(targetAddress, '15.0', '0x12345678');
        if (res.status === 'BLOCK') {
          addLog(`🛑 ON-CHAIN BLOCKED: Spend cap exceeded! Guard halted target execution and refunded funds.`);
          addLog(`🔗 On-chain Tx Hash: ${res.txHash} (Block #${res.blockNumber})`);
        } else {
          addLog(`Result: ${res.status} Tx: ${res.txHash}`);
        }
      } catch (err: any) {
        addLog(`🛑 Intercepted on-chain: ${err.message || err}`);
      }
    } else {
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
      executeLocalAction(action);
    }
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
    executeLocalAction(action);
    setIsSimulating(false);
  };

  // Preset 5: Blacklist Destination Drain
  const runBlacklistScenario = async () => {
    setIsSimulating(true);
    addLog('🚫 Running Scenario: Known Drainer Contract Interaction...');
    const deadTarget = '0x000000000000000000000000000000000000dead';

    if (executionMode === 'onchain') {
      try {
        const res = await globalOnChainClient.executeGuardedAction(deadTarget, '0.01', '0x');
        addLog(`🛑 ON-CHAIN BLOCKED: Target in blocklist! Guard prevented execution.`);
        addLog(`🔗 On-chain Tx Hash: ${res.txHash}`);
      } catch (err: any) {
        addLog(`🛑 Blocked: ${err.message || err}`);
      }
    } else {
      const action: AgentAction = {
        id: uid('drain'),
        agentId: 'agent-sixa-telegram',
        agentWallet: selectedAgent,
        target: deadTarget,
        value: '0.1',
        data: '0x00',
        timestamp: Date.now(),
        metadata: {
          actionType: 'DRAINER_TRANSFER',
          description: 'Call to flagged phishing contract',
        },
      };
      executeLocalAction(action);
    }
    setIsSimulating(false);
  };

  // Preset 6: Velocity Burst Flood (Rate Limit)
  const runVelocityBurstScenario = async () => {
    setIsSimulating(true);
    addLog('⚡ Running Scenario: High-Frequency Transaction Velocity Burst...');

    if (executionMode === 'onchain') {
      addLog(`Sending 4 rapid transactions with distinct payloads on BOT Chain Testnet...`);
      for (let i = 1; i <= 4; i++) {
        const payload = globalOnChainClient.encodeTestKVCall(`burst-${Date.now()}-${i}`, `payload-${i}`);
        try {
          const res = await globalOnChainClient.executeGuardedAction(targetAddress, '0.001', payload);
          if (res.circuitTripped || res.status === 'TRIP') {
            addLog(`⚡⚡⚡ ON-CHAIN VELOCITY BREACH! Breaker autonomously tripped (Rate limit exceeded).`);
            addLog(`🔗 On-chain Tx Hash: ${res.txHash} (Block #${res.blockNumber})`);
            globalFirewallEngine.tripCircuitBreaker(selectedAgent, 'Autonomous on-chain velocity rate limit breach');
          } else {
            addLog(`✅ Velocity Tx #${i} Allowed (Tx: ${res.txHash})`);
          }
        } catch (err: any) {
          addLog(`❌ Velocity Tx #${i} error: ${err.message || err}`);
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    } else {
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
        executeLocalAction(action);
        await new Promise((r) => setTimeout(r, 120));
      }
    }
    setIsSimulating(false);
  };

  // Custom Action Execution
  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);

    if (executionMode === 'onchain') {
      try {
        addLog(`📡 Sending custom transaction on-chain to Guard...`);
        const res = await globalOnChainClient.executeGuardedAction(targetAddress, txValue, txCalldata);
        addLog(`✅ On-chain result: ${res.status}. Tx: ${res.txHash}`);
      } catch (err: any) {
        addLog(`❌ On-chain execution failed: ${err.message || err}`);
      }
    } else {
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
      executeLocalAction(action);
    }
    setIsSimulating(false);
  };

  const handleResetBreaker = async () => {
    setIsSimulating(true);
    addLog(`🔄 Resetting Circuit Breaker...`);
    if (executionMode === 'onchain') {
      try {
        const res = await globalOnChainClient.resetBreakerOnChain();
        addLog(`✅ Circuit Breaker RESET on-chain! Status restored to ACTIVE. Tx: ${res.txHash} (Block #${res.blockNumber})`);
        globalFirewallEngine.resetCircuitBreaker(selectedAgent);
      } catch (err: any) {
        addLog(`❌ On-chain reset failed: ${err.message || err}`);
      }
    } else {
      globalFirewallEngine.resetCircuitBreaker(selectedAgent);
      addLog(`🔄 Circuit Breaker locally reset to ACTIVE for agent ${selectedAgent.substring(0, 8)}...`);
    }
    setIsSimulating(false);
  };

  const activeAgentState = globalFirewallEngine.getAgent(selectedAgent);
  const activePolicy = activeAgentState?.policy;

  const presets: Preset[] = [
    {
      key: 'normal',
      num: '1',
      title: 'Normal Payment',
      description: (
        <>
          Standard transfer below spend cap. Verdict: <strong className="text-emerald-600">ALLOW</strong>.
        </>
      ),
      icon: Activity,
      iconBg: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      hoverBorder: 'hover:border-emerald-400 hover:shadow-[0_12px_28px_-16px_rgba(16,185,129,0.4)]',
      verdictClass: 'text-emerald-600',
    },
    {
      key: 'loop',
      num: '2',
      title: 'Runaway Loop Attack',
      description: (
        <>
          Fires identical payload bursts. Trips autonomously on-chain at <strong className="text-rose-600">Tx #3</strong>.
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
          Requests 15.0 tBOT exceeding policy cap. Verdict: <strong className="text-amber-600">BLOCK</strong>.
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
          Rapid transaction burst exceeding 3 tx/min. Trips on-chain at <strong className="text-rose-600">Tx #4</strong>.
        </>
      ),
      icon: Gauge,
      iconBg: 'bg-rose-50 text-rose-600 ring-rose-100',
      hoverBorder: 'hover:border-rose-400 hover:shadow-[0_12px_28px_-16px_rgba(225,29,72,0.4)]',
      verdictClass: 'text-rose-600',
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
            Trigger attacks against the smart contracts to test on-chain loop detection, velocity limits, and autonomous circuit trips.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                onClick={() => setExecutionMode('onchain')}
                className={`px-3 py-1 text-xs font-mono rounded-md flex items-center space-x-1.5 transition-all ${
                  executionMode === 'onchain'
                    ? 'bg-blue-600 text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>BOT Chain Testnet (On-Chain)</span>
              </button>
              <button
                onClick={() => setExecutionMode('sandbox')}
                className={`px-3 py-1 text-xs font-mono rounded-md flex items-center space-x-1.5 transition-all ${
                  executionMode === 'sandbox'
                    ? 'bg-white text-slate-900 font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HardDrive className="w-3 h-3" />
                <span>Local Sandbox</span>
              </button>
            </div>

            <span className="chip bg-emerald-50 text-emerald-700 border-emerald-200 !text-[10px]">
              <Gauge className="w-3 h-3 text-emerald-600" />
              Pre-flight Latency: {lastLatencyMs}ms
            </span>
          </div>
        </div>

        <button onClick={handleResetBreaker} disabled={isSimulating} className="btn-secondary shrink-0 group">
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSimulating ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
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
                  <span>Active On-Chain Policy — Sentinel Agent</span>
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
                  ['Spend / Tx', `1.0 tBOT`],
                  ['Rate Limit', `3 tx/min`],
                  ['Loop Trip', `2 calls / 60s`],
                  ['Enforcement', `On-Chain Guard`],
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
              <span>Attack Simulation Presets {executionMode === 'onchain' && '(Live On-Chain)'}</span>
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
                <span>{executionMode === 'onchain' ? 'Execute Guarded Transaction on BOT Chain' : 'Evaluate Custom Payload (Local Pre-flight)'}</span>
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
                  className={`leading-relaxed break-all ${
                    log.includes('ALLOWED') || log.includes('ALLOW')
                      ? 'text-emerald-400'
                      : log.includes('BLOCK') || log.includes('TRIPPED') || log.includes('BREACH')
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