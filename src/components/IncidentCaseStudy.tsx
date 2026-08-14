import React, { useState } from 'react';
import { ShieldCheck, Flame, Play, RotateCcw, Clock, CheckCircle2, XCircle, Timer, Gauge } from 'lucide-react';
import { SIXA_INCIDENT_TIMELINE, INCIDENT_SUMMARY } from '../data/incidentData';

export const IncidentCaseStudy: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(SIXA_INCIDENT_TIMELINE.length - 1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const activePoint = SIXA_INCIDENT_TIMELINE[currentStep];

  const handlePlay = () => {
    setIsPlaying(true);
    let step = 0;
    setCurrentStep(0);
    const interval = setInterval(() => {
      step += 1;
      if (step >= SIXA_INCIDENT_TIMELINE.length) {
        clearInterval(interval);
        setIsPlaying(false);
      } else {
        setCurrentStep(step);
      }
    }, 1800);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStep(0);
  };

  return (
    <div className="space-y-6">
      {/* Header Case Study Banner */}
      <div className="p-6 sm:p-8 card relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-amber-600 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>SIMULATED INCIDENT SCENARIO: {INCIDENT_SUMMARY.incidentDate}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">sixa-telegram</span> Runaway Loop Breakdown
            </h2>
            <p className="text-slate-500 text-sm mt-2 max-w-3xl leading-relaxed">
              An unhandled webhook timeout triggered recursive retries, causing an off-chain/on-chain agent to execute
              over <span className="text-rose-600 font-mono font-bold">4,120+ operations</span> before human discovery.
              Here is what happened without a circuit breaker vs how <strong className="text-slate-700">FirewallX</strong> auto-halts it in milliseconds.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button onClick={handlePlay} disabled={isPlaying} className="btn-primary !px-5 !py-2.5">
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isPlaying ? 'Replaying...' : 'Replay Incident'}</span>
            </button>
            <button onClick={handleReset} className="btn-secondary !p-2.5" title="Reset scrubber">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Side-by-Side Impact Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Without Firewall Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-rose-50/80 to-white border border-rose-200/80 relative overflow-hidden space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 to-rose-600" />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600 ring-1 ring-rose-200">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Without FirewallX (Actual Aug 12)</h3>
            </div>
            <span className="chip bg-rose-100 text-rose-700 border-rose-200 font-bold">
              UNPROTECTED
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="bg-white p-3.5 rounded-xl border border-rose-200/70">
              <span className="text-[11px] text-slate-400 block font-mono">Total Runaway Operations</span>
              <span className="text-2xl font-bold font-mono text-rose-600">
                {activePoint.operationsWithoutFirewall.toLocaleString()} ops
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-rose-200/70">
              <span className="text-[11px] text-slate-400 block font-mono flex items-center">
                <Timer className="w-3 h-3 mr-1" /> Time to Containment
              </span>
              <span className="text-xl font-bold font-mono text-slate-800">3h 30m</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex items-start space-x-2">
              <XCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <span>No automated rate or loop limit — retry loops run indefinitely until balance drain or quota breach.</span>
            </div>
            <div className="flex items-start space-x-2">
              <XCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <span>Requires human to notice anomalous billings, pull server logs, and manually kill webhooks.</span>
            </div>
          </div>
        </div>

        {/* With FirewallX Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-50/80 to-white border border-emerald-200/80 relative overflow-hidden space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">With FirewallX (Autonomous Protection)</h3>
            </div>
            <span className="chip bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
              ACTIVE GUARDIAN
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70">
              <span className="text-[11px] text-slate-400 block font-mono">Max Operations Allowed</span>
              <span className="text-2xl font-bold font-mono text-emerald-600">
                {activePoint.operationsWithFirewallX} ops
              </span>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-emerald-200/70">
              <span className="text-[11px] text-slate-400 block font-mono flex items-center">
                <Gauge className="w-3 h-3 mr-1" /> Tripwire Time
              </span>
              <span className="text-xl font-bold font-mono text-blue-600">&lt; 120 ms</span>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>Sliding-window loop detector (in-browser engine) flags the 4th identical calldata and trips the sandbox breaker.</span>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>A sentinel/manual call trips the breaker to TRIPPED on-chain, generating verifiable proof on the block explorer.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Step Scrubber Timeline */}
      <div className="p-6 card space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Incident Timeline Scrubber</h3>
          </div>
          <span className="text-xs font-mono text-blue-600">
            Step {currentStep + 1} of {SIXA_INCIDENT_TIMELINE.length} — Timestamp: {activePoint.time}
          </span>
        </div>

        {/* Progress Timeline Buttons */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {SIXA_INCIDENT_TIMELINE.map((item, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={`p-2.5 rounded-xl text-left border transition-all duration-200 ${
                currentStep === idx
                  ? 'bg-gradient-to-b from-blue-50 to-white border-blue-400 shadow-[0_6px_16px_-8px_rgba(37,99,235,0.35)] -translate-y-0.5'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="text-[10px] font-mono text-slate-400">{item.time}</div>
              <div className="text-xs font-bold font-mono mt-0.5 text-slate-700 truncate">{item.incidentStatus}</div>
              <div className="text-[10px] font-mono mt-1 text-blue-600">{item.operationsWithoutFirewall} ops</div>
            </button>
          ))}
        </div>

        {/* Active Step Deep-Dive Card */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-xs font-mono font-bold text-slate-800 uppercase">{activePoint.incidentStatus}</span>
            </div>
            {activePoint.verdict === 'TRIPPED' ? (
              <span className="chip bg-rose-100 text-rose-700 border-rose-200 font-bold">
                ⚡ CIRCUIT BREAKER TRIPPED
              </span>
            ) : activePoint.verdict === 'FLAG' ? (
              <span className="chip bg-amber-100 text-amber-700 border-amber-200 font-bold">
                ⚠ ANOMALY FLAG FIRED
              </span>
            ) : activePoint.verdict === 'BLOCK' ? (
              <span className="chip bg-rose-100 text-rose-700 border-rose-200 font-bold">
                ✕ EXECUTION HALTED
              </span>
            ) : (
              <span className="chip bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
                ✓ NORMAL BASELINE
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-sans">{activePoint.notes}</p>
        </div>
      </div>
    </div>
  );
};