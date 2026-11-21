// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct Booking {
    bytes32 subject;
    uint64 start;
    uint64 end;
    uint256 amount;
}

contract BookingNFT {
    string public constant name = "Trip Booking";
    string public constant symbol = "TRIP-BOOK";

    address public immutable issuer;
    uint256 public totalMinted;

    mapping(uint256 => address) internal owners;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(uint256 => Booking) internal bookings;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);

    error NotIssuer();
    error NotOwner();
    error UnknownToken();
    error InvalidBooking();

    constructor(address issuer_) {
        issuer = issuer_;
    }

    function mint(address to, bytes32 subject, uint64 start, uint64 end, uint256 amount)
        external
        returns (uint256 tokenId)
    {
        if (msg.sender != issuer) revert NotIssuer();
        if (to == address(0) || end <= start || amount == 0) revert InvalidBooking();
        tokenId = ++totalMinted;
        owners[tokenId] = to;
        balanceOf[to] += 1;
        bookings[tokenId] = Booking({subject: subject, start: start, end: end, amount: amount});
        emit Transfer(address(0), to, tokenId);
    }

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = owners[tokenId];
        if (owner == address(0)) revert UnknownToken();
    }

    function bookingOf(uint256 tokenId) external view returns (Booking memory) {
        ownerOf(tokenId);
        return bookings[tokenId];
    }

    function approve(address to, uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotOwner();
        getApproved[tokenId] = to;
        emit Approval(msg.sender, to, tokenId);
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        if (owner != from || to == address(0)) revert NotOwner();
        if (msg.sender != owner && msg.sender != getApproved[tokenId]) revert NotOwner();
        delete getApproved[tokenId];
        owners[tokenId] = to;
        balanceOf[from] -= 1;
        balanceOf[to] += 1;
        emit Transfer(from, to, tokenId);
    }
}
