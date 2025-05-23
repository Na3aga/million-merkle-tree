import fs from 'fs/promises';
import path from 'path';

export interface LoadedTreeData {
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

/**
 * Load tree data from disk for testing
 */
export async function loadTreeData(depth: number): Promise<LoadedTreeData> {
  const dataDir = path.join("data", "trees", `depth-${depth}`);
  
  try {
    // Load main tree data
    const treeDataPath = path.join(dataDir, "tree.json");
    const treeDataContent = await fs.readFile(treeDataPath, "utf-8");
    const treeData = JSON.parse(treeDataContent);
    
    // Load sample proofs
    const proofsPath = path.join(dataDir, "proofs.json");
    const proofsContent = await fs.readFile(proofsPath, "utf-8");
    const sampleProofs = JSON.parse(proofsContent);
    
    return {
      ...treeData,
      sampleProofs
    };
  } catch (error) {
    throw new Error(
      `Failed to load tree data for depth ${depth}. ` +
      `Make sure to run 'npm run generate:million' first. ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if tree data exists for a given depth
 */
export async function treeDataExists(depth: number): Promise<boolean> {
  const dataDir = path.join("data", "trees", `depth-${depth}`);
  
  try {
    await fs.access(path.join(dataDir, "tree.json"));
    await fs.access(path.join(dataDir, "proofs.json"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get summary information about available tree data
 */
export async function getTreeSummary(depth: number): Promise<{
  exists: boolean;
  summary?: any;
}> {
  const dataDir = path.join("data", "trees", `depth-${depth}`);
  
  try {
    const summaryPath = path.join(dataDir, "summary.json");
    const summaryContent = await fs.readFile(summaryPath, "utf-8");
    const summary = JSON.parse(summaryContent);
    
    return {
      exists: true,
      summary
    };
  } catch {
    return {
      exists: false
    };
  }
} 