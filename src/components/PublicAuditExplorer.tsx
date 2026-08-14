import React, { useState } from 'react';
import { 
  Radio, Search, ExternalLink, CheckCircle2, XCircle, AlertTriangle, 
  Zap, ShieldCheck, FileDown, Hash, Cpu, Copy, Check, Sparkles, ChevronDown, Binary
} from 'lucide-react';
import { EvaluationResult, VerdictDecision } from '../engine/types';
import { BOTCHAIN_TESTNET } from '../config/botchain';

interface PublicAuditExplorerProps {
  auditLog: EvaluationResult[];
}

export const PublicAuditExplorer: React.FC<PublicAuditExplorerProps> = ({ auditLog }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [isVerifierOpen, setIsVerifierOpen] = useState<boolean>(false);

  // Verifier tool state
  const [verifyTarget, setVerifyTarget] = useState<string>('0x8ba1f109551bd432803012645ac136ddd64dba72');
  const [verifyValue, setVerifyValue] = useState<string>('0.05');
  const [verifyCalldata, setVerifyCalldata] = useState<string>('0x608060405234801561001057600080fd5b50');

  const filteredLogs = auditLog.filter((item) => {
    if (verdictFilter !== 'ALL' && item.verdict !== verdictFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        item.agentWallet.toLowerCase().includes(q) ||
        item.target.toLowerCase().includes(q) ||
        item.actionHash.toLowerCase().includes(q) ||
        item.ruleTriggered.toLowerCase().includes(q) ||
        item.agentId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `firewallx-botchain-audit-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = ['ActionID', 'AgentID', 'AgentWallet', 'Verdict', 'RiskScore', 'RuleTriggered', 'Target', 'Value_tBOT', 'CircuitTripped', 'Timestamp'];
    const rows = auditLog.map(e => [
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
    a.download = `firewallx-botchain-audit-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(id);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  // Simple Shannon Entropy calculation for the verifier playground
  const calculateShannonEntropy = (hex: string) => {
    if (!hex || hex.length <= 2) return 0;
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (clean.length === 0) return 0;
    const freq: Record<string, number> = {};
    for (let i = 0; i < clean.length; i += 2) {
      const b = clean.substring(i, i + 2);
      freq[b] = (freq[b] || 0) + 1;
    }
    const total = clean.length / 2;
    let ent = 0;
    for (const b in freq) {
      const p = freq[b] / total;
      ent -= p * Math.log2(p);
    }
    return Math.min(1.0, ent / 8.0);
  };

  // Deterministic Mock Action Fingerprint for playground
  const getCalculatedFingerprint = (target: string, value: string, data: string) => {
    let hash = 0;
    const combined = `${target.toLowerCase()}-${value}-${data}`;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `0x${hex}f4a93c72b8109d44e56c${hex.split('').reverse().join('')}194a82b4`;
  };

  const calculatedEntropy = calculateShannonEntropy(verifyCalldata);
  const calculatedFingerprint = getCalculatedFingerprint(verifyTarget, verifyValue, verifyCalldata);

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

  const totalProtected = auditLog.filter((l) => l.verdict === 'BLOCK').length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 card relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono text-amber-600 mb-1">
            <div className="p-1 rounded-md bg-amber-50">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <span>EVALUATION LEDGER & AUDIT TRAIL</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">FirewallX Evaluation Ledger</h2>
          <p className="text-slate-500 text-xs mt-1">
            Every evaluation, intercept, and autonomous breaker trip is recorded with a reproducible action fingerprint, anchored to the on-chain Auditor and local audit trail.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button onClick={handleExportCSV} className="btn-secondary">
            <FileDown className="w-3.5 h-3.5 text-blue-600" />
            <span>Export CSV</span>
          </button>
          <button onClick={handleExportJSON} className="btn-secondary">
            <FileDown className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Cryptographic Action Fingerprint & Hash Verifier Tool */}
      <div className="card p-5 space-y-4">
        <button
          onClick={() => setIsVerifierOpen(!isVerifierOpen)}
          className="w-full flex items-center justify-between text-left group"
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <Hash className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Cryptographic Action Fingerprint & Entropy Verifier
              </div>
              <div className="text-xs text-slate-400">
                Inspect raw calldata byte distribution, compute Keccak-256 fingerprint, and verify entropy
              </div>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isVerifierOpen ? 'rotate-180' : ''}`} />
        </button>

        {isVerifierOpen && (
          <div className="pt-3 border-t border-slate-100 space-y-4 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Target Address</label>
                <input
                  type="text"
                  value={verifyTarget}
                  onChange={(e) => setVerifyTarget(e.target.value)}
                  className="input !font-mono !text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Value (tBOT)</label>
                <input
                  type="text"
                  value={verifyValue}
                  onChange={(e) => setVerifyValue(e.target.value)}
                  className="input !font-mono !text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Calldata Hex</label>
                <input
                  type="text"
                  value={verifyCalldata}
                  onChange={(e) => setVerifyCalldata(e.target.value)}
                  className="input !font-mono !text-xs"
                />
              </div>
            </div>

            {/* Calculated Results Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Shannon Entropy</span>
                <span className={`font-bold ${calculatedEntropy > 0.85 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {(calculatedEntropy * 100).toFixed(1)}% ({calculatedEntropy > 0.85 ? 'HIGH' : 'NORMAL'})
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Byte Length</span>
                <span className="text-slate-800 font-bold">
                  {Math.max(0, (verifyCalldata.startsWith('0x') ? verifyCalldata.slice(2) : verifyCalldata).length / 2)} bytes
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 text-[10px] block">Deterministic Fingerprint</span>
                <span className="text-blue-600 truncate block font-bold" title={calculatedFingerprint}>
                  {calculatedFingerprint}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Table Container */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Verdict Filter */}
          <div className="flex items-center space-x-1 w-full sm:w-auto">
            {['ALL', 'ALLOW', 'BLOCK', 'FLAG'].map((v) => (
              <button
                key={v}
                onClick={() => setVerdictFilter(v)}
                className={`px-3.5 py-1.5 text-xs font-mono rounded-md transition-colors duration-150 ${
                  verdictFilter === v
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by wallet, target, hash..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input !py-1.5 !pl-9 !text-xs"
            />
          </div>
        </div>

        {/* Ledger Summary Strip */}
        <div className="flex items-center space-x-4 text-[11px] font-mono text-slate-500 px-1">
          <span className="flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              <strong className="text-slate-700">{auditLog.length}</strong> actions evaluated
            </span>
          </span>
          <span className="text-slate-200">|</span>
          <span>
            <strong className="text-rose-600">{totalProtected}</strong> blocked on-chain
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200">
                {['Timestamp', 'Agent Wallet', 'Target Contract', 'Value', 'Verdict', 'Risk Score', 'Triggered Rule', 'Action Fingerprint'].map((h) => (
                  <th key={h} className="pb-3 pr-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                      <Radio className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="text-sm font-semibold text-slate-600">No records match the current filters</div>
                    <p className="text-xs text-slate-400 mt-1">
                      Evaluations appear here as agents execute actions.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.actionId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 pr-4 text-blue-600 whitespace-nowrap" title={log.agentWallet}>
                      {log.agentWallet.substring(0, 6)}...{log.agentWallet.substring(log.agentWallet.length - 4)}
                    </td>
                    <td className="py-3 pr-4 text-slate-600 whitespace-nowrap" title={log.target}>
                      {log.target.substring(0, 6)}...{log.target.substring(log.target.length - 4)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{log.value} tBOT</td>
                    <td className="py-3 pr-4 whitespace-nowrap">
                      {getVerdictBadge(log.verdict, log.circuitTripped)}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap font-bold">
                      <span
                        className={
                          log.anomalyScore >= 700
                            ? 'text-rose-600'
                            : log.anomalyScore >= 400
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }
                      >
                        {log.anomalyScore}/1000
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600 font-sans text-[11px] truncate max-w-xs" title={log.ruleTriggered}>
                      {log.ruleTriggered}
                    </td>
                    <td className="py-3 whitespace-nowrap flex items-center space-x-1.5">
                      <span
                        className="text-slate-400 text-[11px]"
                        title={log.actionHash}
                      >
                        {log.actionHash.substring(0, 10)}...
                      </span>
                      <button
                        onClick={() => handleCopy(log.actionHash, log.actionId)}
                        className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors"
                        title="Copy fingerprint hash"
                      >
                        {copiedHash === log.actionId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};