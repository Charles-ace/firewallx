import hre from "hardhat";
const { ethers } = hre;

/**
 * Raw on-chain evidence dump (ABI-exact) for the Guard/Circuit-Breaker proof.
 * Uses parseLog from the deployed ABIs — handles indexed vs data correctly.
 */
const REGISTRY = "0x8e55ac0a66E9E34376dcCb7D693FeBfF239C3145";
const AUDITOR = "0x87432661f99EcbD0f1510Eda4a0AfAF5540C93bB";
const GUARD = "0x2985B6e0dE7F34c503a52F217927d23bb129aa67";
const TARGET = "0xc93932A69E2A9868AAAEC4CAaafB9B9DB508a555";
const AGENT = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

async function main() {
  const provider = ethers.provider;
  const latest = await provider.getBlockNumber();
  const from = latest - 10000;

  const contracts = [REGISTRY, AUDITOR, GUARD, TARGET];
  const ifaces = contracts.map((addr) => {
    const name = addr === REGISTRY ? "FirewallXRegistry" : addr === AUDITOR ? "FirewallXAuditor" : addr === GUARD ? "FirewallXGuard" : "TestTargetContract";
    const abi = hre.artifacts.readArtifactSync(name).abi;
    return new ethers.Interface(abi);
  });

  const rows: string[] = [];
  for (let i = 0; i < contracts.length; i++) {
    const logs = await provider.send("eth_getLogs", [{ address: contracts[i], fromBlock: `0x${from.toString(16)}`, toBlock: "latest" }]);
    for (const log of logs) {
      let parsed: ethers.LogDescription | null = null;
      try {
        parsed = ifaces[i].parseLog(log);
      } catch {
        continue;
      }
      if (!parsed) continue;
      const name = parsed.name;
      const relevant = ["AgentRegistered", "CircuitBreakerTripped", "CircuitBreakerReset", "AgentStatusChanged", "GuardedExecution", "ActionEvaluated", "KeyValueSet", "FundsReceived"].includes(name);
      if (!relevant) continue;
      const fields: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.args)) {
        if (typeof v === "bigint") fields[k] = v.toString();
        else if (typeof v === "string") fields[k] = v.toLowerCase();
        else if (typeof v === "boolean") fields[k] = String(v);
      }
      const agentHit = Object.values(fields).some((v) => v.toLowerCase() === AGENT.toLowerCase());
      if (name !== "KeyValueSet" && name !== "FundsReceived" && !agentHit) continue;
      const row = `${name} tx=${log.transactionHash} block=${parseInt(log.blockNumber, 16)} ${JSON.stringify(fields)}`;
      rows.push(row);
      console.log(row);
    }
  }
  console.log("ROWS", rows.length);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});