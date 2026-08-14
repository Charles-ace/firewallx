import { AgentAction, SecurityPolicy } from './types';

export interface ActionHistoryEntry {
  hash: string;
  target: string;
  value: string;
  data: string;
  timestamp: number;
}

export class LoopDetector {
  // agentWallet -> history entries
  private history: Map<string, ActionHistoryEntry[]> = new Map();

  /**
   * Deterministic action hash for calldata + target + value
   */
  public hashAction(action: AgentAction): string {
    const raw = `${action.target.toLowerCase()}:${action.value}:${action.data.toLowerCase()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `0x${hex}${raw.length.toString(16).padStart(4, '0')}`;
  }

  /**
   * Check if action represents a repeating loop or runaway trigger
   */
  public checkLoop(
    action: AgentAction,
    policy: SecurityPolicy
  ): {
    isLoop: boolean;
    identicalCount: number;
    windowSeconds: number;
    reason: string;
  } {
    const wallet = action.agentWallet.toLowerCase();
    const actionHash = this.hashAction(action);
    const now = action.timestamp || Date.now();

    let entries = this.history.get(wallet) || [];
    const windowMs = (policy.loopWindowSeconds || 60) * 1000;

    // Prune entries outside the sliding window
    entries = entries.filter((e) => now - e.timestamp <= windowMs);

    // Count identical calls in window
    const identicalEntries = entries.filter((e) => e.hash === actionHash);
    const identicalCount = identicalEntries.length + 1; // including current

    // Check against policy threshold
    const maxAllowed = policy.maxIdenticalPayloads || 3;
    if (identicalCount > maxAllowed) {
      return {
        isLoop: true,
        identicalCount,
        windowSeconds: policy.loopWindowSeconds,
        reason: `Loop detected: ${identicalCount} identical transactions sent within ${policy.loopWindowSeconds}s window (limit: ${maxAllowed})`,
      };
    }

    return {
      isLoop: false,
      identicalCount,
      windowSeconds: policy.loopWindowSeconds,
      reason: 'No loop detected within policy threshold',
    };
  }

  /**
   * Record action into agent's rolling history
   */
  public recordAction(action: AgentAction): void {
    const wallet = action.agentWallet.toLowerCase();
    const actionHash = this.hashAction(action);
    const now = action.timestamp || Date.now();

    const entries = this.history.get(wallet) || [];
    entries.push({
      hash: actionHash,
      target: action.target,
      value: action.value,
      data: action.data,
      timestamp: now,
    });

    // Keep last 100 entries max
    if (entries.length > 100) {
      entries.shift();
    }

    this.history.set(wallet, entries);
  }

  /**
   * Get recent actions for agent
   */
  public getHistory(agentWallet: string): ActionHistoryEntry[] {
    return this.history.get(agentWallet.toLowerCase()) || [];
  }

  /**
   * Clear history for agent
   */
  public clearHistory(agentWallet: string): void {
    this.history.delete(agentWallet.toLowerCase());
  }
}
