// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/structs/MerkleTree.sol";

/**
 * @title IncrementalMerkleTreePush
 * @dev Contract demonstrating OpenZeppelin's Bytes32PushTree for efficient incremental leaf additions
 * @notice This implementation allows for O(log n) push operations instead of O(n) tree rebuilds
 */
contract IncrementalMerkleTreePush {
    using MerkleTree for MerkleTree.Bytes32PushTree;

    // The incremental Merkle tree
    MerkleTree.Bytes32PushTree private _tree;

    // Current root (updated on each push)
    bytes32 public root;

    // Tree configuration
    uint8 public immutable depth;
    bytes32 public immutable zero;

    // Leaf tracking
    uint256 public leafCount;

    // Events for tracking operations
    event TreeSetup(uint8 depth, bytes32 zero, bytes32 initialRoot);
    event LeafPushed(
        bytes32 leaf,
        uint256 index,
        bytes32 newRoot,
        uint256 gasUsed
    );
    event TreeReset(bytes32 newRoot);

    // Error definitions
    error TreeNotSetup();
    error TreeDepthExceeded();
    error InvalidDepth();
    error InvalidZeroValue();

    /**
     * @dev Constructor sets up the incremental Merkle tree
     * @param _depth Maximum depth of the tree (supports 2^_depth leaves)
     * @param _zero Zero value for empty tree positions
     */
    constructor(uint8 _depth, bytes32 _zero) {
        if (_depth == 0 || _depth > 32) revert InvalidDepth();
        if (_zero == bytes32(0)) revert InvalidZeroValue();

        depth = _depth;
        zero = _zero;

        // Setup the tree and get initial root
        root = _tree.setup(_depth, _zero);
        leafCount = 0;

        emit TreeSetup(_depth, _zero, root);
    }

    /**
     * @dev Push a new leaf to the tree
     * @param leaf The leaf value to add
     * @return leafIndex The index where the leaf was inserted
     * @return newRoot The new root after insertion
     */
    function push(
        bytes32 leaf
    ) public returns (uint256 leafIndex, bytes32 newRoot) {
        uint256 gasStart = gasleft();

        // Check if tree has capacity
        if (leafCount >= (1 << depth)) revert TreeDepthExceeded();

        // Push the leaf and get the new root
        (leafIndex, newRoot) = _tree.push(leaf);

        // Update state
        root = newRoot;
        leafCount++;

        uint256 gasUsed = gasStart - gasleft();
        emit LeafPushed(leaf, leafIndex, newRoot, gasUsed);

        return (leafIndex, newRoot);
    }

    /**
     * @dev Push multiple leaves in a single transaction
     * @param leaves Array of leaves to push
     * @return startIndex The starting index for the batch
     * @return finalRoot The final root after all pushes
     */
    function pushBatch(
        bytes32[] calldata leaves
    ) public returns (uint256 startIndex, bytes32 finalRoot) {
        if (leafCount + leaves.length > (1 << depth))
            revert TreeDepthExceeded();

        startIndex = leafCount;

        for (uint256 i = 0; i < leaves.length; i++) {
            (, finalRoot) = push(leaves[i]);
        }

        return (startIndex, finalRoot);
    }

    /**
     * @dev Reset the tree to its initial state
     * @notice This clears all leaves and resets to empty tree
     */
    function reset() public {
        root = _tree.setup(depth, zero);
        leafCount = 0;

        emit TreeReset(root);
    }

    /**
     * @dev Get current tree statistics
     * @return currentRoot Current root of the tree
     * @return currentLeafCount Number of leaves in the tree
     * @return maxCapacity Maximum number of leaves the tree can hold
     * @return utilizationPercent Percentage of tree capacity used
     */
    function getTreeStats()
        public
        view
        returns (
            bytes32 currentRoot,
            uint256 currentLeafCount,
            uint256 maxCapacity,
            uint256 utilizationPercent
        )
    {
        currentRoot = root;
        currentLeafCount = leafCount;
        maxCapacity = 1 << depth;
        utilizationPercent = (currentLeafCount * 100) / maxCapacity;

        return (currentRoot, currentLeafCount, maxCapacity, utilizationPercent);
    }

    /**
     * @dev Check if the tree is at capacity
     * @return True if tree is full, false otherwise
     */
    function isFull() public view returns (bool) {
        return leafCount >= (1 << depth);
    }

    /**
     * @dev Get remaining capacity
     * @return Number of additional leaves that can be added
     */
    function remainingCapacity() public view returns (uint256) {
        uint256 maxCapacity = 1 << depth;
        return maxCapacity > leafCount ? maxCapacity - leafCount : 0;
    }
}
