import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { ethers } from "ethers";
import fs from "fs/promises";
import path from "path";

/**
 * Script 02: Generate 1 Million Leaf Merkle Tree
 * 
 * This script generates a production-scale Merkle tree with exactly 1,048,576 leaves
 * (depth 20) for use in production-scale gas analysis testing.
 */

interface MillionLeafTreeData {
  depth: number;
  root: string;
  leafCount: number;
  format: string[];
  sampleProofs: Array<{
    index: number;
    leaf: [string, string];
    proof: string[];
    leafHash: string;
  }>;
  metadata: {
    generatedAt: number;
    version: string;
    generationTimeMs: number;
    memorySizeBytes: number;
    leafEncoding: string;
    algorithm: string;
  };
}

async function main() {
  console.log("🚀 Generating 1 Million Leaf Merkle Tree");
  console.log("=======================================");
  
  const DEPTH = 20;
  const LEAF_COUNT = Math.pow(2, DEPTH); // 1,048,576 leaves
  const SAMPLE_SIZE = 1000; // Strategic sample for testing
  
  console.log(`📊 Target specifications:`);
  console.log(`   Depth: ${DEPTH}`);
  console.log(`   Leaves: ${LEAF_COUNT.toLocaleString()}`);
  console.log(`   Sample proofs: ${SAMPLE_SIZE}`);
  
  // Check memory requirements
  const estimatedMemoryGB = (LEAF_COUNT * 64) / (1024 * 1024 * 1024); // Rough estimate
  const availableMemoryGB = process.memoryUsage().heapTotal / (1024 * 1024 * 1024);
  
  console.log(`💾 Memory analysis:`);
  console.log(`   Estimated need: ~${estimatedMemoryGB.toFixed(1)} GB`);
  console.log(`   Available: ${availableMemoryGB.toFixed(1)} GB`);
  
  if (estimatedMemoryGB > availableMemoryGB * 0.8) {
    console.warn(`⚠️  Memory warning: Consider running with:`);
    console.warn(`   NODE_OPTIONS="--max-old-space-size=8192" npm run generate:million`);
  }

  try {
    const startTime = Date.now();

    // Step 1: Generate leaves efficiently
    console.log(`\n🌱 Step 1: Generating ${LEAF_COUNT.toLocaleString()} leaves...`);
    const leaves = await generateMillionLeaves(LEAF_COUNT);
    
    // Step 2: Build tree
    console.log(`\n🌲 Step 2: Building Merkle tree...`);
    const tree = await buildTree(leaves);
    
    // Step 3: Generate strategic sample proofs
    console.log(`\n🔍 Step 3: Generating ${SAMPLE_SIZE} strategic sample proofs...`);
    const sampleProofs = await generateStrategicProofs(tree, SAMPLE_SIZE);
    
    // Step 4: Create tree data structure
    const generationTime = Date.now() - startTime;
    const treeData: MillionLeafTreeData = {
      depth: DEPTH,
      root: tree.root,
      leafCount: LEAF_COUNT,
      format: ["address", "uint256"],
      sampleProofs,
      metadata: {
        generatedAt: Date.now(),
        version: "1.0.0",
        generationTimeMs: generationTime,
        memorySizeBytes: estimateTreeSize(LEAF_COUNT),
        leafEncoding: "address,uint256",
        algorithm: "StandardMerkleTree"
      }
    };
    
    // Step 5: Save to disk
    console.log(`\n💾 Step 5: Saving tree data to disk...`);
    await saveTreeData(treeData);
    
    // Summary
    console.log(`\n🎉 Million Leaf Tree Generation Complete!`);
    console.log(`======================================`);
    console.log(`⏱️  Total time: ${formatTime(generationTime)}`);
    console.log(`🌲 Tree root: ${tree.root}`);
    console.log(`📊 Leaf count: ${LEAF_COUNT.toLocaleString()}`);
    console.log(`🔍 Sample proofs: ${sampleProofs.length}`);
    console.log(`💾 Estimated size: ${formatBytes(treeData.metadata.memorySizeBytes)}`);
    console.log(`📁 Saved to: data/trees/depth-${DEPTH}/`);
    
    console.log(`\n🚀 Ready for production-scale testing!`);
    console.log(`   Run: npm test -- --grep "million.*leaf"`);

  } catch (error) {
    console.error("\n💥 Fatal error during generation:");
    console.error(error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.message.includes("memory")) {
      console.error("\n💡 Memory tips:");
      console.error("   1. Close other applications");
      console.error("   2. Run with: NODE_OPTIONS=\"--max-old-space-size=8192\"");
      console.error("   3. Consider generating in smaller batches");
    }
    
    process.exit(1);
  }
}

/**
 * Generate 1 million leaves efficiently using deterministic algorithm
 */
async function generateMillionLeaves(leafCount: number): Promise<[string, string][]> {
  const leaves: [string, string][] = new Array(leafCount);
  const startTime = Date.now();
  const batchSize = 50000; // Process in batches
  
  console.log(`   🚀 Using batched generation (${batchSize.toLocaleString()} per batch)`);
  
  for (let batch = 0; batch < Math.ceil(leafCount / batchSize); batch++) {
    const batchStart = batch * batchSize;
    const batchEnd = Math.min(batchStart + batchSize, leafCount);
    
    for (let i = batchStart; i < batchEnd; i++) {
      // Deterministic address generation (much faster than random)
      const addressSeed = ethers.solidityPackedKeccak256(
        ["uint256", "string"],
        [i, "production_address"]
      );
      const address = ethers.getAddress(addressSeed.slice(0, 42));
      
      // Amount: 1 to 1M tokens (scaled by position)
      const amount = (BigInt(i + 1) * BigInt(1e18)).toString();
      
      leaves[i] = [address, amount];
    }
    
    const elapsed = Date.now() - startTime;
    const completed = batchEnd;
    const rate = completed / elapsed * 1000; // leaves per second
    const eta = (leafCount - completed) / rate; // seconds remaining
    
    console.log(`   📦 Batch ${batch + 1}/${Math.ceil(leafCount / batchSize)}: ${completed.toLocaleString()} / ${leafCount.toLocaleString()} leaves (${(completed/leafCount*100).toFixed(1)}%) - ${Math.round(rate).toLocaleString()} leaves/sec - ETA: ${Math.round(eta)}s`);
    
    // Allow garbage collection between batches
    if (global.gc && batch % 5 === 0) {
      global.gc();
    }
  }
  
  const totalTime = Date.now() - startTime;
  const rate = leafCount / totalTime * 1000;
  console.log(`   ✅ Generated ${leafCount.toLocaleString()} leaves in ${formatTime(totalTime)} (${Math.round(rate).toLocaleString()} leaves/sec)`);
  
  return leaves;
}

/**
 * Build tree with progress tracking
 */
async function buildTree(leaves: [string, string][]): Promise<StandardMerkleTree<[string, string]>> {
  const startTime = Date.now();
  
  console.log(`   🔨 Building tree with ${leaves.length.toLocaleString()} leaves...`);
  console.log(`   ⚙️  Using StandardMerkleTree algorithm...`);
  
  // Create tree (this is the memory-intensive part)
  const tree = StandardMerkleTree.of(leaves, ["address", "uint256"]);
  
  const buildTime = Date.now() - startTime;
  console.log(`   ✅ Tree built in ${formatTime(buildTime)}`);
  console.log(`   🌲 Root: ${tree.root}`);
  console.log(`   📊 Tree length: ${tree.length.toLocaleString()}`);
  
  return tree;
}

/**
 * Generate strategic proof samples for comprehensive testing
 */
async function generateStrategicProofs(
  tree: StandardMerkleTree<[string, string]>,
  sampleSize: number
): Promise<Array<{
  index: number;
  leaf: [string, string];
  proof: string[];
  leafHash: string;
}>> {
  const leafCount = tree.length;
  const indices = generateStrategicIndices(leafCount, sampleSize);
  const proofs = [];
  
  console.log(`   🎯 Generating ${sampleSize} strategic proofs...`);
  console.log(`   📍 Strategy: edges, powers of 2, random distribution`);
  
  const values = Array.from(tree.entries());
  
  for (let i = 0; i < indices.length; i++) {
    const index = indices[i];
    
    // Find the leaf entry
    const entry = values.find(([entryIndex]) => entryIndex === index);
    if (!entry) {
      throw new Error(`Could not find leaf at index ${index}`);
    }
    
    const [, leaf] = entry;
    const proof = tree.getProof(index);
    const leafHash = tree.leafHash(leaf);
    
    proofs.push({
      index,
      leaf,
      proof,
      leafHash
    });
    
    if ((i + 1) % 100 === 0) {
      console.log(`   📊 Generated ${i + 1}/${indices.length} proofs (${((i + 1)/indices.length*100).toFixed(1)}%)`);
    }
  }
  
  console.log(`   ✅ Generated ${proofs.length} strategic proofs`);
  console.log(`   📊 Proof depth range: ${Math.min(...proofs.map(p => p.proof.length))} - ${Math.max(...proofs.map(p => p.proof.length))} levels`);
  
  return proofs;
}

/**
 * Generate strategic indices for comprehensive testing
 */
function generateStrategicIndices(leafCount: number, sampleSize: number): number[] {
  const indices = new Set<number>();
  
  // 1. Edge cases
  indices.add(0); // First leaf
  indices.add(leafCount - 1); // Last leaf
  indices.add(1); // Second leaf
  indices.add(leafCount - 2); // Second to last
  
  // 2. Powers of 2 and nearby
  for (let i = 1; i <= Math.log2(leafCount); i++) {
    const pow2 = Math.pow(2, i);
    if (pow2 < leafCount) {
      indices.add(pow2);
      indices.add(pow2 - 1);
      indices.add(pow2 + 1);
    }
  }
  
  // 3. Quartiles
  indices.add(Math.floor(leafCount * 0.25));
  indices.add(Math.floor(leafCount * 0.5));
  indices.add(Math.floor(leafCount * 0.75));
  
  // 4. Random distribution for remaining slots
  const remaining = sampleSize - indices.size;
  if (remaining > 0) {
    for (let i = 0; i < remaining; i++) {
      let randomIndex;
      do {
        randomIndex = Math.floor(Math.random() * leafCount);
      } while (indices.has(randomIndex));
      indices.add(randomIndex);
    }
  }
  
  return Array.from(indices).sort((a, b) => a - b).slice(0, sampleSize);
}

/**
 * Save tree data to disk with proper structure
 */
async function saveTreeData(treeData: MillionLeafTreeData): Promise<void> {
  const dataDir = path.join("data", "trees", `depth-${treeData.depth}`);
  
  // Create directory
  await fs.mkdir(dataDir, { recursive: true });
  
  // Save main tree data (without proofs for memory efficiency)
  const mainData = {
    depth: treeData.depth,
    root: treeData.root,
    leafCount: treeData.leafCount,
    format: treeData.format,
    metadata: treeData.metadata
  };
  
  await fs.writeFile(
    path.join(dataDir, "tree.json"),
    JSON.stringify(mainData, null, 2)
  );
  
  // Save sample proofs separately
  await fs.writeFile(
    path.join(dataDir, "proofs.json"),
    JSON.stringify(treeData.sampleProofs, null, 2)
  );
  
  // Save a summary for quick reference
  const summary = {
    generatedAt: new Date(treeData.metadata.generatedAt).toISOString(),
    depth: treeData.depth,
    leafCount: treeData.leafCount.toLocaleString(),
    root: treeData.root,
    sampleProofs: treeData.sampleProofs.length,
    generationTime: formatTime(treeData.metadata.generationTimeMs),
    estimatedSize: formatBytes(treeData.metadata.memorySizeBytes)
  };
  
  await fs.writeFile(
    path.join(dataDir, "summary.json"),
    JSON.stringify(summary, null, 2)
  );
  
  console.log(`   💾 Saved tree.json (${formatBytes(JSON.stringify(mainData).length)})`);
  console.log(`   💾 Saved proofs.json (${formatBytes(JSON.stringify(treeData.sampleProofs).length)})`);
  console.log(`   💾 Saved summary.json (${formatBytes(JSON.stringify(summary).length)})`);
}

/**
 * Utility functions
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function estimateTreeSize(leafCount: number): number {
  // Rough estimate: each leaf ~64 bytes, tree overhead ~50%
  return Math.floor(leafCount * 64 * 1.5);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
} 