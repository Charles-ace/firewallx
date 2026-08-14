import { AgentAction, AnomalyReport, SecurityPolicy } from './types';
import { ActionHistoryEntry } from './loopDetector';

export class AnomalyScorer {
  /**
   * Calculate Shannon entropy of calldata hex string
   */
  public calculateEntropy(hexStr: string): number {
    if (!hexStr || hexStr === '0x' || hexStr.length <= 2) return 0;
    const cleanHex = hexStr.startsWith('0x') ? hexStr.slice(2) : hexStr;
    if (cleanHex.length === 0) return 0;

    const freqMap: Record<string, number> = {};
    for (let i = 0; i < cleanHex.length; i += 2) {
      const byte = cleanHex.substring(i, i + 2);
      freqMap[byte] = (freqMap[byte] || 0) + 1;
    }

    const totalBytes = cleanHex.length / 2;
    let entropy = 0;
    for (const byte in freqMap) {
      const p = freqMap[byte] / totalBytes;
      entropy -= p * Math.log2(p);
    }
    // Max entropy for a byte (256 states) is 8 bits
    return Math.min(1.0, entropy / 8.0);
  }

  /**
   * Evaluate AI Anomaly Score across multi-factor telemetry
   */
  public scoreAction(
    action: AgentAction,
    history: ActionHistoryEntry[],
    policy: SecurityPolicy
  ): AnomalyReport {
    const riskFactors: string[] = [];

    // 1. Frequency Burst Scoring (Txs within the last 60 seconds)
    const now = action.timestamp || Date.now();
    const oneMinAgo = now - 60000;
    const recentTxs = history.filter((h) => h.timestamp >= oneMinAgo);
    const txCountLastMin = recentTxs.length + 1;

    let frequencyBurstScore = 0;
    const maxVelocity = policy.maxTxPerMinute || 10;
    if (txCountLastMin > maxVelocity) {
      const overflow = txCountLastMin - maxVelocity;
      frequencyBurstScore = Math.min(1000, Math.floor(500 + overflow * 100));
      riskFactors.push(`Velocity Spike: ${txCountLastMin} txs/min exceeds policy limit of ${maxVelocity}`);
    } else {
      frequencyBurstScore = Math.floor((txCountLastMin / maxVelocity) * 300);
    }

    // 2. Spend / Value Deviation Scoring
    const txValue = parseFloat(action.value || '0');
    const maxSpend = parseFloat(policy.maxSpendPerTx || '0');
    let spendDeviationScore = 0;

    if (maxSpend > 0) {
      if (txValue > maxSpend) {
        spendDeviationScore = 1000;
        riskFactors.push(`Spend Cap Breach: ${txValue} BOT exceeds configured limit of ${maxSpend} BOT`);
      } else {
        spendDeviationScore = Math.floor((txValue / maxSpend) * 400);
      }
    }

    // 3. Calldata Entropy / Obfuscation Scoring
    const entropy = this.calculateEntropy(action.data);
    let calldataEntropyScore = 0;
    if (entropy > 0.85 && action.data.length > 256) {
      calldataEntropyScore = 800;
      riskFactors.push(`High Calldata Entropy (${(entropy * 100).toFixed(1)}%): Potential payload obfuscation or binary injection`);
    } else {
      calldataEntropyScore = Math.floor(entropy * 300);
    }

    // 4. Destination Risk Scoring
    let destinationRiskScore = 0;
    const target = action.target.toLowerCase();
    if (policy.blocklist.map((a) => a.toLowerCase()).includes(target)) {
      destinationRiskScore = 1000;
      riskFactors.push(`Blacklisted Target: Destination ${action.target} is on the security blocklist`);
    } else if (policy.enforceAllowlist && !policy.allowlist.map((a) => a.toLowerCase()).includes(target)) {
      destinationRiskScore = 900;
      riskFactors.push(`Unauthorized Target: Destination ${action.target} not present on strict allowlist`);
    } else {
      // Check target familiarity in agent history
      const familiar = history.some((h) => h.target.toLowerCase() === target);
      if (!familiar && history.length > 5) {
        destinationRiskScore = 350;
        riskFactors.push(`Unfamiliar Contract: Target ${action.target.substring(0, 10)}... has no prior interaction history`);
      } else {
        destinationRiskScore = 50;
      }
    }

    // 5. Repetition Score (Identical calldata within history)
    const identicalCalls = history.filter(
      (h) => h.target.toLowerCase() === target && h.data.toLowerCase() === action.data.toLowerCase()
    );
    let repetitionScore = 0;
    if (identicalCalls.length >= policy.maxIdenticalPayloads) {
      repetitionScore = 950;
      riskFactors.push(`Retry Loop: ${identicalCalls.length + 1} identical payloads submitted`);
    } else if (identicalCalls.length > 1) {
      repetitionScore = identicalCalls.length * 200;
    }

    // Weighted Overall Score (0 - 1000)
    // Weights: Destination (30%), Repetition (25%), Frequency (20%), Spend (15%), Entropy (10%)
    const weightedScore = Math.round(
      destinationRiskScore * 0.30 +
      repetitionScore * 0.25 +
      frequencyBurstScore * 0.20 +
      spendDeviationScore * 0.15 +
      calldataEntropyScore * 0.10
    );

    const overallScore = Math.min(1000, Math.max(0, weightedScore));

    return {
      overallScore,
      frequencyBurstScore,
      spendDeviationScore,
      calldataEntropyScore,
      destinationRiskScore,
      repetitionScore,
      riskFactors: riskFactors.length > 0 ? riskFactors : ['Action matches expected behavioral profile'],
    };
  }
}
