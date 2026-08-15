import { ethers } from 'ethers';
import { BOTCHAIN_TESTNET } from '../config/botchain';
import { globalOnChainIndexer } from './onChainIndexer';

// Testnet Agent Wallet for Interactive UI Demonstrations (Funded on BOT Chain Testnet)
const DEMO_TESTNET_MNEMONIC = 'test test test test test test test test test test test junk';

const GUARD_ABI = [
  'function executeGuarded(address agentWallet, address target, uint256 value, bytes calldata data) external payable returns (bool, bytes memory)',
  'event GuardedExecution(address indexed agentWallet, address indexed target, uint256 value, bytes data)',
  'event GuardedExecutionBlocked(address indexed agentWallet, address indexed target, uint256 value, string reason)',
];

const REGISTRY_ABI = [
  'function resetCircuitBreaker(address agentWallet) external',
  'function agents(address) external view returns (address agentWallet, address owner, string name, string aidid, uint8 status, uint256 registeredAt, uint256 lastTripTime, string lastTripReason, uint32 totalTrips)',
  'function updatePolicy(address agentWallet, tuple(uint256 maxSpendPerTx, uint256 maxHourlySpend, uint32 maxTxPerMinute, uint32 loopWindowSeconds, uint32 maxIdenticalPayloads, uint16 anomalyThreshold, bool enforceAllowlist)) external',
  'event CircuitBreakerTripped(address indexed agentWallet, address indexed triggeredBy, string reason, uint256 timestamp)',
  'event CircuitBreakerReset(address indexed agentWallet, address indexed resetBy, uint256 timestamp)',
];

const TARGET_ABI = [
  'function setKeyValue(string key, string value) external payable',
  'function totalOps() external view returns (uint256)',
];

export interface OnChainExecutionResult {
  txHash: string;
  blockNumber: number;
  status: 'ALLOW' | 'BLOCK' | 'TRIP';
  reason?: string;
  gasUsed: string;
  circuitTripped: boolean;
  agentStatusAfter?: string;
}

export class OnChainClient {
  private provider: ethers.JsonRpcProvider;
  private demoSigner: ethers.Wallet;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(BOTCHAIN_TESTNET.rpcUrl);
    this.demoSigner = ethers.Wallet.fromPhrase(DEMO_TESTNET_MNEMONIC).connect(this.provider);
  }

  public getTestAgentAddress(): string {
    return this.demoSigner.address;
  }

  private async getSigner(userInjected?: boolean): Promise<ethers.Signer> {
    if (userInjected && typeof window !== 'undefined' && (window as any).ethereum) {
      const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
      return await browserProvider.getSigner();
    }
    return this.demoSigner;
  }

  /**
   * Execute Guarded Action on BOT Chain Testnet
   */
  public async executeGuardedAction(
    target: string,
    valueEth: string,
    data: string,
    useUserWallet = false
  ): Promise<OnChainExecutionResult> {
    const signer = await this.getSigner(useUserWallet);
    const agentAddress = await signer.getAddress();

    const guardContract = new ethers.Contract(
      BOTCHAIN_TESTNET.contracts.guard,
      GUARD_ABI,
      signer
    );

    const registryContract = new ethers.Contract(
      BOTCHAIN_TESTNET.contracts.registry,
      REGISTRY_ABI,
      this.provider
    );

    const valueWei = ethers.parseEther(valueEth || '0');

    // Send the guarded execution transaction
    const tx = await guardContract.executeGuarded(
      agentAddress,
      target,
      valueWei,
      data || '0x',
      { value: valueWei, gasLimit: 400000 }
    );

    const receipt = await tx.wait();

    // Query on-chain agent state post-execution
    const agentInfo = await registryContract.agents(agentAddress);
    const statusMap = ['ACTIVE', 'WARNING', 'TRIPPED', 'PAUSED'];
    const statusStr = statusMap[Number(agentInfo.status)] || 'ACTIVE';

    let blockedReason: string | undefined;
    let isBlocked = false;
    let isTripped = statusStr === 'TRIPPED';

    for (const log of receipt.logs) {
      try {
        const parsed = guardContract.interface.parseLog(log);
        if (parsed?.name === 'GuardedExecutionBlocked') {
          isBlocked = true;
          blockedReason = parsed.args.reason;
        }
      } catch {}
    }

    // Trigger indexer to fetch new events right away
    setTimeout(() => {
      globalOnChainIndexer.pollNow();
    }, 1000);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      status: isTripped ? 'TRIP' : isBlocked ? 'BLOCK' : 'ALLOW',
      reason: blockedReason || (isTripped ? agentInfo.lastTripReason : undefined),
      gasUsed: receipt.gasUsed.toString(),
      circuitTripped: isTripped,
      agentStatusAfter: statusStr,
    };
  }

  /**
   * Reset Circuit Breaker on BOT Chain Testnet
   */
  public async resetBreakerOnChain(useUserWallet = false): Promise<{ txHash: string; blockNumber: number }> {
    const signer = await this.getSigner(useUserWallet);
    const agentAddress = await signer.getAddress();

    const registryContract = new ethers.Contract(
      BOTCHAIN_TESTNET.contracts.registry,
      REGISTRY_ABI,
      signer
    );

    const tx = await registryContract.resetCircuitBreaker(agentAddress, { gasLimit: 200000 });
    const receipt = await tx.wait();

    setTimeout(() => {
      globalOnChainIndexer.pollNow();
    }, 1000);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  /**
   * Encode target test KV call
   */
  public encodeTestKVCall(key: string, value: string): string {
    const targetIface = new ethers.Interface(TARGET_ABI);
    return targetIface.encodeFunctionData('setKeyValue', [key, value]);
  }
}

export const globalOnChainClient = new OnChainClient();
