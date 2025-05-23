// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title MerkleVerifier
 * @notice Gas-optimized Merkle proof verification for gas analysis
 * @dev Focuses on minimal gas consumption for analysis purposes
 */
contract MerkleVerifier {
    /// @notice Mapping to store valid Merkle roots
    mapping(bytes32 => bool) public roots;

    /// @notice Total number of roots stored
    uint256 public rootCount;

    /// @notice Event emitted when a new root is set
    event RootUpdated(bytes32 indexed root, uint256 indexed rootId);

    /// @notice Event emitted when a proof is verified
    event ProofVerified(
        bytes32 indexed root,
        bytes32 indexed leaf,
        bool result
    );

    /// @notice Custom errors for gas-efficient reverts
    error InvalidProof();
    error RootNotSet();
    error RootAlreadyExists();

    /**
     * @notice Set a new Merkle root
     * @param _root The Merkle root to store
     */
    function setRoot(bytes32 _root) external {
        if (roots[_root]) {
            revert RootAlreadyExists();
        }

        roots[_root] = true;
        rootCount++;

        emit RootUpdated(_root, rootCount);
    }

    /**
     * @notice Verify a Merkle proof against a stored root
     * @param proof Array of proof hashes
     * @param leaf The leaf to verify
     * @return bool True if proof is valid
     */
    function verify(
        bytes32[] calldata proof,
        bytes32 leaf
    ) external view returns (bool) {
        bytes32 root = MerkleProof.processProof(proof, leaf);
        return roots[root];
    }

    /**
     * @notice Verify a Merkle proof against a specific root
     * @param proof Array of proof hashes
     * @param root The Merkle root to verify against
     * @param leaf The leaf to verify
     * @return bool True if proof is valid
     */
    function verifyWithRoot(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) external view returns (bool) {
        if (!roots[root]) {
            revert RootNotSet();
        }

        bool result = MerkleProof.verify(proof, root, leaf);

        return result;
    }

    /**
     * @notice Batch verify multiple proofs against stored roots
     * @param proofs Array of proof arrays
     * @param leaves Array of leaves to verify
     * @return results Array of verification results
     */
    function verifyBatch(
        bytes32[][] calldata proofs,
        bytes32[] calldata leaves
    ) external view returns (bool[] memory results) {
        uint256 length = proofs.length;
        if (length != leaves.length) {
            revert InvalidProof();
        }

        results = new bool[](length);

        for (uint256 i; i < length; ) {
            bytes32 root = MerkleProof.processProof(proofs[i], leaves[i]);
            results[i] = roots[root];

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Batch verify multiple proofs against a specific root
     * @param root The Merkle root to verify against
     * @param proofs Array of proof arrays
     * @param leaves Array of leaves to verify
     * @return results Array of verification results
     */
    function verifyBatchWithRoot(
        bytes32 root,
        bytes32[][] calldata proofs,
        bytes32[] calldata leaves
    ) external view returns (bool[] memory results) {
        if (!roots[root]) {
            revert RootNotSet();
        }

        uint256 length = proofs.length;
        if (length != leaves.length) {
            revert InvalidProof();
        }

        results = new bool[](length);

        for (uint256 i; i < length; ) {
            results[i] = MerkleProof.verify(proofs[i], root, leaves[i]);

            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Check if a root is stored
     * @param root The root to check
     * @return bool True if root exists
     */
    function hasRoot(bytes32 root) external view returns (bool) {
        return roots[root];
    }

    /**
     * @notice Remove a root (for testing purposes)
     * @param _root The root to remove
     */
    function removeRoot(bytes32 _root) external {
        if (!roots[_root]) {
            revert RootNotSet();
        }

        roots[_root] = false;
        rootCount--;
    }
}
