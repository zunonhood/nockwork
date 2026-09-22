// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

interface IComponentRegistry {
    function publisherOf(bytes32 componentId) external view returns (address);
    function isActive(bytes32 componentId) external view returns (bool);
}

/// @title LicenseMarket
/// @notice Fixed-price component licenses with renewals and optional transfer.
contract LicenseMarket {
    error Unauthorized();
    error InvalidAddress();
    error InvalidDuration();
    error InvalidPrice();
    error InvalidFee();
    error ListingUnavailable();
    error IncorrectPayment();
    error LicenseUnavailable();
    error TransferDisabled();
    error WithdrawalFailed();
    error ReentrantCall();

    struct Listing {
        address publisher;
        bytes32 componentId;
        uint128 price;
        uint64 duration;
        bool transferable;
        bool active;
    }

    IComponentRegistry public immutable registry;
    address public immutable treasury;
    uint16 public immutable protocolFeeBps;
    uint256 public nextListingId;

    mapping(uint256 listingId => Listing) public listings;
    mapping(bytes32 componentId => mapping(address user => uint64 expiry))
        public licensedUntil;
    mapping(bytes32 componentId => mapping(address user => bool allowed))
        public isTransferable;
    mapping(address account => uint256 amount) public credits;

    uint256 private _locked = 1;

    event ListingCreated(
        uint256 indexed listingId,
        bytes32 indexed componentId,
        address indexed publisher,
        uint128 price,
        uint64 duration,
        bool transferable
    );
    event ListingStatusChanged(uint256 indexed listingId, bool active);
    event LicensePurchased(
        uint256 indexed listingId,
        bytes32 indexed componentId,
        address indexed buyer,
        uint64 licensedUntil
    );
    event LicenseTransferred(
        bytes32 indexed componentId,
        address indexed from,
        address indexed to,
        uint64 licensedUntil
    );
    event Withdrawal(address indexed account, uint256 amount);

    modifier nonReentrant() {
        if (_locked != 1) revert ReentrantCall();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(
        address registryAddress,
        address treasuryAddress,
        uint16 feeBps
    ) {
        if (registryAddress == address(0) || treasuryAddress == address(0)) {
            revert InvalidAddress();
        }
        if (feeBps > 1_000) revert InvalidFee();
        registry = IComponentRegistry(registryAddress);
        treasury = treasuryAddress;
        protocolFeeBps = feeBps;
    }

    function createListing(
        bytes32 componentId,
        uint128 price,
        uint64 duration,
        bool transferable
    ) external returns (uint256 listingId) {
        if (registry.publisherOf(componentId) != msg.sender) revert Unauthorized();
        if (!registry.isActive(componentId)) revert ListingUnavailable();
        if (price == 0) revert InvalidPrice();
        if (duration < 1 hours || duration > 3650 days) revert InvalidDuration();

        listingId = nextListingId++;
        listings[listingId] = Listing({
            publisher: msg.sender,
            componentId: componentId,
            price: price,
            duration: duration,
            transferable: transferable,
            active: true
        });
        emit ListingCreated(
            listingId, componentId, msg.sender, price, duration, transferable
        );
    }

    function setListingActive(uint256 listingId, bool active) external {
        Listing storage listing = listings[listingId];
        if (listing.publisher != msg.sender) revert Unauthorized();
        listing.active = active;
        emit ListingStatusChanged(listingId, active);
    }

    function purchase(uint256 listingId) external payable nonReentrant {
        Listing memory listing = listings[listingId];
        if (!listing.active || !registry.isActive(listing.componentId)) {
            revert ListingUnavailable();
        }
        if (msg.value != listing.price) revert IncorrectPayment();

        uint64 current = licensedUntil[listing.componentId][msg.sender];
        uint64 start = current > block.timestamp ? current : uint64(block.timestamp);
        uint64 expiry = start + listing.duration;
        licensedUntil[listing.componentId][msg.sender] = expiry;
        isTransferable[listing.componentId][msg.sender] = listing.transferable;

        uint256 fee = (msg.value * protocolFeeBps) / 10_000;
        credits[treasury] += fee;
        credits[listing.publisher] += msg.value - fee;
        emit LicensePurchased(listingId, listing.componentId, msg.sender, expiry);
    }

    function transferLicense(bytes32 componentId, address recipient) external {
        if (recipient == address(0) || recipient == msg.sender) revert InvalidAddress();
        uint64 expiry = licensedUntil[componentId][msg.sender];
        if (expiry <= block.timestamp) revert LicenseUnavailable();
        if (!isTransferable[componentId][msg.sender]) revert TransferDisabled();

        licensedUntil[componentId][msg.sender] = 0;
        isTransferable[componentId][msg.sender] = false;
        licensedUntil[componentId][recipient] = expiry;
        isTransferable[componentId][recipient] = true;
        emit LicenseTransferred(componentId, msg.sender, recipient, expiry);
    }

    function hasAccess(bytes32 componentId, address user)
        external
        view
        returns (bool)
    {
        return registry.isActive(componentId)
            && licensedUntil[componentId][user] > block.timestamp;
    }

    function withdraw() external nonReentrant {
        uint256 amount = credits[msg.sender];
        if (amount == 0) revert LicenseUnavailable();
        credits[msg.sender] = 0;
        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert WithdrawalFailed();
        emit Withdrawal(msg.sender, amount);
    }
}
