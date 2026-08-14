// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title FirewallXAuditor
 * @notice Immutable on-chain audit trail of pre-execution firewall verdicts and security telemetry on BOT Chain.
 * @dev Enables public, independent verification of every firewall decision (Verification over Trust).
 * @author Ace (webski101 / @charlesace)
 */
contract FirewallXAuditor {
    enum Verdict {
        ALLOW, // 0 - Passed checks
        BLOCK, // 1 - Violation detected, execution prevented
        FLAG   // 2 - Anomaly threshold warning
    }

    struct AuditRecord {
        address agentWallet;
        bytes32 actionHash;
        address target;
        uint256 value;
        Verdict verdict;
        uint16 anomalyScore; // 0 - 1000
        string ruleTriggered;
        string reasoning;
        uint256 timestamp;
        uint256 blockNumber;
    }

    address public owner;
    address public registry;
    mapping(address => bool) public isAuthorizedReporter;

    // Total audit counters
    uint256 public totalEvaluations;
    uint256 public totalAllowed;
    uint256 public totalBlocked;
    uint256 public totalFlagged;

    // Recent audit records storage
    AuditRecord[] public auditHistory;
    // Agent Wallet -> action hashes
    mapping(address => bytes32[]) public agentActionHashes;
    // Action Hash -> AuditRecord
    mapping(bytes32 => AuditRecord) public recordsByHash;

    event ActionEvaluated(
        address indexed agentWallet,
        bytes32 indexed actionHash,
        address indexed target,
        uint256 value,
        Verdict verdict,
        uint16 anomalyScore,
        string ruleTriggered,
        string reasoning,
        uint256 timestamp
    );

    event ReporterAuthorized(address indexed reporter, bool authorized);

    error NotAuthorized();
    error RecordAlreadyExists();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    modifier onlyReporter() {
        if (!isAuthorizedReporter[msg.sender] && msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor(address _registry) {
        owner = msg.sender;
        registry = _registry;
        isAuthorizedReporter[msg.sender] = true;
    }

    function setReporter(address reporter, bool authorized) external onlyOwner {
        isAuthorizedReporter[reporter] = authorized;
        emit ReporterAuthorized(reporter, authorized);
    }

    function setRegistry(address _registry) external onlyOwner {
        registry = _registry;
    }

    /**
     * @notice Record a single pre-execution firewall evaluation
     */
    function recordEvaluation(
        address agentWallet,
        bytes32 actionHash,
        address target,
        uint256 value,
        Verdict verdict,
        uint16 anomalyScore,
        string calldata ruleTriggered,
        string calldata reasoning
    ) external onlyReporter {
        AuditRecord memory record = AuditRecord({
            agentWallet: agentWallet,
            actionHash: actionHash,
            target: target,
            value: value,
            verdict: verdict,
            anomalyScore: anomalyScore,
            ruleTriggered: ruleTriggered,
            reasoning: reasoning,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        auditHistory.push(record);
        recordsByHash[actionHash] = record;
        agentActionHashes[agentWallet].push(actionHash);

        totalEvaluations += 1;
        if (verdict == Verdict.ALLOW) totalAllowed += 1;
        else if (verdict == Verdict.BLOCK) totalBlocked += 1;
        else if (verdict == Verdict.FLAG) totalFlagged += 1;

        emit ActionEvaluated(
            agentWallet,
            actionHash,
            target,
            value,
            verdict,
            anomalyScore,
            ruleTriggered,
            reasoning,
            block.timestamp
        );
    }

    /**
     * @notice Get total number of audit records
     */
    function getAuditCount() external view returns (uint256) {
        return auditHistory.length;
    }

    /**
     * @notice Get recent audit records with pagination
     */
    function getRecentAudits(uint256 offset, uint256 limit) external view returns (AuditRecord[] memory) {
        uint256 total = auditHistory.length;
        if (offset >= total) {
            return new AuditRecord[](0);
        }

        uint256 count = limit;
        if (offset + limit > total) {
            count = total - offset;
        }

        AuditRecord[] memory result = new AuditRecord[](count);
        for (uint256 i = 0; i < count; i++) {
            // Newest first
            result[i] = auditHistory[total - 1 - (offset + i)];
        }
        return result;
    }

    /**
     * @notice Get all action hashes for an agent
     */
    function getAgentActionHashes(address agentWallet) external view returns (bytes32[] memory) {
        return agentActionHashes[agentWallet];
    }
}
