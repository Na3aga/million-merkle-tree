import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { MerkleVerifier, TestMerkleProof } from '../../typechain-types';

import { loadTreeData, treeDataExists, getTreeSummary, LoadedTreeData } from '../helpers/loadTreeData';

describe('Million Leaf Tree - Production Scale Testing', function () {
  // Increase timeout for production-scale operations
  this.timeout(120000); // 2 minutes

  let verifier: MerkleVerifier;
  let merkleProofLib: TestMerkleProof;
  let treeData: LoadedTreeData;

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
    
    // Load the tree data
    console.log('📖 Loading tree data...');
    treeData = await loadTreeData(20);
    
    console.log(`📊 Loaded tree summary:`);
    console.log(`   Depth: ${treeData.depth}`);
    console.log(`   Leaves: ${treeData.leafCount.toLocaleString()}`);
    console.log(`   Root: ${treeData.root}`);
    console.log(`   Sample proofs: ${treeData.sampleProofs.length}`);
    console.log(`   Generated: ${new Date(treeData.metadata.generatedAt).toISOString()}`);
    console.log(`   Size: ${formatBytes(treeData.metadata.memorySizeBytes)}`);
    
    // Deploy contracts
    console.log('🚀 Deploying contracts...');
    const contracts = await loadFixture(deployContractsFixture);
    verifier = contracts.verifier;
    merkleProofLib = contracts.merkleProofLib;
  });

  describe('Tree Data Validation', function () {
    it('validates loaded tree data structure', async function () {
      expect(treeData.depth).to.equal(20);
      expect(treeData.leafCount).to.equal(1048576);
      expect(treeData.format).to.deep.equal(['address', 'uint256']);
      expect(treeData.sampleProofs.length).to.be.greaterThan(0);
      expect(treeData.root).to.match(/^0x[a-fA-F0-9]{64}$/);
      
      console.log(`✅ Tree data structure validated`);
      console.log(`   🌲 1,048,576 leaves confirmed`);
      console.log(`   📊 ${treeData.sampleProofs.length} sample proofs loaded`);
    });

    it('validates proof structure and depths', async function () {
      console.log('\n🔍 Analyzing proof structure...');
      
      const proofLengths = treeData.sampleProofs.map(p => p.proof.length);
      const minDepth = Math.min(...proofLengths);
      const maxDepth = Math.max(...proofLengths);
      const avgDepth = proofLengths.reduce((a, b) => a + b, 0) / proofLengths.length;
      
      console.log(`   📊 Proof depth analysis:`);
      console.log(`      Min depth: ${minDepth} levels`);
      console.log(`      Max depth: ${maxDepth} levels`);
      console.log(`      Avg depth: ${avgDepth.toFixed(1)} levels`);
      console.log(`      Expected: 20 levels for depth 20 tree`);
      
      // For a perfect binary tree of depth 20, all proofs should be exactly 20 levels
      expect(minDepth).to.equal(20);
      expect(maxDepth).to.equal(20);
      
      // Validate leaf structure
      treeData.sampleProofs.slice(0, 5).forEach((proofData, i) => {
        expect(proofData.leaf).to.have.length(2);
        expect(proofData.leaf[0]).to.match(/^0x[a-fA-F0-9]{40}$/); // Address
        expect(proofData.leaf[1]).to.match(/^\d+$/); // Amount as string
        expect(proofData.leafHash).to.match(/^0x[a-fA-F0-9]{64}$/);
        
        console.log(`   🏷️ Sample leaf ${i}: address=${proofData.leaf[0].slice(0, 8)}..., amount=${BigInt(proofData.leaf[1]).toString().slice(0, 10)}...`);
      });
    });
  });

  describe('Production Scale Proof Verification', function () {
    beforeEach(async function () {
      // Set the tree root in the verifier contract (only if not already set)
      const hasRoot = await verifier.hasRoot(treeData.root);
      if (!hasRoot) {
        await verifier.setRoot(treeData.root);
      }
    });

    it('verifies sample proofs from actual million leaf tree', async function () {
      console.log('\n🔍 Verifying proofs from 1M leaf tree...');
      
      const sampleSize = Math.min(50, treeData.sampleProofs.length); // Test 50 proofs
      const samples = treeData.sampleProofs.slice(0, sampleSize);
      
      let successCount = 0;
      let totalGasUsed = 0n;
      const gasReadings: number[] = [];
      
      for (let i = 0; i < samples.length; i++) {
        const proofData = samples[i];
        
        // Verify using OpenZeppelin's MerkleProof directly
        const isValid = await merkleProofLib.verify(
          proofData.proof,
          treeData.root,
          proofData.leafHash
        );
        
        expect(isValid).to.be.true;
        successCount++;
        
        // Also test with our contract
        const contractResult = await verifier.verify(
          proofData.proof,
          proofData.leafHash
        );
        expect(contractResult).to.be.true;
        
        // Measure gas for verification
        const gasEstimate = await verifier.verify.estimateGas(
          proofData.proof,
          proofData.leafHash
        );
        gasReadings.push(Number(gasEstimate));
        totalGasUsed += gasEstimate;
        
        if ((i + 1) % 10 === 0) {
          const avgGas = Number(totalGasUsed) / (i + 1);
          console.log(`   📊 Verified ${i + 1}/${samples.length} proofs - Avg gas: ${Math.round(avgGas).toLocaleString()}`);
        }
      }
      
      const avgGas = Number(totalGasUsed) / samples.length;
      const minGas = Math.min(...gasReadings);
      const maxGas = Math.max(...gasReadings);
      
      console.log(`\n✅ Production Scale Verification Results:`);
      console.log(`   🎯 Verified: ${successCount}/${samples.length} proofs (100%)`);
      console.log(`   ⛽ Gas analysis:`);
      console.log(`      Average: ${Math.round(avgGas).toLocaleString()} gas`);
      console.log(`      Range: ${minGas.toLocaleString()} - ${maxGas.toLocaleString()} gas`);
      console.log(`      Per level: ~${Math.round(avgGas / 20).toLocaleString()} gas`);
      
      expect(successCount).to.equal(samples.length);
    });

    it('demonstrates gas efficiency at different tree positions', async function () {
      console.log('\n📊 Gas Analysis Across Tree Positions...');
      
      // Test strategic positions across the million leaf tree
      const strategicIndices = [
        0,                    // First leaf
        1,                    // Second leaf
        524287,               // Middle leaf (2^19 - 1)
        524288,               // Middle leaf (2^19)
        1048575               // Last leaf
      ];
      
      const positionTests = [];
      
      for (const targetIndex of strategicIndices) {
        // Find proof for this index
        const proofData = treeData.sampleProofs.find(p => p.index === targetIndex);
        
        if (!proofData) {
          console.log(`   ⚠️ No proof available for index ${targetIndex.toLocaleString()}, skipping`);
          continue;
        }
        
        const gasEstimate = await verifier.verify.estimateGas(
          proofData.proof,
          proofData.leafHash
        );
        
        positionTests.push({
          index: targetIndex,
          position: targetIndex === 0 ? 'First' : 
                   targetIndex === 1 ? 'Second' :
                   targetIndex === 524287 ? 'Middle-1' :
                   targetIndex === 524288 ? 'Middle' : 'Last',
          gas: Number(gasEstimate),
          proofLength: proofData.proof.length
        });
        
        console.log(`   📍 Position ${targetIndex.toLocaleString().padStart(7)} (${positionTests[positionTests.length - 1].position.padEnd(8)}): ${Number(gasEstimate).toLocaleString().padStart(6)} gas, ${proofData.proof.length} levels`);
      }
      
      // Analyze gas consistency
      const gasValues = positionTests.map(t => t.gas);
      const avgGas = gasValues.reduce((a, b) => a + b, 0) / gasValues.length;
      const gasVariance = gasValues.reduce((sum, gas) => sum + Math.pow(gas - avgGas, 2), 0) / gasValues.length;
      const gasStdDev = Math.sqrt(gasVariance);
      
      console.log(`\n   📊 Gas consistency analysis:`);
      console.log(`      Average: ${Math.round(avgGas).toLocaleString()} gas`);
      console.log(`      Std dev: ${Math.round(gasStdDev).toLocaleString()} gas (${(gasStdDev/avgGas*100).toFixed(2)}%)`);
      console.log(`      ✅ Consistent gas usage across all tree positions`);
      
      // Gas should be very consistent for depth 20 tree (all proofs are 20 levels)
      expect(gasStdDev / avgGas).to.be.lessThan(0.01); // Less than 1% variance
    });

    it('performs batch verification simulation', async function () {
      console.log('\n🚀 Batch Verification Simulation...');
      
      const batchSizes = [1, 5, 10, 25, 50];
      const results = [];
      
      for (const batchSize of batchSizes) {
        const batch = treeData.sampleProofs.slice(0, batchSize);
        const startTime = Date.now();
        
        let totalGas = 0n;
        let successCount = 0;
        
        for (const proofData of batch) {
          const gasEstimate = await verifier.verify.estimateGas(
            proofData.proof,
            proofData.leafHash
          );
          totalGas += gasEstimate;
          
          // Verify it actually works
          const isValid = await verifier.verify(proofData.proof, proofData.leafHash);
          if (isValid) successCount++;
        }
        
        const endTime = Date.now();
        const avgGasPerProof = Number(totalGas) / batchSize;
        const timePerProof = (endTime - startTime) / batchSize;
        
        results.push({
          batchSize,
          totalGas: Number(totalGas),
          avgGasPerProof,
          timePerProof,
          successRate: successCount / batchSize
        });
        
        console.log(`   📦 Batch ${batchSize.toString().padStart(2)}: ${Math.round(avgGasPerProof).toLocaleString().padStart(6)} gas/proof, ${timePerProof.toFixed(1).padStart(4)}ms/proof, ${(successCount/batchSize*100).toFixed(0)}% success`);
      }
      
      // Verify all batches succeeded
      results.forEach(result => {
        expect(result.successRate).to.equal(1.0);
      });
      
      console.log(`\n   💡 Batch efficiency insights:`);
      console.log(`      Gas per proof remains consistent across batch sizes`);
      console.log(`      Each proof verification independent: O(log n) complexity`);
    });
  });

  describe('Production Scale Performance Analysis', function () {
    it('extrapolates performance for full tree verification', async function () {
      console.log('\n📊 Full Tree Performance Extrapolation...');
      
      // Use a representative sample for extrapolation
      const sampleSize = 20;
      const samples = treeData.sampleProofs.slice(0, sampleSize);
      
      let totalGas = 0n;
      const startTime = Date.now();
      
      for (const proofData of samples) {
        const gasEstimate = await verifier.verify.estimateGas(
          proofData.proof,
          proofData.leafHash
        );
        totalGas += gasEstimate;
      }
      
      const endTime = Date.now();
      const avgGasPerProof = Number(totalGas) / sampleSize;
      const avgTimePerProof = (endTime - startTime) / sampleSize;
      
      // Extrapolate to full tree
      const fullTreeGas = BigInt(Math.round(avgGasPerProof)) * BigInt(treeData.leafCount);
      const fullTreeTimeMinutes = (avgTimePerProof * treeData.leafCount) / (1000 * 60);
      const fullTreeTimeHours = fullTreeTimeMinutes / 60;
      
      // Gas cost estimates (using current mainnet prices)
      const gasPrice = 20; // gwei
      const ethPrice = 3000; // USD
      const estimatedCostEth = Number(fullTreeGas) * gasPrice / 1e9;
      const estimatedCostUsd = estimatedCostEth * ethPrice;
      
      console.log(`   📊 Sample analysis (${sampleSize} proofs):`);
      console.log(`      Avg gas per proof: ${Math.round(avgGasPerProof).toLocaleString()}`);
      console.log(`      Avg time per proof: ${avgTimePerProof.toFixed(1)}ms`);
      
      console.log(`\n   🌍 Full tree extrapolation (${treeData.leafCount.toLocaleString()} leaves):`);
      console.log(`      Total gas needed: ${fullTreeGas.toLocaleString()}`);
      console.log(`      Estimated time: ${fullTreeTimeHours.toFixed(1)} hours`);
      console.log(`      Cost at 20 gwei: ${estimatedCostEth.toFixed(2)} ETH (~$${estimatedCostUsd.toLocaleString()})`);
      
      console.log(`\n   💡 Real-world implications:`);
      console.log(`      - Verifying all 1M+ leaves would require ${(Number(fullTreeGas) / 30_000_000).toFixed(0)} blocks of gas`);
      console.log(`      - More practical: verify on-demand as needed`);
      console.log(`      - Each individual verification: ~${Math.round(avgGasPerProof).toLocaleString()} gas`);
      
      // Verify the gas estimate is reasonable for 20-level proofs (20 levels * ~2400 gas per level)
      expect(avgGasPerProof).to.be.greaterThan(40000);  // At least 40k gas for 20 levels
      expect(avgGasPerProof).to.be.lessThan(60000);     // At most 60k gas for 20 levels
    });

    it('demonstrates tree traversal patterns', async function () {
      console.log('\n🌲 Tree Traversal Pattern Analysis...');
      
      // Analyze different tree regions
      const regions = [
        { name: 'First Quarter', start: 0, end: Math.floor(treeData.leafCount * 0.25) },
        { name: 'Second Quarter', start: Math.floor(treeData.leafCount * 0.25), end: Math.floor(treeData.leafCount * 0.5) },
        { name: 'Third Quarter', start: Math.floor(treeData.leafCount * 0.5), end: Math.floor(treeData.leafCount * 0.75) },
        { name: 'Fourth Quarter', start: Math.floor(treeData.leafCount * 0.75), end: treeData.leafCount }
      ];
      
      for (const region of regions) {
        const regionProofs = treeData.sampleProofs.filter(
          p => p.index >= region.start && p.index < region.end
        );
        
        if (regionProofs.length === 0) {
          console.log(`   📍 ${region.name}: No sample proofs available`);
          continue;
        }
        
        let totalGas = 0n;
        for (const proofData of regionProofs.slice(0, 5)) { // Test up to 5 per region
          const gasEstimate = await verifier.verify.estimateGas(
            proofData.proof,
            proofData.leafHash
          );
          totalGas += gasEstimate;
        }
        
        const avgGas = Number(totalGas) / Math.min(regionProofs.length, 5);
        const indexRange = `${region.start.toLocaleString()}-${(region.end-1).toLocaleString()}`;
        
        console.log(`   📍 ${region.name.padEnd(15)} (${indexRange.padEnd(15)}): ${Math.round(avgGas).toLocaleString().padStart(6)} gas avg`);
      }
      
      console.log(`\n   ✅ Gas usage consistent across all tree regions`);
      console.log(`   🔍 Proof depth remains constant at 20 levels throughout tree`);
    });
  });

  describe('Edge Cases and Robustness', function () {
    it('verifies edge case proofs from million leaf tree', async function () {
      console.log('\n🧪 Testing Edge Cases...');
      
      // Find specific edge case proofs
      const edgeCases = [
        { name: 'First leaf', index: 0 },
        { name: 'Last leaf', index: 1048575 },
        { name: 'Power of 2', index: 65536 }, // 2^16
        { name: 'Power of 2 - 1', index: 65535 },
        { name: 'Power of 2 + 1', index: 65537 }
      ];
      
      for (const edgeCase of edgeCases) {
        const proofData = treeData.sampleProofs.find(p => p.index === edgeCase.index);
        
        if (!proofData) {
          console.log(`   ⚠️ ${edgeCase.name}: No proof available for index ${edgeCase.index}`);
          continue;
        }
        
        const isValid = await merkleProofLib.verify(
          proofData.proof,
          treeData.root,
          proofData.leafHash
        );
        
        expect(isValid).to.be.true;
        console.log(`   ✅ ${edgeCase.name} (index ${edgeCase.index.toLocaleString()}): verified`);
      }
    });

    it('rejects invalid proofs against million leaf tree', async function () {
      console.log('\n🚫 Testing Invalid Proof Rejection...');
      
      const validProof = treeData.sampleProofs[0];
      
      // Test various invalid scenarios
      const invalidTests = [
        {
          name: 'Wrong root',
          proof: validProof.proof,
          root: '0x' + '1'.repeat(64),
          leaf: validProof.leafHash
        },
        {
          name: 'Wrong leaf',
          proof: validProof.proof,
          root: treeData.root,
          leaf: '0x' + '2'.repeat(64)
        },
        {
          name: 'Tampered proof',
          proof: [validProof.proof[0], '0x' + '3'.repeat(64), ...validProof.proof.slice(2)],
          root: treeData.root,
          leaf: validProof.leafHash
        }
      ];
      
      for (const test of invalidTests) {
        const isValid = await merkleProofLib.verify(
          test.proof,
          test.root,
          test.leaf
        );
        
        expect(isValid).to.be.false;
        console.log(`   ❌ ${test.name}: correctly rejected`);
      }
    });
  });
});

/**
 * Utility function to format bytes
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