// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {RecurringPayment} from "../src/RecurringPayment.sol";

contract DeployRecurringPayment is Script {
    function run() external returns (RecurringPayment deployed) {
        address owner = vm.envAddress("CONTRACT_OWNER");

        vm.startBroadcast();
        deployed = new RecurringPayment(owner);
        vm.stopBroadcast();
    }
}
