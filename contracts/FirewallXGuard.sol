// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./FirewallXRegistry.sol";
import "./FirewallXAuditor.sol";

/**
 * @title FirewallXGuard
 * @notice Execution Gatekeeper smart account wrapper. Halts execution if circuit breaker is tripped or policy violated.
 * @author Ace (webski101 / @charlesace)
 */
contract FirewallXGuard {
    FirewallXRegistry public immutable registry;
    FirewallXAuditor public immutable auditor;

    event GuardedExecution(address indexed agentWallet, address indexed target, uint256 value, bool success);
    event GuardedExecutionBlocked(address indexed agentWallet, address indexed target, uint256 value, string reason);

    error ExecutionBlocked(string reason);
    error TargetCallFailed();

    constructor(address _registry, address _auditor) {
        registry = FirewallXRegistry(_registry);
        auditor = FirewallXAuditor(_auditor);
    }

    /**
     * @notice Execute an action on behalf of an agent wallet only if policy & circuit breaker allow it
     */
    function executeGuarded(
        address target,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory returnData) {
        address agentWallet = msg.sender;

        // Deterministic fingerprint of the full action: (target, value, calldata).
        // Lets the Registry enforce identical-payload (loop) limits on-chain.
        bytes32 calldataHash = keccak256(abi.encodePacked(target, value, data));

        (bool permitted, string memory reason) = registry.isActionPermitted(agentWallet, target, value, calldataHash);
        if (!permitted) {
            if (msg.value > 0) {
                (bool refundOk, ) = payable(agentWallet).call{value: msg.value}("");
                require(refundOk, "Refund failed");
            }
            emit GuardedExecutionBlocked(agentWallet, target, value, reason);
            return bytes(reason);
        }

        // Forward call
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            revert TargetCallFailed();
        }

        emit GuardedExecution(agentWallet, target, value, success);
        return result;
    }

    receive() external payable {}
}
