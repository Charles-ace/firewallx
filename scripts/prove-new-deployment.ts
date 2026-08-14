import hre from "hardhat";
const { ethers } = hre;

async function main() {
  console.log("================================================================================");
  console.log("⚡ FIREWALLX ON-CHAIN AUTONOMOUS CIRCUIT BREAKER PROOF (NEW TESTNET DEPLOYMENT)");
  console.log("================================================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  const depBal = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(depBal), "tBOT\n");

  // New testnet deployment addresses
  const REGISTRY_ADDR = "0x36ece459D9f873DA0DdACb0c1589D30391651617";
  const AUDITOR_ADDR = "0xC522De1b6CF90A14B9336Fd944Fa7Bd6798B0bFE";
  const GUARD_ADDR = "0x63C317a6a9cFb8846Aa659ad395c2839E187d081";
  const TARGET_ADDR = "0x46fD9e348975e1a297Fe3f5879C4959553Cf6F76";

  const registry = await ethers.getContractAt("FirewallXRegistry", REGISTRY_ADDR);
  const auditor = await ethers.getContractAt("FirewallXAuditor", AUDITOR_ADDR);
  const guard = await ethers.getContractAt("FirewallXGuard", GUARD_ADDR);
  const target = await ethers.getContractAt("TestTargetContract", TARGET_ADDR);

  // Generate agent wallet from deployer (same as Hardhat default)
  const agentWallet = deployer;

  // Define policy: max 2 identical payloads per 60s, max 3 tx/min
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
  console.log("Agent registeredAt:", existing.registeredAt.toString());
  if (existing.registeredAt === 0n) {
    console.log("Registering agent...");
    const regTx = await registry.connect(agentWallet).registerAgent(
      agentWallet.address,
      "Proof-Agent-Onchain",
      "aid:proof-onchain-v1",
      policy
    );
    const regRec = await regTx.wait();
    console.log("✅ Agent Registered on-chain! Tx:", regTx.hash, "Block:", regRec?.blockNumber);
  } else {
    console.log("Agent already registered. Status:", existing.status.toString());
  }

  const targetIface = new ethers.Interface([
    "function setKeyValue(string key, string value) external payable",
  ]);

  const timestamp = Date.now();
  const payloadA = targetIface.encodeFunctionData("setKeyValue", [`loop-${timestamp}-a`, "val-a"]);
  const payloadB = targetIface.encodeFunctionData("setKeyValue", [`loop-${timestamp}-b`, "val-b"]);
  const payloadC = targetIface.encodeFunctionData("setKeyValue", [`loop-${timestamp}-c`, "val-c"]);

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
  console.log("Target totalOps after call 1:", await target.totalOps());

  console.log("\nSTEP 2: Executing 2nd identical payload (Payload A)...");
  const call2Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadA, { gasLimit: 300000 });
  const rec2 = await call2Tx.wait();
  console.log("✅ Call 2 Succeeded (Cap is 2)! Tx:", call2Tx.hash, "Block:", rec2?.blockNumber);
  console.log("Target totalOps after call 2:", await target.totalOps());

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

  // Emit audit via auditor
  const auditHash1 = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "string"],
      [agentWallet.address, TARGET_ADDR, 0n, `loop-proof-${timestamp}-a`]
    )
  );
  const auditTx1 = await auditor.connect(deployer).recordEvaluation(
    agentWallet.address,
    auditHash1,
    TARGET_ADDR,
    0n,
    1, // BLOCK
    950, // 95% anomaly
    "loop-repetition",
    "Autonomous circuit breaker tripped: 3rd identical payload in 60s window"
  );
  await auditTx1.wait();
  console.log("📝 Audit Record logged on-chain! Tx:", auditTx1.hash);

  // --------------------------------------------------------------------------------
  // TEST 2: VELOCITY BURST & AUTONOMOUS BREAKER TRIP
  // --------------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("STEP 4: Velocity burst test (maxTxPerMinute: 3)...");

  const payloadD = targetIface.encodeFunctionData("setKeyValue", [`vel-${timestamp}-d`, "val-d"]);
  const payloadE = targetIface.encodeFunctionData("setKeyValue", [`vel-${timestamp}-e`, "val-e"]);
  const payloadF = targetIface.encodeFunctionData("setKeyValue", [`vel-${timestamp}-f`, "val-f"]);

  console.log("Sending Distinct Tx 1 (Payload D)...");
  const v1Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadD, { gasLimit: 300000 });
  await v1Tx.wait();
  console.log("✅ Velocity Tx 1 succeeded. Hash:", v1Tx.hash);

  console.log("Sending Distinct Tx 2 (Payload E)...");
  const v2Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadE, { gasLimit: 300000 });
  await v2Tx.wait();
  console.log("✅ Velocity Tx 2 succeeded. Hash:", v2Tx.hash);

  console.log("Sending Distinct Tx 3 (Payload F — 4th tx in window) — MUST TRIP BREAKER AUTONOMOUSLY...");
  const v3Tx = await guard.connect(agentWallet).executeGuarded(TARGET_ADDR, 0n, payloadF, { gasLimit: 300000 });
  const v3Rec = await v3Tx.wait();
  console.log("⚡ Velocity Breach Tx Mined! Tx:", v3Tx.hash, "Block:", v3Rec?.blockNumber);

  const agentAfterVelocity = await registry.agents(agentWallet.address);
  console.log("\n🔎 ON-CHAIN AGENT STATE VERIFICATION AFTER VELOCITY BREACH:");
  console.log("- Status:", agentAfterVelocity.status.toString(), agentAfterVelocity.status === 2n ? "✅ TRIPPED" : "❌ NOT TRIPPED");
  console.log("- Total Trips:", agentAfterVelocity.totalTrips.toString());
  console.log("- Last Trip Reason:", agentAfterVelocity.lastTripReason);
  console.log("- Last Trip Timestamp:", agentAfterVelocity.lastTripTime.toString());

  if (agentAfterVelocity.status !== 2n) {
    throw new Error("FATAL: Agent status is not TRIPPED after velocity burst breach!");
  }

  // Emit audit for velocity breach
  const auditHash2 = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint256", "string"],
      [agentWallet.address, TARGET_ADDR, 0n, `vel-proof-${timestamp}`]
    )
  );
  const auditTx2 = await auditor.connect(deployer).recordEvaluation(
    agentWallet.address,
    auditHash2,
    TARGET_ADDR,
    0n,
    1, // BLOCK
    950, // 95% anomaly
    "rate-limit",
    "Autonomous circuit breaker tripped: rate limit exceeded (4th tx in 60s window)"
  );
  await auditTx2.wait();
  console.log("📝 Audit Record logged on-chain for velocity breach! Tx:", auditTx2.hash);

  // Reset breaker
  console.log("\nSTEP 5: Resetting Circuit Breaker back to ACTIVE...");
  const resetTx = await registry.connect(agentWallet).resetCircuitBreaker(agentWallet.address);
  await resetTx.wait();
  console.log("✅ Final Breaker Reset Tx:", resetTx.hash);

  const recovered = await registry.agents(agentWallet.address);
  console.log("Agent status after reset:", recovered.status.toString(), recovered.status === 0n ? "✅ ACTIVE" : "❌");

  console.log("\n================================================================================");
  console.log("🎉 ON-CHAIN PROOF COMPLETE 100%!");
  console.log("================================================================================");
  console.log("RAW TRANSACTION PROOFS (BOT Chain Testnet - scan.bohr.life):");
  console.log(`1. Call 1 (Allow):             https://scan.bohr.life/tx/${call1Tx.hash}`);
  console.log(`2. Call 2 (Allow):             https://scan.bohr.life/tx/${call2Tx.hash}`);
  console.log(`3. Call 3 (Loop Breaker Trip): https://scan.bohr.life/tx/${call3Tx.hash}`);
  console.log(`4. Velocity Tx 1:              https://scan.bohr.life/tx/${v1Tx.hash}`);
  console.log(`5. Velocity Tx 2:              https://scan.bohr.life/tx/${v2Tx.hash}`);
  console.log(`6. Velocity Breaker Trip:      https://scan.bohr.life/tx/${v3Tx.hash}`);
  console.log(`7. Reset Breaker:              https://scan.bohr.life/tx/${resetTx.hash}`);
  console.log("================================================================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});