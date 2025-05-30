// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title TestMerkleProof
 * @notice Simple wrapper around OpenZeppelin's MerkleProof for testing
 */
contract TestMerkleProof {
    function verify(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) public pure returns (bool) {
        return MerkleProof.verify(proof, root, leaf);
    }

    function processProof(
        bytes32[] memory proof,
        bytes32 leaf
    ) public pure returns (bytes32) {
        return MerkleProof.processProof(proof, leaf);
    }
}
