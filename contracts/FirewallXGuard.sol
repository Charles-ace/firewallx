// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./FirewallXRegistry.sol";
import "./FirewallXAuditor.sol";

/**
 * @title FirewallXGuard
 * @notice Execution Gatekeeper smart account wrapper. Reverts if circuit breaker is tripped or policy violated.
 * @author Ace (webski101 / @charlesace)
 */
contract FirewallXGuard {
    FirewallXRegistry public immutable registry;
    FirewallXAuditor public immutable auditor;

    event GuardedExecution(address indexed agentWallet, address indexed target, uint256 value, bool success);

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

        (bool permitted, string memory reason) = registry.isActionPermitted(agentWallet, target, value);
        if (!permitted) {
            revert ExecutionBlocked(reason);
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
