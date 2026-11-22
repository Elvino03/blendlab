// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @dev Stores one immutable UTF-8 metadata URI in contract bytecode after a STOP opcode.
contract MetadataBlob {
    constructor(string memory uri) {
        bytes memory runtime = abi.encodePacked(hex"00", uri);
        assembly ("memory-safe") {
            return(add(runtime, 32), mload(runtime))
        }
    }
}

/// @notice Deploys a fixed ERC-721 edition and mints every item to the initiating wallet.
contract Blendlab is ERC721 {
    error InvalidEditionSize();
    error InvalidMetadataLength();

    uint256 public immutable totalSupply;
    mapping(uint256 => address) private _metadata;

    constructor(string memory name_, string memory symbol_, string[] memory uris)
        ERC721(name_, symbol_)
    {
        uint256 count = uris.length;
        if (count == 0 || count > 10) revert InvalidEditionSize();
        totalSupply = count;
        for (uint256 i; i < count; ++i) {
            uint256 size = bytes(uris[i]).length;
            if (size == 0 || size > 12_000) revert InvalidMetadataLength();
            uint256 tokenId = i + 1;
            _metadata[tokenId] = address(new MetadataBlob(uris[i]));
            _mint(msg.sender, tokenId);
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory uri) {
        _requireOwned(tokenId);
        address pointer = _metadata[tokenId];
        assembly ("memory-safe") {
            let size := sub(extcodesize(pointer), 1)
            uri := mload(0x40)
            mstore(uri, size)
            extcodecopy(pointer, add(uri, 32), 1, size)
            mstore(0x40, and(add(add(uri, size), 63), not(31)))
        }
    }
}
