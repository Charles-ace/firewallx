import hre from "hardhat";
const { ethers } = hre;

/**
 * Raw on-chain evidence dump (ABI-exact) for the Guard/Circuit-Breaker proof.
 * Uses parseLog from the deployed ABIs — handles indexed vs data correctly.
 */
const REGISTRY = "0x271b7549524fa569317f8abaa0EB4504C280F4AD";
const AUDITOR = "0x0E969975A150AC0Fc8874dd6f68c0fE5c0b7EbAa";
const GUARD = "0x84d6d903045D686550D4B2bA01003aDF5917f114";
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