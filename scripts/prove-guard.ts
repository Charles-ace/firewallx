import hre from "hardhat";
const { ethers } = hre;

/**
 * Real end-to-end proof of the Guard + Circuit Breaker on BOT Chain Testnet:
 *  1. Create a distinct agent wallet, fund it, register it in the Registry
 *  2. Guarded compliant execution                -> GuardedExecution (success=true)
 *  3. Guarded spend-cap breach                   -> ExecutionBlocked("Spend cap exceeded")
 *  4. Auditor BLOCK verdict recorded on-chain    -> ActionEvaluated(verdict=BLOCK)
 *  5. Circuit breaker tripped by sentinel        -> CircuitBreakerTripped
 *  6. Follow-up guarded call now blocked         -> ExecutionBlocked("Circuit Breaker TRIPPED")
 *  7. Breaker reset, guarded execution recovers  -> GuardedExecution (success=true)
 * Prints every tx hash and revert reason raw.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("DEPLOYER", deployer.address);

  const REGISTRY = "0x271b7549524fa569317f8abaa0EB4504C280F4AD";
  const AUDITOR = "0x0E969975A150AC0Fc8874dd6f68c0fE5c0b7EbAa";
  const GUARD = "0x84d6d903045D686550D4B2bA01003aDF5917f114";
  const TARGET = "0xc93932A69E2A9868AAAEC4CAaafB9B9DB508a555";

  const registry = await ethers.getContractAt("FirewallXRegistry", REGISTRY);
  const auditor = await ethers.getContractAt("FirewallXAuditor", AUDITOR);
  const guard = await ethers.getContractAt("FirewallXGuard", GUARD);

  // 1a. distinct agent identity (reuse key from a prior run so the script is idempotent)
  const agent = ethers.Wallet.fromPhrase(process.env.PROOF_AGENT_MNEMONIC ?? "test test test test test test test test test test test junk")
    .connect(ethers.provider);
  console.log("AGENT", agent.address);

  const existing = await registry.agents(agent.address);
  if (existing.registeredAt === 0n) {
    const fundTx = await deployer.sendTransaction({ to: agent.address, value: ethers.parseEther("1") });
    await fundTx.wait();
    console.log("HASH fund-agent", fundTx.hash);

    // 1b. register with a policy: 1 tBOT spend cap per tx
    const policy = {
      maxSpendPerTx: ethers.parseEther("1"),
      maxHourlySpend: 0n,
      maxTxPerMinute: 0,
      loopWindowSeconds: 0,
      maxIdenticalPayloads: 0,
      anomalyThreshold: 750,
      enforceAllowlist: false,
    };
    const regTx = await registry.registerAgent(agent.address, "Proof Agent", "aid:proof-agent-001", policy);
    await regTx.wait();
    console.log("HASH register-agent", regTx.hash);
  } else {
    console.log("AGENT already registered — skipping registration");
  }

  // Idempotent start: if the breaker is still tripped from an earlier run, reset first
  const pre = await registry.agents(agent.address);
  if (pre.status === 2n) {
    const resetTx = await registry.resetCircuitBreaker(agent.address);
    await resetTx.wait();
    console.log("HASH reset-stale-trip", resetTx.hash);
    console.log("STATE pre-run reset applied (status was TRIPPED)");
  }

  const targetIface = new ethers.Interface([
    "function setKeyValue(string key, string value) external payable",
  ]);
  const kvData = targetIface.encodeFunctionData("setKeyValue", ["proof", "allow"]);

  // 2. compliant guarded execution from the AGENT wallet
  const allowTx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvData, { gasLimit: 300000 });
  const allowReceipt = await allowTx.wait();
  console.log("HASH guarded-allow", allowTx.hash);

  // 3. spend-cap breach -> should revert with ExecutionBlocked("Spend cap exceeded")
  const breachTx = await guard.connect(agent).executeGuarded(TARGET, ethers.parseEther("1.05"), "0x", { gasLimit: 300000 });
  let breachReceipt;
  try {
    breachReceipt = await breachTx.wait();
  } catch (err) {
    const e = err as { info?: { error?: { message?: string }; receipt?: unknown }; receipt?: unknown; message?: string };
    breachReceipt = (e.info?.receipt ?? e.receipt) as unknown as { transactionHash: string } | undefined;
    console.log("REVERT blocked-spend", String(e.message ?? "").split("\n")[0].slice(0, 300));
  }
  console.log("HASH guarded-blocked-spend", breachTx.hash);

  // 4. record the BLOCK verdict on-chain (deployer is authorized reporter)
  const spendHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "string"],
      [agent.address, TARGET, ethers.parseEther("1.05"), "proof-block"]
    )
  );
  const blockAuditTx = await auditor.recordEvaluation(
    agent.address, spendHash, TARGET, ethers.parseEther("1.05"),
    1, // BLOCK
    900,
    "spend-cap",
    "value 1.05 tBOT exceeds maxSpendPerTx of 1.0 tBOT"
  );
  await blockAuditTx.wait();
  console.log("HASH audit-block", blockAuditTx.hash);

  // 5. trip the circuit breaker (deployer is sentinel + owner)
  const tripTx = await registry.tripCircuitBreaker(agent.address, "spend cap breached; breaker tripped for proof", spendHash);
  await tripTx.wait();
  console.log("HASH trip-breaker", tripTx.hash);

  // 6. follow-up guarded call from the agent -> should revert "Circuit Breaker TRIPPED"
  const followTx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvData, { gasLimit: 300000 });
  let followReceipt;
  try {
    followReceipt = await followTx.wait();
  } catch (err) {
    const e = err as { info?: { error?: { message?: string }; receipt?: unknown }; receipt?: unknown; message?: string };
    followReceipt = (e.info?.receipt ?? e.receipt) as unknown as { transactionHash: string } | undefined;
    console.log("REVERT blocked-by-breaker", String(e.message ?? "").split("\n")[0].slice(0, 300));
  }
  console.log("HASH guarded-blocked-by-breaker", followTx.hash);

  // record the breaker-denial verdict
  const deniedHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "string"],
      [agent.address, TARGET, 0n, "proof-after-trip"]
    )
  );
  const deniedAuditTx = await auditor.recordEvaluation(
    agent.address, deniedHash, TARGET, 0n,
    1, // BLOCK
    950,
    "circuit-breaker",
    "execution denied: circuit breaker TRIPPED"
  );
  await deniedAuditTx.wait();
  console.log("HASH audit-denied", deniedAuditTx.hash);

  // state proof while tripped
  const tripped = await registry.agents(agent.address);
  console.log("STATE after trip", JSON.stringify({ status: tripped.status.toString(), totalTrips: tripped.totalTrips.toString(), lastTripReason: tripped.lastTripReason, lastTripTime: tripped.lastTripTime.toString() }));

  // raw revert data of a guarded call while the breaker is tripped
  try {
    await guard.connect(agent).executeGuarded.staticCall(TARGET, 0n, kvData);
    console.log("REVERT static-call unexpectedly succeeded");
  } catch (err) {
    const e = err as { data?: string; message?: string };
    console.log("REVERT static-call-while-tripped", String(e.data ?? e.message ?? "").slice(0, 400));
  }

  // 7. reset + recovery
  const resetTx = await registry.resetCircuitBreaker(agent.address);
  await resetTx.wait();
  console.log("HASH reset-breaker", resetTx.hash);

  const recoverTx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvData);
  await recoverTx.wait();
  console.log("HASH guarded-recover", recoverTx.hash);

  const recovered = await registry.agents(agent.address);
  console.log("STATE after reset", JSON.stringify({ status: recovered.status.toString(), totalTrips: recovered.totalTrips.toString() }));

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});