import { ethers } from "ethers";

const RPC_URL = "https://rpc.bohr.life";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const GUARD = "0xa9c078278a1164838Ab449e6019A779242605758";
const REGISTRY = "0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1";
const TARGET = "0x35810D68685f11a792438E2Fd237A10313015228";
const AGENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const GUARD_ABI = [
  "event GuardedExecution(address indexed agentWallet, address indexed target, uint256 value, bool success)",
  "event GuardedExecutionBlocked(address indexed agentWallet, address indexed target, uint256 value, string reason)",
];
const REG_ABI = [
  "event CircuitBreakerTripped(address indexed agentWallet, address indexed triggeredBy, string reason, bytes32 indexed payloadHash, uint256 timestamp)",
  "event CircuitBreakerReset(address indexed agentWallet, address indexed resetBy, uint256 timestamp)",
];

const TXS = {
  "loop-tx1-allowed": "0x1ecb97b7df21a14fe414c467b4f4ad12f48a8ce867a7b82a810b84b202498153",
  "loop-tx2-allowed": "0x92e1419e41293f4e5bfdfaa93eba99ea940fc28549d31456c7fc2bb150f2f913",
  "loop-tx3-TRIPPED": "0x00be6c36a68f2c6393b8ca8fd08d105bd62a9149d93ea0c0e2595126c77a935b",
  "reset-1": "0x923ee9c0f3dc1e0c29eeea86db5dd91e2a6e278f48a54e68a1249e8bd581f71f",
  "burst-tx-TRIPPED": "0x272919ee26794cefc698670fb759c803292894421f11a04c011038704b903758",
  "burst-tx2": "0x8489d31861bf4789fdcfbc31ffd64ea0158e44b497f15929e43d87b212c34948",
  "burst-tx3": "0xeda07a2979c949c5ee46b6d43bf7097d41fa18497781b6d0fb6e7bd4b8973b25",
  "burst-tx4": "0x0e441ce3a0fcd812e98555fa1aded7edb9754cb50ec26384d2bf8c3f3d6f7b69",
  "reset-2": "0x61b804eeaac8a7e787f7fffa21e0be3862fb6409644acfbea5f961c977f696d6",
};

const guardIface = new ethers.Interface(GUARD_ABI);
const regIface = new ethers.Interface(REG_ABI);

async function main() {
  for (const [label, hash] of Object.entries(TXS)) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (!receipt) { console.log(`${label}: NO RECEIPT (${hash})`); continue; }
    const events = [];
    for (const log of receipt.logs) {
      try {
        const p = guardIface.parseLog(log);
        if (p) events.push(`${p.name}(${p.args.reason ?? 'success=' + p.args.success})`);
      } catch {}
      try {
        const p = regIface.parseLog(log);
        if (p) events.push(`${p.name}(${p.args.reason})`);
      } catch {}
    }
    console.log(`${label.padEnd(20)} block=${receipt.blockNumber} status=${receipt.status} events=[${events.join(', ')}]`);
  }

  console.log("\n--- Current on-chain agent state ---");
  const reg = new ethers.Contract(REGISTRY, [
    "function agents(address) external view returns (address owner, string name, string aidid, uint8 status, uint256 registeredAt, uint256 lastTripTime, string lastTripReason, bytes32 lastTripPayloadHash, uint256 totalActionsEvaluated, uint256 totalBlocks, uint256 totalTrips)",
  ], provider);
  const a = await reg.agents(AGENT);
  const map = ["ACTIVE","WARNING","TRIPPED","PAUSED"];
  console.log("status:", map[Number(a.status)], "| totalTrips:", a.totalTrips.toString(), "| totalBlocks:", a.totalBlocks.toString(), "| lastTripReason:", a.lastTripReason, "| lastTripTime:", a.lastTripTime.toString());
}

main().catch((e) => { console.error(e); process.exit(1); });