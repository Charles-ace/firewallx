import React, { useState, useEffect, useRef } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { LiveTelemetryFeed } from './components/LiveTelemetryFeed';
import { OnChainFeed } from './components/OnChainFeed';
import { IncidentCaseStudy } from './components/IncidentCaseStudy';
import { AgentSimulator } from './components/AgentSimulator';
import { PolicyStudio } from './components/PolicyStudio';
import { PublicAuditExplorer } from './components/PublicAuditExplorer';
import { SDKModal } from './components/SDKModal';
import { WalletModal } from './components/WalletModal';
import { LandingPage } from './components/LandingPage';
import { globalFirewallEngine } from './engine/firewallEngine';
import { EvaluationResult } from './engine/types';
import { Zap, ExternalLink, Shield, ArrowRight } from 'lucide-react';
import { BOTCHAIN_TESTNET } from './config/botchain';

interface HeroContent {
  pill?: string;
  title: string;
  highlight: string;
  sub: string;
  ctaLabel: string;
  ctaTarget: ActiveTab;
  secondaryLabel: string;
  secondaryTarget: ActiveTab;
}

const HERO_CONTENT: Record<Exclude<ActiveTab, 'home'>, HeroContent> = {
  telemetry: {
    title: 'AI agent security, scored',
    highlight: 'before it hits the chain.',
    sub: 'Every action is pre-checked before execution — with spend caps, allow/block lists, rolling velocity limits, loop tripwires, and autonomous circuit breaker trips enforced directly on-chain by the Guard & Registry on BOT Chain testnet.',
    ctaLabel: 'Open Attack Sandbox',
    ctaTarget: 'simulator',
    secondaryLabel: 'Explore Live Telemetry',
    secondaryTarget: 'audit',
  },
  incident: {
    pill: 'Simulated incident retrospective',
    title: 'The sixa-telegram runaway loop,',
    highlight: 'contained.',
    sub: 'An agent fell into a recursive retry loop with no firewall in place. FirewallX halts the same loop in milliseconds. Replay the scenario to see how.',
    ctaLabel: 'Replay the Incident',
    ctaTarget: 'incident',
    secondaryLabel: 'Try the Simulation',
    secondaryTarget: 'simulator',
  },
  simulator: {
    pill: 'Interactive attack sandbox',
    title: 'Attack the firewall.',
    highlight: 'Live.',
    sub: 'Run runaway loops, spend-cap breaches, entropy bombs, and drainer calls against the engine — watch verdicts resolve in milliseconds.',
    ctaLabel: 'Open Policy Studio',
    ctaTarget: 'policy',
    secondaryLabel: 'View Live Verdicts',
    secondaryTarget: 'telemetry',
  },
  policy: {
    pill: 'Agent policy studio',
    title: 'Fine-grained policies for',
    highlight: 'every agent.',
    sub: 'Spend caps, velocity limits, loop tripwires, anomaly thresholds, and destination allow/block lists — configured with one API. Spend cap, velocity, loop, allow/block lists, and autonomous breaker trips are enforced on-chain by the Guard; six-signal anomaly scoring runs client-side.',
    ctaLabel: 'Open the Sandbox',
    ctaTarget: 'simulator',
    secondaryLabel: 'See Protected Agents',
    secondaryTarget: 'telemetry',
  },
  audit: {
    pill: 'On-chain & local audit ledger',
    title: 'Proof over',
    highlight: 'trust.',
    sub: 'Every verdict, intercept, and autonomous circuit breaker trip is recorded with a reproducible action fingerprint, verified on-chain via the deployed FirewallXAuditor contract and live event indexer.',
    ctaLabel: 'Open the Sandbox',
    ctaTarget: 'simulator',
    secondaryLabel: 'Review an Incident',
    secondaryTarget: 'incident',
  },
};

const HERO_STATS = [
  { value: '0.75s', label: 'Fast finality' },
  { value: '<120ms', label: 'Circuit tripwire' },
  { value: '6', label: 'Anomaly signals' },
];

const FOOTER_LINKS: { title: string; items: { label: string; tab?: ActiveTab; href?: string; sdk?: boolean }[] }[] = [
  {
    title: 'Product',
    items: [
      { label: 'Live Telemetry', tab: 'telemetry' },
      { label: 'Attack Sandbox', tab: 'simulator' },
      { label: 'Policy Studio', tab: 'policy' },
      { label: 'Audit Log', tab: 'audit' },
      { label: 'Incident Case', tab: 'incident' },
      { label: 'Agent SDK', sdk: true },
    ],
  },
  {
    title: 'Developers',
    items: [
      { label: 'BOT Chain Dev Docs', href: 'https://dev-docs.botchain.ai' },
      { label: 'Testnet Explorer', href: BOTCHAIN_TESTNET.blockExplorerUrls[0] },
    ],
  },
];

const CursorGlow: React.FC = () => {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (glowRef.current) {
          glowRef.current.style.transform = `translate(${e.clientX - 150}px, ${e.clientY - 150}px)`;
        }
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={glowRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-0 w-[300px] h-[300px] rounded-full will-change-transform"
      style={{
        background:
          'radial-gradient(circle, rgba(59,130,246,0.16) 0%, rgba(139,92,246,0.10) 40%, transparent 70%)',
      }}
    />
  );
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [isSDKModalOpen, setIsSDKModalOpen] = useState<boolean>(false);
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
  const [circuitTripAlert, setCircuitTripAlert] = useState<{ agentName: string; reason: string } | null>(null);

  const pushEvaluation = (result: EvaluationResult) => {
    setEvaluations((prev) => {
      // Engine verdicts arrive via both the verdict subscription and the
      // simulator's onEvaluationComplete callback — dedupe so the same
      // actionId never appears twice in the list (duplicate React keys).
      if (prev.length > 0 && prev[0].actionId === result.actionId) return prev;
      return [result, ...prev.slice(0, 99)];
    });
  };

  useEffect(() => {
    globalFirewallEngine.subscribeVerdict(pushEvaluation);

    globalFirewallEngine.subscribeCircuitTrip((agentState, reason) => {
      setCircuitTripAlert({
        agentName: agentState.name,
        reason,
      });
      setTimeout(() => setCircuitTripAlert(null), 7000);
    });
  }, []);

  const handleEvaluationComplete = pushEvaluation;

  const trippedCount = globalFirewallEngine.getAllAgents().filter((a) => a.status === 'TRIPPED').length;
  const hero = activeTab === 'home' ? null : HERO_CONTENT[activeTab];

  return (
    <div className="relative min-h-screen bg-[#f7f8fc] text-slate-900 flex flex-col selection:bg-blue-600 selection:text-white overflow-x-hidden">
      {/* Ambient background — soft gradient glows */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <CursorGlow />
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[1000px] h-[560px] rounded-full bg-blue-500/[0.08] blur-[130px]" />
        <div className="absolute top-1/4 -left-48 w-[480px] h-[480px] rounded-full bg-violet-500/[0.07] blur-[120px]" />
        <div className="absolute top-2/3 -right-48 w-[520px] h-[520px] rounded-full bg-cyan-400/[0.07] blur-[130px]" />
      </div>

      {/* Circuit Breaker Emergency Toast Notification */}
      {circuitTripAlert && (
        <div className="fixed bottom-5 right-5 z-50 p-4 rounded-2xl bg-white border-2 border-rose-200 shadow-[0_20px_60px_-16px_rgba(225,29,72,0.35)] max-w-md">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-500 shrink-0 ring-1 ring-rose-100">
              <Zap className="w-5 h-5 text-rose-500" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-rose-600">
                Circuit Breaker Tripped
              </div>
              <p className="text-sm font-bold text-slate-900">{circuitTripAlert.agentName}</p>
              <p className="text-xs text-slate-500 leading-tight">{circuitTripAlert.reason}</p>
              <div className="pt-1.5">
                <button
                  onClick={() => {
                    setActiveTab('policy');
                    setCircuitTripAlert(null);
                  }}
                  className="text-xs font-mono text-blue-600 hover:underline font-semibold"
                >
                  Manage in Policy Studio →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSDKModal={() => setIsSDKModalOpen(true)}
        trippedCount={trippedCount}
      />

      {hero && (
        <>
      {/* Hero */}
      <section className="relative z-10 border-b border-slate-200/80 bg-gradient-to-b from-blue-50/70 via-white/40 to-transparent cyber-grid overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24 text-center">
          {/* Pill badge */}
          {hero.pill && (
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] mb-7">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>{hero.pill}</span>
            </div>
          )}

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 max-w-3xl mx-auto leading-[1.08]">
            {hero.title} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">{hero.highlight}</span>
          </h1>

          <p className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            {hero.sub}
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => setActiveTab(hero.ctaTarget)} className="btn-primary text-sm px-7 py-3 w-full sm:w-auto group">
              <span>{hero.ctaLabel}</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button onClick={() => setActiveTab(hero.secondaryTarget)} className="btn-secondary text-sm px-7 py-3 w-full sm:w-auto">
              <span>{hero.secondaryLabel}</span>
            </button>
          </div>

          {/* Compact trust stats */}
          <div className="mt-10 grid grid-cols-3 max-w-lg mx-auto divide-x divide-slate-200 rounded-2xl bg-white/70 backdrop-blur border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {HERO_STATS.map((s) => (
              <div key={s.label} className="px-4 py-3.5">
                <div className="text-base sm:text-lg font-bold font-mono text-slate-900">{s.value}</div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Chain Contract Status Line */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-slate-400">
            <span>
              Sentinel Registry:{' '}
              <a
                href={`${BOTCHAIN_TESTNET.blockExplorerUrls[0]}/address/${BOTCHAIN_TESTNET.contracts.registry}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline"
              >
                {BOTCHAIN_TESTNET.contracts.registry.slice(0, 6)}…{BOTCHAIN_TESTNET.contracts.registry.slice(-4)} deployed
              </a>
            </span>
            <span>
              Auditor Contract:{' '}
              <a
                href={`${BOTCHAIN_TESTNET.blockExplorerUrls[0]}/address/${BOTCHAIN_TESTNET.contracts.auditor}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:underline"
              >
                {BOTCHAIN_TESTNET.contracts.auditor.slice(0, 6)}…{BOTCHAIN_TESTNET.contracts.auditor.slice(-4)} deployed
              </a>
            </span>
            <span>
              Engine:{' '}
              <span className="text-slate-600">on-chain Guard enforced</span>
            </span>
            <a
              href="https://dev-docs.botchain.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center"
            >
              Docs <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>
      </section>
        </>)}

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {activeTab === 'home' && (
          <LandingPage
            onNavigate={setActiveTab}
            onOpenSDKModal={() => setIsSDKModalOpen(true)}
          />
        )}

        {activeTab === 'telemetry' && (
          <>
            <OnChainFeed />
            <div className="mt-6">
              <LiveTelemetryFeed
                evaluations={evaluations}
                onTriggerSimAction={() => setActiveTab('simulator')}
              />
            </div>
          </>
        )}

        {activeTab === 'incident' && <IncidentCaseStudy />}

        {activeTab === 'simulator' && (
          <AgentSimulator onEvaluationComplete={handleEvaluationComplete} />
        )}

        {activeTab === 'policy' && (
          <PolicyStudio onPolicyUpdated={() => setEvaluations([...globalFirewallEngine.getAuditLog()])} />
        )}

        {activeTab === 'audit' && (
          <PublicAuditExplorer auditLog={evaluations} />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-[#0a0a0f] text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-10">
            {/* Brand Column */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center space-x-2.5">
                <img src="/logo.svg" alt="FirewallX" className="w-9 h-9" draggable={false} />
                <span className="text-lg font-extrabold tracking-tight text-white">FirewallX</span>
              </div>
              <p className="text-sm leading-relaxed max-w-xs">
                Agent Action Firewall & Autonomous Circuit Breaker for BOT Chain.
              </p>
            </div>

            {/* Link Columns */}
            {FOOTER_LINKS.map((col) => (
              <div key={col.title} className="space-y-3">
                <div className="eyebrow text-slate-500">{col.title}</div>
                <ul className="space-y-2.5">
                  {col.items.map((item) => (
                    <li key={item.label}>
                      {item.tab ? (
                        <button
                          onClick={() => setActiveTab(item.tab!)}
                          className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                          {item.label}
                        </button>
                      ) : item.sdk ? (
                        <button
                          onClick={() => setIsSDKModalOpen(true)}
                          className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                          {item.label}
                        </button>
                      ) : (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-slate-400 hover:text-white transition-colors"
                        >
                          {item.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span>© 2026 FirewallX — AI Agent Action Firewall for BOT Chain.</span>
            <div className="flex items-center space-x-4 font-mono">
              <span>BOT Chain Testnet</span>
              <span>•</span>
              <span>EVM Compatible</span>
              <span>•</span>
              <span className="text-blue-400">Local evaluation engine</span>
            </div>
          </div>
        </div>
      </footer>

      {/* SDK Integration Modal */}
      <SDKModal isOpen={isSDKModalOpen} onClose={() => setIsSDKModalOpen(false)} />

      {/* Wallet Connection Modal */}
      <WalletModal />
    </div>
  );
};