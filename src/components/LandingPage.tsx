import React from 'react';
import {
  Zap, Cpu, ShieldCheck, KeyRound, ArrowRight, ShieldAlert, Ban, Flag,
  TerminalSquare, Code2, Network, Radio, ExternalLink, Cog, FileCode2, Gauge,
} from 'lucide-react';
import { PipelineDemo } from './PipelineDemo';
import { Reveal } from './Reveal';
import { ActiveTab } from './Navbar';
import { BOTCHAIN_TESTNET, BOTCHAIN_MAINNET } from '../config/botchain';

interface LandingPageProps {
  onNavigate: (tab: ActiveTab) => void;
  onOpenSDKModal: () => void;
}

const FEATURES = [
  {
    icon: Zap,
    title: 'Pre-transaction interception',
    body: 'Every agent action is evaluated before execution. Spend caps, velocity rate limits, loop repetition tripwires, and allow/block lists are enforced on-chain by the Guard & Registry — stopping waste and exploits at the source.',
    accent: 'bg-blue-50 text-blue-600 ring-blue-100',
  },
  {
    icon: Gauge,
    title: 'On-chain loop & velocity detection',
    body: 'A rolling-window ring buffer and payload repetition tracker evaluate velocity and loop limits directly on-chain. The contract autonomously trips the circuit breaker on sustained violations before recursive calls can drain funds.',
    accent: 'bg-violet-50 text-violet-600 ring-violet-100',
  },
  {
    icon: Cpu,
    title: 'Multi-factor anomaly scoring',
    body: 'Six signals — repetition, velocity burst, spend deviation, calldata entropy, destination familiarity, and composite risk — score every action from 0 to 1000 in-browser/SDK.',
    accent: 'bg-amber-50 text-amber-600 ring-amber-100',
  },
  {
    icon: ShieldAlert,
    title: 'Autonomous circuit breaker',
    body: 'When velocity or loop repetition limits are breached, the smart contract autonomously trips the breaker on-chain. The Guard immediately blocks all follow-up calls until an owner reset.',
    accent: 'bg-rose-50 text-rose-600 ring-rose-100',
  },
];

const VERDICTS = [
  {
    badge: 'ALLOW',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: ShieldCheck,
    desc: 'Action passes every deterministic and statistical check and is released for execution.',
  },
  {
    badge: 'FLAG',
    badgeCls: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Flag,
    desc: 'Elevated risk detected — allowed to proceed, but recorded with full telemetry for review.',
  },
  {
    badge: 'BLOCK',
    badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: Ban,
    desc: 'A deterministic check fails (spend cap, allow/block list, velocity, loop limit) on-chain, or the in-browser engine flags anomaly risk. Blocked actions never execute.',
  },
  {
    badge: 'TRIPPED',
    badgeCls: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: Zap,
    desc: 'Circuit breaker opens. Agent operations pause until the owner resets policy and re-approves the agent.',
  },
];

const SIGNALS = [
  ['Repetition / loop', 'identical payloads inside the sliding window'],
  ['Velocity burst', 'tx-per-minute spikes against the agent baseline'],
  ['Spend deviation', 'value requested vs. per-tx and hourly caps'],
  ['Calldata entropy', 'obfuscated or unusual payload shapes'],
  ['Destination familiarity', 'new or blocklisted targets'],
  ['Composite risk', 'weighted combination into a single 0–1000 score'],
];

const ROADMAP_ITEMS = [
  {
    title: 'Dual Network Sentinels',
    desc: 'Byte-identical contract suite deployed and verified on BOT Chain Mainnet (Chain 677) and Testnet (Chain 968).',
    badge: 'MAINNET & TESTNET LIVE',
    badgeCls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    title: 'Autonomous Breaker & Limits',
    desc: 'Identical-payload loop detection, velocity limits, and spend caps enforced directly on-chain with auto-tripping.',
    badge: 'ACTIVE ON-CHAIN',
    badgeCls: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    title: 'Real-Time Event Indexer',
    desc: 'Live telemetry stream indexes Registry, Auditor, Guard, and TestTarget events with sub-second polling.',
    badge: 'LIVE TELEMETRY',
    badgeCls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    title: '6-Signal Sentinel SDK',
    desc: 'Shannon entropy math, velocity tracking, and multi-factor composite risk scoring ready for Node.js & TypeScript.',
    badge: 'SDK INTEGRATED',
    badgeCls: 'bg-purple-50 text-purple-700 border-purple-200',
  },
];

interface FlowNodeProps {
  x: number;
  y: number;
  r?: number;
  stroke: string;
  icon: React.ComponentType<{ className?: string }>;
  iconCls: string;
  title: string;
  caption: string;
}

const FlowNode: React.FC<FlowNodeProps> = ({ x, y, r = 24, stroke, icon: Icon, iconCls, title, caption }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#0a0a0f" stroke={stroke} strokeWidth={2} />
    <circle cx={x} cy={y} r={r} fill="none" stroke={stroke} strokeWidth={1.5}>
      <animate attributeName="r" values={`${r};${r + 12};${r}`} dur="2.6s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.4;0;0.4" dur="2.6s" repeatCount="indefinite" />
    </circle>
    <foreignObject x={x - 13} y={y - 13} width={26} height={26}>
      <div {...({ xmlns: 'http://www.w3.org/1999/xhtml' } as React.HTMLAttributes<HTMLDivElement>)} className="w-full h-full flex items-center justify-center">
        <Icon className={`w-4 h-4 ${iconCls}`} />
      </div>
    </foreignObject>    <text x={x} y={y + r + 26} textAnchor="middle" className="text-[13px] font-semibold fill-slate-100">
      {title}
    </text>
    <text x={x} y={y + r + 44} textAnchor="middle" className="text-[10px] font-mono fill-slate-500">
      {caption}
    </text>
  </g>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, onOpenSDKModal }) => {
  const [networkTab, setNetworkTab] = React.useState<'mainnet' | 'testnet'>('mainnet');
  const currentNetwork = networkTab === 'mainnet' ? BOTCHAIN_MAINNET : BOTCHAIN_TESTNET;

  return (
    <div className="relative z-10">
      {/* Hero */}
      <section className="border-b border-slate-200/80 bg-gradient-to-b from-blue-50/70 via-white/40 to-transparent cyber-grid overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-28 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 max-w-3xl mx-auto leading-[1.08]">
            AI agent security, scored{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
              before it hits the chain.
            </span>
          </h1>

          <p className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            FirewallX is an agent action firewall and autonomous circuit breaker for BOT Chain. Every
            agent transaction is intercepted, scored across six anomaly signals, checked against policy,
            and halted before it can burn a balance — no SDK rewrite required.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => onNavigate('simulator')} className="btn-primary text-sm px-7 py-3 w-full sm:w-auto group">
              <span>Open Attack Sandbox</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button onClick={() => onNavigate('audit')} className="btn-secondary text-sm px-7 py-3 w-full sm:w-auto">
              <span>View the Audit Log</span>
            </button>
            <button onClick={onOpenSDKModal} className="btn-dark text-sm px-7 py-3 w-full sm:w-auto">
              <Code2 className="w-4 h-4" />
              <span>Get the SDK</span>
            </button>
          </div>
        </div>
      </section>

      {/* What FirewallX does */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto">
            <div className="eyebrow text-slate-500 flex items-center justify-center space-x-2 mb-2">
              <span className="w-6 h-px bg-slate-300" />
              <span>The Build</span>
              <span className="w-6 h-px bg-slate-300" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              An autonomous gatekeeper for every agent
            </h2>
            <p className="mt-4 text-slate-500 text-base leading-relaxed">
              Four layers work together:<span className="font-mono text-slate-700"> intercept → score → enforce → trip</span>.
              Spend caps, velocity limits, loop tripwires, and autonomous circuit breaker tripping are enforced on-chain by the Guard & Registry, while the 6-signal anomaly scorer runs client-side.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 90} className="h-full">
              <div className="card card-hover p-5 h-full">
                <div className={`p-2.5 rounded-xl ring-1 w-fit ${f.accent}`}>
                  <f.icon className="w-4.5 h-4.5" />
                </div>
                <h3 className="mt-3.5 text-sm font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-xs text-slate-500 leading-relaxed">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pipeline internals */}
      <section className="bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Verdict model */}
            <Reveal>
              <div>
              <div className="flex items-center space-x-2 text-xs font-mono text-blue-600 mb-2">
                <Radio className="w-3.5 h-3.5" />
                <span>VERDICT MODEL</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">Everything resolves to one of four outcomes</h3>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed mb-6">
                Evaluations are recorded with the triggered rule, anomaly report, and a reproducible action fingerprint — anchored to the on-chain Auditor and local audit trail.
              </p>
              <div className="space-y-3">
                {VERDICTS.map((v) => (
                  <div key={v.badge} className="flex items-start space-x-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                    <div className={`p-1.5 rounded-lg shrink-0 ${v.badgeCls} border`}>
                      <v.icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className={`chip ${v.badgeCls} !py-0.5 !text-[10px]`}>{v.badge}</span>
                      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            </Reveal>

            {/* Signals + policy knobs */}
            <Reveal delay={120}>
              <div>
              <div className="flex items-center space-x-2 text-xs font-mono text-violet-600 mb-2">
                <Gauge className="w-3.5 h-3.5" />
                <span>ANOMALY SIGNALS</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">Six signals, one risk score</h3>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed mb-6">
                The scorer compares each action against the agent's own history and policy envelope,
                not a global heuristic.
              </p>
              <ul className="space-y-2 mb-10">
                {SIGNALS.map(([label, detail]) => (
                  <li key={label} className="flex items-start space-x-2.5 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                    <span className="text-slate-700 font-medium">{label}</span>
                    <span className="text-slate-400 text-xs leading-relaxed pt-0.5">{detail}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center space-x-2 text-xs font-mono text-cyan-600 mb-2">
                <KeyRound className="w-3.5 h-3.5" />
                <span>POLICY STUDIO</span>
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-slate-900">Per-agent policies, not global defaults</h3>
<p className="mt-3 text-sm text-slate-500 leading-relaxed">
  Spend caps, hourly velocity, loop windows, identical-payload limits, anomaly thresholds,
  and destination allow/block lists — configured per agent in the Policy Studio or via the SDK.
  Spend cap, velocity, loop, allow/block lists, and autonomous breaker trips are enforced on-chain by the Guard;
  six-signal anomaly scoring runs client-side.
</p>
            </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Build architecture — animated flow */}
      <section className="bg-[#0a0a0f] border-y border-slate-800/60 relative overflow-hidden">
        <div className="absolute inset-0 cyber-grid opacity-30" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 relative">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-10">
              <div className="eyebrow text-blue-400 flex items-center justify-center space-x-2 mb-2">
                <span className="w-6 h-px bg-slate-700" />
                <span>BUILD ARCHITECTURE</span>
                <span className="w-6 h-px bg-slate-700" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                One pipeline, from agent action to verdict
              </h2>
<p className="mt-4 text-slate-400 text-sm leading-relaxed">
  The on-chain Guard & Registry enforce spend caps, velocity limits, loop/repetition tripwires, allow/block lists,
  and autonomous circuit breaker trips directly on BOT Chain, while the 6-signal anomaly scorer runs client-side. The glowing packet traces the live path.
</p>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="card !bg-white/[0.03] !border-slate-800 p-6 sm:p-10">
              <svg viewBox="0 0 1000 330" className="w-full h-auto">
                <defs>
                  <filter id="flow-glow" x="-200%" y="-200%" width="500%" height="500%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Connectors — flowing dashed pulse */}
                <line x1="104" y1="110" x2="836" y2="110" stroke="#334155" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset" values="0;-64" dur="1s" repeatCount="indefinite" />
                </line>
                <path d="M 872 134 C 900 170, 925 205, 925 238" fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset" values="0;-64" dur="1s" repeatCount="indefinite" />
                </path>
                <path d="M 848 134 C 820 170, 795 205, 795 238" fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="2 6" strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset" values="0;-64" dur="1s" repeatCount="indefinite" />
                </path>

                {/* Traveling glow packets */}
                <circle r="5" fill="#60a5fa" filter="url(#flow-glow)">
                  <animateMotion dur="3s" repeatCount="indefinite" path="M 104 110 H 836" />
                </circle>
                <circle r="3" fill="#93c5fd" opacity="0.7">
                  <animateMotion dur="3s" begin="1.5s" repeatCount="indefinite" path="M 104 110 H 836" />
                </circle>
                <circle r="5" fill="#34d399" filter="url(#flow-glow)">
                  <animateMotion dur="1.8s" begin="3s" repeatCount="indefinite" path="M 872 134 C 900 170, 925 205, 925 238" />
                </circle>
                <circle r="5" fill="#f43f5e" filter="url(#flow-glow)">
                  <animateMotion dur="1.8s" begin="3s" repeatCount="indefinite" path="M 848 134 C 820 170, 795 205, 795 238" />
                </circle>

                {/* Nodes */}
                <FlowNode x={80} y={110} stroke="#64748b" icon={Zap} iconCls="text-slate-300" title="Agent Action" caption="pre-tx call" />
                <FlowNode x={280} y={110} stroke="#3b82f6" icon={ShieldCheck} iconCls="text-blue-400" title="Intercept" caption="firewall engine" />
                <FlowNode x={480} y={110} stroke="#8b5cf6" icon={Gauge} iconCls="text-violet-400" title="Score & Detect" caption="loop + 6 signals" />
                <FlowNode x={680} y={110} stroke="#06b6d4" icon={KeyRound} iconCls="text-cyan-400" title="Policy Enforce" caption="caps · lists · Δ" />
                <FlowNode x={860} y={110} stroke="#f59e0b" icon={Radio} iconCls="text-amber-400" title="Verdict" caption="allow · flag · block" />

                <FlowNode x={925} y={260} r={22} stroke="#10b981" icon={ShieldCheck} iconCls="text-emerald-400" title="ALLOW — Release" caption="executed via Guard" />
                <FlowNode x={795} y={260} r={22} stroke="#f43f5e" icon={Zap} iconCls="text-rose-400" title="BLOCK / TRIP" caption="reverted · breaker trips" />
              </svg>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works — animated walkthrough */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="eyebrow text-slate-500 mb-2">How It Works</div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Watch the pipeline resolve a live attack
            </h2>
            <p className="mt-4 text-slate-500 text-base leading-relaxed">
              Three scenarios — a normal payment, a runaway loop, and a spend-cap breach. The animation
              steps through the same interception, scoring, and policy stages the engine executes.
            </p>
          </div>
        </Reveal>
        <PipelineDemo />
      </section>

      {/* SDK */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <Reveal>
          <div className="card p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-500/[0.07] blur-[80px]" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative">
            <div>
              <div className="flex items-center space-x-2 text-xs font-mono text-blue-600 mb-2">
                <FileCode2 className="w-3.5 h-3.5" />
                <span>AGENT SDK</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Three lines to wrap any agent
              </h2>
              <p className="mt-4 text-sm text-slate-500 leading-relaxed">
                LangChain, CrewAI, AutoGPT, or a custom bot — the SDK guards every transaction the agent
                attempts. The pre-execution check returns a verdict; the autonomous wrapper decides to
                release, flag, or halt based on your policy.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={onOpenSDKModal} className="btn-primary text-sm px-6 py-2.5">
                  <Code2 className="w-4 h-4" />
                  <span>View Drop-In Snippets</span>
                </button>
                <a
                  href="https://dev-docs.botchain.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-sm px-6 py-2.5"
                >
                  BOT Chain Dev Docs
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
            <div className="bg-[#0a0a0f] rounded-xl p-5 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2 overflow-x-auto">
              <div className="text-slate-500">// wrap your agent's transaction</div>
              <div className="text-cyan-300">const</div>
              <div className="text-slate-400">verdict = await firewall.evaluateAction({'{'}</div>
              <div className="pl-4 text-slate-400">target: </div>
              <div className="pl-4 text-slate-400">value: </div>
              <div className="pl-4 text-slate-400">data: </div>
              <div className="text-slate-400">{'}'});</div>
              <div className="mt-2 text-slate-500">// if ALLOW → release · FLAG → monitor · BLOCK → halt</div>
              <div className="text-emerald-400">if (verdict.verdict === 'ALLOW')</div>
              <div className="pl-4 text-slate-400">await agent.send(tx);</div>
              <div className="text-slate-500">else</div>
              <div className="pl-4 text-rose-400">console.error(verdict.reasoning);</div>
            </div>
          </div>
        </div>
        </Reveal>
      </section>

      {/* BOT Chain integration & status */}
      <section className="bg-white border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <Reveal>
            <div className="text-center max-w-2xl mx-auto mb-8">
              <div className="eyebrow text-slate-500 flex items-center justify-center space-x-2 mb-2">
                <span className="w-6 h-px bg-slate-300" />
                <span>Built for BOT Chain</span>
                <span className="w-6 h-px bg-slate-300" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                Target networks, verified live
              </h2>
              <p className="mt-4 text-slate-500 text-base leading-relaxed">
                FirewallX is fully deployed and verified across both BOT Chain Mainnet and Testnet.
                Sub-second finality (~0.75s) enables deterministic on-chain security evaluations with zero user latency.
              </p>

              {/* Network Tab Selector */}
              <div className="mt-6 inline-flex items-center p-1 bg-slate-100/90 rounded-full border border-slate-200 shadow-inner">
                <button
                  type="button"
                  onClick={() => setNetworkTab('mainnet')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 flex items-center space-x-2 ${
                    networkTab === 'mainnet'
                      ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${networkTab === 'mainnet' ? 'bg-white animate-pulse' : 'bg-amber-400'}`} />
                  <span>BOT Chain Mainnet (Live)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNetworkTab('testnet')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 flex items-center space-x-2 ${
                    networkTab === 'testnet'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${networkTab === 'testnet' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <span>BOT Chain Testnet (On-Chain)</span>
                </button>
              </div>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Network Facts (5 cols) */}
            <div className="lg:col-span-5 card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2 text-xs font-mono text-blue-600 font-bold uppercase tracking-wider">
                    <Network className="w-4 h-4" />
                    <span>{currentNetwork.chainName} Facts</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    networkTab === 'mainnet' 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {networkTab === 'mainnet' ? 'LIVE MAINNET' : 'PUBLIC TESTNET'}
                  </span>
                </div>

                <dl className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <dt className="text-slate-500 font-medium">RPC Endpoint</dt>
                    <dd className="font-mono text-blue-600 font-semibold">{currentNetwork.rpcUrl.replace('https://', '')}</dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <dt className="text-slate-500 font-medium">Block Explorer</dt>
                    <dd className="font-mono text-blue-600 font-semibold">
                      <a href={currentNetwork.blockExplorerUrls[0]} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                        <span>{currentNetwork.blockExplorerUrls[0].replace('https://', '')}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </dd>
                  </div>
                  {currentNetwork.faucetUrl ? (
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <dt className="text-slate-500 font-medium">Faucet</dt>
                      <dd className="font-mono text-blue-600 font-semibold">
                        <a href={currentNetwork.faucetUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          <span>faucet.botchain.ai</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </dd>
                    </div>
                  ) : (
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <dt className="text-slate-500 font-medium">Gas Market</dt>
                      <dd className="font-mono text-slate-700 font-semibold">Live BOT Native Gas</dd>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <dt className="text-slate-500 font-medium">Native Asset</dt>
                    <dd className="font-mono text-slate-800 font-semibold">{currentNetwork.nativeCurrency.symbol} (18 decimals)</dd>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <dt className="text-slate-500 font-medium">Block Time / Finality</dt>
                    <dd className="font-mono text-emerald-600 font-bold">~0.75s sub-second</dd>
                  </div>
                </dl>
              </div>

              <div className="mt-5 flex items-start space-x-2.5 p-3.5 rounded-xl bg-blue-50/70 border border-blue-100">
                <Cog className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Active connection targets the live <strong>{currentNetwork.chainName}</strong> endpoint — wallet balances and on-chain circuit breaker interactions execute in real-time.
                </p>
              </div>
            </div>

            {/* Verified On-Chain Contracts (7 cols) */}
            <div className="lg:col-span-7 card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2 text-xs font-mono text-emerald-600 font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verified Sentinel Contracts</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>100% BYTE-IDENTICAL</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { role: 'Registry', desc: 'Agent registration & policy config', addr: currentNetwork.contracts.registry },
                    { role: 'Guard', desc: 'Interception & breaker execution', addr: currentNetwork.contracts.guard },
                    { role: 'Auditor', desc: 'Immutable on-chain verdict logging', addr: currentNetwork.contracts.auditor },
                    { role: 'TestTarget', desc: 'Simulated DeFi protocol receiver', addr: currentNetwork.contracts.testTarget },
                  ].map((c) => (
                    <a
                      key={c.role}
                      href={`${currentNetwork.blockExplorerUrls[0]}/address/${c.addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-emerald-50/40 hover:border-emerald-300 transition-all group flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {c.role}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                      <p className="text-[10px] text-slate-500 mb-2 leading-tight">{c.desc}</p>
                      <div className="font-mono text-[11px] text-emerald-700 font-semibold truncate bg-white px-2 py-1 rounded border border-slate-200/80 group-hover:border-emerald-200">
                        {c.addr.slice(0, 8)}…{c.addr.slice(-6)}
                      </div>
                    </a>
                  ))}
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between">
                <span>Direct on-chain event indexer active for {currentNetwork.chainName}.</span>
                <span className="font-mono font-bold text-emerald-700">SUB-SECOND SETTLEMENT</span>
              </div>
            </div>

            {/* Architecture & Roadmap Status (12 cols full width) */}
            <div className="lg:col-span-12 card p-6">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-700 font-bold uppercase tracking-wider mb-4">
                <TerminalSquare className="w-4 h-4 text-blue-600" />
                <span>Architecture & Implementation Status</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {ROADMAP_ITEMS.map((item) => (
                  <div key={item.title} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900">{item.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{item.desc}</p>
                    </div>
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${item.badgeCls}`}>
                        {item.badge}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <Reveal>
          <div className="rounded-3xl bg-[#0a0a0f] relative overflow-hidden px-6 py-14 sm:px-12 text-center">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[320px] rounded-full bg-blue-600/20 blur-[110px]" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Break it. That's the point.
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto text-sm leading-relaxed">
              The Attack Sandbox is a safe room: run runaway loops, spend-cap breaches, entropy bombs,
              and drainer calls against the engine and watch verdicts resolve in milliseconds.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button onClick={() => onNavigate('simulator')} className="btn-primary text-sm px-7 py-3 w-full sm:w-auto group">
                <span>Open the Sandbox</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button onClick={() => onNavigate('policy')} className="btn-secondary text-sm px-7 py-3 w-full sm:w-auto">
                <KeyRound className="w-4 h-4" />
                <span>Configure a Policy</span>
              </button>
            </div>
          </div>
        </div>
        </Reveal>
      </section>
    </div>
  );
};