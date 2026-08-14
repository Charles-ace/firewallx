export type CircuitStatus = 'ACTIVE' | 'WARNING' | 'TRIPPED' | 'PAUSED';

export type VerdictDecision = 'ALLOW' | 'BLOCK' | 'FLAG';

export interface SecurityPolicy {
  maxSpendPerTx: string;        // e.g. "0.5" in BOT / ETH
  maxHourlySpend: string;       // e.g. "2.0" in BOT / ETH
  maxTxPerMinute: number;       // e.g. 10
  loopWindowSeconds: number;    // e.g. 60
  maxIdenticalPayloads: number; // e.g. 3
  anomalyThreshold: number;     // e.g. 750 (75%)
  enforceAllowlist: boolean;
  allowlist: string[];
  blocklist: string[];
}

export interface AgentAction {
  id: string;
  agentId: string;
  agentWallet: string;
  target: string;
  value: string; // in BOT / ETH
  data: string;  // calldata hex
  timestamp: number;
  metadata?: {
    actionType?: string;
    description?: string;
    triggerSource?: string; // e.g. "webhook", "cron", "llm-autonomous", "retry-worker"
  };
}

export interface AnomalyReport {
  overallScore: number; // 0 to 1000 (0 = 0%, 1000 = 100%)
  frequencyBurstScore: number;
  spendDeviationScore: number;
  calldataEntropyScore: number;
  destinationRiskScore: number;
  repetitionScore: number;
  riskFactors: string[];
}

export interface EvaluationResult {
  actionId: string;
  agentId: string;
  agentWallet: string;
  verdict: VerdictDecision;
  actionHash: string;
  target: string;
  value: string;
  anomalyScore: number; // 0 - 1000
  ruleTriggered: string;
  reasoning: string;
  anomalyReport: AnomalyReport;
  timestamp: number;
  circuitTripped: boolean;
  source: 'simulation' | 'onchain';
  txHash?: string;
  onChainVerified?: boolean;
}

export interface AgentState {
  agentId: string;
  agentWallet: string;
  name: string;
  aidid: string;
  owner: string;
  status: CircuitStatus;
  registeredAt: number;
  policy: SecurityPolicy;
  consecutiveViolations: number;
  lastTripReason?: string;
  lastTripTime?: number;
  lastTripPayloadHash?: string;
  totalActionsEvaluated: number;
  totalBlocks: number;
  totalTrips: number;
}
