import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, ShieldAlert, AlertTriangle, Zap, CheckCircle2, XCircle, Search, 
  ChevronDown, Cpu, Clock, FileCode2, Activity, Ban, Flag, Play, Pause, 
  RotateCcw, Download, Sparkles, Copy, Check, Filter, Layers, BarChart2
} from 'lucide-react';
import { EvaluationResult, VerdictDecision } from '../engine/types';
import { globalFirewallEngine } from '../engine/firewallEngine';

interface LiveTelemetryFeedProps {
  evaluations: EvaluationResult[];
  totalSessionCount?: number;
  onTriggerSimAction?: () => void;
}

export const LiveTelemetryFeed: React.FC<LiveTelemetryFeedProps> = ({ evaluations, totalSessionCount, onTriggerSimAction }) => {
  const [filterVerdict, setFilterVerdict] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'SAFE' | 'ELEVATED' | 'CRITICAL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<EvaluationResult | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState<boolean>(true);
  const [streamIntervalMs, setStreamIntervalMs] = useState<number>(3000);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const streamTimerRef = useRef<number | null>(null);

  // Auto-run live stream of simulated AI agent traffic
  useEffect(() => {
    if (!isLiveStreamActive) {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      return;
    }

    // Emit initial sample if empty
    if (evaluations.length === 0) {
      const initAction = globalFirewallEngine.generateSimulatedAction();
      globalFirewallEngine.evaluate(initAction);
    }

    streamTimerRef.current = window.setInterval(() => {
      const action = globalFirewallEngine.generateSimulatedAction();
      globalFirewallEngine.evaluate(action);
    }, streamIntervalMs);

    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, [isLiveStreamActive, streamIntervalMs, evaluations.length]);

  const handleEmitBatch = () => {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const action = globalFirewallEngine.generateSimulatedAction();
        globalFirewallEngine.evaluate(action);
      }, i * 200);
    }
  };

  const handleResetAllBreakers = () => {
    globalFirewallEngine.resetAllBreakers();
    setActionNotice('All agent circuit breakers restored to ACTIVE');
    setTimeout(() => setActionNotice(null), 3000);
  };

  const handleBlockDestination = (agentWallet: string, targetAddr: string) => {
    const agent = globalFirewallEngine.getAgent(agentWallet);
    if (agent) {
      if (!agent.policy.blocklist.includes(targetAddr)) {
        const updatedPolicy = {
          ...agent.policy,
          blocklist: [...agent.policy.blocklist, targetAddr],
        };
        globalFirewallEngine.updatePolicy(agentWallet, updatedPolicy);
        setActionNotice(`Added ${targetAddr.substring(0, 8)}... to blocklist for ${agent.name}`);
        setTimeout(() => setActionNotice(null), 3500);
      } else {
        setActionNotice(`Address already on blocklist`);
        setTimeout(() => setActionNotice(null), 2500);
      }
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(evaluations, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `firewallx-telemetry-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportCSV = () => {
    const headers = ['ActionID', 'AgentID', 'AgentWallet', 'Verdict', 'RiskScore', 'RuleTriggered', 'Target', 'Value_tBOT', 'CircuitTripped', 'Timestamp'];
    const rows = evaluations.map(e => [
      e.actionId,
      e.agentId,
      e.agentWallet,
      e.verdict,
      e.anomalyScore,
      `"${e.ruleTriggered.replace(/"/g, '""')}"`,
      e.target,
      e.value,
      e.circuitTripped ? 'TRUE' : 'FALSE',
      new Date(e.timestamp).toISOString()
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csvContent);
    a.download = `firewallx-telemetry-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const filteredEvaluations = evaluations.filter((item) => {
    if (filterVerdict !== 'ALL' && item.verdict !== filterVerdict) {
      return false;
    }
    if (riskFilter === 'SAFE' && item.anomalyScore >= 400) return false;
    if (riskFilter === 'ELEVATED' && (item.anomalyScore < 400 || item.anomalyScore >= 700)) return false;
    if (riskFilter === 'CRITICAL' && item.anomalyScore < 700) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.agentId.toLowerCase().includes(q) ||
        item.agentWallet.toLowerCase().includes(q) ||
        item.target.toLowerCase().includes(q) ||
        item.ruleTriggered.toLowerCase().includes(q) ||
        item.actionHash.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const total = evaluations.length;
  const allowed = evaluations.filter((e) => e.verdict === 'ALLOW').length;
  const blocked = evaluations.filter((e) => e.verdict === 'BLOCK').length;
  const flagged = evaluations.filter((e) => e.verdict === 'FLAG').length;
  const trips = evaluations.filter((e) => e.circuitTripped).length;

  const safeCount = evaluations.filter(e => e.anomalyScore < 400).length;
  const elevatedCount = evaluations.filter(e => e.anomalyScore >= 400 && e.anomalyScore < 700).length;
  const criticalCount = evaluations.filter(e => e.anomalyScore >= 700).length;

  const safePct = total > 0 ? Math.round((safeCount / total) * 100) : 0;
  const elevatedPct = total > 0 ? Math.round((elevatedCount / total) * 100) : 0;
  const criticalPct = total > 0 ? Math.round((criticalCount / total) * 100) : 0;

  const metricCards = [
    {
      label: 'Total Intercepts',
      value: String(totalSessionCount && totalSessionCount > total ? totalSessionCount : total),
      sub: 'Pre-mempool evaluations',
      icon: Activity,
      iconBg: 'bg-blue-50 text-blue-600 ring-blue-100',
      valueClass: 'text-slate-900',
    },
    {
      label: 'Safe Execution',
      value: String(allowed),
      sub: `${total > 0 ? ((allowed / total) * 100).toFixed(0) : 0}% passing policy`,
      icon: ShieldCheck,
      iconBg: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
      valueClass: 'text-emerald-600',
    },
    {
      label: 'Blocks & Rejections',
      value: String(blocked),
      sub: 'Blocked by policy & Guard',
      icon: Ban,
      iconBg: 'bg-rose-50 text-rose-600 ring-rose-100',
      valueClass: 'text-rose-600',
    },
    {
      label: 'Monitored Flags',
      value: String(flagged),
      sub: 'Elevated anomaly risk',
      icon: Flag,
      iconBg: 'bg-amber-50 text-amber-600 ring-amber-100',
      valueClass: 'text-amber-600',
    },
    {
      label: 'Circuit Halts',
      value: String(trips),
      sub: 'Breakers autonomous trip',
      icon: Zap,
      iconBg: 'bg-rose-50 text-rose-600 ring-rose-100',
      valueClass: 'text-rose-600',
    },
  ];

  const getVerdictBadge = (verdict: VerdictDecision, tripped?: boolean) => {
    if (tripped) {
      return (
        <span className="chip bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse">
          <Zap className="w-3 h-3 text-rose-600" />
          TRIPPED
        </span>
      );
    }
    switch (verdict) {
      case 'ALLOW':
        return (
          <span className="chip bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            ALLOW
          </span>
        );
      case 'BLOCK':
        return (
          <span className="chip bg-rose-50 text-rose-700 border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            BLOCK
          </span>
        );
      case 'FLAG':
        return (
          <span className="chip bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            FLAG
          </span>
        );
    }
  };

  const getAccentBar = (item: EvaluationResult) => {
    if (item.circuitTripped) return 'bg-rose-500';
    switch (item.verdict) {
      case 'ALLOW':
        return 'bg-emerald-500';
      case 'BLOCK':
        return 'bg-rose-500';
      case 'FLAG':
        return 'bg-amber-500';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 700) return 'text-rose-600';
    if (score >= 400) return 'text-amber-600';
    return 'text-emerald-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 700) return 'bg-rose-500';
    if (score >= 400) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {actionNotice && (
        <div className="fixed top-20 right-6 z-50 p-3.5 px-4 rounded-xl bg-slate-900 text-white shadow-2xl flex items-center space-x-2 text-xs font-mono border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Top Banner / Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {metricCards.map((m) => (
          <div key={m.label} className="card card-hover p-4 relative overflow-hidden col-span-2 sm:col-span-1">
            <div className="flex items-start justify-between">
              <div className="text-[11px] eyebrow text-slate-400">{m.label}</div>
              <div className={`p-1.5 rounded-lg ring-1 ${m.iconBg}`}>
                <m.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className={`text-2xl font-mono font-bold mt-1.5 ${m.valueClass}`}>{m.value}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Live Stream Controls & Spectrum Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Stream controller (7 cols) */}
        <div className="lg:col-span-7 card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsLiveStreamActive(!isLiveStreamActive)}
              className={`p-2.5 rounded-xl border flex items-center space-x-2 text-xs font-semibold transition-all ${
                isLiveStreamActive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {isLiveStreamActive ? (
                <>
                  <Pause className="w-4 h-4 text-emerald-600" />
                  <span>Stream Active</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 text-slate-600" />
                  <span>Stream Paused</span>
                </>
              )}
            </button>

            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-mono">
              <span>Rate:</span>
              {[
                { label: '1.2s', ms: 1200 },
                { label: '3s', ms: 3000 },
                { label: '6s', ms: 6000 },
              ].map((s) => (
                <button
                  key={s.ms}
                  onClick={() => setStreamIntervalMs(s.ms)}
                  className={`px-2 py-1 rounded text-[11px] ${
                    streamIntervalMs === s.ms
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleEmitBatch}
              title="Inject 3 instant simulated agent actions"
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Burst (3)</span>
            </button>
            <button
              onClick={handleResetAllBreakers}
              title="Reset all tripped agent breakers"
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
              <span>Reset Breakers</span>
            </button>
          </div>
        </div>

        {/* Anomaly Risk Spectrum Bar (5 cols) */}
        <div className="lg:col-span-5 card p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-slate-700 flex items-center space-x-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Telemetry Risk Spectrum</span>
            </span>
            <span className="text-[11px] font-mono text-slate-400">{total} actions sampled</span>
          </div>

          {/* Spectrum Bar */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div style={{ width: `${safePct}%` }} className="bg-emerald-500 transition-all" title={`Safe: ${safePct}%`} />
            <div style={{ width: `${elevatedPct}%` }} className="bg-amber-500 transition-all" title={`Elevated: ${elevatedPct}%`} />
            <div style={{ width: `${criticalPct}%` }} className="bg-rose-500 transition-all" title={`Critical: ${criticalPct}%`} />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono mt-2 text-slate-500">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Safe: {safePct}%</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Flagged: {elevatedPct}%</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Critical: {criticalPct}%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Feed Spine & Side Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Event Feed List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter Bar & Export Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white/80 backdrop-blur border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {/* Verdict tabs */}
            <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'ALLOW', 'BLOCK', 'FLAG'].map((v) => (
                <button
                  key={v}
                  onClick={() => setFilterVerdict(v)}
                  className={`px-3 py-1 text-[11px] font-mono rounded-md transition-colors ${
                    filterVerdict === v
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Risk filter selector & export */}
            <div className="flex items-center space-x-2">
              <div className="relative w-full sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by agent, hash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input !py-1 !pl-8 !text-xs w-full"
                />
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={handleExportJSON}
                  title="Export telemetry as JSON"
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Feed Items */}
          <div className="space-y-2.5 max-h-[680px] overflow-y-auto pr-1">
            {filteredEvaluations.length === 0 ? (
              <div className="p-10 text-center card border-dashed !border-slate-300 space-y-3">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-slate-400" />
                </div>
                <div className="text-sm font-semibold text-slate-600">No events match current filter</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Adjust your search filter or trigger simulated traffic to view pre-flight intercept evaluations.
                </p>
                <button
                  onClick={() => { setFilterVerdict('ALL'); setRiskFilter('ALL'); setSearchQuery(''); }}
                  className="btn-secondary !text-xs mx-auto"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredEvaluations.map((item) => {
                const isSelected = selectedAction?.actionId === item.actionId;
                const isExpanded = expandedId === item.actionId;
                const scorePercent = (item.anomalyScore / 10).toFixed(0);

                return (
                  <div
                    key={item.actionId}
                    onClick={() => {
                      setSelectedAction(item);
                      setExpandedId(isExpanded ? null : item.actionId);
                    }}
                    className={`relative p-4 pl-5 rounded-2xl transition-all cursor-pointer border bg-white overflow-hidden ${
                      isSelected
                        ? 'border-blue-500 ring-4 ring-blue-500/10 shadow-lg shadow-blue-500/10'
                        : 'border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300 hover:shadow-[0_12px_28px_-16px_rgba(15,23,42,0.22)] hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Verdict accent bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getAccentBar(item)}`} />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getVerdictBadge(item.verdict, item.circuitTripped)}
                        <span className="text-xs font-mono font-bold text-slate-800">
                          {item.agentId}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Anomaly Gauge */}
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-mono text-slate-400">Risk:</span>
                        <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${getScoreBg(item.anomalyScore)} transition-all`}
                            style={{ width: `${Math.min(100, Math.max(8, item.anomalyScore / 10))}%` }}
                          />
                        </div>
                        <span className={`text-xs font-mono font-bold ${getScoreColor(item.anomalyScore)}`}>
                          {scorePercent}%
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </div>

                    {/* Middle Details */}
                    <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Target Contract</span>
                        <span className="text-slate-600 truncate block" title={item.target}>
                          {item.target.substring(0, 10)}...{item.target.substring(item.target.length - 4)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Value</span>
                        <span className="text-slate-600">{item.value} tBOT</span>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-slate-400 text-[10px] block">Triggered Rule</span>
                        <span className="text-blue-600 truncate block font-sans text-[11px] font-medium">
                          {item.ruleTriggered}
                        </span>
                      </div>
                    </div>

                    {/* Reasoning Snippet */}
                    <div className="mt-2 text-xs text-slate-500 line-clamp-1">
                      {item.reasoning}
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-3 fade-in-up">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Triggered Rule</div>
                            <div className="text-xs font-semibold text-blue-700">{item.ruleTriggered}</div>
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Composite Risk</div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-bold text-slate-700">{item.anomalyScore} / 1000</span>
                              <span className={`text-[10px] font-mono font-semibold ${getScoreColor(item.anomalyScore)}`}>
                                {(item.anomalyScore / 10).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">Evaluation Details</div>
                          <p className="text-xs text-slate-600 leading-relaxed">{item.reasoning}</p>
                        </div>
                        <div>
                          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">Detected Anomaly Signals</div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.anomalyReport.riskFactors.map((f) => (
                              <span key={f} className="chip bg-slate-100 text-slate-600 border-slate-200 !text-[10px]">{f}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400 pt-1">
                          <span title={item.actionHash}>Fingerprint: {item.actionHash.substring(0, 16)}…</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(item.actionHash, item.actionId);
                            }}
                            className="flex items-center space-x-1 text-blue-600 hover:underline"
                          >
                            {copiedHash === item.actionId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedHash === item.actionId ? 'Copied' : 'Copy Hash'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action Inspector Drawer (5 cols) */}
        <div className="lg:col-span-5">
          {selectedAction ? (
            <div className="card p-6 space-y-5 sticky top-24">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                    <Cpu className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">Action Telemetry Inspector</h3>
                </div>
                {getVerdictBadge(selectedAction.verdict, selectedAction.circuitTripped)}
              </div>

              {/* High-level Summary */}
              <div className="space-y-1 text-xs">
                {[
                  ['Action ID', selectedAction.actionId],
                  ['Agent Wallet', `${selectedAction.agentWallet.substring(0, 8)}...${selectedAction.agentWallet.substring(selectedAction.agentWallet.length - 6)}`],
                  ['Target Address', selectedAction.target],
                  ['Value (tBOT)', `${selectedAction.value} tBOT`],
                  ['Action Hash', `${selectedAction.actionHash.substring(0, 18)}...`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 border-b border-slate-100 gap-4">
                    <span className="text-slate-400 shrink-0">{k}</span>
                    <span className={`font-mono truncate ${k === 'Agent Wallet' ? 'text-blue-600' : 'text-slate-600'}`} title={v as string}>
                      {v}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between py-1.5 border-b border-slate-100 gap-4">
                  <span className="text-slate-400 shrink-0">Evaluated At</span>
                  <span className="font-mono text-slate-600 truncate">
                    {new Date(selectedAction.timestamp).toLocaleTimeString()} ({new Date(selectedAction.timestamp).toLocaleDateString()})
                  </span>
                </div>
              </div>

              {/* Multi-Factor AI Risk Breakdown */}
              <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center space-x-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    <span>AI Risk Factor Breakdown</span>
                  </span>
                  <span className={`font-mono ${getScoreColor(selectedAction.anomalyScore)}`}>
                    Score: {selectedAction.anomalyScore} / 1000
                  </span>
                </div>

                <div className="space-y-2.5 text-[11px] font-mono">
                  {[
                    ['Repetition / Loop Risk', selectedAction.anomalyReport.repetitionScore, 'bg-violet-500'],
                    ['Velocity Burst Spike', selectedAction.anomalyReport.frequencyBurstScore, 'bg-amber-500'],
                    ['Destination Familiarity', selectedAction.anomalyReport.destinationRiskScore, 'bg-blue-500'],
                    ['Calldata Entropy / Obfuscation', selectedAction.anomalyReport.calldataEntropyScore, 'bg-rose-500'],
                  ].map(([label, val, color]) => (
                    <div key={label as string}>
                      <div className="flex justify-between text-slate-500 mb-1">
                        <span>{label}</span>
                        <span>{val} / 1000</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`${color} h-1.5 rounded-full transition-all`}
                          style={{ width: `${(val as number) / 10}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Risk Explanation Notes */}
                <div className="mt-3 pt-2.5 border-t border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1.5">Detected Signals:</div>
                  <ul className="space-y-1">
                    {selectedAction.anomalyReport.riskFactors.map((f, i) => (
                      <li key={i} className="text-[11px] text-slate-500 flex items-start">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 mr-2 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Quick Actions on Target */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => handleBlockDestination(selectedAction.agentWallet, selectedAction.target)}
                  className="w-full py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                  <span>Add Target to Agent Blocklist</span>
                </button>
              </div>

              {/* Evaluation Engine Status */}
              <div className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Pre-flight intercept evaluated in &lt;1.2ms</span>
              </div>
            </div>
          ) : (
            <div className="card border-dashed !border-slate-300 p-8 text-center space-y-3 sticky top-24">
              <div className="flex items-center justify-center space-x-2 text-slate-300">
                <Clock className="w-5 h-5" />
                <FileCode2 className="w-5 h-5" />
              </div>
              <div className="text-sm font-semibold text-slate-500">Select an Action to Inspect</div>
              <p className="text-xs text-slate-400">
                Click any telemetry item in the stream to review multi-factor anomaly signals and risk scores.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};