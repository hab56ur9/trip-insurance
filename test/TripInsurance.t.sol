// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {BookingNFT} from "../src/BookingNFT.sol";
import {Bid, Comparison, Condition, Policy, Status, TripInsurance} from "../src/TripInsurance.sol";

contract TripInsuranceTest is Test {
    BookingNFT nft;
    TripInsurance insurance;

    address issuer = makeAddr("issuer");
    address treasury = makeAddr("treasury");
    address buyer = makeAddr("buyer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint256 oracleKey = 0xA11CE;
    address oracle;

    bytes32 constant KIND = keccak256("rail.suspended");
    bytes32 constant SUBJECT = keccak256("KTX-101");
    uint64 constant MIN_GAP = 1 hours;
    uint64 constant JUDGE_PERIOD = 3 days;
    uint256 constant PREMIUM = 1 ether;
    uint256 constant MIN_COVERAGE = 10 ether;

    uint64 start;
    uint64 end;
    uint64 biddingEnd;
    uint256 tokenId;

    function setUp() public {
        vm.warp(1_800_000_000);
        oracle = vm.addr(oracleKey);
        nft = new BookingNFT(issuer);
        insurance = new TripInsurance(nft, treasury, MIN_GAP, JUDGE_PERIOD);
        start = uint64(block.timestamp + 2 days);
        end = start + 3 hours;
        biddingEnd = uint64(block.timestamp + 1 days);
        vm.prank(issuer);
        tokenId = nft.mint(buyer, SUBJECT, start, end, 2 ether);
        vm.deal(buyer, 10 ether);
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
        vm.deal(carol, 1000 ether);
    }

    function condition() internal view returns (Condition memory) {
        return Condition({oracle: oracle, kind: KIND, comparison: Comparison.AtLeast, threshold: 1});
    }

    function request() internal returns (uint256) {
        vm.prank(buyer);
        return insurance.requestPolicy{value: PREMIUM}(tokenId, condition(), MIN_COVERAGE, biddingEnd);
    }

    function bid(address who, uint256 policyId, uint16 units, uint256 unitCoverage) internal {
        vm.prank(who);
        insurance.placeBid{value: uint256(units) * unitCoverage}(policyId, units, unitCoverage);
    }

    function bound(uint16 units) internal returns (uint256 policyId) {
        policyId = request();
        bid(alice, policyId, units, 0.2 ether);
        vm.warp(biddingEnd);
        insurance.bind(policyId);
    }

    function held(uint256 policyId, address who) internal view returns (uint256 units) {
        (units,) = insurance.holdingOf(policyId, who);
    }

    function claim(address who, uint256 policyId) internal {
        vm.prank(who);
        insurance.claim(policyId);
    }

    function signed(uint256 policyId, int256 value) internal view returns (bytes memory) {
        bytes32 digest = insurance.observationHash(policyId, value);
        bytes32 message = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, message);
        return abi.encodePacked(r, s, v);
    }

    function test_G1_RequiresBookingNft() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(TripInsurance.NotBookingOwner.selector);
        insurance.requestPolicy{value: PREMIUM}(tokenId, condition(), MIN_COVERAGE, biddingEnd);
    }

    function test_G1_TransferredNftMovesTheRight() public {
        vm.prank(buyer);
        nft.transferFrom(buyer, alice, tokenId);
        vm.prank(buyer);
        vm.expectRevert(TripInsurance.NotBookingOwner.selector);
        insurance.requestPolicy{value: PREMIUM}(tokenId, condition(), MIN_COVERAGE, biddingEnd);
    }

    function test_G2_RequiresPremiumConditionAndMinimum() public {
        vm.startPrank(buyer);
        vm.expectRevert(TripInsurance.InvalidRequest.selector);
        insurance.requestPolicy(tokenId, condition(), MIN_COVERAGE, biddingEnd);
        vm.expectRevert(TripInsurance.InvalidRequest.selector);
        insurance.requestPolicy{value: PREMIUM}(tokenId, condition(), 0, biddingEnd);
        Condition memory empty = condition();
        empty.oracle = address(0);
        vm.expectRevert(TripInsurance.InvalidRequest.selector);
        insurance.requestPolicy{value: PREMIUM}(tokenId, empty, MIN_COVERAGE, biddingEnd);
        vm.expectRevert(TripInsurance.InvalidRequest.selector);
        insurance.requestPolicy{value: PREMIUM}(tokenId, condition(), MIN_COVERAGE, start);
        vm.stopPrank();
    }

    function test_G2_RecordsThePolicy() public {
        uint256 policyId = request();
        Policy memory policy = insurance.policyOf(policyId);
        assertEq(policy.insured, buyer);
        assertEq(policy.premium, PREMIUM);
        assertEq(policy.minCoverage, MIN_COVERAGE);
        assertEq(policy.subject, SUBJECT);
        assertEq(uint8(policy.status), uint8(Status.Auction));
    }

    function test_A1_UnitsAreFixedAtOneHundred() public {
        uint256 policyId = request();
        assertEq(insurance.UNITS(), 100);
        vm.prank(alice);
        vm.expectRevert(TripInsurance.InvalidRequest.selector);
        insurance.placeBid{value: 101 * 0.1 ether}(policyId, 101, 0.1 ether);
    }

    function test_A2_RecordsUnitsAndCoverage() public {
        uint256 policyId = request();
        bid(alice, policyId, 60, 0.12 ether);
        Bid[] memory list = insurance.bidsOf(policyId);
        assertEq(list.length, 1);
        assertEq(list[0].bidder, alice);
        assertEq(list[0].units, 60);
        assertEq(list[0].unitCoverage, 0.12 ether);
    }

    function test_A3_RejectsBelowStartingPrice() public {
        uint256 policyId = request();
        vm.prank(alice);
        vm.expectRevert(TripInsurance.BelowMinimum.selector);
        insurance.placeBid{value: 10 * 0.09 ether}(policyId, 10, 0.09 ether);
        bid(alice, policyId, 10, 0.1 ether);
    }

    function test_A4_RequiresFullDeposit() public {
        uint256 policyId = request();
        vm.prank(alice);
        vm.expectRevert(TripInsurance.WrongPayment.selector);
        insurance.placeBid{value: 1 ether}(policyId, 10, 0.12 ether);
    }

    function test_A4_RejectsInsuredAndOracle() public {
        uint256 policyId = request();
        vm.deal(oracle, 10 ether);
        vm.prank(buyer);
        vm.expectRevert(TripInsurance.NotAllowed.selector);
        insurance.placeBid{value: 0.1 ether}(policyId, 1, 0.1 ether);
        vm.prank(oracle);
        vm.expectRevert(TripInsurance.NotAllowed.selector);
        insurance.placeBid{value: 0.1 ether}(policyId, 1, 0.1 ether);
    }

    function test_A5_AllocatesHighestFirst() public {
        uint256 policyId = request();
        bid(carol, policyId, 30, 0.1 ether);
        bid(bob, policyId, 50, 0.11 ether);
        bid(alice, policyId, 60, 0.12 ether);
        vm.prank(alice);
        vm.expectRevert(TripInsurance.BiddingOpen.selector);
        insurance.bind(policyId);
        vm.warp(biddingEnd);
        insurance.bind(policyId);
        assertEq(held(policyId, alice), 60);
        assertEq(held(policyId, bob), 40);
        assertEq(held(policyId, carol), 0);
    }

    function test_A5_EarlierBidWinsATie() public {
        uint256 policyId = request();
        bid(alice, policyId, 70, 0.1 ether);
        bid(bob, policyId, 70, 0.1 ether);
        vm.warp(biddingEnd);
        insurance.bind(policyId);
        assertEq(held(policyId, alice), 70);
        assertEq(held(policyId, bob), 30);
    }

    function test_A5_ClosesBiddingAtDeadline() public {
        uint256 policyId = request();
        vm.warp(biddingEnd);
        vm.prank(alice);
        vm.expectRevert(TripInsurance.BiddingClosed.selector);
        insurance.placeBid{value: 0.1 ether}(policyId, 1, 0.1 ether);
    }

    function test_A6_PayAsBidCoverage() public {
        uint256 policyId = request();
        bid(alice, policyId, 60, 0.12 ether);
        bid(bob, policyId, 50, 0.11 ether);
        vm.warp(biddingEnd);
        insurance.bind(policyId);
        Policy memory policy = insurance.policyOf(policyId);
        assertEq(policy.coverage, 60 * 0.12 ether + 40 * 0.11 ether);
        (, uint256 deposit) = insurance.holdingOf(policyId, bob);
        assertEq(deposit, 40 * 0.11 ether);
    }

    function test_A7_RefundsUnfilledBids() public {
        uint256 policyId = request();
        bid(alice, policyId, 60, 0.12 ether);
        bid(bob, policyId, 50, 0.11 ether);
        bid(carol, policyId, 30, 0.1 ether);
        vm.warp(biddingEnd);
        insurance.bind(policyId);
        claim(bob, policyId);
        claim(carol, policyId);
        assertEq(insurance.credits(bob), 10 * 0.11 ether);
        assertEq(insurance.credits(carol), 30 * 0.1 ether);
        vm.prank(alice);
        vm.expectRevert(TripInsurance.NothingToClaim.selector);
        insurance.claim(policyId);
        vm.prank(carol);
        vm.expectRevert(TripInsurance.NothingToClaim.selector);
        insurance.claim(policyId);
    }

    function test_A8_PartialFillRefundsUnusedPremium() public {
        uint256 policyId = bound(40);
        Policy memory policy = insurance.policyOf(policyId);
        assertEq(policy.soldUnits, 40);
        assertEq(policy.usedPremium, PREMIUM * 40 / 100);
        assertEq(insurance.credits(buyer), PREMIUM * 60 / 100);
        assertEq(uint8(policy.status), uint8(Status.Bound));
    }

    function test_A8_NoBidsCancels() public {
        uint256 policyId = request();
        vm.warp(biddingEnd);
        insurance.bind(policyId);
        assertEq(uint8(insurance.policyOf(policyId).status), uint8(Status.Cancelled));
        assertEq(insurance.credits(buyer), PREMIUM);
    }

    function test_J1_RejectsOtherSigners() public {
        uint256 policyId = bound(100);
        vm.warp(end);
        bytes32 message = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", insurance.observationHash(policyId, 1))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xB0B, message);
        vm.expectRevert(TripInsurance.WrongOracle.selector);
        insurance.settle(policyId, 1, abi.encodePacked(r, s, v));
    }

    function test_J1_JudgesOnlyInsideTheWindow() public {
        uint256 policyId = bound(100);
        bytes memory signature = signed(policyId, 1);
        vm.warp(end - 1);
        vm.expectRevert(TripInsurance.JudgingClosed.selector);
        insurance.settle(policyId, 1, signature);
        vm.warp(end + JUDGE_PERIOD);
        vm.expectRevert(TripInsurance.WrongStatus.selector);
        insurance.settle(policyId, 1, signature);
    }

    function test_J2_ConditionMetPays() public {
        uint256 policyId = bound(100);
        vm.warp(end);
        insurance.settle(policyId, 1, signed(policyId, 1));
        assertEq(uint8(insurance.policyOf(policyId).status), uint8(Status.Paid));
        assertEq(insurance.credits(buyer), 100 * 0.2 ether);
    }

    function test_J2_ConditionNotMetExpires() public {
        uint256 policyId = bound(100);
        vm.warp(end);
        insurance.settle(policyId, 0, signed(policyId, 0));
        assertEq(uint8(insurance.policyOf(policyId).status), uint8(Status.Expired));
        assertEq(insurance.credits(buyer), 0);
    }

    function test_J3_NoObservationVoids() public {
        uint256 policyId = bound(100);
        vm.warp(end + JUDGE_PERIOD - 1);
        vm.expectRevert(TripInsurance.JudgingOpen.selector);
        insurance.voidPolicy(policyId);
        vm.warp(end + JUDGE_PERIOD);
        insurance.voidPolicy(policyId);
        assertEq(uint8(insurance.policyOf(policyId).status), uint8(Status.Voided));
        assertEq(insurance.credits(buyer), PREMIUM);
        vm.prank(alice);
        insurance.claim(policyId);
        assertEq(insurance.credits(alice), 100 * 0.2 ether);
    }

    function test_S1_PremiumShareFollowsUnits() public {
        uint256 policyId = request();
        bid(alice, policyId, 75, 0.2 ether);
        bid(bob, policyId, 25, 0.2 ether);
        vm.warp(biddingEnd);
        insurance.bind(policyId);
        vm.warp(end);
        insurance.settle(policyId, 0, signed(policyId, 0));
        claim(alice, policyId);
        claim(bob, policyId);
        uint256 shared = PREMIUM - PREMIUM * 200 / 10_000;
        assertEq(insurance.credits(alice), 75 * 0.2 ether + shared * 75 / 100);
        assertEq(insurance.credits(bob), 25 * 0.2 ether + shared * 25 / 100);
    }

    function test_S1_PaidHoldersKeepOnlyTheShare() public {
        uint256 policyId = bound(100);
        vm.warp(end);
        insurance.settle(policyId, 5, signed(policyId, 5));
        vm.prank(alice);
        insurance.claim(policyId);
        assertEq(insurance.credits(alice), PREMIUM - PREMIUM * 200 / 10_000);
        vm.prank(alice);
        vm.expectRevert(TripInsurance.NothingToClaim.selector);
        insurance.claim(policyId);
    }

    function test_S2_FeeAndRemainderGoToTreasury() public {
        uint256 policyId = request();
        bid(alice, policyId, 3, 4 ether);
        vm.warp(biddingEnd);
        insurance.bind(policyId);
        vm.warp(end);
        insurance.settle(policyId, 0, signed(policyId, 0));
        Policy memory policy = insurance.policyOf(policyId);
        uint256 fee = policy.usedPremium * 200 / 10_000;
        uint256 shared = policy.usedPremium - fee;
        assertEq(insurance.credits(treasury), fee + shared - policy.unitShare * 3);
        vm.prank(alice);
        insurance.claim(policyId);
        uint256 owed = insurance.credits(alice) + insurance.credits(buyer) + insurance.credits(treasury);
        assertEq(address(insurance).balance, owed);
    }

    function test_A5_BindFitsInABlockAtMaxBids() public {
        uint256 policyId = request();
        for (uint256 i; i < insurance.MAX_BIDS(); ++i) {
            address who = address(uint160(0x1000 + i));
            vm.deal(who, 1 ether);
            vm.prank(who);
            insurance.placeBid{value: 0.1 ether + i}(policyId, 1, 0.1 ether + i);
        }
        vm.prank(alice);
        vm.expectRevert(TripInsurance.TooManyBids.selector);
        insurance.placeBid{value: 0.2 ether}(policyId, 1, 0.2 ether);
        vm.warp(biddingEnd);
        uint256 gasBefore = gasleft();
        insurance.bind(policyId);
        assertLt(gasBefore - gasleft(), 15_000_000);
        assertEq(insurance.policyOf(policyId).soldUnits, 100);
    }

    function test_Lazy_SettleBindsFirst() public {
        uint256 policyId = request();
        bid(alice, policyId, 100, 0.2 ether);
        vm.warp(end);
        assertEq(uint8(insurance.statusOf(policyId)), uint8(Status.Bound));
        insurance.settle(policyId, 1, signed(policyId, 1));
        assertEq(uint8(insurance.policyOf(policyId).status), uint8(Status.Paid));
        assertEq(insurance.policyOf(policyId).soldUnits, 100);
    }

    function test_Lazy_ClaimVoidsAfterJudging() public {
        uint256 policyId = request();
        bid(alice, policyId, 100, 0.2 ether);
        vm.warp(end + JUDGE_PERIOD);
        assertEq(uint8(insurance.statusOf(policyId)), uint8(Status.Voided));
        claim(alice, policyId);
        assertEq(uint8(insurance.policyOf(policyId).status), uint8(Status.Voided));
        assertEq(insurance.credits(alice), 100 * 0.2 ether);
        assertEq(insurance.credits(buyer), PREMIUM);
    }

    function test_Lazy_SameResultWhoeverCallsWhenever() public {
        uint256 policyId = request();
        bid(alice, policyId, 60, 0.12 ether);
        bid(bob, policyId, 50, 0.11 ether);
        vm.warp(biddingEnd + 1 days);
        claim(bob, policyId);
        assertEq(held(policyId, alice), 60);
        assertEq(held(policyId, bob), 40);
        assertEq(insurance.credits(bob), 10 * 0.11 ether);
    }

    function test_Lazy_StatusWithoutBids() public {
        uint256 policyId = request();
        vm.warp(biddingEnd);
        assertEq(uint8(insurance.statusOf(policyId)), uint8(Status.Cancelled));
    }

    function test_WithdrawPaysOutCredits() public {
        uint256 policyId = request();
        vm.warp(biddingEnd);
        insurance.bind(policyId);
        uint256 before = buyer.balance;
        vm.prank(buyer);
        insurance.withdraw();
        assertEq(buyer.balance, before + PREMIUM);
        assertEq(insurance.credits(buyer), 0);
    }
}
