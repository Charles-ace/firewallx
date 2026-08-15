import { ethers } from "ethers";

const RPC_URL = "https://rpc.bohr.life";
const provider = new ethers.JsonRpcProvider(RPC_URL);
const REGISTRY = "0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1";
const AGENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// The ABI used in src/engine/onChainClient.ts (line 16) — note the extra first field
const CLIENT_ABI = [
  "function agents(address) external view returns (address agentWallet, address owner, string name, string aidid, uint8 status, uint256 registeredAt, uint256 lastTripTime, string lastTripReason, bytes32 lastTripPayloadHash, uint256 totalActionsEvaluated, uint256 totalBlocks, uint256 totalTrips)",
];
// The ACTUAL contract ABI (matches FirewallXRegistry.sol AgentInfo struct — no agentWallet field)
const TRUE_ABI = [
  "function agents(address) external view returns (address owner, string name, string aidid, uint8 status, uint256 registeredAt, uint256 lastTripTime, string lastTripReason, bytes32 lastTripPayloadHash, uint256 totalActionsEvaluated, uint256 totalBlocks, uint256 totalTrips)",
];

async function main() {
  const withClientAbi = new ethers.Contract(REGISTRY, CLIENT_ABI, provider);
  try {
    const r = await withClientAbi.agents(AGENT);
    console.log("Client ABI (12 fields) decode: OK");
    console.log("  [4] =", r[4], "(declared as status, actual slot)");
  } catch (e) {
    console.log("Client ABI (12 fields) decode: FAILED ->", e.shortMessage || e.message);
  }

  const withTrueAbi = new ethers.Contract(REGISTRY, TRUE_ABI, provider);
  try {
    const r = await withTrueAbi.agents(AGENT);
    console.log("True ABI (11 fields) decode: OK");
    console.log("  status=", r.status, "registeredAt=", r.registeredAt.toString());
  } catch (e) {
    console.log("True ABI (11 fields) decode: FAILED ->", e.shortMessage || e.message);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });