// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title TestTargetContract
 * @notice Mock target contract (e.g. Agent KV Store / Payment Vault) used for simulation and testnet demos.
 */
contract TestTargetContract {
    mapping(string => string) public kvStore;
    uint256 public totalOps;
    address public lastCaller;

    event KeyValueSet(string key, string value, address caller, uint256 opCount);
    event FundsReceived(address from, uint256 amount);

    function setKeyValue(string calldata key, string calldata value) external payable {
        kvStore[key] = value;
        totalOps += 1;
        lastCaller = msg.sender;
        emit KeyValueSet(key, value, msg.sender, totalOps);
    }

    function transferFunds(address payable recipient) external payable {
        require(msg.value > 0, "No funds provided");
        recipient.transfer(msg.value);
        totalOps += 1;
    }

    receive() external payable {
        emit FundsReceived(msg.sender, msg.value);
    }
}
