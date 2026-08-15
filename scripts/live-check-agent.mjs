import { ethers } from "ethers";

const RPC_URL = "https://rpc.bohr.life";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const REGISTRY = "0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1";
const AGENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // demo signer from onChainClient.ts

const ABI = [
  "function agents(address) external view returns (address owner, string name, string aidid, uint8 status, uint256 registeredAt, uint256 lastTripTime, string lastTripReason, bytes32 lastTripPayloadHash, uint256 totalActionsEvaluated, uint256 totalBlocks, uint256 totalTrips)",
  "function policies(address) external view returns (uint256 maxSpendPerTx, uint256 maxHourlySpend, uint32 maxTxPerMinute, uint32 loopWindowSeconds, uint32 maxIdenticalPayloads, uint16 anomalyThreshold, bool enforceAllowlist)",
];

async function main() {
  const registry = new ethers.Contract(REGISTRY, ABI, provider);
  const agent = await registry.agents(AGENT);
  const policy = await registry.policies(AGENT);
  const statusMap = ["ACTIVE", "WARNING", "TRIPPED", "PAUSED"];

  console.log("=== On-chain agent state (Registry 0x3E0E9fbd...) ===");
  console.log("Agent wallet:        ", AGENT);
  console.log("Registered:          ", agent.registeredAt > 0n ? "YES" : "NO");
  if (agent.registeredAt > 0n) {
    console.log("Name:                ", agent.name);
    console.log("Status:              ", statusMap[Number(agent.status)], `(${agent.status})`);
    console.log("Total trips:         ", agent.totalTrips.toString());
    console.log("Total blocks:        ", agent.totalBlocks.toString());
    console.log("Last trip reason:    ", agent.lastTripReason);
    console.log("Last trip payload:   ", agent.lastTripPayloadHash);
    console.log("Policy: maxSpendPerTx     ", ethers.formatEther(policy.maxSpendPerTx), "tBOT");
    console.log("Policy: maxTxPerMinute    ", policy.maxTxPerMinute);
    console.log("Policy: loopWindowSeconds ", policy.loopWindowSeconds);
    console.log("Policy: maxIdentical      ", policy.maxIdenticalPayloads);
    console.log("Policy: enforceAllowlist  ", policy.enforceAllowlist);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });