import hre from "hardhat";
const { ethers } = hre;

/**
 * Real end-to-end proof of the Guard + Circuit Breaker + rolling-window enforcement
 * on BOT Chain Testnet:
 *  1. Create a distinct agent wallet, fund it, register it in the Registry
 *  2. Guarded compliant execution                -> GuardedExecution (success=true)
 *  3. Identical-payload (loop) breach            -> ExecutionBlocked("Repetitive loop detected")
 *  4. Guarded spend-cap breach                   -> ExecutionBlocked("Spend cap exceeded")
 *  5. Velocity breach (4th tx in 60s)            -> ExecutionBlocked("Rate limit exceeded")
 *  6. Auditor BLOCK verdict recorded on-chain    -> ActionEvaluated(verdict=BLOCK)
 *  7. Circuit breaker tripped by sentinel        -> CircuitBreakerTripped
 *  8. Follow-up guarded call now blocked         -> ExecutionBlocked("Circuit Breaker TRIPPED")
 *  9. Windows expire, breaker reset, recovery    -> GuardedExecution (success=true)
 * Prints every tx hash and revert reason raw.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("DEPLOYER", deployer.address);

  const REGISTRY = "0x8e55ac0a66E9E34376dcCb7D693FeBfF239C3145";
  const AUDITOR = "0x87432661f99EcbD0f1510Eda4a0AfAF5540C93bB";
  const GUARD = "0x2985B6e0dE7F34c503a52F217927d23bb129aa67";
  const TARGET = "0xc93932A69E2A9868AAAEC4CAaafB9B9DB508a555";

  const registry = await ethers.getContractAt("FirewallXRegistry", REGISTRY);
  const auditor = await ethers.getContractAt("FirewallXAuditor", AUDITOR);
  const guard = await ethers.getContractAt("FirewallXGuard", GUARD);

  // 1a. distinct agent identity (reuse key from a prior run so the script is idempotent)
  const agent = ethers.Wallet.fromPhrase(process.env.PROOF_AGENT_MNEMONIC ?? "test test test test test test test test test test test junk")
    .connect(ethers.provider);
  console.log("AGENT", agent.address);

  // Enforcement-active policy: 1 tBOT/tx cap, 3 tx/min, max 2 identical payloads per 60s
  const policy = {
    maxSpendPerTx: ethers.parseEther("1"),
    maxHourlySpend: 0n,
    maxTxPerMinute: 3,
    loopWindowSeconds: 60,
    maxIdenticalPayloads: 2,
    anomalyThreshold: 750,
    enforceAllowlist: false,
  };

  const existing = await registry.agents(agent.address);
  if (existing.registeredAt === 0n) {
    const fundTx = await deployer.sendTransaction({ to: agent.address, value: ethers.parseEther("1") });
    await fundTx.wait();
    console.log("HASH fund-agent", fundTx.hash);

    const regTx = await registry.registerAgent(agent.address, "Proof Agent", "aid:proof-agent-001", policy);
    await regTx.wait();
    console.log("HASH register-agent", regTx.hash);
  } else {
    console.log("AGENT already registered — skipping registration");
  }

  // Always (re)apply the enforcement policy so this run proves velocity + loop limits
  const polTx = await registry.updatePolicy(agent.address, policy);
  await polTx.wait();
  console.log("HASH update-policy", polTx.hash);

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
  const kvAllow = targetIface.encodeFunctionData("setKeyValue", ["proof", "allow"]);      // F1
  const kvOther = targetIface.encodeFunctionData("setKeyValue", ["proof", "other"]);      // F2
  const kvBurst = targetIface.encodeFunctionData("setKeyValue", ["proof", "burst"]);      // F3

  // 2. compliant guarded execution from the AGENT wallet (F1, 1st)
  const allowTx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvAllow, { gasLimit: 300000 });
  await allowTx.wait();
  console.log("HASH guarded-allow", allowTx.hash);

  // 3a. same payload again (F1, 2nd) — still allowed, loop count reaches the cap
  const allow2Tx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvAllow, { gasLimit: 300000 });
  await allow2Tx.wait();
  console.log("HASH guarded-allow-2", allow2Tx.hash);

  // 3b. identical payload 3rd time within 60s -> should revert ExecutionBlocked("Repetitive loop detected")
  const loopTx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvAllow, { gasLimit: 300000 });
  try {
    await loopTx.wait();
    console.log("REVERT loop-breach UNEXPECTEDLY SUCCEEDED");
  } catch (err) {
    const e = err as { info?: { error?: { message?: string } }; message?: string };
    console.log("REVERT loop-breach", String(e.info?.error?.message ?? e.message ?? "").split("\n")[0].slice(0, 300));
  }
  console.log("HASH guarded-blocked-loop", loopTx.hash);

  // 4. spend-cap breach -> should revert ExecutionBlocked("Spend cap exceeded")
  const breachTx = await guard.connect(agent).executeGuarded(TARGET, ethers.parseEther("1.05"), "0x", { gasLimit: 300000 });
  try {
    await breachTx.wait();
    console.log("REVERT spend-breach UNEXPECTEDLY SUCCEEDED");
  } catch (err) {
    const e = err as { info?: { error?: { message?: string } }; message?: string };
    console.log("REVERT blocked-spend", String(e.info?.error?.message ?? e.message ?? "").split("\n")[0].slice(0, 300));
  }
  console.log("HASH guarded-blocked-spend", breachTx.hash);

  // 5a. distinct payload (F2) — allowed; now 3 allowed txs sit in the 60s velocity window
  const otherTx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvOther, { gasLimit: 300000 });
  await otherTx.wait();
  console.log("HASH guarded-allow-3", otherTx.hash);

  // 5b. 4th tx within 60s -> should revert ExecutionBlocked("Rate limit exceeded")
  const burstTx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvBurst, { gasLimit: 300000 });
  try {
    await burstTx.wait();
    console.log("REVERT velocity-breach UNEXPECTEDLY SUCCEEDED");
  } catch (err) {
    const e = err as { info?: { error?: { message?: string } }; message?: string };
    console.log("REVERT velocity-breach", String(e.info?.error?.message ?? e.message ?? "").split("\n")[0].slice(0, 300));
  }
  console.log("HASH guarded-blocked-velocity", burstTx.hash);

  // 6. record the BLOCK verdict on-chain (deployer is authorized reporter)
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

  // 7. trip the circuit breaker (deployer is sentinel + owner)
  const tripTx = await registry.tripCircuitBreaker(agent.address, "spend cap breached; breaker tripped for proof", spendHash);
  await tripTx.wait();
  console.log("HASH trip-breaker", tripTx.hash);

  // 8. follow-up guarded call from the agent -> should revert "Circuit Breaker TRIPPED"
  const followTx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvAllow, { gasLimit: 300000 });
  try {
    await followTx.wait();
    console.log("REVERT blocked-by-breaker UNEXPECTEDLY SUCCEEDED");
  } catch (err) {
    const e = err as { info?: { error?: { message?: string } }; message?: string };
    console.log("REVERT blocked-by-breaker", String(e.info?.error?.message ?? e.message ?? "").split("\n")[0].slice(0, 300));
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
    await guard.connect(agent).executeGuarded.staticCall(TARGET, 0n, kvAllow);
    console.log("REVERT static-call unexpectedly succeeded");
  } catch (err) {
    const e = err as { data?: string; message?: string };
    console.log("REVERT static-call-while-tripped", String(e.data ?? e.message ?? "").slice(0, 400));
  }

  // 9a. wait for the 60s velocity + loop windows to expire (real testnet time)
  console.log("SLEEP waiting 61s for rolling windows to expire...");
  await new Promise((r) => setTimeout(r, 61000));

  // 9b. reset + recovery
  const resetTx = await registry.resetCircuitBreaker(agent.address);
  await resetTx.wait();
  console.log("HASH reset-breaker", resetTx.hash);

  // 9c. the previously-looping payload (F1) is allowed again once windows expired
  const recoverTx = await guard.connect(agent).executeGuarded(TARGET, 0n, kvAllow, { gasLimit: 300000 });
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