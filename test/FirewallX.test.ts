import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

describe("FirewallX System Tests", function () {
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

  describe("Circuit Breaker Tripping and Resetting", function () {
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

    it("should allow sentinel to trip circuit breaker on runaway loop detection", async function () {
      const payloadHash = ethers.keccak256(ethers.toUtf8Bytes("setKeyValue('loopKey', 'loopVal')"));
      
      await expect(
        registry.connect(owner).tripCircuitBreaker(
          agentWallet.address,
          "Identical payload repetition limit exceeded (Loop Detected)",
          payloadHash
        )
      ).to.emit(registry, "CircuitBreakerTripped");

      const agentInfo = await registry.agents(agentWallet.address);
      expect(agentInfo.status).to.equal(2); // TRIPPED
      expect(agentInfo.lastTripReason).to.equal("Identical payload repetition limit exceeded (Loop Detected)");

      const [permitted, reason] = await registry.isActionPermitted(agentWallet.address, await targetContract.getAddress(), 0);
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

      const [permitted] = await registry.isActionPermitted(agentWallet.address, await targetContract.getAddress(), 0);
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

  describe("FirewallXGuard Execution Interception", function () {
    it("should permit execution when agent is ACTIVE and revert when TRIPPED", async function () {
      const policy = {
        maxSpendPerTx: ethers.parseEther("1.0"),
        maxHourlySpend: ethers.parseEther("5.0"),
        maxTxPerMinute: 10,
        loopWindowSeconds: 60,
        maxIdenticalPayloads: 3,
        anomalyThreshold: 750,
        enforceAllowlist: false,
      };

      await registry.connect(agentOwner).registerAgent(agentWallet.address, "Agent-Alpha", "aidid:001", policy);

      const targetAddr = await targetContract.getAddress();
      const data = targetContract.interface.encodeFunctionData("setKeyValue", ["testKey", "testVal"]);

      // Execute via Guard as agentWallet
      await guard.connect(agentWallet).executeGuarded(targetAddr, 0, data);
      expect(await targetContract.kvStore("testKey")).to.equal("testVal");

      // Trip the breaker
      const payloadHash = ethers.keccak256(data);
      await registry.connect(owner).tripCircuitBreaker(agentWallet.address, "Loop Breaker Triggered", payloadHash);

      // Now execution must revert
      await expect(
        guard.connect(agentWallet).executeGuarded(targetAddr, 0, data)
      ).to.be.revertedWithCustomError(guard, "ExecutionBlocked");
    });
  });
});
