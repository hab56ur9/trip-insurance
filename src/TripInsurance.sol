// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Booking, BookingNFT} from "./BookingNFT.sol";

enum Status {
    None,
    Auction,
    Bound,
    Cancelled,
    Paid,
    Expired,
    Voided
}

enum Comparison {
    AtLeast,
    AtMost
}

struct Condition {
    address oracle;
    bytes32 kind;
    Comparison comparison;
    int256 threshold;
}

struct Policy {
    address insured;
    uint256 tokenId;
    bytes32 subject;
    Condition condition;
    uint64 biddingEnd;
    uint64 windowStart;
    uint64 windowEnd;
    uint64 judgingEnd;
    uint256 premium;
    uint256 minCoverage;
    uint256 coverage;
    uint256 usedPremium;
    uint256 unitShare;
    uint16 soldUnits;
    Status status;
}

struct Bid {
    address bidder;
    uint16 units;
    uint16 filled;
    bool refunded;
    bool claimed;
    uint256 unitCoverage;
}

contract TripInsurance {
    uint16 public constant UNITS = 100;
    uint256 public constant MAX_BIDS = 200;
    uint256 public constant FEE_BPS = 200;

    BookingNFT public immutable nft;
    address public immutable treasury;
    uint64 public immutable minGap;
    uint64 public immutable judgePeriod;

    uint256 public policyCount;
    mapping(uint256 => Policy) internal policies;
    mapping(uint256 => Bid[]) internal bids;
    mapping(address => uint256) public credits;
    bool private locked;

    event PolicyRequested(uint256 indexed policyId, address indexed insured, uint256 tokenId, uint256 premium, uint256 minCoverage);
    event BidPlaced(uint256 indexed policyId, address indexed bidder, uint256 bidId, uint16 units, uint256 unitCoverage);
    event PolicyBound(uint256 indexed policyId, uint16 soldUnits, uint256 coverage, uint256 usedPremium);
    event PolicyCancelled(uint256 indexed policyId);
    event Settled(uint256 indexed policyId, Status status, int256 value, uint256 fee);
    event Claimed(uint256 indexed policyId, address indexed holder, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    error NotBookingOwner();
    error InvalidRequest();
    error WrongStatus();
    error BiddingClosed();
    error BiddingOpen();
    error NotAllowed();
    error BelowMinimum();
    error WrongPayment();
    error TooManyBids();
    error JudgingClosed();
    error JudgingOpen();
    error WrongOracle();
    error NothingToClaim();
    error TransferFailed();
    error Reentrancy();

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    constructor(BookingNFT nft_, address treasury_, uint64 minGap_, uint64 judgePeriod_) {
        if (address(nft_) == address(0) || treasury_ == address(0) || judgePeriod_ == 0) revert InvalidRequest();
        nft = nft_;
        treasury = treasury_;
        minGap = minGap_;
        judgePeriod = judgePeriod_;
    }

    function requestPolicy(uint256 tokenId, Condition calldata condition, uint256 minCoverage, uint64 biddingEnd)
        external
        payable
        returns (uint256 policyId)
    {
        if (nft.ownerOf(tokenId) != msg.sender) revert NotBookingOwner();
        if (msg.value == 0 || minCoverage == 0) revert InvalidRequest();
        if (condition.oracle == address(0) || condition.kind == bytes32(0)) revert InvalidRequest();
        Booking memory booking = nft.bookingOf(tokenId);
        if (biddingEnd <= block.timestamp || biddingEnd + minGap > booking.start) revert InvalidRequest();

        policyId = ++policyCount;
        Policy storage policy = policies[policyId];
        policy.insured = msg.sender;
        policy.tokenId = tokenId;
        policy.subject = booking.subject;
        policy.condition = condition;
        policy.biddingEnd = biddingEnd;
        policy.windowStart = booking.start;
        policy.windowEnd = booking.end;
        policy.judgingEnd = booking.end + judgePeriod;
        policy.premium = msg.value;
        policy.minCoverage = minCoverage;
        policy.status = Status.Auction;

        emit PolicyRequested(policyId, msg.sender, tokenId, msg.value, minCoverage);
    }

    function placeBid(uint256 policyId, uint16 units, uint256 unitCoverage) external payable {
        Policy storage policy = policies[policyId];
        if (policy.status != Status.Auction) revert WrongStatus();
        if (block.timestamp >= policy.biddingEnd) revert BiddingClosed();
        if (msg.sender == policy.insured || msg.sender == policy.condition.oracle) revert NotAllowed();
        if (units == 0 || units > UNITS) revert InvalidRequest();
        if (unitCoverage * UNITS < policy.minCoverage) revert BelowMinimum();
        if (msg.value != uint256(units) * unitCoverage) revert WrongPayment();
        if (bids[policyId].length >= MAX_BIDS) revert TooManyBids();

        bids[policyId].push(
            Bid({bidder: msg.sender, units: units, filled: 0, refunded: false, claimed: false, unitCoverage: unitCoverage})
        );
        emit BidPlaced(policyId, msg.sender, bids[policyId].length - 1, units, unitCoverage);
    }

    function bind(uint256 policyId) public {
        Policy storage policy = policies[policyId];
        if (policy.status != Status.Auction) revert WrongStatus();
        if (block.timestamp < policy.biddingEnd) {
            if (msg.sender != policy.insured) revert BiddingOpen();
            policy.biddingEnd = uint64(block.timestamp);
        }

        Bid[] storage list = bids[policyId];
        (uint256[] memory order, uint256[] memory prices) = ranked(list);
        uint16 remaining = UNITS;
        uint256 coverage;
        for (uint256 k; k < order.length && remaining > 0; ++k) {
            Bid storage bid = list[order[k]];
            uint16 taken = bid.units < remaining ? bid.units : remaining;
            remaining -= taken;
            bid.filled = taken;
            coverage += uint256(taken) * prices[k];
        }

        uint16 sold = UNITS - remaining;
        if (sold == 0) {
            policy.status = Status.Cancelled;
            credits[policy.insured] += policy.premium;
            emit PolicyCancelled(policyId);
            return;
        }

        policy.soldUnits = sold;
        policy.coverage = coverage;
        policy.usedPremium = policy.premium * sold / UNITS;
        policy.status = Status.Bound;
        credits[policy.insured] += policy.premium - policy.usedPremium;
        emit PolicyBound(policyId, sold, coverage, policy.usedPremium);
    }

    function settle(uint256 policyId, int256 value, bytes calldata signature) external {
        Policy storage policy = policies[policyId];
        advance(policyId, policy);
        if (policy.status != Status.Bound) revert WrongStatus();
        if (block.timestamp >= policy.judgingEnd) revert JudgingClosed();
        if (recover(observationHash(policyId, value), signature) != policy.condition.oracle) revert WrongOracle();

        uint256 fee = policy.usedPremium * FEE_BPS / 10_000;
        uint256 shared = policy.usedPremium - fee;
        policy.unitShare = shared / policy.soldUnits;
        credits[treasury] += fee + shared - policy.unitShare * policy.soldUnits;

        bool met = policy.condition.comparison == Comparison.AtLeast
            ? value >= policy.condition.threshold
            : value <= policy.condition.threshold;
        policy.status = met ? Status.Paid : Status.Expired;
        if (met) credits[policy.insured] += policy.coverage;
        emit Settled(policyId, policy.status, value, fee);
    }

    function voidPolicy(uint256 policyId) public {
        Policy storage policy = policies[policyId];
        if (policy.status != Status.Bound) revert WrongStatus();
        if (block.timestamp < policy.judgingEnd) revert JudgingOpen();

        policy.status = Status.Voided;
        credits[policy.insured] += policy.usedPremium;
        emit Settled(policyId, Status.Voided, 0, 0);
    }

    function claim(uint256 policyId) external {
        Policy storage policy = policies[policyId];
        advance(policyId, policy);
        Status status = policy.status;
        if (status == Status.None || status == Status.Auction) revert WrongStatus();
        bool finished = status == Status.Paid || status == Status.Expired || status == Status.Voided;

        Bid[] storage list = bids[policyId];
        uint256 amount;
        for (uint256 i; i < list.length; ++i) {
            Bid storage bid = list[i];
            if (bid.bidder != msg.sender) continue;
            if (!bid.refunded) {
                bid.refunded = true;
                amount += uint256(bid.units - bid.filled) * bid.unitCoverage;
            }
            if (finished && !bid.claimed && bid.filled > 0) {
                bid.claimed = true;
                amount += payoutOf(policy, status, bid);
            }
        }
        if (amount == 0) revert NothingToClaim();
        credits[msg.sender] += amount;
        emit Claimed(policyId, msg.sender, amount);
    }

    function withdraw() external nonReentrant {
        uint256 amount = credits[msg.sender];
        if (amount == 0) revert NothingToClaim();
        credits[msg.sender] = 0;
        emit Withdrawn(msg.sender, amount);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function policyOf(uint256 policyId) external view returns (Policy memory) {
        return policies[policyId];
    }

    function statusOf(uint256 policyId) external view returns (Status) {
        Policy storage policy = policies[policyId];
        Status status = policy.status;
        if (status == Status.Auction && block.timestamp >= policy.biddingEnd) {
            status = bids[policyId].length == 0 ? Status.Cancelled : Status.Bound;
        }
        if (status == Status.Bound && block.timestamp >= policy.judgingEnd) return Status.Voided;
        return status;
    }

    function bidsOf(uint256 policyId) external view returns (Bid[] memory) {
        return bids[policyId];
    }

    function holdingOf(uint256 policyId, address holder) external view returns (uint256 units, uint256 deposit) {
        Bid[] storage list = bids[policyId];
        for (uint256 i; i < list.length; ++i) {
            if (list[i].bidder != holder) continue;
            units += list[i].filled;
            deposit += uint256(list[i].filled) * list[i].unitCoverage;
        }
    }

    function observationHash(uint256 policyId, int256 value) public view returns (bytes32) {
        Policy storage policy = policies[policyId];
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                policy.condition.kind,
                policy.subject,
                policy.windowStart,
                policy.windowEnd,
                value
            )
        );
    }

    function advance(uint256 policyId, Policy storage policy) internal {
        if (policy.status == Status.Auction && block.timestamp >= policy.biddingEnd) bind(policyId);
        if (policy.status == Status.Bound && block.timestamp >= policy.judgingEnd) voidPolicy(policyId);
    }

    function payoutOf(Policy storage policy, Status status, Bid storage bid) internal view returns (uint256) {
        uint256 share = uint256(bid.filled) * policy.unitShare;
        uint256 deposit = uint256(bid.filled) * bid.unitCoverage;
        if (status == Status.Paid) return share;
        if (status == Status.Expired) return deposit + share;
        return deposit;
    }

    function ranked(Bid[] storage list) internal view returns (uint256[] memory order, uint256[] memory prices) {
        order = new uint256[](list.length);
        prices = new uint256[](list.length);
        for (uint256 i; i < list.length; ++i) {
            uint256 price = list[i].unitCoverage;
            uint256 j = i;
            while (j > 0 && prices[j - 1] < price) {
                order[j] = order[j - 1];
                prices[j] = prices[j - 1];
                --j;
            }
            order[j] = i;
            prices[j] = price;
        }
    }

    function recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) return address(0);
        bytes32 r = bytes32(signature[0:32]);
        bytes32 s = bytes32(signature[32:64]);
        uint8 v = uint8(signature[64]);
        if (v < 27) v += 27;
        bytes32 signed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        return ecrecover(signed, v, r, s);
    }
}
