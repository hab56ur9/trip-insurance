// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {BookingNFT} from "../src/BookingNFT.sol";
import {TripInsurance} from "../src/TripInsurance.sol";

contract Deploy is Script {
    function run() external returns (TripInsurance insurance, BookingNFT nft) {
        string memory profile = vm.envOr("PROFILE", string("local"));
        bool local = keccak256(bytes(profile)) == keccak256("local");
        uint64 minGap = local ? 60 : 1 hours;
        uint64 judgePeriod = local ? 300 : 72 hours;

        vm.startBroadcast();
        nft = new BookingNFT(vm.envAddress("ISSUER"));
        insurance = new TripInsurance(nft, vm.envAddress("TREASURY"), minGap, judgePeriod);
        vm.stopBroadcast();

        string memory json = "deployment";
        vm.serializeAddress(json, "insurance", address(insurance));
        vm.serializeAddress(json, "nft", address(nft));
        vm.serializeUint(json, "minGap", minGap);
        vm.serializeUint(json, "judgePeriod", judgePeriod);
        string memory out = vm.serializeString(json, "profile", profile);
        vm.writeJson(out, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }
}
