// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {BookingNFT} from "../src/BookingNFT.sol";
import {TripInsurance} from "../src/TripInsurance.sol";

contract Deploy is Script {
    function run() external returns (TripInsurance insurance, BookingNFT nft) {
        string memory profile = vm.envOr("PROFILE", string("local"));
        (uint64 defaultGap, uint64 defaultPeriod) = periods(profile);
        uint64 minGap = uint64(vm.envOr("MIN_GAP", uint256(defaultGap)));
        uint64 judgePeriod = uint64(vm.envOr("JUDGE_PERIOD", uint256(defaultPeriod)));

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

    function periods(string memory profile) internal pure returns (uint64 minGap, uint64 judgePeriod) {
        bytes32 name = keccak256(bytes(profile));
        if (name == keccak256("local")) return (60, 300);
        if (name == keccak256("demo")) return (1 minutes, 30 minutes);
        return (1 hours, 72 hours);
    }
}
