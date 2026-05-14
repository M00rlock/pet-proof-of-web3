// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract ProofOfLearningBadge is ERC721, Ownable {
    uint256 private _nextTokenId = 1;

    mapping(address learner => bool minted) private _hasBadge;

    address public issuer;

    error BadgeAlreadyMinted(address learner);
    error NotIssuer(address caller);
    error SoulboundToken();

    event IssuerUpdated(address indexed issuer);
    event BadgeMinted(address indexed learner, uint256 indexed tokenId, string badgeType);

    constructor(address initialOwner, address initialIssuer)
        ERC721("Proof of Web3 Learning Badge", "POW3")
        Ownable(initialOwner)
    {
        issuer = initialIssuer;
        emit IssuerUpdated(initialIssuer);
    }

    modifier onlyIssuer() {
        if (msg.sender != issuer && msg.sender != owner()) {
            revert NotIssuer(msg.sender);
        }
        _;
    }

    function setIssuer(address nextIssuer) external onlyOwner {
        issuer = nextIssuer;
        emit IssuerUpdated(nextIssuer);
    }

    function mintBadge(address learner) external onlyIssuer returns (uint256 tokenId) {
        if (_hasBadge[learner]) {
            revert BadgeAlreadyMinted(learner);
        }

        tokenId = _nextTokenId++;
        _hasBadge[learner] = true;

        _safeMint(learner, tokenId);

        emit BadgeMinted(learner, tokenId, "web3-foundations");
    }

    function hasBadge(address learner) external view returns (bool) {
        return _hasBadge[learner];
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address previousOwner)
    {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            revert SoulboundToken();
        }

        return super._update(to, tokenId, auth);
    }
}

