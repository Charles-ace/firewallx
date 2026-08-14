import { AgentAction, AgentState, EvaluationResult, SecurityPolicy, VerdictDecision } from './types';
import { LoopDetector } from './loopDetector';
import { uid } from './uid';
import { AnomalyScorer } from './anomalyScorer';

export class FirewallEngine {
  private loopDetector: LoopDetector;
  private anomalyScorer: AnomalyScorer;
  private agents: Map<string, AgentState> = new Map();
  private auditLog: EvaluationResult[] = [];
  private onVerdictCallback?: (result: EvaluationResult) => void;
  private onCircuitTripCallback?: (agentState: AgentState, reason: string) => void;

  constructor() {
    this.loopDetector = new LoopDetector();
    this.anomalyScorer = new AnomalyScorer();
    this.seedDefaultAgents();
  }

  private seedDefaultAgents() {
    // Seed test agent (e.g. Sixa Telegram Agent & Alpha Trading Agent)
    this.registerAgent({
      agentId: 'agent-sixa-telegram',
      agentWallet: '0x71C8366420A092671827649D3863464509520770',
      name: 'Sixa Telegram Agent (KV Worker)',
      aidid: 'aidid:botchain:sixa-telegram-v2',
      owner: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
      status: 'ACTIVE',
      registeredAt: Date.now() - 86400000 * 3,
      policy: {
        maxSpendPerTx: '0.2',
        maxHourlySpend: '1.0',
        maxTxPerMinute: 8,
        loopWindowSeconds: 60,
        maxIdenticalPayloads: 3,
        anomalyThreshold: 700, // 70%
        enforceAllowlist: false,
        allowlist: ['0x1111111111111111111111111111111111111111', '0x2222222222222222222222222222222222222222'],
        blocklist: ['0x000000000000000000000000000000000000dead', '0xbadbadbadbadbadbadbadbadbadbadbadbadbad0'],
      },
      consecutiveViolations: 0,
      totalActionsEvaluated: 142,
      totalBlocks: 3,
      totalTrips: 0,
    });

    this.registerAgent({
      agentId: 'agent-alpha-trader',
      agentWallet: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      name: 'Alpha DEX Arbitrage Bot',
      aidid: 'aidid:botchain:alpha-arbitrage-01',
      owner: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
      status: 'ACTIVE',
      registeredAt: Date.now() - 86400000 * 7,
      policy: {
        maxSpendPerTx: '5.0',
        maxHourlySpend: '25.0',
        maxTxPerMinute: 20,
        loopWindowSeconds: 30,
        maxIdenticalPayloads: 2,
        anomalyThreshold: 750,
        enforceAllowlist: true,
        allowlist: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
          '0x8ba1f109551bd432803012645ac136ddd64dba72',
        ],
        blocklist: ['0xbadbadbadbadbadbadbadbadbadbadbadbadbad0'],
      },
      consecutiveViolations: 0,
      totalActionsEvaluated: 890,
      totalBlocks: 12,
      totalTrips: 1,
    });
    this.registerAgent({
      agentId: 'agent-vault-sentinel',
      agentWallet: '0x14DC79964da2C08b23698B3D3cc7Ca32193d9955',
      name: 'BOT Treasury Sentinel Vault',
      aidid: 'aidid:botchain:vault-sentinel-01',
      owner: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
      status: 'ACTIVE',
      registeredAt: Date.now() - 86400000 * 14,
      policy: {
        maxSpendPerTx: '0.1',
        maxHourlySpend: '0.5',
        maxTxPerMinute: 4,
        loopWindowSeconds: 120,
        maxIdenticalPayloads: 2,
        anomalyThreshold: 500, // Strict 50%
        enforceAllowlist: true,
        allowlist: [
          '0x1111111111111111111111111111111111111111',
          '0x2222222222222222222222222222222222222222',
        ],
        blocklist: [
          '0x000000000000000000000000000000000000dead',
          '0xbadbadbadbadbadbadbadbadbadbadbadbadbad0',
        ],
      },
      consecutiveViolations: 0,
      totalActionsEvaluated: 412,
      totalBlocks: 8,
      totalTrips: 0,
    });
  }

  public registerAgent(agent: AgentState): void {
    this.agents.set(agent.agentWallet.toLowerCase(), agent);
  }

  public getAgent(agentWallet: string): AgentState | undefined {
    return this.agents.get(agentWallet.toLowerCase());
  }

  public getAllAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  public updatePolicy(agentWallet: string, policy: SecurityPolicy): boolean {
    const agent = this.agents.get(agentWallet.toLowerCase());
    if (!agent) return false;
    agent.policy = policy;
    return true;
  }

  public resetCircuitBreaker(agentWallet: string): boolean {
    const agent = this.agents.get(agentWallet.toLowerCase());
    if (!agent) return false;
    agent.status = 'ACTIVE';
    agent.consecutiveViolations = 0;
    this.loopDetector.clearHistory(agentWallet);
    return true;
  }

  public resetAllBreakers(): void {
    for (const agent of this.agents.values()) {
      agent.status = 'ACTIVE';
      agent.consecutiveViolations = 0;
      this.loopDetector.clearHistory(agent.agentWallet);
    }
  }

  public pauseAgent(agentWallet: string): boolean {
    const agent = this.agents.get(agentWallet.toLowerCase());
    if (!agent) return false;
    agent.status = 'PAUSED';
    return true;
  }

  public resumeAgent(agentWallet: string): boolean {
    const agent = this.agents.get(agentWallet.toLowerCase());
    if (!agent) return false;
    agent.status = 'ACTIVE';
    return true;
  }

  public subscribeVerdict(callback: (result: EvaluationResult) => void): void {
    this.onVerdictCallback = callback;
  }

  public subscribeCircuitTrip(callback: (agentState: AgentState, reason: string) => void): void {
    this.onCircuitTripCallback = callback;
  }

  /**
   * Generates a realistic simulated AI agent action for telemetry streaming
   */
  public generateSimulatedAction(): AgentAction {
    const agentsList = this.getAllAgents();
    const activeAgents = agentsList.filter((a) => a.status === 'ACTIVE');
    const selectedAgent = activeAgents.length > 0 
      ? activeAgents[Math.floor(Math.random() * activeAgents.length)]
      : agentsList[0];

    const types = [
      {
        type: 'KV_SET',
        desc: 'Scheduled state cache sync',
        target: '0x8ba1f109551bd432803012645ac136ddd64dba72',
        val: '0.01',
        data: '0xa9059cbb' + Math.random().toString(16).substring(2, 10).padStart(64, '0'),
        weight: 60,
      },
      {
        type: 'ORACLE_UPDATE',
        desc: 'Price feed heartbeat submission',
        target: '0x1111111111111111111111111111111111111111',
        val: '0.005',
        data: '0x4973452f' + Math.random().toString(16).substring(2, 10).padStart(64, '0'),
        weight: 20,
      },
      {
        type: 'SWAP_CHECK',
        desc: 'DEX routing quote verification',
        target: '0x2222222222222222222222222222222222222222',
        val: '0.03',
        data: '0x38ed1739' + Math.random().toString(16).substring(2, 10).padStart(64, '0'),
        weight: 12,
      },
      {
        type: 'HIGH_ENTROPY_EXEC',
        desc: 'Unusual calldata byte stream evaluation',
        target: '0x9999999999999999999999999999999999999999',
        val: '0.12',
        data: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''),
        weight: 5,
      },
      {
        type: 'DRAINER_PROBE',
        desc: 'Suspicious proxy router interaction',
        target: '0xbadbadbadbadbadbadbadbadbadbadbadbadbad0',
        val: '0.8',
        data: '0x095ea7b3000000000000000000000000ffffffffffffffffffffffffffffffffffffffff',
        weight: 3,
      },
    ];

    const rand = Math.random() * 100;
    let cum = 0;
    let choice = types[0];
    for (const t of types) {
      cum += t.weight;
      if (rand <= cum) {
        choice = t;
        break;
      }
    }

    return {
      id: uid('live'),
      agentId: selectedAgent.agentId,
      agentWallet: selectedAgent.agentWallet,
      target: choice.target,
      value: choice.val,
      data: choice.data,
      timestamp: Date.now(),
      metadata: {
        actionType: choice.type,
        description: choice.desc,
        triggerSource: 'telemetry-live-generator',
      },
    };
  }

  /**
   * Pre-execution transaction firewall check
   */
  public evaluate(action: AgentAction): EvaluationResult {
    const wallet = action.agentWallet.toLowerCase();
    let agent = this.agents.get(wallet);

    // If agent not registered, create dynamic profile
    if (!agent) {
      agent = {
        agentId: action.agentId || `agent-${wallet.substring(0, 8)}`,
        agentWallet: action.agentWallet,
        name: `Agent ${action.agentWallet.substring(0, 6)}...`,
        aidid: `aidid:botchain:${wallet.substring(2, 10)}`,
        owner: '0x0000000000000000000000000000000000000000',
        status: 'ACTIVE',
        registeredAt: Date.now(),
        policy: {
          maxSpendPerTx: '1.0',
          maxHourlySpend: '5.0',
          maxTxPerMinute: 10,
          loopWindowSeconds: 60,
          maxIdenticalPayloads: 3,
          anomalyThreshold: 750,
          enforceAllowlist: false,
          allowlist: [],
          blocklist: [],
        },
        consecutiveViolations: 0,
        totalActionsEvaluated: 0,
        totalBlocks: 0,
        totalTrips: 0,
      };
      this.agents.set(wallet, agent);
    }

    const actionHash = this.loopDetector.hashAction(action);
    const history = this.loopDetector.getHistory(wallet);

    agent.totalActionsEvaluated += 1;

    // 1. Check if Breaker already Tripped / Paused
    if (agent.status === 'TRIPPED') {
      const result: EvaluationResult = {
        actionId: action.id || uid('act'),
        agentId: agent.agentId,
        agentWallet: agent.agentWallet,
        verdict: 'BLOCK',
        actionHash,
        target: action.target,
        value: action.value,
        anomalyScore: 1000,
        ruleTriggered: 'Circuit Breaker Active',
        reasoning: `Action rejected: Circuit breaker is currently TRIPPED for agent (${agent.lastTripReason || 'Safety threshold breached'})`,
        anomalyReport: {
          overallScore: 1000,
          frequencyBurstScore: 1000,
          spendDeviationScore: 0,
          calldataEntropyScore: 0,
          destinationRiskScore: 1000,
          repetitionScore: 1000,
          riskFactors: ['Circuit breaker is TRIPPED. Manual reset required by owner.'],
        },
        timestamp: action.timestamp || Date.now(),
        circuitTripped: true,
        source: 'simulation',
      };
      agent.totalBlocks += 1;
      this.recordEvaluation(result);
      return result;
    }

    if (agent.status === 'PAUSED') {
      const result: EvaluationResult = {
        actionId: action.id || uid('act'),
        agentId: agent.agentId,
        agentWallet: agent.agentWallet,
        verdict: 'BLOCK',
        actionHash,
        target: action.target,
        value: action.value,
        anomalyScore: 800,
        ruleTriggered: 'Agent Paused',
        reasoning: 'Action rejected: Agent is manually paused by owner',
        anomalyReport: {
          overallScore: 800,
          frequencyBurstScore: 0,
          spendDeviationScore: 0,
          calldataEntropyScore: 0,
          destinationRiskScore: 0,
          repetitionScore: 0,
          riskFactors: ['Agent operations paused manually.'],
        },
        timestamp: action.timestamp || Date.now(),
        circuitTripped: false,
        source: 'simulation',
      };
      agent.totalBlocks += 1;
      this.recordEvaluation(result);
      return result;
    }

    // 2. Loop Detection Check
    const loopCheck = this.loopDetector.checkLoop(action, agent.policy);

    // 3. AI Multi-Factor Anomaly Scoring
    const anomalyReport = this.anomalyScorer.scoreAction(action, history, agent.policy);

    let verdict: VerdictDecision = 'ALLOW';
    let ruleTriggered = 'Baseline Normal';
    let reasoning = 'Action passed all deterministic and statistical security constraints.';
    let tripCircuit = false;

    if (loopCheck.isLoop) {
      verdict = 'BLOCK';
      ruleTriggered = 'Repetitive Loop Threshold';
      reasoning = loopCheck.reason;
      tripCircuit = true;
    } else if (anomalyReport.overallScore >= agent.policy.anomalyThreshold) {
      verdict = 'BLOCK';
      ruleTriggered = 'AI Anomaly Threshold Breach';
      reasoning = `Anomaly score ${anomalyReport.overallScore}/1000 exceeds safety threshold (${agent.policy.anomalyThreshold}). Risk factors: ${anomalyReport.riskFactors.join('; ')}`;
      agent.consecutiveViolations += 1;
      if (agent.consecutiveViolations >= 2 || anomalyReport.overallScore >= 900) {
        tripCircuit = true;
      }
    } else if (anomalyReport.overallScore > 450) {
      verdict = 'FLAG';
      ruleTriggered = 'Elevated Risk Warning';
      reasoning = `Action flagged with moderate risk score (${anomalyReport.overallScore}/1000). Allowed with telemetry warning.`;
    }

    if (verdict === 'ALLOW') {
      agent.consecutiveViolations = 0;
      this.loopDetector.recordAction(action);
    } else {
      agent.totalBlocks += 1;
    }

    // Handle Circuit Breaker Tripping
    if (tripCircuit) {
      agent.status = 'TRIPPED';
      agent.lastTripReason = reasoning;
      agent.lastTripTime = Date.now();
      agent.lastTripPayloadHash = actionHash;
      agent.totalTrips += 1;

      if (this.onCircuitTripCallback) {
        this.onCircuitTripCallback(agent, reasoning);
      }
    }

    const result: EvaluationResult = {
      actionId: action.id || uid('act'),
      agentId: agent.agentId,
      agentWallet: agent.agentWallet,
      verdict,
      actionHash,
      target: action.target,
      value: action.value,
      anomalyScore: anomalyReport.overallScore,
      ruleTriggered,
      reasoning,
      anomalyReport,
      timestamp: action.timestamp || Date.now(),
      circuitTripped: tripCircuit,
      source: 'simulation',
    };

    this.recordEvaluation(result);
    return result;
  }

  private recordEvaluation(result: EvaluationResult): void {
    this.auditLog.unshift(result);
    if (this.auditLog.length > 500) {
      this.auditLog.pop();
    }
    if (this.onVerdictCallback) {
      this.onVerdictCallback(result);
    }
  }

  public getAuditLog(limit = 100): EvaluationResult[] {
    return this.auditLog.slice(0, limit);
  }

  public clearAuditLog(): void {
    this.auditLog = [];
  }
}

// Global Singleton for in-app state & demo
export const globalFirewallEngine = new FirewallEngine();

