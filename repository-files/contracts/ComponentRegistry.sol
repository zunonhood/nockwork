// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ComponentRegistry
/// @notice Canonical metadata and code hashes for system components.
contract ComponentRegistry {
    error ComponentAlreadyExists();
    error ComponentNotFound();
    error NotPublisher();
    error InvalidCodeHash();
    error EmptyMetadataURI();

    struct Component {
        address publisher;
        bytes32 codeHash;
        string metadataURI;
        uint64 version;
        bool active;
    }

    mapping(bytes32 componentId => Component) private _components;

    event ComponentPublished(
        bytes32 indexed componentId,
        address indexed publisher,
        bytes32 indexed codeHash,
        string metadataURI
    );
    event ComponentUpdated(
        bytes32 indexed componentId,
        bytes32 indexed codeHash,
        uint64 version,
        string metadataURI
    );
    event ComponentStatusChanged(bytes32 indexed componentId, bool active);

    function publish(
        bytes32 componentId,
        bytes32 codeHash,
        string calldata metadataURI
    ) external {
        if (_components[componentId].publisher != address(0)) {
            revert ComponentAlreadyExists();
        }
        _validate(codeHash, metadataURI);
        _components[componentId] = Component({
            publisher: msg.sender,
            codeHash: codeHash,
            metadataURI: metadataURI,
            version: 1,
            active: true
        });
        emit ComponentPublished(componentId, msg.sender, codeHash, metadataURI);
    }

    function update(
        bytes32 componentId,
        bytes32 newCodeHash,
        string calldata newMetadataURI
    ) external {
        Component storage component = _requirePublisher(componentId);
        _validate(newCodeHash, newMetadataURI);
        component.codeHash = newCodeHash;
        component.metadataURI = newMetadataURI;
        unchecked { component.version += 1; }
        emit ComponentUpdated(
            componentId,
            newCodeHash,
            component.version,
            newMetadataURI
        );
    }

    function setActive(bytes32 componentId, bool active) external {
        Component storage component = _requirePublisher(componentId);
        component.active = active;
        emit ComponentStatusChanged(componentId, active);
    }

    function getComponent(bytes32 componentId)
        external
        view
        returns (Component memory)
    {
        Component memory component = _components[componentId];
        if (component.publisher == address(0)) revert ComponentNotFound();
        return component;
    }

    function publisherOf(bytes32 componentId) external view returns (address) {
        return _components[componentId].publisher;
    }

    function isActive(bytes32 componentId) external view returns (bool) {
        return _components[componentId].active;
    }

    function _requirePublisher(bytes32 componentId)
        private
        view
        returns (Component storage component)
    {
        component = _components[componentId];
        if (component.publisher == address(0)) revert ComponentNotFound();
        if (component.publisher != msg.sender) revert NotPublisher();
    }

    function _validate(bytes32 codeHash, string calldata metadataURI)
        private
        pure
    {
        if (codeHash == bytes32(0)) revert InvalidCodeHash();
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
    }
}
