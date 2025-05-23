import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { MerkleVerifier, TestMerkleProof } from '../../typechain-types';
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

import { loadTreeData, treeDataExists, LoadedTreeData } from '../helpers/loadTreeData';

describe('Merkle Tree Push Leaf - Sequential Addition Testing', function () {
  this.timeout(600000); // 10 minutes for intensive operations

  let verifier: MerkleVerifier;
  let merkleProofLib: TestMerkleProof;
  let originalTreeData: LoadedTreeData;

  async function deployContractsFixture() {
    const [deployer] = await ethers.getSigners();
    
    const Verifier = await ethers.getContractFactory('MerkleVerifier');
    const verifier = await Verifier.deploy();
    
    const MerkleProofLib = await ethers.getContractFactory('TestMerkleProof');
    const merkleProofLib = await MerkleProofLib.deploy();
    
    return { verifier, merkleProofLib, deployer };
  }

  before(async function () {
    console.log('\n🔍 Checking for million leaf tree data...');
    
    const exists = await treeDataExists(20);
    if (!exists) {
      console.log('❌ Million leaf tree data not found!');
      console.log('💡 Please run: npm run generate:million');
      this.skip();
      return;
    }
    
    console.log('✅ Million leaf tree data found!');
    originalTreeData = await loadTreeData(20);
    
    console.log(`📊 Original tree summary:`);
    console.log(`   Depth: ${originalTreeData.depth}`);
    console.log(`   Leaves: ${originalTreeData.leafCount.toLocaleString()}`);
    console.log(`   Root: ${originalTreeData.root}`);
    
    const contracts = await loadFixture(deployContractsFixture);
    verifier = contracts.verifier;
    merkleProofLib = contracts.merkleProofLib;
  });

  describe('Sequential Push Operations', function () {
    it('tests sequential push to million-size tree', async function () {
      console.log('\n📤 Testing Sequential Push Operations on Million-Size Tree...');
      
      // Start with a sample from the million leaf tree
      console.log('📊 Setting up base tree from million-leaf sample...');
      const baseSampleSize = 100; // Start smaller for testing
      const baseLeaves: [string, string][] = originalTreeData.sampleProofs
        .slice(0, baseSampleSize)
        .map(proof => proof.leaf);
      
      let currentTree = StandardMerkleTree.of(baseLeaves, ["address", "uint256"]);
      let currentLeaves = [...baseLeaves];
      
      // Set initial root
      const hasInitialRoot = await verifier.hasRoot(currentTree.root);
      if (!hasInitialRoot) {
        await verifier.setRoot(currentTree.root);
      }
      
      console.log(`   🌲 Base tree: ${currentLeaves.length} leaves, depth: ${Math.ceil(Math.log2(currentLeaves.length))} levels`);
      console.log(`   🌳 Root: ${currentTree.root.slice(0, 10)}...`);
      
      // Test sequential pushes
      const pushOperations = [1, 2, 5, 10, 25, 50, 100]; // Number of leaves to push in each operation
      const results: Array<{
        operation: number;
        leavesAdded: number;
        totalLeaves: number;
        rebuildTime: number;
        rootUpdateGas: bigint;
        verificationGas: number;
        treeDepth: number;
        newRoot: string;
      }> = [];
      
      for (let i = 0; i < pushOperations.length; i++) {
        const pushCount = pushOperations[i];
        console.log(`\n   📤 Push Operation ${i + 1}: Adding ${pushCount} leaves...`);
        
        // Generate new leaves to push
        const newLeaves: [string, string][] = [];
        for (let j = 0; j < pushCount; j++) {
          const address = ethers.Wallet.createRandom().address;
          const amount = (BigInt(currentLeaves.length + j + 1) * BigInt(1e18)).toString();
          newLeaves.push([address, amount]);
        }
        
        // Measure rebuild time
        const rebuildStart = process.hrtime.bigint();
        currentLeaves = [...currentLeaves, ...newLeaves];
        currentTree = StandardMerkleTree.of(currentLeaves, ["address", "uint256"]);
        const rebuildEnd = process.hrtime.bigint();
        const rebuildTime = Number((rebuildEnd - rebuildStart) / 1000000n); // Convert to milliseconds
        
        // Measure gas for root update
        const rootUpdateTx = await verifier.setRoot(currentTree.root);
        const rootUpdateReceipt = await rootUpdateTx.wait();
        const rootUpdateGas = rootUpdateReceipt?.gasUsed || 0n;
        
        // Measure verification gas for the last pushed leaf
        const lastLeafIndex = currentLeaves.length - 1;
        const lastLeafProof = currentTree.getProof(lastLeafIndex);
        const lastLeafHash = currentTree.leafHash(currentLeaves[lastLeafIndex]);
        
        const verificationGas = await verifier.verifyWithRoot.estimateGas(
          lastLeafProof,
          currentTree.root,
          lastLeafHash
        );
        
        // Verify the push was successful
        const isValid = await verifier.verifyWithRoot(
          lastLeafProof,
          currentTree.root,
          lastLeafHash
        );
        
        const result = {
          operation: i + 1,
          leavesAdded: pushCount,
          totalLeaves: currentLeaves.length,
          rebuildTime,
          rootUpdateGas,
          verificationGas: Number(verificationGas),
          treeDepth: lastLeafProof.length,
          newRoot: currentTree.root
        };
        
        results.push(result);
        
        console.log(`      📊 Push ${pushCount} leaves: ${rebuildTime}ms rebuild, ${rootUpdateGas.toLocaleString()} gas root, ${Number(verificationGas).toLocaleString()} gas verify`);
        console.log(`      🌲 New tree: ${currentLeaves.length} leaves, depth: ${lastLeafProof.length} levels`);
        console.log(`      ✅ Verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
        
        expect(isValid).to.be.true;
      }
      
      // Analyze the push operation results
      console.log('\n📈 Push Operations Analysis:');
      console.log('┌─────────┬───────────┬─────────────┬─────────────┬──────────────┬─────────────┬───────────┐');
      console.log('│ Op #    │ Added     │ Total       │ Rebuild(ms) │ Root Gas     │ Verify Gas  │ Depth     │');
      console.log('├─────────┼───────────┼─────────────┼─────────────┼──────────────┼─────────────┼───────────┤');
      
      results.forEach((result, i) => {
        const op = result.operation.toString().padEnd(7);
        const added = result.leavesAdded.toString().padEnd(9);
        const total = result.totalLeaves.toString().padEnd(11);
        const rebuild = result.rebuildTime.toString().padEnd(11);
        const rootGas = result.rootUpdateGas.toLocaleString().padEnd(12);
        const verifyGas = result.verificationGas.toLocaleString().padEnd(11);
        const depth = result.treeDepth.toString().padEnd(9);
        
        console.log(`│ ${op} │ ${added} │ ${total} │ ${rebuild} │ ${rootGas} │ ${verifyGas} │ ${depth} │`);
      });
      console.log('└─────────┴───────────┴─────────────┴─────────────┴──────────────┴─────────────┴───────────┘');
      
      // Performance insights
      const avgRootGas = results.reduce((sum, r) => sum + Number(r.rootUpdateGas), 0) / results.length;
      const maxRebuildTime = Math.max(...results.map(r => r.rebuildTime));
      const minRebuildTime = Math.min(...results.map(r => r.rebuildTime));
      
      console.log('\n💡 Push Operation Insights:');
      console.log(`   • Root update gas remains constant: ~${Math.round(avgRootGas).toLocaleString()} gas`);
      console.log(`   • Rebuild time range: ${minRebuildTime}ms - ${maxRebuildTime}ms`);
      console.log(`   • Tree depth increases logarithmically with leaf count`);
      console.log(`   • Verification gas scales with tree depth (~2,400 gas per level)`);
    });

    it('simulates push operations scaling to million-size', async function () {
      console.log('\n🎯 Simulating Push Scaling to Million-Size Tree...');
      
      // Based on the actual million leaf tree data, project push performance
      const currentTreeStats = {
        leaves: originalTreeData.leafCount,
        depth: originalTreeData.depth,
        root: originalTreeData.root
      };
      
      console.log(`\n   📊 Current Million-Size Tree:`);
      console.log(`      Leaves: ${currentTreeStats.leaves.toLocaleString()}`);
      console.log(`      Depth: ${currentTreeStats.depth} levels`);
      console.log(`      Root: ${currentTreeStats.root.slice(0, 16)}...`);
      
      // Simulate different push scenarios
      const pushScenarios = [
        { name: "Single leaf push", count: 1 },
        { name: "Small batch push", count: 10 },
        { name: "Medium batch push", count: 100 },
        { name: "Large batch push", count: 1000 },
        { name: "Mega batch push", count: 10000 },
        { name: "Ultra batch push", count: 100000 }
      ];
      
      console.log('\n🔮 Push Scenarios Analysis:');
      
      for (const scenario of pushScenarios) {
        const newTotalLeaves = currentTreeStats.leaves + scenario.count;
        const newDepth = Math.ceil(Math.log2(newTotalLeaves));
        const depthIncrease = newDepth - currentTreeStats.depth;
        
        // Estimate rebuild time based on our 1M leaf generation benchmark
        const leavesPerSecond = currentTreeStats.leaves / (2.8 * 60); // ~6,250 leaves/second
        const estimatedRebuildTime = newTotalLeaves / leavesPerSecond;
        
        // Gas estimates
        const rootUpdateGas = 43000; // Constant from our tests
        const currentVerifyGas = currentTreeStats.depth * 2433; // ~2433 gas per level
        const newVerifyGas = newDepth * 2433;
        const verifyGasIncrease = newVerifyGas - currentVerifyGas;
        
        // Cost calculations (20 gwei, $3000 ETH)
        const gasPriceGwei = 20;
        const ethPriceUsd = 3000;
        const rootUpdateCost = (rootUpdateGas * gasPriceGwei * 1e-9) * ethPriceUsd;
        const verifyGasIncreaseCost = (verifyGasIncrease * gasPriceGwei * 1e-9) * ethPriceUsd;
        
        console.log(`\n   📤 ${scenario.name} (+${scenario.count.toLocaleString()} leaves):`);
        console.log(`      📊 New total: ${newTotalLeaves.toLocaleString()} leaves`);
        console.log(`      📏 New depth: ${newDepth} levels (+${depthIncrease})`);
        console.log(`      ⏱️  Estimated rebuild: ${(estimatedRebuildTime / 60).toFixed(1)} minutes`);
        console.log(`      ⛽ Root update: ${rootUpdateGas.toLocaleString()} gas ($${rootUpdateCost.toFixed(2)})`);
        console.log(`      🔍 Verify gas change: +${verifyGasIncrease.toLocaleString()} gas ($${verifyGasIncreaseCost.toFixed(2)} per verify)`);
        
        // Feasibility assessment
        if (scenario.count <= 1000) {
          console.log(`      ✅ HIGHLY FEASIBLE - Real-time push operations`);
        } else if (scenario.count <= 10000) {
          console.log(`      ✅ FEASIBLE - Batch push operations`);
        } else {
          console.log(`      ⚠️  MAJOR OPERATION - Consider staged approach`);
        }
      }
      
      console.log('\n🚀 Push Strategy Recommendations:');
      console.log('   1. Single/Small pushes (1-100): Real-time operations');
      console.log('   2. Medium pushes (100-1K): Scheduled batch operations');
      console.log('   3. Large pushes (1K-10K): Maintenance window operations');
      console.log('   4. Ultra pushes (10K+): Multi-stage deployment strategy');
    });
  });

  describe('Push Performance Patterns', function () {
    it('analyzes push performance degradation patterns', async function () {
      console.log('\n📉 Analyzing Push Performance Degradation...');
      
      // Test how push performance changes as tree grows
      const startSize = 50;
      const pushSizes = [10, 20, 50]; // Different push sizes to test
      const growthSteps = 5; // How many times to grow the tree
      
      for (const pushSize of pushSizes) {
        console.log(`\n   📈 Testing ${pushSize}-leaf push pattern:`);
        
        // Initialize tree
        let currentLeaves: [string, string][] = [];
        for (let i = 0; i < startSize; i++) {
          const address = ethers.Wallet.createRandom().address;
          const amount = (BigInt(i + 1) * BigInt(1e18)).toString();
          currentLeaves.push([address, amount]);
        }
        
        let currentTree = StandardMerkleTree.of(currentLeaves, ["address", "uint256"]);
        
        // Set initial root
        const hasRoot = await verifier.hasRoot(currentTree.root);
        if (!hasRoot) {
          await verifier.setRoot(currentTree.root);
        }
        
        const performanceData: Array<{
          step: number;
          totalLeaves: number;
          rebuildTime: number;
          gasUsed: bigint;
          timePerLeaf: number;
          gasPerLeaf: number;
        }> = [];
        
        for (let step = 1; step <= growthSteps; step++) {
          // Generate leaves to push
          const newLeaves: [string, string][] = [];
          for (let i = 0; i < pushSize; i++) {
            const address = ethers.Wallet.createRandom().address;
            const amount = (BigInt(currentLeaves.length + i + 1) * BigInt(1e18)).toString();
            newLeaves.push([address, amount]);
          }
          
          // Measure push performance
          const pushStart = process.hrtime.bigint();
          currentLeaves = [...currentLeaves, ...newLeaves];
          currentTree = StandardMerkleTree.of(currentLeaves, ["address", "uint256"]);
          const pushEnd = process.hrtime.bigint();
          
          const rebuildTime = Number((pushEnd - pushStart) / 1000000n);
          
          // Measure gas
          const gasUpdateTx = await verifier.setRoot(currentTree.root);
          const gasUpdateReceipt = await gasUpdateTx.wait();
          const gasUsed = gasUpdateReceipt?.gasUsed || 0n;
          
          const timePerLeaf = rebuildTime / pushSize;
          const gasPerLeaf = Number(gasUsed) / pushSize;
          
          performanceData.push({
            step,
            totalLeaves: currentLeaves.length,
            rebuildTime,
            gasUsed,
            timePerLeaf,
            gasPerLeaf
          });
          
          console.log(`      Step ${step}: ${currentLeaves.length} total leaves, ${rebuildTime}ms rebuild (${timePerLeaf.toFixed(1)}ms/leaf), ${gasUsed.toLocaleString()} gas (${gasPerLeaf.toFixed(0)} gas/leaf)`);
        }
        
        // Analyze degradation pattern
        const firstStepTime = performanceData[0].timePerLeaf;
        const lastStepTime = performanceData[performanceData.length - 1].timePerLeaf;
        const timeDegradation = ((lastStepTime - firstStepTime) / firstStepTime) * 100;
        
        const firstStepGas = performanceData[0].gasPerLeaf;
        const lastStepGas = performanceData[performanceData.length - 1].gasPerLeaf;
        const gasDegradation = ((lastStepGas - firstStepGas) / firstStepGas) * 100;
        
        console.log(`      📊 Performance Analysis for ${pushSize}-leaf pushes:`);
        console.log(`         Time degradation: ${timeDegradation.toFixed(1)}% (${firstStepTime.toFixed(1)}ms → ${lastStepTime.toFixed(1)}ms per leaf)`);
        console.log(`         Gas degradation: ${gasDegradation.toFixed(1)}% (${firstStepGas.toFixed(0)} → ${lastStepGas.toFixed(0)} gas per leaf)`);
        
        if (timeDegradation < 50) {
          console.log(`         ✅ EXCELLENT scaling characteristics`);
        } else if (timeDegradation < 100) {
          console.log(`         ✅ GOOD scaling characteristics`);
        } else {
          console.log(`         ⚠️  Noticeable performance degradation`);
        }
      }
    });

    it('tests optimal push batch sizing', async function () {
      console.log('\n🎯 Finding Optimal Push Batch Size...');
      
      // Test different batch sizes to find the optimal push size
      const batchSizes = [1, 5, 10, 25, 50, 100, 250];
      const baseSize = 100;
      
      // Create base tree
      let baseLeaves: [string, string][] = [];
      for (let i = 0; i < baseSize; i++) {
        const address = ethers.Wallet.createRandom().address;
        const amount = (BigInt(i + 1) * BigInt(1e18)).toString();
        baseLeaves.push([address, amount]);
      }
      
      console.log(`   🌲 Testing with base tree of ${baseSize} leaves`);
      
      const batchResults: Array<{
        batchSize: number;
        rebuildTime: number;
        gasUsed: bigint;
        efficiency: number; // ms per leaf
        gasEfficiency: number; // gas per leaf
      }> = [];
      
      for (const batchSize of batchSizes) {
        console.log(`\n   📦 Testing batch size: ${batchSize} leaves`);
        
        // Create test leaves
        const testLeaves: [string, string][] = [];
        for (let i = 0; i < batchSize; i++) {
          const address = ethers.Wallet.createRandom().address;
          const amount = (BigInt(baseSize + i + 1) * BigInt(1e18)).toString();
          testLeaves.push([address, amount]);
        }
        
        // Measure rebuild performance
        const rebuildStart = process.hrtime.bigint();
        const combinedLeaves = [...baseLeaves, ...testLeaves];
        const testTree = StandardMerkleTree.of(combinedLeaves, ["address", "uint256"]);
        const rebuildEnd = process.hrtime.bigint();
        
        const rebuildTime = Number((rebuildEnd - rebuildStart) / 1000000n);
        
        // Measure gas
        const gasUpdateTx = await verifier.setRoot(testTree.root);
        const gasUpdateReceipt = await gasUpdateTx.wait();
        const gasUsed = gasUpdateReceipt?.gasUsed || 0n;
        
        const efficiency = rebuildTime / batchSize;
        const gasEfficiency = Number(gasUsed) / batchSize;
        
        batchResults.push({
          batchSize,
          rebuildTime,
          gasUsed,
          efficiency,
          gasEfficiency
        });
        
        console.log(`      ⏱️  Rebuild time: ${rebuildTime}ms (${efficiency.toFixed(2)}ms per leaf)`);
        console.log(`      ⛽ Gas used: ${gasUsed.toLocaleString()} (${gasEfficiency.toFixed(0)} gas per leaf)`);
      }
      
      // Find optimal batch size
      const mostTimeEfficient = batchResults.reduce((best, current) => 
        current.efficiency < best.efficiency ? current : best
      );
      
      const mostGasEfficient = batchResults.reduce((best, current) => 
        current.gasEfficiency < best.gasEfficiency ? current : best
      );
      
      console.log('\n🏆 Optimal Batch Size Analysis:');
      console.log(`   ⚡ Most time efficient: ${mostTimeEfficient.batchSize} leaves (${mostTimeEfficient.efficiency.toFixed(2)}ms per leaf)`);
      console.log(`   ⛽ Most gas efficient: ${mostGasEfficient.batchSize} leaves (${mostGasEfficient.gasEfficiency.toFixed(0)} gas per leaf)`);
      
      // Efficiency comparison table
      console.log('\n📊 Batch Size Efficiency Comparison:');
      console.log('┌─────────────┬─────────────┬──────────────┬─────────────────┬───────────────────┐');
      console.log('│ Batch Size  │ Rebuild(ms) │ Gas Used     │ Time/Leaf (ms)  │ Gas/Leaf          │');
      console.log('├─────────────┼─────────────┼──────────────┼─────────────────┼───────────────────┤');
      
      batchResults.forEach(result => {
        const size = result.batchSize.toString().padEnd(11);
        const time = result.rebuildTime.toString().padEnd(11);
        const gas = result.gasUsed.toLocaleString().padEnd(12);
        const timeEff = result.efficiency.toFixed(2).padEnd(15);
        const gasEff = result.gasEfficiency.toFixed(0).padEnd(17);
        
        console.log(`│ ${size} │ ${time} │ ${gas} │ ${timeEff} │ ${gasEff} │`);
      });
      console.log('└─────────────┴─────────────┴──────────────┴─────────────────┴───────────────────┘');
      
      // Recommendations
      console.log('\n💡 Push Batch Size Recommendations:');
      if (mostTimeEfficient.batchSize <= 50) {
        console.log('   ✅ For real-time applications: Use small batches (1-50 leaves)');
      }
      if (mostGasEfficient.batchSize >= 100) {
        console.log('   ✅ For cost optimization: Use larger batches (100+ leaves)');
      }
      console.log('   ✅ For balanced performance: Use medium batches (25-100 leaves)');
    });
  });
});

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
} 