import React, { useEffect, useRef, useState } from 'react';
import {
  Zap, Cpu, ShieldCheck, CheckCircle2, XCircle, RotateCcw, Activity, ArrowRight, Gauge, Play,
} from 'lucide-react';

type Verdict = 'ALLOW' | 'BLOCK' | 'TRIP';

interface Factor {
  label: string;
  value: number;
  color: string;
}

interface Scenario {
  id: string;
  label: string;
  verdict: Verdict;
  verdictLabel: string;
  verdictNote: string;
  verdictCls: string;
  factors: Factor[];
  logs: { at: number; text: string }[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'normal',
    label: 'Normal Payment',
    verdict: 'ALLOW',
    verdictLabel: 'ALLOW · RELEASED',
    verdictNote: 'Composite risk 0.9/10 — every policy passes. The action is released for execution.',
    verdictCls: 'bg-emerald-500 border-emerald-400',
    factors: [
      { label: 'Repetition', value: 4, color: 'bg-violet-500' },
      { label: 'Velocity', value: 12, color: 'bg-amber-500' },
      { label: 'Entropy', value: 9, color: 'bg-blue-500' },
      { label: 'Destination', value: 5, color: 'bg-rose-500' },
      { label: 'Spend dev.', value: 6, color: 'bg-sky-500' },
    ],
    logs: [
      { at: 0, text: 'intercept · action in-flight → 0x8ba1…dba72 · 0.04 tBOT' },
      { at: 1, text: 'scorer    · composite risk 0.9/10 · baseline match' },
      { at: 2, text: 'policy    · spend cap · velocity · allowlist — all PASS' },
      { at: 3, text: 'verdict   · ALLOW · releasing to caller' },
    ],
  },
  {
    id: 'loop',
    label: 'Runaway Loop',
    verdict: 'TRIP',
    verdictLabel: 'TRIP · CIRCUIT OPEN · AGENT PAUSED',
    verdictNote: 'Repetition 96/100 — sliding-window detector fires and the breaker halts the agent.',
    verdictCls: 'bg-rose-600 border-rose-500',
    factors: [
      { label: 'Repetition', value: 96, color: 'bg-violet-500' },
      { label: 'Velocity', value: 88, color: 'bg-amber-500' },
      { label: 'Entropy', value: 20, color: 'bg-blue-500' },
      { label: 'Destination', value: 6, color: 'bg-rose-500' },
      { label: 'Spend dev.', value: 52, color: 'bg-sky-500' },
    ],
    logs: [
      { at: 0, text: 'intercept · burst detected → 5 identical payloads' },
      { at: 1, text: 'scorer    · repetition 96/100 · loop signature' },
      { at: 2, text: 'policy    · loop window 4/3 exceeded — override' },
      { at: 3, text: 'verdict   · TRIP · circuit open · agent paused' },
    ],
  },
  {
    id: 'spend',
    label: 'Spend Cap Breach',
    verdict: 'BLOCK',
    verdictLabel: 'BLOCK · RETURNED TO SENDER',
    verdictNote: 'Spend deviation 99/100 — 15.0 tBOT requested against a 0.2 tBOT cap. Never reaches the chain.',
    verdictCls: 'bg-rose-600 border-rose-500',
    factors: [
      { label: 'Repetition', value: 10, color: 'bg-violet-500' },
      { label: 'Velocity', value: 30, color: 'bg-amber-500' },
      { label: 'Entropy', value: 15, color: 'bg-blue-500' },
      { label: 'Destination', value: 92, color: 'bg-rose-500' },
      { label: 'Spend dev.', value: 99, color: 'bg-sky-500' },
    ],
    logs: [
      { at: 0, text: 'intercept · action in-flight → 0x8ba1…dba72 · 15.0 tBOT' },
      { at: 1, text: 'scorer    · spend deviation 99/100 · far from baseline' },
      { at: 2, text: 'policy    · maxSpendPerTx violated — 15.0 > 0.2' },
      { at: 3, text: 'verdict   · BLOCK · returned to sender' },
    ],
  },
];

const STAGES = [
  { label: 'Intercept', icon: Zap },
  { label: 'AI Scorer', icon: Cpu },
  { label: 'Policy', icon: ShieldCheck },
];

const getVerdictIcon = (v: Verdict, cls: string) => {
  if (v === 'ALLOW') return <CheckCircle2 className={cls} />;
  if (v === 'BLOCK') return <XCircle className={cls} />;
  return <Zap className={cls} />;
};

const stageFor = (progress: number) => (progress < 25 ? 0 : progress < 55 ? 1 : progress < 80 ? 2 : 3);

const connectorPct = (index: number, progress: number) => {
  const start = (index + 1) * 25;
  return Math.max(0, Math.min(100, ((progress - start) / 25) * 100));
};

function FactorBars({ factors }: { factors: Factor[] }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 80);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="space-y-2.5">
      {factors.map((f, i) => (
        <div key={f.label}>
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span className="text-slate-400">{f.label}</span>
            <span className={f.value >= 70 ? 'text-rose-400' : f.value >= 35 ? 'text-amber-400' : 'text-emerald-400'}>
              {on ? f.value : 0}/100
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className={`${f.color} h-1.5 rounded-full transition-all duration-700 ease-out`}
              style={{ width: on ? `${f.value}%` : '0%', transitionDelay: `${i * 130}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export const PipelineDemo: React.FC = () => {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scenario = SCENARIOS[scenarioIdx];
  const stage = stageFor(progress);

  useEffect(() => {
    if (!playing) return;
    intervalRef.current = setInterval(() => {
      setProgress((p) => Math.min(100, p + 2));
    }, 160);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, scenarioIdx]);

  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => {
        setScenarioIdx((i) => (i + 1) % SCENARIOS.length);
        setProgress(0);
      }, 2200);
      return () => clearTimeout(t);
    }
  }, [progress]);

  const selectScenario = (idx: number) => {
    setScenarioIdx(idx);
    setProgress(0);
    setPlaying(true);
  };

  return (
    <div className="w-full max-w-2xl mx-auto text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
        <div className="eyebrow text-slate-500 flex items-center space-x-2">
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          <span>Animated Walkthrough — How FirewallX Evaluates</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex p-0.5 bg-slate-100 border border-slate-200 rounded-md">
            {SCENARIOS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => selectScenario(i)}
                className={`px-3 py-1 text-[11px] font-mono rounded transition-colors ${
                  scenarioIdx === i ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setProgress(0); setPlaying(true); }}
            className="p-1.5 rounded-md border border-slate-300 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Replay"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Panel */}
      <div className="rounded-2xl bg-[#0a0a0f] border border-slate-800 p-5 sm:p-6 overflow-hidden relative">
        {/* Progress rail */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5">
          <div className="h-full bg-blue-500 transition-all duration-75" style={{ width: `${progress}%` }} />
        </div>

        {/* Stage row */}
        <div className="flex items-center">
          {STAGES.map((s, i) => {
            const st = stage;
            const done = i < st;
            const active = i === st;
            const Connector = i === 0 ? null : (
              <div className="flex-1 h-0.5 bg-white/10 relative mx-2 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-blue-400 transition-all duration-75"
                  style={{ width: `${connectorPct(i - 1, progress)}%` }}
                />
              </div>
            );
            return (
              <React.Fragment key={s.label}>
                {Connector}
                <div className="flex items-center gap-2">
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-lg border-2 transition-colors duration-150 ${
                      done
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : active
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-white/5 border-slate-700 text-slate-500'
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider ${
                      done || active ? 'text-slate-200' : 'text-slate-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
          {/* Verdict node */}
          <div className="flex-1 h-0.5 bg-white/10 relative mx-2 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-blue-400 transition-all duration-75"
              style={{ width: `${connectorPct(2, progress)}%` }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center justify-center w-9 h-9 rounded-lg border-2 transition-colors duration-150 ${
                stage === 3
                  ? scenario.verdict === 'ALLOW'
                    ? 'bg-emerald-500 border-emerald-400 text-white'
                    : 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-white/5 border-slate-700 text-slate-500'
              }`}
            >
              {getVerdictIcon(scenario.verdict, 'w-4 h-4')}
            </div>
            <span className={`text-[10px] font-mono uppercase tracking-wider ${stage === 3 ? 'text-slate-200' : 'text-slate-500'}`}>
              Verdict
            </span>
          </div>
        </div>

        {/* Stage content */}
        <div className="mt-5 min-h-[150px]">
          {stage === 0 && (
            <div className="fade-in-up">
              <div className="text-sm font-semibold text-slate-100 flex items-center space-x-2">
                <Play className="w-3.5 h-3.5 text-amber-400" />
                <span>Action intercepted in-flight</span>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="p-2.5 rounded-lg bg-white/5 border border-slate-800">
                  <div className="text-slate-500 mb-0.5">Agent</div>
                  <div className="text-slate-300 truncate">{scenario.id === 'normal' ? 'agent-sixa-telegram' : 'agent-sixa-telegram'}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-slate-800">
                  <div className="text-slate-500 mb-0.5">Target</div>
                  <div className="text-slate-300 truncate">0x8ba1…dba72</div>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-slate-800">
                  <div className="text-slate-500 mb-0.5">Value</div>
                  <div className="text-slate-300">{scenario.id === 'spend' ? '15.0 tBOT' : '0.04 tBOT'}</div>
                </div>
              </div>
            </div>
          )}

          {stage === 1 && (
            <div className="fade-in-up">
              <div className="text-sm font-semibold text-slate-100 flex items-center space-x-2 mb-3">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                <span>AI anomaly scoring in progress</span>
              </div>
              <FactorBars key={scenario.id} factors={scenario.factors} />
            </div>
          )}

          {stage === 2 && (
            <div className="fade-in-up space-y-2">
              <div className="text-sm font-semibold text-slate-100 flex items-center space-x-2 mb-3">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Policy engine checks (in-browser)</span>
              </div>
              {['Spend cap', 'Velocity / loop window', 'Destination allow & block lists', 'Anomaly threshold'].map((p, i) => (
                <div key={p} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-300">{p}</span>
                  <span
                    className={`text-[11px] font-mono fade-in-up ${
                      scenario.verdict !== 'ALLOW' && (i === 1 || i === 3)
                        ? 'text-rose-400'
                        : scenario.verdict === 'BLOCK' && i === 0
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                    style={{ animationDelay: `${i * 250}ms` }}
                  >
                    {scenario.verdict === 'ALLOW' ? 'PASS' : i === 1 || i === 3 || (scenario.verdict === 'BLOCK' && i === 0) ? 'FAIL' : 'PASS'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {stage === 3 && (
            <div className={`fade-in-up p-4 rounded-xl border ${scenario.verdictCls} bg-white/5`}>
              <div className="flex items-center space-x-2">
                {getVerdictIcon(scenario.verdict, 'w-4 h-4 text-white')}
                <span className="text-sm font-bold font-mono text-white">{scenario.verdictLabel}</span>
              </div>
              <p className="mt-2 text-[11px] text-slate-300 leading-relaxed">{scenario.verdictNote}</p>
            </div>
          )}
        </div>

        {/* Console log */}
        <div className="mt-4 pt-3 border-t border-slate-800 font-mono text-[10px] leading-relaxed space-y-1">
          {scenario.logs.filter((l) => l.at <= stage).map((l) => (
            <div
              key={l.text}
              className={`fade-in-up whitespace-nowrap overflow-hidden text-ellipsis ${
                l.text.includes('ALLOW')
                  ? 'text-emerald-400'
                  : l.text.includes('BLOCK') || l.text.includes('TRIP')
                  ? 'text-rose-400'
                  : 'text-slate-500'
              }`}
            >
              <ArrowRight className="w-3 h-3 inline text-slate-600 mr-1" />
              {l.text}
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-slate-600">
          <span>{playing ? 'auto-playing · scenario advancing' : 'paused'}</span>
          <span>
            step {stage + 1}/4 · {Math.min(100, Math.round(progress + 5))}%
          </span>
        </div>
      </div>
    </div>
  );
};