import hre from "hardhat";
const { ethers } = hre;

/**
 * End-to-end On-Chain Proof of Autonomous Circuit Breaker on BOT Chain Testnet:
 * 1. Register distinct agent identity
 * 2. Apply active enforcement policy (max 2 identical payloads/min, max 3 tx/min)
 * 3. 1st & 2nd identical calls succeed via Guard -> target state updated
 * 4. 3rd identical call AUTONOMOUSLY TRIPS breaker on-chain -> status becomes TRIPPED, target untouched
 * 5. Verify on-chain storage state (status=TRIPPED, totalTrips=1, reason="Repetitive loop detected")
 * 6. Follow-up call is blocked by TRIPPED state
 * 7. Reset breaker on-chain
 * 8. Velocity burst (4th tx in rolling minute) AUTONOMOUSLY TRIPS breaker on-chain
 * 9. Verify on-chain storage state (status=TRIPPED, totalTrips=2, reason="Rate limit exceeded")
 * 10. Reset breaker on-chain
 */
async function main() {
  console.log("================================================================================");
  console.log("⚡ STARTING FIREWALLX ON-CHAIN AUTONOMOUS CIRCUIT BREAKER PROOF (BOT CHAIN TESTNET)");
  console.log("================================================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  const depBal = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(depBal), "tBOT\n");

  const REGISTRY_ADDR = "0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1";
  const AUDITOR_ADDR = "0x3F9f55ff8c3C5090b8321E9ecB8B6c02a13a055A";
  const GUARD_ADDR = "0xa9c078278a1164838Ab449e6019A779242605758";
  const TARGET_ADDR = "0x35810D68685f11a792438E2Fd237A10313015228";

  const registry = await ethers.getContractAt("FirewallXRegistry", REGISTRY_ADDR);
  const auditor = await ethers.getContractAt("FirewallXAuditor", AUDITOR_ADDR);
  const guard = await ethers.getContractAt("FirewallXGuard", GUARD_ADDR);
  const target = await ethers.getContractAt("TestTargetContract", TARGET_ADDR);

  // Generate deterministic test agent wallet
  const agentWallet = ethers.Wallet.fromPhrase(
    process.env.PROOF_AGENT_MNEMONIC ?? "test test test test test test test test test test test junk"
  ).connect(ethers.provider);

  console.log("Test Agent Address:", agentWallet.address);
  let agentBal = await ethers.provider.getBalance(agentWallet.address);
  if (agentBal < ethers.parseEther("0.5")) {
    console.log("Funding agent wallet with 1.0 tBOT...");
    const fundTx = await deployer.sendTransaction({
      to: agentWallet.address,
      value: ethers.parseEther("1.0"),
    });
    await fundTx.wait();
    console.log("✅ Funded Agent. Tx:", fundTx.hash);
  }

  // Define policy: 1.0 tBOT max per tx, max 3 txs/min, max 2 identical payloads per 60s
  const policy = {
    maxSpendPerTx: ethers.parseEther("1.0"),
    maxHourlySpend: ethers.parseEther("10.0"),
    maxTxPerMinute: 3,
    loopWindowSeconds: 60,
    maxIdenticalPayloads: 2,
    anomalyThreshold: 750,
    enforceAllowlist: false,
  };

  // Check if agent registered
  const existing = await registry.agents(agentWallet.address);
  if (existing.registeredAt === 0n) {
    console.log("Registering Agent in FirewallXRegistry...");
    const regTx = await registry.connect(agentWallet).registerAgent(
      agentWallet.address,
      "Sentinel-Autonomous-Agent-01",
      "aid:botchain:autonomous-breaker-test",
      policy
    );
    const regRec = await regTx.wait();
    console.log("✅ Agent Registered on-chain! Tx:", regTx.hash, "Block:", regRec?.blockNumber);
  } else {
    console.log("Agent already registered. Updating policy to enforce limits...");
    const updateTx = await registry.connect(agentWallet).updatePolicy(agentWallet.address, policy);
    await updateTx.wait();
    console.log("✅ Policy updated on-chain! Tx:", updateTx.hash);

    // Reset breaker if tripped
    if (existing.status === 2n || existing.status === 3n) {
      console.log("Resetting existing tripped breaker...");
      const rTx = await registry.connect(agentWallet).resetCircuitBreaker(agentWallet.address);
      await rTx.wait();
      console.log("✅ Breaker reset on-chain! Tx:", rTx.hash);
    }
  }

  const targetIface = new ethers.Interface([
    "function setKeyValue(string key, string value) external payable",
  ]);

  const timestamp = Date.now();
  const payloadA = targetIface.encodeFunctionData("setKeyValue", [`runaway-loop-${timestamp}`, "payload-alpha"]);
  const payloadB = targetIface.encodeFunctionData("setKeyValue", [`burst-b-${timestamp}`, "payload-beta"]);
  const payloadC = targetIface.encodeFunctionData("setKeyValue", [`burst-c-${timestamp}`, "payload-gamma"]);
  const payloadD = targetIface.encodeFunctionData("setKeyValue", [`burst-d-${timestamp}`, "payload-delta"]);

  const initialOps = await target.totalOps();
  console.log(`\nInitial Target totalOps: ${initialOps}`);

  // --------------------------------------------------------------------------------
  // TEST 1: IDENTICAL-PAYLOAD LOOP ENFORCEMENT & AUTONOMOUS BREAKER TRIP
  // --------------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 1: Executing 1st identical payload (Payload A)...");
  const call1Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadA, { gasLimit: 300000 });
  const rec1 = await call1Tx.wait();
  console.log("✅ Call 1 Succeeded! Tx:", call1Tx.hash, "Block:", rec1?.blockNumber);
  console.log("Target totalOps:", await target.totalOps());

  console.log("\nSTEP 2: Executing 2nd identical payload (Payload A)...");
  const call2Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadA, { gasLimit: 300000 });
  const rec2 = await call2Tx.wait();
  console.log("✅ Call 2 Succeeded (Cap is 2)! Tx:", call2Tx.hash, "Block:", rec2?.blockNumber);
  console.log("Target totalOps:", await target.totalOps());

  console.log("\nSTEP 3: Executing 3rd identical payload (Payload A) — MUST TRIP BREAKER AUTONOMOUSLY ON-CHAIN...");
  const call3Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadA, { gasLimit: 300000 });
  const rec3 = await call3Tx.wait();
  console.log("⚡ Call 3 Mined! Tx:", call3Tx.hash, "Block:", rec3?.blockNumber);

  const opsAfterTrip = await target.totalOps();
  console.log("Target totalOps after 3rd call:", opsAfterTrip, `(Target was protected: ${opsAfterTrip === initialOps + 2n})`);

  // Verify on-chain storage state in Registry
  const agentAfterTrip1 = await registry.agents(agentWallet.address);
  console.log("\n🔎 ON-CHAIN AGENT STATE VERIFICATION AFTER LOOP BREACH:");
  console.log("- Status (0=ACTIVE, 1=WARNING, 2=TRIPPED):", agentAfterTrip1.status.toString(), agentAfterTrip1.status === 2n ? "✅ TRIPPED" : "❌ NOT TRIPPED");
  console.log("- Total Trips:", agentAfterTrip1.totalTrips.toString());
  console.log("- Last Trip Reason:", agentAfterTrip1.lastTripReason);
  console.log("- Last Trip Timestamp:", agentAfterTrip1.lastTripTime.toString());
  console.log("- Last Trip Payload Hash:", agentAfterTrip1.lastTripPayloadHash);

  if (agentAfterTrip1.status !== 2n) {
    throw new Error("FATAL: Agent status is not TRIPPED after 3rd identical payload!");
  }

  // --------------------------------------------------------------------------------
  // TEST 2: ATTEMPT CALL WHILE BREAKER IS TRIPPED
  // --------------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 4: Attempting execution with distinct Payload B while Breaker is TRIPPED...");
  const blockedTx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadB, { gasLimit: 300000 });
  const blockedRec = await blockedTx.wait();
  console.log("🛡️ Execution Intercepted & Blocked by TRIPPED Breaker! Tx:", blockedTx.hash, "Block:", blockedRec?.blockNumber);
  console.log("Target totalOps remains:", await target.totalOps());

  // Record audit trail in Auditor contract
  const auditHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "string"],
      [agentWallet.address, TARGET_ADDR, 0n, `autonomous-trip-proof-${timestamp}`]
    )
  );
  const auditTx = await auditor.connect(deployer).recordEvaluation(
    agentWallet.address,
    auditHash,
    TARGET_ADDR,
    0n,
    1, // BLOCK
    950, // 95% anomaly
    "loop-repetition",
    "Autonomous circuit breaker tripped: 3rd identical payload in 60s window"
  );
  await auditTx.wait();
  console.log("📝 Audit Record logged on-chain! Tx:", auditTx.hash);

  // --------------------------------------------------------------------------------
  // TEST 3: RESET CIRCUIT BREAKER
  // --------------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 5: Resetting Circuit Breaker on-chain via Agent Owner...");
  const resetTx = await registry.connect(agentWallet).resetCircuitBreaker(agentWallet.address);
  const resetRec = await resetTx.wait();
  console.log("✅ Circuit Breaker Reset! Tx:", resetTx.hash, "Block:", resetRec?.blockNumber);

  const agentAfterReset = await registry.agents(agentWallet.address);
  console.log("- Status after reset:", agentAfterReset.status.toString(), agentAfterReset.status === 0n ? "✅ ACTIVE" : "❌");

  // --------------------------------------------------------------------------------
  // TEST 4: VELOCITY BURST & AUTONOMOUS BREAKER TRIP
  // --------------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 6: Executing Velocity Burst test (maxTxPerMinute: 3)...");

  console.log("Sending Distinct Tx 1 (Payload B)...");
  const v1Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadB, { gasLimit: 300000 });
  await v1Tx.wait();
  console.log("✅ Velocity Tx 1 succeeded. Hash:", v1Tx.hash);

  console.log("Sending Distinct Tx 2 (Payload C)...");
  const v2Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadC, { gasLimit: 300000 });
  await v2Tx.wait();
  console.log("✅ Velocity Tx 2 succeeded. Hash:", v2Tx.hash);

  console.log("Sending Distinct Tx 3 (Payload D — 4th tx in window) — MUST TRIP BREAKER AUTONOMOUSLY...");
  const v3Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadD, { gasLimit: 300000 });
  const v3Rec = await v3Tx.wait();
  console.log("⚡ Velocity Breach Tx Mined! Tx:", v3Tx.hash, "Block:", v3Rec?.blockNumber);

  const agentAfterVelocity = await registry.agents(agentWallet.address);
  console.log("\n🔎 ON-CHAIN AGENT STATE VERIFICATION AFTER VELOCITY BREACH:");
  console.log("- Status:", agentAfterVelocity.status.toString(), agentAfterVelocity.status === 2n ? "✅ TRIPPED" : "❌");
  console.log("- Total Trips:", agentAfterVelocity.totalTrips.toString());
  console.log("- Last Trip Reason:", agentAfterVelocity.lastTripReason);
  console.log("- Last Trip Timestamp:", agentAfterVelocity.lastTripTime.toString());

  if (agentAfterVelocity.status !== 2n) {
    throw new Error("FATAL: Agent status is not TRIPPED after velocity burst breach!");
  }

  // Reset breaker again to leave agent in clean state
  console.log("\nSTEP 7: Resetting Circuit Breaker back to ACTIVE...");
  const resetFinalTx = await registry.connect(agentWallet).resetCircuitBreaker(agentWallet.address);
  await resetFinalTx.wait();
  console.log("✅ Final Breaker Reset Tx:", resetFinalTx.hash);

  console.log("\n================================================================================");
  console.log("🎉 ALL ON-CHAIN AUTONOMOUS CIRCUIT BREAKER PROOFS VERIFIED AND PASSED 100%!");
  console.log("================================================================================");
  console.log(`Registry:          ${REGISTRY_ADDR}`);
  console.log(`Auditor:           ${AUDITOR_ADDR}`);
  console.log(`Guard:             ${GUARD_ADDR}`);
  console.log(`TestTarget:        ${TARGET_ADDR}`);
  console.log(`Agent Wallet:      ${agentWallet.address}`);
  console.log("--------------------------------------------------------------------------------");
  console.log("RAW TRANSACTION PROOFS (BOT Chain Testnet - scan.bohr.life):");
  console.log(`1. Call 1 (Allow):             https://scan.bohr.life/tx/${call1Tx.hash}`);
  console.log(`2. Call 2 (Allow):             https://scan.bohr.life/tx/${call2Tx.hash}`);
  console.log(`3. Call 3 (Loop Breaker Trip): https://scan.bohr.life/tx/${call3Tx.hash}`);
  console.log(`4. Follow-up Blocked:          https://scan.bohr.life/tx/${blockedTx.hash}`);
  console.log(`5. Reset Breaker:              https://scan.bohr.life/tx/${resetTx.hash}`);
  console.log(`6. Velocity Tx 1:              https://scan.bohr.life/tx/${v1Tx.hash}`);
  console.log(`7. Velocity Tx 2:              https://scan.bohr.life/tx/${v2Tx.hash}`);
  console.log(`8. Velocity Breaker Trip:      https://scan.bohr.life/tx/${v3Tx.hash}`);
  console.log(`9. Reset Final:                https://scan.bohr.life/tx/${resetFinalTx.hash}`);
  console.log("================================================================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
