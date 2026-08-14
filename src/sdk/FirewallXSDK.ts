import { AgentAction, CircuitStatus, EvaluationResult, SecurityPolicy, VerdictDecision } from '../engine/types';
import { globalFirewallEngine } from '../engine/firewallEngine';

export interface FirewallXConfig {
  agentId: string;
  agentWallet: string;
  rpcUrl?: string;
  registryAddress?: string;
  auditorAddress?: string;
  apiKey?: string;
  localFallback?: boolean;
}

export class FirewallXSDK {
  private config: FirewallXConfig;

  constructor(config: FirewallXConfig) {
    this.config = {
      rpcUrl: 'https://rpc.bohr.life',
      localFallback: true,
      ...config,
    };
  }

  /**
   * Pre-flight action firewall check before sending transaction on-chain.
   * Drops into an AI agent's execution pipeline.
   *
   * @example
   * ```ts
   * const verdict = await firewall.evaluateAction({
   *   target: "0x123...",
   *   value: "0.1",
   *   data: "0xa9059cbb..."
   * });
   * if (verdict.verdict === 'ALLOW') {
   *   // Proceed with on-chain execution
   * } else {
   *   console.error(`Blocked by FirewallX: ${verdict.reasoning}`);
   * }
   * ```
   */
  public async evaluateAction(params: {
    target: string;
    value?: string;
    data?: string;
    metadata?: {
      actionType?: string;
      description?: string;
      triggerSource?: string;
    };
  }): Promise<EvaluationResult> {
    const action: AgentAction = {
      id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId: this.config.agentId,
      agentWallet: this.config.agentWallet,
      target: params.target,
      value: params.value || '0',
      data: params.data || '0x',
      timestamp: Date.now(),
      metadata: params.metadata,
    };

    // Evaluate via engine
    const evaluation = globalFirewallEngine.evaluate(action);
    return evaluation;
  }

  /**
   * Safely wraps an asynchronous on-chain transaction execution.
   * Evaluates before sending; throws error if blocked or breaker is tripped.
   */
  public async executeSafe<T>(
    params: {
      target: string;
      value?: string;
      data?: string;
      metadata?: { actionType?: string; description?: string };
    },
    sendTransactionFn: () => Promise<T>
  ): Promise<{ result?: T; verdict: EvaluationResult }> {
    const verdict = await this.evaluateAction(params);

    if (verdict.verdict === 'BLOCK') {
      throw new Error(`[FirewallX BLOCKED] Rule: ${verdict.ruleTriggered}. ${verdict.reasoning}`);
    }

    if (verdict.circuitTripped) {
      throw new Error(`[FirewallX CIRCUIT TRIPPED] Agent execution halted.`);
    }

    const result = await sendTransactionFn();
    return { result, verdict };
  }

  /**
   * Query the current operational status of this agent's circuit breaker
   */
  public async getBreakerStatus(): Promise<CircuitStatus> {
    const agent = globalFirewallEngine.getAgent(this.config.agentWallet);
    return agent ? agent.status : 'ACTIVE';
  }

  /**
   * Reset circuit breaker (owner signature required in live contract)
   */
  public async resetBreaker(): Promise<boolean> {
    return globalFirewallEngine.resetCircuitBreaker(this.config.agentWallet);
  }
}
