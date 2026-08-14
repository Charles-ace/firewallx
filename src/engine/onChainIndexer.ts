import { BOTCHAIN_TESTNET } from '../config/botchain';

// ---------------------------------------------------------------------------
// On-chain event indexer
//
// Source of truth: direct JSON-RPC `eth_getLogs` polling against rpc.bohr.life.
//   - No API key, no third-party indexing dependency; every event verified
//     against the chain itself.
//   - Ranges are polled in bounded chunks (NODE_CHUNK_BLOCKS) because public
//     nodes cap eth_getLogs range sizes.
//   - Cursor persisted to localStorage so a reload never re-scans history.
// Tradeoff vs. scan.bohr.life's HTTP API: the explorer API is indexed (faster
// for deep history, offset-paginated) but requires an API key and its schema
// is not publicly documented; direct RPC polling is self-contained and works
// offline of any explorer. History depth is limited by node retention either
// way; for this dashboard the recent window is what matters.
// ---------------------------------------------------------------------------

export type ContractName = 'registry' | 'auditor' | 'guard' | 'testTarget';

export interface OnChainEvent {
  id: string;
  contract: ContractName;
  eventName: string;
  blockNumber: number;
  txHash: string;
  logIndex: number;
  summary: string;
  details: Record<string, string>;
  indexedAt: number;
}

export interface IndexerStatus {
  running: boolean;
  lastSyncBlock: number;
  lastSyncAt: number | null;
  error: string | null;
}

type ParamSpec = {
  name: string;
  type: 'address' | 'uint256' | 'uint32' | 'uint16' | 'uint8' | 'bool' | 'string' | 'bytes32';
  indexed: boolean;
};

interface EventSpec {
  name: string;
  topic: string;
  params: ParamSpec[];
  format: (v: Record<string, string>) => string;
}

const RPC_URL = BOTCHAIN_TESTNET.rpcUrl;
const CONTRACTS: Record<ContractName, string> = BOTCHAIN_TESTNET.contracts;

const POLL_INTERVAL_MS = 20000;
const NODE_CHUNK_BLOCKS = 2000;
const INITIAL_BACKFILL_BLOCKS = 3000;
const MAX_KEPT_EVENTS = 100;
const CURSOR_KEY = 'firewallx.onchain.cursor';

const VERDICT_NAMES = ['ALLOW', 'BLOCK', 'FLAG'];
const STATUS_NAMES = ['ACTIVE', 'WARNING', 'TRIPPED', 'PAUSED'];

const short = (v: string): string =>
  v.length > 12 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;

const EVENT_SPECS: Record<ContractName, EventSpec[]> = {
  registry: [
    {
      name: 'AgentRegistered',
      topic: '0x98f1d3f26b7a596f348679d084cb4dae41a946a206f79885dfbf55071eb698f8',
      params: [
        { name: 'agentWallet', type: 'address', indexed: true },
        { name: 'owner', type: 'address', indexed: true },
        { name: 'name', type: 'string', indexed: false },
        { name: 'aidid', type: 'string', indexed: false },
        { name: 'timestamp', type: 'uint256', indexed: false },
      ],
      format: (v) => `agent ${short(v.agentWallet)} registered as "${v.name}" (aid: ${v.aidid})`,
    },
    {
      name: 'PolicyUpdated',
      topic: '0x819b0fad83040a25093d300af0fac6900d3ba56c358346a694468ff7a4ae4620',
      params: [
        { name: 'agentWallet', type: 'address', indexed: true },
        { name: 'maxSpendPerTx', type: 'uint256', indexed: false },
        { name: 'maxHourlySpend', type: 'uint256', indexed: false },
        { name: 'maxTxPerMinute', type: 'uint32', indexed: false },
        { name: 'anomalyThreshold', type: 'uint16', indexed: false },
      ],
      format: (v) => `policy updated for ${short(v.agentWallet)} (cap=${v.maxSpendPerTx}/tx, ${v.maxTxPerMinute}/min)`,
    },
    {
      name: 'CircuitBreakerTripped',
      topic: '0xecaecbf34792c3b17902ac059cafc6aca218f472d2034567f3e8f77852761459',
      params: [
        { name: 'agentWallet', type: 'address', indexed: true },
        { name: 'triggeredBy', type: 'address', indexed: true },
        { name: 'reason', type: 'string', indexed: false },
        { name: 'payloadHash', type: 'bytes32', indexed: true },
        { name: 'timestamp', type: 'uint256', indexed: false },
      ],
      format: (v) => `BREAKER TRIPPED for ${short(v.agentWallet)} by ${short(v.triggeredBy)}: ${v.reason}`,
    },
    {
      name: 'CircuitBreakerReset',
      topic: '0x263296f30b05ea97d7d20570ff543552059aedd9022d57b01606b973d1b70f95',
      params: [
        { name: 'agentWallet', type: 'address', indexed: true },
        { name: 'resetBy', type: 'address', indexed: true },
        { name: 'timestamp', type: 'uint256', indexed: false },
      ],
      format: (v) => `breaker reset for ${short(v.agentWallet)} by ${short(v.resetBy)}`,
    },
    {
      name: 'AgentStatusChanged',
      topic: '0x2040204530671ab8c3bf6fb53c13c92d1fc6de1841a9e35a14cf66f0083984c7',
      params: [
        { name: 'agentWallet', type: 'address', indexed: true },
        { name: 'oldStatus', type: 'uint8', indexed: false },
        { name: 'newStatus', type: 'uint8', indexed: false },
        { name: 'timestamp', type: 'uint256', indexed: false },
      ],
      format: (v) => `${short(v.agentWallet)}: ${STATUS_NAMES[Number(v.oldStatus)] ?? v.oldStatus} → ${STATUS_NAMES[Number(v.newStatus)] ?? v.newStatus}`,
    },
    {
      name: 'AllowlistUpdated',
      topic: '0x7b4f287cb79b7c061712a59529c3dd5ee321e6d2975defe7b85d7090cbd29b7d',
      params: [
        { name: 'agentWallet', type: 'address', indexed: true },
        { name: 'target', type: 'address', indexed: true },
        { name: 'allowed', type: 'bool', indexed: false },
      ],
      format: (v) => `allowlist for ${short(v.agentWallet)}: ${short(v.target)} ${v.allowed === 'true' ? 'ALLOWED' : 'removed'}`,
    },
    {
      name: 'BlocklistUpdated',
      topic: '0xffe80d6d91bb72bd036e4be8badcf33d7c8e13b2a0aaab3dc3aef76f6b1f786a',
      params: [
        { name: 'agentWallet', type: 'address', indexed: true },
        { name: 'target', type: 'address', indexed: true },
        { name: 'blocked', type: 'bool', indexed: false },
      ],
      format: (v) => `blocklist for ${short(v.agentWallet)}: ${short(v.target)} ${v.blocked === 'true' ? 'BLOCKED' : 'removed'}`,
    },
    {
      name: 'SentinelUpdated',
      topic: '0x2322f2689a51662b4b5ed214dad65d0455ec6b3c5f5e5b0dd94d2bea3e0bd846',
      params: [
        { name: 'sentinel', type: 'address', indexed: true },
        { name: 'active', type: 'bool', indexed: false },
      ],
      format: (v) => `sentinel ${short(v.sentinel)} ${v.active === 'true' ? 'ACTIVATED' : 'deactivated'}`,
    },
  ],
  auditor: [
    {
      name: 'ActionEvaluated',
      topic: '0xf62d79cf06f70f55f2cd46b46e10d6fe51d3e6fe07700289bc001900c7f0bde5',
      params: [
        { name: 'agentWallet', type: 'address', indexed: true },
        { name: 'actionHash', type: 'bytes32', indexed: true },
        { name: 'target', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
        { name: 'verdict', type: 'uint8', indexed: false },
        { name: 'anomalyScore', type: 'uint16', indexed: false },
        { name: 'ruleTriggered', type: 'string', indexed: false },
        { name: 'reasoning', type: 'string', indexed: false },
        { name: 'timestamp', type: 'uint256', indexed: false },
      ],
      format: (v) =>
        `verdict=${VERDICT_NAMES[Number(v.verdict)] ?? v.verdict} score=${v.anomalyScore}/1000 rule=${v.ruleTriggered} → ${short(v.target)}`,
    },
    {
      name: 'ReporterAuthorized',
      topic: '0xd47f4d9453e9791c794cf5aa87230761df19291606f7b48627c71d934e672714',
      params: [
        { name: 'reporter', type: 'address', indexed: true },
        { name: 'authorized', type: 'bool', indexed: false },
      ],
      format: (v) => `reporter ${short(v.reporter)} ${v.authorized === 'true' ? 'authorized' : 'deauthorized'}`,
    },
  ],
  guard: [
    {
      name: 'GuardedExecution',
      topic: '0x504674f60a7863338d7a54f2d3aa1e6daa55289e5766eeaacc0e9b15abd2568b',
      params: [
        { name: 'agentWallet', type: 'address', indexed: true },
        { name: 'target', type: 'address', indexed: true },
        { name: 'value', type: 'uint256', indexed: false },
        { name: 'success', type: 'bool', indexed: false },
      ],
      format: (v) => `guard executed → ${short(v.target)} value=${v.value} success=${v.success}`,
    },
  ],
  testTarget: [
    {
      name: 'KeyValueSet',
      topic: '0xa0fd742189b4d297b74f632a25e1382a04f6ba3d81c61de46b42f21639a55b12',
      params: [
        { name: 'key', type: 'string', indexed: false },
        { name: 'value', type: 'string', indexed: false },
        { name: 'caller', type: 'address', indexed: false },
        { name: 'opCount', type: 'uint256', indexed: false },
      ],
      format: (v) => `key="${v.key}" = "${v.value}" by ${short(v.caller)} (op #${v.opCount})`,
    },
    {
      name: 'FundsReceived',
      topic: '0x8e47b87b0ef542cdfa1659c551d88bad38aa7f452d2bbb349ab7530dfec8be8f',
      params: [
        { name: 'from', type: 'address', indexed: true },
        { name: 'amount', type: 'uint256', indexed: false },
      ],
      format: (v) => `received ${(BigInt(v.amount) / 10n ** 18n).toString()} tBOT from ${short(v.from)}`,
    },
  ],
};

const WORD = 32;

function stripHex(hex: string): string {
  if (!hex) return '';
  return hex.startsWith('0x') ? hex.slice(2) : hex;
}

function wordAt(dataHex: string, index: number): string {
  const hex = stripHex(dataHex);
  return '0x' + hex.slice(index * 64, index * 64 + 64);
}

function hexToBigInt(w: string): bigint {
  const s = stripHex(w);
  return s === '' ? 0n : BigInt('0x' + s);
}

function wordToNumber(w: string): number {
  return Number(hexToBigInt(w));
}

function wordToBool(w: string): boolean {
  return hexToBigInt(w) !== 0n;
}

function wordToAddress(w: string): string {
  return '0x' + stripHex(w).slice(-40).toLowerCase();
}

function wordToBytes32(w: string): string {
  return w.toLowerCase();
}

function wordsToString(words: string[], offsetWord: number): { value: string; endWord: number } {
  if (!words[offsetWord]) return { value: '(unparsed)', endWord: offsetWord + 1 };
  const len = wordToNumber(words[offsetWord]);
  const dataWords = Math.ceil(len / WORD);
  let out = '';
  for (let i = 0; i < dataWords; i++) {
    out += stripHex(words[offsetWord + 1 + i]);
  }
  const bytes = Uint8Array.from(
    out.slice(0, len * 2).match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? []
  );
  return { value: new TextDecoder().decode(bytes), endWord: offsetWord + 1 + dataWords };
}

/**
 * Decode one log from one of our contracts. Returns null if it does not
 * belong to a known event signature.
 */
export function decodeEvent(contract: ContractName, log: { topics: string[]; data: string }): OnChainEvent | null {
  const spec = EVENT_SPECS[contract].find((s) => s.topic === log.topics[0]);
  if (!spec) return null;

  const values: Record<string, string> = {};
  let topicIdx = 1;
  const dataHex = log.data ?? '0x';
  const words = [] as string[];
  for (let i = 0; i < Math.ceil((dataHex.length - 2) / 64); i++) words.push(wordAt(dataHex, i));
  let dataWord = 0;

  for (const p of spec.params) {
    if (p.indexed) {
      const topic = log.topics[topicIdx++];
      if (p.type === 'address') values[p.name] = wordToAddress(topic);
      else if (p.type === 'bytes32') values[p.name] = wordToBytes32(topic);
      else values[p.name] = wordToNumber(topic).toString();
    } else {
if (p.type === 'string') {
        const offsetWordRaw = words[dataWord];
        if (!offsetWordRaw) {
          values[p.name] = '(unparsed)';
          dataWord += 1;
          continue;
        }
        const byteOffset = wordToNumber(offsetWordRaw);
        const { value } = wordsToString(words, byteOffset / WORD);
        values[p.name] = value;
        dataWord += 1;
      } else if (p.type === 'address') {
        values[p.name] = wordToAddress(words[dataWord++]);
      } else if (p.type === 'bytes32') {
        values[p.name] = wordToBytes32(words[dataWord++]);
      } else if (p.type === 'bool') {
        values[p.name] = wordToBool(words[dataWord++]).toString();
      } else {
        values[p.name] = wordToNumber(words[dataWord++]).toString();
      }
    }
  }

  return {
    id: '',
    contract,
    eventName: spec.name,
    blockNumber: 0,
    txHash: '',
    logIndex: 0,
    summary: spec.format(values),
    details: values,
    indexedAt: Date.now(),
  };
}

type Log = { address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string; logIndex: string };

const contractAddresses = Object.values(CONTRACTS).map((a) => a.toLowerCase());

class OnChainIndexer {
  private events: OnChainEvent[] = [];
  private listeners: ((events: OnChainEvent[]) => void)[] = [];
  private statusListeners: ((s: IndexerStatus) => void)[] = [];
  private cursor: number;
  private timer: number | null = null;
  private inFlight = false;
  private status: IndexerStatus = {
    running: false,
    lastSyncBlock: 0,
    lastSyncAt: null,
    error: null,
  };

  constructor() {
    const saved = Number(localStorage.getItem(CURSOR_KEY) ?? '0');
    this.cursor = Number.isFinite(saved) && saved > 0 ? saved : 0;
    try {
      const stored = JSON.parse(localStorage.getItem('firewallx.onchain.events') ?? '[]') as OnChainEvent[];
      this.events = Array.isArray(stored) ? stored : [];
    } catch {
      this.events = [];
    }
  }

  getEvents(): OnChainEvent[] {
    return [...this.events];
  }

  getStatus(): IndexerStatus {
    return { ...this.status };
  }

  subscribeOnChainEvents(cb: (events: OnChainEvent[]) => void): () => void {
    this.listeners.push(cb);
    cb(this.getEvents());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  subscribeStatus(cb: (s: IndexerStatus) => void): () => void {
    this.statusListeners.push(cb);
    cb(this.getStatus());
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== cb);
    };
  }

  start(): void {
    if (this.timer !== null) return;
    this.status.running = true;
    this.emitStatus();
    this.refresh();
    this.timer = window.setInterval(() => this.refresh(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.status.running = false;
    this.emitStatus();
  }

  async refresh(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const latest = await this.rpcNumber('eth_blockNumber');
      if (this.cursor === 0) {
        this.cursor = Math.max(0, latest - INITIAL_BACKFILL_BLOCKS);
      }
      if (this.cursor >= latest) {
        this.status.lastSyncBlock = latest;
        this.status.lastSyncAt = Date.now();
        this.status.error = null;
        this.emitStatus();
        return;
      }
      for (let from = this.cursor + 1; from <= latest; from += NODE_CHUNK_BLOCKS + 1) {
        const to = Math.min(from + NODE_CHUNK_BLOCKS, latest);
        const logs = await this.fetchLogs(from, to);
        this.ingest(logs);
        this.cursor = to;
      }
      this.status.lastSyncBlock = latest;
      this.status.lastSyncAt = Date.now();
      this.status.error = null;
      this.emitStatus();
      this.persist();
    } catch (err) {
      this.status.error = err instanceof Error ? err.message : String(err);
      this.emitStatus();
    } finally {
      this.inFlight = false;
    }
  }

  private async rpcNumber(method: string): Promise<number> {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }),
    });
    const json = await res.json();
    return parseInt(json.result, 16);
  }

  private async fetchLogs(fromBlock: number, toBlock: number): Promise<Log[]> {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getLogs',
        params: [
          {
            fromBlock: '0x' + fromBlock.toString(16),
            toBlock: '0x' + toBlock.toString(16),
            address: contractAddresses,
          },
        ],
      }),
    });
    const json = await res.json();
    if (json.error) throw new Error(`eth_getLogs: ${json.error.message ?? JSON.stringify(json.error)}`);
    return (json.result ?? []) as Log[];
  }

  private ingest(logs: Log[]): void {
    for (const log of logs) {
      const contract = (Object.keys(CONTRACTS) as ContractName[]).find(
        (k) => CONTRACTS[k].toLowerCase() === log.address.toLowerCase()
      );
      if (!contract) continue;
      const decoded = decodeEvent(contract, log);
      if (!decoded) continue;
      const event: OnChainEvent = {
        ...decoded,
        id: `${log.transactionHash}-${parseInt(log.logIndex, 16)}`,
        blockNumber: parseInt(log.blockNumber, 16),
        txHash: log.transactionHash,
        logIndex: parseInt(log.logIndex, 16),
        indexedAt: Date.now(),
      };
      const existing = this.events.find((e) => e.id === event.id);
      if (existing) continue;
      this.events = [event, ...this.events].slice(0, MAX_KEPT_EVENTS);
    }
    if (logs.length > 0) {
      this.emitEvents();
      this.persist();
    }
  }

  private emitEvents(): void {
    for (const cb of this.listeners) cb(this.getEvents());
  }

  private emitStatus(): void {
    for (const cb of this.statusListeners) cb(this.getStatus());
  }

  private persist(): void {
    try {
      localStorage.setItem(CURSOR_KEY, String(this.cursor));
      localStorage.setItem('firewallx.onchain.events', JSON.stringify(this.events.slice(0, 50)));
    } catch {
      // storage may be unavailable; indexing still works in-memory
    }
  }
}

export const globalOnChainIndexer = new OnChainIndexer();
