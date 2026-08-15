import { ethers } from 'ethers';
import { BOTCHAIN_TESTNET } from '../config/botchain';
import { globalOnChainIndexer } from './onChainIndexer';

// Testnet Agent Wallet for Interactive UI Demonstrations (Funded on BOT Chain Testnet)
const DEMO_TESTNET_MNEMONIC = 'test test test test test test test test test test test junk';

const GUARD_ABI = [
  'function executeGuarded(address target, uint256 value, bytes calldata data) external payable returns (bytes memory)',
  'event GuardedExecution(address indexed agentWallet, address indexed target, uint256 value, bool success)',
  'event GuardedExecutionBlocked(address indexed agentWallet, address indexed target, uint256 value, string reason)',
];

const REGISTRY_ABI = [
  'function resetCircuitBreaker(address agentWallet) external',
  'function agents(address) external view returns (address owner, string name, string aidid, uint8 status, uint256 registeredAt, uint256 lastTripTime, string lastTripReason, bytes32 lastTripPayloadHash, uint256 totalActionsEvaluated, uint256 totalBlocks, uint256 totalTrips)',
  'function updatePolicy(address agentWallet, tuple(uint256 maxSpendPerTx, uint256 maxHourlySpend, uint32 maxTxPerMinute, uint32 loopWindowSeconds, uint32 maxIdenticalPayloads, uint16 anomalyThreshold, bool enforceAllowlist)) external',
  'event CircuitBreakerTripped(address indexed agentWallet, address indexed triggeredBy, string reason, bytes32 indexed payloadHash, uint256 timestamp)',
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
  private demoSigner: ethers.HDNodeWallet;

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

    // Send the guarded execution transaction (3 params: target, value, data)
    const tx = await guardContract.executeGuarded(
      target,
      valueWei,
      data || '0x',
      { value: valueWei, gasLimit: 400000 }
    );

    const receipt = await tx.wait();

    let blockedReason: string | undefined;
    let isBlocked = false;
    let isTripped = false;
    let statusStr = 'ACTIVE';

    for (const log of receipt.logs) {
      try {
        const parsedGuard = guardContract.interface.parseLog(log);
        if (parsedGuard?.name === 'GuardedExecutionBlocked') {
          isBlocked = true;
          blockedReason = parsedGuard.args.reason;
        }
      } catch {}
      try {
        const parsedReg = registryContract.interface.parseLog(log);
        if (parsedReg?.name === 'CircuitBreakerTripped') {
          isTripped = true;
          statusStr = 'TRIPPED';
          blockedReason = parsedReg.args.reason;
        }
      } catch {}
    }

    try {
      const agentInfo = await registryContract.agents(agentAddress);
      const statusMap = ['ACTIVE', 'WARNING', 'TRIPPED', 'PAUSED'];
      statusStr = statusMap[Number(agentInfo.status)] || statusStr;
      if (statusStr === 'TRIPPED') isTripped = true;
    } catch {}

    // Trigger indexer to fetch new events right away
    setTimeout(() => {
      void globalOnChainIndexer.refresh().catch(() => {});
    }, 1000);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      status: isTripped ? 'TRIP' : isBlocked ? 'BLOCK' : 'ALLOW',
      reason: blockedReason,
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
      void globalOnChainIndexer.refresh().catch(() => {});
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
