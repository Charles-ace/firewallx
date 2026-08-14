import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("FirewallX Protocol & Autonomous Circuit Breaker Tests", function () {
  let registry: any;
  let auditor: any;
  let guard: any;
  let targetContract: any;
  let owner: any;
  let agentOwner: any;
  let agentWallet: any;
  let rogueAgent: any;
  let user: any;

  beforeEach(async function () {
    [owner, agentOwner, agentWallet, rogueAgent, user] = await ethers.getSigners();

    // Deploy Registry
    const RegistryFactory = await ethers.getContractFactory("FirewallXRegistry");
    registry = await RegistryFactory.deploy();
    await registry.waitForDeployment();

    // Deploy Auditor
    const AuditorFactory = await ethers.getContractFactory("FirewallXAuditor");
    auditor = await AuditorFactory.deploy(await registry.getAddress());
    await auditor.waitForDeployment();

    // Deploy Guard
    const GuardFactory = await ethers.getContractFactory("FirewallXGuard");
    guard = await GuardFactory.deploy(await registry.getAddress(), await auditor.getAddress());
    await guard.waitForDeployment();

    // Deploy TestTargetContract
    const TargetFactory = await ethers.getContractFactory("TestTargetContract");
    targetContract = await TargetFactory.deploy();
    await targetContract.waitForDeployment();
  });

  describe("Agent Registration & Policy", function () {
    it("should register an agent with customized security policy", async function () {
      const policy = {
        maxSpendPerTx: ethers.parseEther("0.5"),
        maxHourlySpend: ethers.parseEther("2.0"),
        maxTxPerMinute: 10,
        loopWindowSeconds: 60,
        maxIdenticalPayloads: 3,
        anomalyThreshold: 750,
        enforceAllowlist: true,
      };

      await registry.connect(agentOwner).registerAgent(
        agentWallet.address,
        "Agent-Alpha",
        "aidid:botchain:agent-alpha-001",
        policy
      );

      const agentInfo = await registry.agents(agentWallet.address);
      expect(agentInfo.owner).to.equal(agentOwner.address);
      expect(agentInfo.name).to.equal("Agent-Alpha");
      expect(agentInfo.status).to.equal(0); // ACTIVE

      const registeredPolicy = await registry.policies(agentWallet.address);
      expect(registeredPolicy.maxSpendPerTx).to.equal(ethers.parseEther("0.5"));
      expect(registeredPolicy.maxTxPerMinute).to.equal(10);
    });

    it("should reject duplicate registration", async function () {
      const policy = {
        maxSpendPerTx: ethers.parseEther("1"),
        maxHourlySpend: ethers.parseEther("5"),
        maxTxPerMinute: 10,
        loopWindowSeconds: 60,
        maxIdenticalPayloads: 3,
        anomalyThreshold: 750,
        enforceAllowlist: false,
      };

      await registry.connect(agentOwner).registerAgent(agentWallet.address, "Agent-Alpha", "aidid:001", policy);

      await expect(
        registry.connect(agentOwner).registerAgent(agentWallet.address, "Agent-Alpha", "aidid:001", policy)
      ).to.be.revertedWithCustomError(registry, "AgentAlreadyRegistered");
    });
  });

  describe("Circuit Breaker Manual Control", function () {
    beforeEach(async function () {
      const policy = {
        maxSpendPerTx: ethers.parseEther("0.5"),
        maxHourlySpend: ethers.parseEther("2.0"),
        maxTxPerMinute: 10,
        loopWindowSeconds: 60,
        maxIdenticalPayloads: 3,
        anomalyThreshold: 750,
        enforceAllowlist: false,
      };

      await registry.connect(agentOwner).registerAgent(agentWallet.address, "Agent-Alpha", "aidid:001", policy);
    });

    it("should allow sentinel to manually trip circuit breaker", async function () {
      const payloadHash = ethers.keccak256(ethers.toUtf8Bytes("setKeyValue('loopKey', 'loopVal')"));

      await expect(
        registry.connect(owner).tripCircuitBreaker(
          agentWallet.address,
          "Manual sentinel intervention",
          payloadHash
        )
      ).to.emit(registry, "CircuitBreakerTripped");

      const agentInfo = await registry.agents(agentWallet.address);
      expect(agentInfo.status).to.equal(2); // TRIPPED
      expect(agentInfo.lastTripReason).to.equal("Manual sentinel intervention");

      const [permitted, reason] = await registry.isActionPermittedView(
        agentWallet.address,
        await targetContract.getAddress(),
        0,
        ethers.ZeroHash
      );
      expect(permitted).to.equal(false);
      expect(reason).to.equal("Circuit Breaker TRIPPED");
    });

    it("should allow only agent owner to reset the circuit breaker", async function () {
      const payloadHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      await registry.connect(owner).tripCircuitBreaker(agentWallet.address, "Anomaly threshold exceeded", payloadHash);

      // Unauthorized user cannot reset
      await expect(
        registry.connect(user).resetCircuitBreaker(agentWallet.address)
      ).to.be.revertedWithCustomError(registry, "NotAuthorized");

      // Agent owner resets
      await expect(
        registry.connect(agentOwner).resetCircuitBreaker(agentWallet.address)
      ).to.emit(registry, "CircuitBreakerReset");

      const agentInfo = await registry.agents(agentWallet.address);
      expect(agentInfo.status).to.equal(0); // ACTIVE

      const [permitted] = await registry.isActionPermittedView(
        agentWallet.address,
        await targetContract.getAddress(),
        0,
        ethers.ZeroHash
      );
      expect(permitted).to.equal(true);
    });
  });

  describe("FirewallXAuditor Immutable Telemetry", function () {
    it("should log pre-execution evaluations and update audit statistics", async function () {
      const actionHash = ethers.keccak256(ethers.toUtf8Bytes("action-001"));

      await auditor.connect(owner).recordEvaluation(
        agentWallet.address,
        actionHash,
        await targetContract.getAddress(),
        ethers.parseEther("0.1"),
        0, // ALLOW
        120, // 12% anomaly
        "None",
        "Action verified within standard behavioral baseline"
      );

      const totalAudits = await auditor.getAuditCount();
      expect(totalAudits).to.equal(1);
      expect(await auditor.totalAllowed()).to.equal(1);

      const recent = await auditor.getRecentAudits(0, 10);
      expect(recent.length).to.equal(1);
      expect(recent[0].agentWallet).to.equal(agentWallet.address);
      expect(recent[0].verdict).to.equal(0); // ALLOW
    });
  });

  describe("Autonomous Circuit Breaker Tripping (On-Chain Loop & Velocity)", function () {
    const makeData = (key: string, val: string) =>
      targetContract.interface.encodeFunctionData("setKeyValue", [key, val]);

    it("should autonomously trip the circuit breaker on identical-payload loop breach", async function () {
      const loopPolicy = {
        maxSpendPerTx: ethers.parseEther("1.0"),
        maxHourlySpend: ethers.parseEther("5.0"),
        maxTxPerMinute: 10,
        loopWindowSeconds: 60,
        maxIdenticalPayloads: 2,
        anomalyThreshold: 750,
        enforceAllowlist: false,
      };

      await registry.connect(agentOwner).registerAgent(
        agentWallet.address,
        "LoopAgent",
        "aid:loop-01",
        loopPolicy
      );

      const targetAddr = await targetContract.getAddress();
      const data = makeData("loopKey", "loopVal");

      // 1st call: permitted -> executes on target
      const tx1 = await guard.connect(agentWallet).executeGuarded(targetAddr, 0, data);
      await expect(tx1).to.emit(guard, "GuardedExecution");
      expect(await targetContract.kvStore("loopKey")).to.equal("loopVal");
      expect(await targetContract.totalOps()).to.equal(1n);

      // 2nd call: permitted (cap is 2) -> executes on target
      const tx2 = await guard.connect(agentWallet).executeGuarded(targetAddr, 0, data);
      await expect(tx2).to.emit(guard, "GuardedExecution");
      expect(await targetContract.totalOps()).to.equal(2n);

      // 3rd identical call: AUTONOMOUS BREAKER TRIP on-chain!
      const tx3 = await guard.connect(agentWallet).executeGuarded(targetAddr, 0, data);
      await expect(tx3)
        .to.emit(registry, "CircuitBreakerTripped")
        .withArgs(
          agentWallet.address,
          await guard.getAddress(),
          "Repetitive loop detected",
          ethers.keccak256(ethers.solidityPacked(["address", "uint256", "bytes"], [targetAddr, 0, data])),
          (ts: any) => ts > 0
        );
      await expect(tx3).to.emit(guard, "GuardedExecutionBlocked");

      // Target was NOT called on the 3rd attempt
      expect(await targetContract.totalOps()).to.equal(2n);

      // Agent is now TRIPPED on-chain
      const agentInfo = await registry.agents(agentWallet.address);
      expect(agentInfo.status).to.equal(2); // TRIPPED
      expect(agentInfo.totalTrips).to.equal(1n);
      expect(agentInfo.lastTripReason).to.equal("Repetitive loop detected");

      // 4th call: blocked immediately because status is TRIPPED
      const diffData = makeData("otherKey", "otherVal");
      const tx4 = await guard.connect(agentWallet).executeGuarded(targetAddr, 0, diffData);
      await expect(tx4).to.emit(guard, "GuardedExecutionBlocked");
      expect(await targetContract.totalOps()).to.equal(2n);

      // Reset breaker by owner
      await registry.connect(agentOwner).resetCircuitBreaker(agentWallet.address);
      const afterReset = await registry.agents(agentWallet.address);
      expect(afterReset.status).to.equal(0); // ACTIVE

      // Fast forward past loopWindowSeconds (60s)
      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine", []);

      // Now the same payload can execute again
      const tx5 = await guard.connect(agentWallet).executeGuarded(targetAddr, 0, data);
      await expect(tx5).to.emit(guard, "GuardedExecution");
      expect(await targetContract.totalOps()).to.equal(3n);
    });

    it("should autonomously trip the circuit breaker on velocity burst breach", async function () {
      const velocityPolicy = {
        maxSpendPerTx: ethers.parseEther("1.0"),
        maxHourlySpend: ethers.parseEther("5.0"),
        maxTxPerMinute: 2,
        loopWindowSeconds: 60,
        maxIdenticalPayloads: 0, // disable loop check
        anomalyThreshold: 750,
        enforceAllowlist: false,
      };

      await registry.connect(agentOwner).registerAgent(
        agentWallet.address,
        "VelocityAgent",
        "aid:vel-01",
        velocityPolicy
      );

      const targetAddr = await targetContract.getAddress();

      // 1st distinct call: permitted
      await guard.connect(agentWallet).executeGuarded(targetAddr, 0, makeData("k1", "v1"));
      expect(await targetContract.totalOps()).to.equal(1n);

      // 2nd distinct call: permitted (cap is 2/min)
      await guard.connect(agentWallet).executeGuarded(targetAddr, 0, makeData("k2", "v2"));
      expect(await targetContract.totalOps()).to.equal(2n);

      // 3rd distinct call within the same minute: AUTONOMOUS BREAKER TRIP!
      const tx3 = await guard.connect(agentWallet).executeGuarded(targetAddr, 0, makeData("k3", "v3"));
      await expect(tx3)
        .to.emit(registry, "CircuitBreakerTripped")
        .withArgs(
          agentWallet.address,
          await guard.getAddress(),
          "Rate limit exceeded",
          ethers.keccak256(ethers.solidityPacked(["address", "uint256", "bytes"], [targetAddr, 0, makeData("k3", "v3")])),
          (ts: any) => ts > 0
        );

      // Target was NOT called
      expect(await targetContract.totalOps()).to.equal(2n);

      // Agent is now TRIPPED on-chain
      const agentInfo = await registry.agents(agentWallet.address);
      expect(agentInfo.status).to.equal(2); // TRIPPED
      expect(agentInfo.totalTrips).to.equal(1n);
      expect(agentInfo.lastTripReason).to.equal("Rate limit exceeded");

      // Reset breaker
      await registry.connect(agentOwner).resetCircuitBreaker(agentWallet.address);

      // Advance time past 60s
      await hre.network.provider.send("evm_increaseTime", [61]);
      await hre.network.provider.send("evm_mine", []);

      // Now execution is permitted again
      await guard.connect(agentWallet).executeGuarded(targetAddr, 0, makeData("k4", "v4"));
      expect(await targetContract.totalOps()).to.equal(3n);
    });

    it("should enforce spend cap and blocklist via Guard without executing target", async function () {
      const spendPolicy = {
        maxSpendPerTx: ethers.parseEther("0.5"),
        maxHourlySpend: 0n,
        maxTxPerMinute: 10,
        loopWindowSeconds: 60,
        maxIdenticalPayloads: 5,
        anomalyThreshold: 750,
        enforceAllowlist: false,
      };

      await registry.connect(agentOwner).registerAgent(
        agentWallet.address,
        "SpendAgent",
        "aid:spend-01",
        spendPolicy
      );

      const targetAddr = await targetContract.getAddress();

      // Attempt transaction with value exceeding 0.5 ETH
      const tx = await guard.connect(agentWallet).executeGuarded(targetAddr, ethers.parseEther("0.6"), "0x", {
        value: ethers.parseEther("0.6"),
      });
      await expect(tx).to.emit(guard, "GuardedExecutionBlocked");
      expect(await targetContract.totalOps()).to.equal(0n);

      // Set blocklist
      await registry.connect(agentOwner).setBlocklist(agentWallet.address, targetAddr, true);

      // Attempt call to blocklisted target
      const blockTx = await guard.connect(agentWallet).executeGuarded(targetAddr, 0, makeData("test", "val"));
      await expect(blockTx).to.emit(guard, "GuardedExecutionBlocked");
      expect(await targetContract.totalOps()).to.equal(0n);
    });
  });
});
