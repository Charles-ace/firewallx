// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title FirewallXRegistry
 * @notice Central registry for AI Agent security policies, state monitor, and autonomous circuit breaker.
 * @dev Deployed on BOT Chain (Testnet: 968, Mainnet: 677).
 * @author Ace (webski101 / @charlesace)
 */
contract FirewallXRegistry {
    enum CircuitStatus {
        ACTIVE,   // Normal operation
        WARNING,  // Elevated risk, monitored
        TRIPPED,  // Breaker tripped, transactions blocked
        PAUSED    // Manually paused by owner
    }

    struct SecurityPolicy {
        uint256 maxSpendPerTx;       // Max wei per single tx
        uint256 maxHourlySpend;      // Max wei per rolling hour
        uint32 maxTxPerMinute;       // Velocity cap (txs / min)
        uint32 loopWindowSeconds;    // Sliding window for identical calls
        uint32 maxIdenticalPayloads; // Max identical payloads before loop trigger
        uint16 anomalyThreshold;     // Score out of 1000 (e.g. 750 = 75%)
        bool enforceAllowlist;       // If true, only allowlisted targets permitted
    }

    struct AgentInfo {
        address owner;
        string name;
        string aidid;                // BOT Chain AIDID or identity URI
        CircuitStatus status;
        uint256 registeredAt;
        uint256 lastTripTime;
        string lastTripReason;
        bytes32 lastTripPayloadHash;
        uint256 totalActionsEvaluated;
        uint256 totalBlocks;
        uint256 totalTrips;
    }

    /// @dev Rolling window of per-agent transaction timestamps for velocity enforcement.
    ///      Ring buffer capacity 64 — maxTxPerMinute values >= 64 are not velocity-enforced.
    struct VelocityState {
        uint32[64] timestamps;
        uint8 start;
        uint8 count;
    }

    /// @dev Per-fingerprint repetition state for identical-payload (loop) enforcement.
    ///      One storage slot per distinct (agent, fingerprint) pair within the window.
    struct RepetitionState {
        uint32 firstTs;
        uint16 count;
    }

    // Agent Wallet -> Agent Info
    mapping(address => AgentInfo) public agents;
    // Agent Wallet -> Security Policy
    mapping(address => SecurityPolicy) public policies;
    // Agent Wallet -> Target Address -> Whitelisted?
    mapping(address => mapping(address => bool)) public allowlist;
    // Agent Wallet -> Target Address -> Blacklisted?
    mapping(address => mapping(address => bool)) public blocklist;
    // Registered Sentinel / Engine operators authorized to trigger circuit trips
    mapping(address => bool) public isSentinel;
    // All registered agent addresses list
    address[] public registeredAgents;

    // Agent Wallet -> rolling tx-timestamp ring buffer (velocity enforcement)
    mapping(address => VelocityState) private velocityWindow;
    // Agent Wallet -> fingerprint -> first-ts / count (identical-payload loop enforcement)
    mapping(address => mapping(bytes32 => RepetitionState)) private repetitionWindow;

    address public owner;

    // Events
    event AgentRegistered(address indexed agentWallet, address indexed owner, string name, string aidid, uint256 timestamp);
    event PolicyUpdated(address indexed agentWallet, uint256 maxSpendPerTx, uint256 maxHourlySpend, uint32 maxTxPerMinute, uint16 anomalyThreshold);
    event CircuitBreakerTripped(address indexed agentWallet, address indexed triggeredBy, string reason, bytes32 indexed payloadHash, uint256 timestamp);
    event CircuitBreakerReset(address indexed agentWallet, address indexed resetBy, uint256 timestamp);
    event AgentStatusChanged(address indexed agentWallet, CircuitStatus oldStatus, CircuitStatus newStatus, uint256 timestamp);
    event AllowlistUpdated(address indexed agentWallet, address indexed target, bool allowed);
    event BlocklistUpdated(address indexed agentWallet, address indexed target, bool blocked);
    event SentinelUpdated(address indexed sentinel, bool active);

    error NotAuthorized();
    error AgentAlreadyRegistered();
    error AgentNotFound();
    error CircuitAlreadyTripped();
    error CircuitNotTripped();
    error TargetBlocked();
    error TargetNotAllowed();
    error SpendCapExceeded();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyAgentOwner(address agentWallet) {
        if (agents[agentWallet].owner != msg.sender && msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlySentinelOrOwner(address agentWallet) {
        if (!isSentinel[msg.sender] && agents[agentWallet].owner != msg.sender && msg.sender != owner) {
            revert NotAuthorized();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
        isSentinel[msg.sender] = true;
    }

    function setSentinel(address sentinel, bool active) external onlyOwner {
        isSentinel[sentinel] = active;
        emit SentinelUpdated(sentinel, active);
    }

    /**
     * @notice Register an AI agent wallet with custom security policy
     */
    function registerAgent(
        address agentWallet,
        string calldata name,
        string calldata aidid,
        SecurityPolicy calldata policy
    ) external {
        if (agents[agentWallet].registeredAt != 0) revert AgentAlreadyRegistered();

        agents[agentWallet] = AgentInfo({
            owner: msg.sender,
            name: name,
            aidid: aidid,
            status: CircuitStatus.ACTIVE,
            registeredAt: block.timestamp,
            lastTripTime: 0,
            lastTripReason: "",
            lastTripPayloadHash: bytes32(0),
            totalActionsEvaluated: 0,
            totalBlocks: 0,
            totalTrips: 0
        });

        policies[agentWallet] = policy;
        registeredAgents.push(agentWallet);

        emit AgentRegistered(agentWallet, msg.sender, name, aidid, block.timestamp);
        emit PolicyUpdated(agentWallet, policy.maxSpendPerTx, policy.maxHourlySpend, policy.maxTxPerMinute, policy.anomalyThreshold);
    }

    /**
     * @notice Update security policy for an agent
     */
    function updatePolicy(address agentWallet, SecurityPolicy calldata newPolicy) external onlyAgentOwner(agentWallet) {
        if (agents[agentWallet].registeredAt == 0) revert AgentNotFound();
        policies[agentWallet] = newPolicy;
        emit PolicyUpdated(agentWallet, newPolicy.maxSpendPerTx, newPolicy.maxHourlySpend, newPolicy.maxTxPerMinute, newPolicy.anomalyThreshold);
    }

    /**
     * @notice Set allowlist status for an agent's destination target
     */
    function setAllowlist(address agentWallet, address target, bool allowed) external onlyAgentOwner(agentWallet) {
        allowlist[agentWallet][target] = allowed;
        emit AllowlistUpdated(agentWallet, target, allowed);
    }

    /**
     * @notice Set blocklist status for an agent's destination target
     */
    function setBlocklist(address agentWallet, address target, bool blocked) external onlyAgentOwner(agentWallet) {
        blocklist[agentWallet][target] = blocked;
        emit BlocklistUpdated(agentWallet, target, blocked);
    }

    /**
     * @notice Internal helper to autonomously trip the circuit breaker and record state
     */
    function _tripCircuitBreakerInternal(
        address agentWallet,
        string memory reason,
        bytes32 triggerPayloadHash
    ) internal {
        AgentInfo storage agent = agents[agentWallet];
        CircuitStatus oldStatus = agent.status;
        agent.status = CircuitStatus.TRIPPED;
        agent.lastTripTime = block.timestamp;
        agent.lastTripReason = reason;
        agent.lastTripPayloadHash = triggerPayloadHash;
        agent.totalTrips += 1;
        agent.totalBlocks += 1;

        emit CircuitBreakerTripped(agentWallet, msg.sender, reason, triggerPayloadHash, block.timestamp);
        emit AgentStatusChanged(agentWallet, oldStatus, CircuitStatus.TRIPPED, block.timestamp);
    }

    /**
     * @notice Manually trip the circuit breaker (sentinel or agent owner)
     */
    function tripCircuitBreaker(
        address agentWallet,
        string calldata reason,
        bytes32 triggerPayloadHash
    ) external onlySentinelOrOwner(agentWallet) {
        AgentInfo storage agent = agents[agentWallet];
        if (agent.registeredAt == 0) revert AgentNotFound();
        if (agent.status == CircuitStatus.TRIPPED) revert CircuitAlreadyTripped();

        _tripCircuitBreakerInternal(agentWallet, reason, triggerPayloadHash);
    }

    /**
     * @notice Reset a tripped circuit breaker back to ACTIVE (agent owner only)
     */
    function resetCircuitBreaker(address agentWallet) external onlyAgentOwner(agentWallet) {
        AgentInfo storage agent = agents[agentWallet];
        if (agent.registeredAt == 0) revert AgentNotFound();
        if (agent.status != CircuitStatus.TRIPPED && agent.status != CircuitStatus.PAUSED) revert CircuitNotTripped();

        CircuitStatus oldStatus = agent.status;
        agent.status = CircuitStatus.ACTIVE;

        emit CircuitBreakerReset(agentWallet, msg.sender, block.timestamp);
        emit AgentStatusChanged(agentWallet, oldStatus, CircuitStatus.ACTIVE, block.timestamp);
    }

    /**
     * @notice Pause an agent manually
     */
    function pauseAgent(address agentWallet) external onlyAgentOwner(agentWallet) {
        AgentInfo storage agent = agents[agentWallet];
        if (agent.registeredAt == 0) revert AgentNotFound();
        CircuitStatus oldStatus = agent.status;
        agent.status = CircuitStatus.PAUSED;
        emit AgentStatusChanged(agentWallet, oldStatus, CircuitStatus.PAUSED, block.timestamp);
    }

    /**
     * @notice Resume a paused agent
     */
    function resumeAgent(address agentWallet) external onlyAgentOwner(agentWallet) {
        AgentInfo storage agent = agents[agentWallet];
        if (agent.registeredAt == 0) revert AgentNotFound();
        CircuitStatus oldStatus = agent.status;
        agent.status = CircuitStatus.ACTIVE;
        emit AgentStatusChanged(agentWallet, oldStatus, CircuitStatus.ACTIVE, block.timestamp);
    }

    /**
     * @notice Check whether an agent transaction is permitted under current circuit status & policy.
     * @dev Stateful: records velocity & repetition-window entries for permitted calls.
     *      Autonomously trips the circuit breaker on-chain if velocity or loop limits are breached.
     *      `calldataHash` is the keccak256 fingerprint of (target, value, data).
     */
    function isActionPermitted(
        address agentWallet,
        address target,
        uint256 value,
        bytes32 calldataHash
    ) external returns (bool permitted, string memory reason) {
        AgentInfo storage agent = agents[agentWallet];
        if (agent.registeredAt == 0) {
            return (false, "Agent not registered");
        }
        if (agent.status == CircuitStatus.TRIPPED) {
            return (false, "Circuit Breaker TRIPPED");
        }
        if (agent.status == CircuitStatus.PAUSED) {
            return (false, "Agent PAUSED by owner");
        }

        SecurityPolicy memory policy = policies[agentWallet];
        if (blocklist[agentWallet][target]) {
            agent.totalBlocks += 1;
            return (false, "Target in blocklist");
        }
        if (policy.enforceAllowlist && !allowlist[agentWallet][target]) {
            agent.totalBlocks += 1;
            return (false, "Target not in allowlist");
        }
        if (policy.maxSpendPerTx > 0 && value > policy.maxSpendPerTx) {
            agent.totalBlocks += 1;
            return (false, "Spend cap exceeded");
        }

        // Velocity: rolling 60s tx-count window (maxTxPerMinute)
        if (policy.maxTxPerMinute > 0 && policy.maxTxPerMinute < 64) {
            (bool ok, string memory rateReason) = _recordVelocity(agentWallet, policy.maxTxPerMinute, calldataHash);
            if (!ok) {
                return (false, rateReason);
            }
        }

        // Loop: identical-payload count within loopWindowSeconds
        if (policy.maxIdenticalPayloads > 0 && policy.loopWindowSeconds > 0) {
            (bool ok, string memory loopReason) = _recordRepetition(agentWallet, calldataHash, policy);
            if (!ok) {
                return (false, loopReason);
            }
        }

        agent.totalActionsEvaluated += 1;
        return (true, "OK");
    }

    /**
     * @notice View-only preflight mirror of isActionPermitted — no state recorded, no trips triggered.
     */
    function isActionPermittedView(
        address agentWallet,
        address target,
        uint256 value,
        bytes32 calldataHash
    ) external view returns (bool permitted, string memory reason) {
        AgentInfo memory agent = agents[agentWallet];
        if (agent.registeredAt == 0) {
            return (false, "Agent not registered");
        }
        if (agent.status == CircuitStatus.TRIPPED) {
            return (false, "Circuit Breaker TRIPPED");
        }
        if (agent.status == CircuitStatus.PAUSED) {
            return (false, "Agent PAUSED by owner");
        }

        SecurityPolicy memory policy = policies[agentWallet];
        if (blocklist[agentWallet][target]) {
            return (false, "Target in blocklist");
        }
        if (policy.enforceAllowlist && !allowlist[agentWallet][target]) {
            return (false, "Target not in allowlist");
        }
        if (policy.maxSpendPerTx > 0 && value > policy.maxSpendPerTx) {
            return (false, "Spend cap exceeded");
        }
        if (policy.maxTxPerMinute > 0 && policy.maxTxPerMinute < 64) {
            VelocityState storage vs = velocityWindow[agentWallet];
            uint256 threshold = block.timestamp > 60 ? block.timestamp - 60 : 0;
            uint256 active = 0;
            for (uint8 i = 0; i < vs.count; i++) {
                if (vs.timestamps[(vs.start + i) % 64] >= threshold) {
                    active++;
                }
            }
            if (active >= policy.maxTxPerMinute) {
                return (false, "Rate limit exceeded");
            }
        }
        if (policy.maxIdenticalPayloads > 0 && policy.loopWindowSeconds > 0) {
            RepetitionState storage rep = repetitionWindow[agentWallet][calldataHash];
            if (rep.firstTs != 0 && block.timestamp <= uint256(rep.firstTs) + policy.loopWindowSeconds) {
                if (rep.count >= policy.maxIdenticalPayloads) {
                    return (false, "Repetitive loop detected");
                }
            }
        }
        return (true, "OK");
    }

    function _recordVelocity(
        address agentWallet,
        uint32 maxPerMinute,
        bytes32 calldataHash
    ) private returns (bool, string memory) {
        VelocityState storage vs = velocityWindow[agentWallet];
        uint256 threshold = block.timestamp > 60 ? block.timestamp - 60 : 0;
        uint8 cnt = vs.count;
        uint8 s = vs.start;
        uint256 active = 0;

        for (uint8 i = 0; i < cnt; i++) {
            if (vs.timestamps[(s + i) % 64] >= threshold) {
                active++;
            }
        }

        if (active >= maxPerMinute) {
            _tripCircuitBreakerInternal(agentWallet, "Rate limit exceeded", calldataHash);
            return (false, "Rate limit exceeded");
        }

        if (cnt < 64) {
            vs.timestamps[(s + cnt) % 64] = uint32(block.timestamp);
            vs.count = cnt + 1;
        } else {
            vs.timestamps[s] = uint32(block.timestamp);
            vs.start = (s + 1) % 64;
        }
        return (true, "OK");
    }

    function _recordRepetition(
        address agentWallet,
        bytes32 calldataHash,
        SecurityPolicy memory policy
    ) private returns (bool, string memory) {
        RepetitionState storage rep = repetitionWindow[agentWallet][calldataHash];
        if (rep.firstTs == 0 || block.timestamp > uint256(rep.firstTs) + policy.loopWindowSeconds) {
            rep.firstTs = uint32(block.timestamp);
            rep.count = 1;
            return (true, "OK");
        } else {
            if (rep.count >= policy.maxIdenticalPayloads) {
                _tripCircuitBreakerInternal(agentWallet, "Repetitive loop detected", calldataHash);
                return (false, "Repetitive loop detected");
            }
            rep.count += 1;
            return (true, "OK");
        }
    }

    /**
     * @notice Get total number of registered agents
     */
    function getAgentCount() external view returns (uint256) {
        return registeredAgents.length;
    }

    /**
     * @notice Get list of all registered agent addresses
     */
    function getAllAgents() external view returns (address[] memory) {
        return registeredAgents;
    }
}
