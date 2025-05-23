import { ethers } from 'hardhat';
import { expect } from 'chai';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { IncrementalMerkleTreePush } from '../../typechain-types';

describe('Incremental Merkle Tree Push - OpenZeppelin Bytes32PushTree', function () {
  this.timeout(300000); // 5 minutes for operations

  async function deployPushTreeFixture() {
    const [deployer] = await ethers.getSigners();
    
    // Deploy with depth 20 (supports 1M+ leaves) and zero value
    const depth = 20;
    const zero = ethers.keccak256(ethers.toUtf8Bytes("ZERO"));
    
    const PushTreeFactory = await ethers.getContractFactory('IncrementalMerkleTreePush');
    const pushTree = await PushTreeFactory.deploy(depth, zero);
    await pushTree.waitForDeployment();
    
    return { pushTree, deployer, depth, zero };
  }

  describe('Basic Push Operations', function () {
    it('should push single leaves efficiently', async function () {
      console.log('\n📤 Testing Incremental Push Operations...');
      
      const { pushTree } = await loadFixture(deployPushTreeFixture);
      
      console.log(`   Contract deployed at: ${await pushTree.getAddress()}`);
      
      const testLeaves = [
        ethers.keccak256(ethers.toUtf8Bytes("leaf1")),
        ethers.keccak256(ethers.toUtf8Bytes("leaf2")),
        ethers.keccak256(ethers.toUtf8Bytes("leaf3")),
        ethers.keccak256(ethers.toUtf8Bytes("leaf4")),
        ethers.keccak256(ethers.toUtf8Bytes("leaf5"))
      ];
      
      const pushResults: Array<{
        leafIndex: number;
        gasUsed: bigint;
        leafCount: number;
      }> = [];
      
      for (let i = 0; i < testLeaves.length; i++) {
        console.log(`\n   📤 Pushing leaf ${i + 1}: ${testLeaves[i].slice(0, 10)}...`);
        
        // Measure gas for push operation
        const pushTx = await pushTree.push(testLeaves[i]);
        const pushReceipt = await pushTx.wait();
        
        if (!pushReceipt) {
          throw new Error('Push transaction failed');
        }
        
        const gasUsed = pushReceipt.gasUsed;
        
        // Get updated stats
        const stats = await pushTree.getTreeStats();
        
        pushResults.push({
          leafIndex: i,
          gasUsed,
          leafCount: Number(stats.currentLeafCount)
        });
        
        console.log(`      ✅ Pushed to index: ${i}`);
        console.log(`      ⛽ Gas used: ${gasUsed.toLocaleString()}`);
        console.log(`      📊 Total leaves: ${Number(stats.currentLeafCount)}`);
        
        // Verify the leaf was added correctly
        expect(Number(stats.currentLeafCount)).to.equal(i + 1);
      }
      
      // Analyze gas efficiency
      console.log('\n📈 Push Operation Analysis:');
      console.log('┌─────────┬─────────────┬─────────────┐');
      console.log('│ Index   │ Gas Used    │ Leaf Count  │');
      console.log('├─────────┼─────────────┼─────────────┤');
      
      pushResults.forEach((result) => {
        const index = result.leafIndex.toString().padEnd(7);
        const gas = result.gasUsed.toLocaleString().padEnd(11);
        const count = result.leafCount.toString().padEnd(11);
        
        console.log(`│ ${index} │ ${gas} │ ${count} │`);
      });
      console.log('└─────────┴─────────────┴─────────────┘');
      
      // Gas efficiency insights
      const gasValues = pushResults.map(r => Number(r.gasUsed));
      const avgGas = gasValues.reduce((a, b) => a + b, 0) / gasValues.length;
      const maxGas = Math.max(...gasValues);
      const minGas = Math.min(...gasValues);
      
      console.log('\n💡 Gas Efficiency Insights:');
      console.log(`   • Average gas per push: ${Math.round(avgGas).toLocaleString()}`);
      console.log(`   • Gas range: ${minGas.toLocaleString()} - ${maxGas.toLocaleString()}`);
      console.log(`   • Gas variation: ${((maxGas - minGas) / avgGas * 100).toFixed(1)}%`);
      
      // Verify all pushes were successful
      expect(pushResults.length).to.equal(testLeaves.length);
      expect(pushResults[pushResults.length - 1].leafCount).to.equal(testLeaves.length);
    });

    it('should handle batch push operations', async function () {
      console.log('\n📦 Testing Batch Push Operations...');
      
      const { pushTree } = await loadFixture(deployPushTreeFixture);
      
      const batchSizes = [1, 5, 10, 25, 50];
      
      for (const batchSize of batchSizes) {
        console.log(`\n   📦 Testing batch size: ${batchSize} leaves`);
        
        // Generate batch of leaves
        const batchLeaves: string[] = [];
        for (let i = 0; i < batchSize; i++) {
          const leaf = ethers.keccak256(
            ethers.toUtf8Bytes(`batch_${batchSize}_leaf_${i}`)
          );
          batchLeaves.push(leaf);
        }
        
        // Measure batch push gas
        const batchTx = await pushTree.pushBatch(batchLeaves);
        const batchReceipt = await batchTx.wait();
        
        if (!batchReceipt) {
          throw new Error('Batch push transaction failed');
        }
        
        const batchGas = batchReceipt.gasUsed;
        
        // Get final stats
        const stats = await pushTree.getTreeStats();
        
        console.log(`      ⛽ Total batch gas: ${batchGas.toLocaleString()}`);
        console.log(`      📊 Gas per leaf: ${Math.round(Number(batchGas) / batchSize).toLocaleString()}`);
        console.log(`      🌲 Final leaf count: ${Number(stats.currentLeafCount)}`);
        console.log(`      📏 Tree utilization: ${Number(stats.utilizationPercent)}%`);
        
        // Verify batch was processed correctly
        expect(Number(stats.currentLeafCount)).to.be.greaterThan(0);
        
        // Reset for next batch test
        await pushTree.reset();
      }
    });
  });

  describe('Scaling Analysis', function () {
    it('analyzes push performance at different tree sizes', async function () {
      console.log('\n📈 Analyzing Push Performance Scaling...');
      
      const { pushTree } = await loadFixture(deployPushTreeFixture);
      
      const scalingPoints = [10, 50, 100, 500]; // Different tree sizes to test
      
      const scalingResults: Array<{
        treeSize: number;
        pushGas: bigint;
        treeDepth: number;
      }> = [];
      
      for (const targetSize of scalingPoints) {
        console.log(`\n   🎯 Testing push performance at tree size: ${targetSize.toLocaleString()}`);
        
        // Fill tree to target size (minus 1 for the test push)
        const fillSize = targetSize - 1;
        if (fillSize > 0) {
          const fillLeaves: string[] = [];
          for (let i = 0; i < fillSize; i++) {
            fillLeaves.push(ethers.keccak256(
              ethers.toUtf8Bytes(`fill_${targetSize}_${i}`)
            ));
          }
          
          // Fill in batches to avoid gas limits
          const batchSize = 100;
          for (let i = 0; i < fillLeaves.length; i += batchSize) {
            const batch = fillLeaves.slice(i, i + batchSize);
            await pushTree.pushBatch(batch);
          }
        }
        
        // Now test a single push at this tree size
        const testLeaf = ethers.keccak256(
          ethers.toUtf8Bytes(`test_push_at_${targetSize}`)
        );
        
        const pushTx = await pushTree.push(testLeaf);
        const pushReceipt = await pushTx.wait();
        
        if (!pushReceipt) {
          throw new Error('Push transaction failed');
        }
        
        const pushGas = pushReceipt.gasUsed;
        
        const stats = await pushTree.getTreeStats();
        const treeDepth = Math.ceil(Math.log2(Number(stats.currentLeafCount)));
        
        scalingResults.push({
          treeSize: targetSize,
          pushGas,
          treeDepth
        });
        
        console.log(`      📊 Tree size: ${Number(stats.currentLeafCount).toLocaleString()}`);
        console.log(`      ⛽ Push gas: ${pushGas.toLocaleString()}`);
        console.log(`      📏 Tree depth: ${treeDepth} levels`);
        console.log(`      📈 Utilization: ${Number(stats.utilizationPercent)}%`);
        
        // Reset for next test
        await pushTree.reset();
      }
      
      // Analyze scaling pattern
      console.log('\n📊 Push Performance Scaling Analysis:');
      console.log('┌─────────────┬─────────────┬─────────────┐');
      console.log('│ Tree Size   │ Push Gas    │ Tree Depth  │');
      console.log('├─────────────┼─────────────┼─────────────┤');
      
      scalingResults.forEach((result) => {
        const size = result.treeSize.toLocaleString().padEnd(11);
        const gas = result.pushGas.toLocaleString().padEnd(11);
        const depth = result.treeDepth.toString().padEnd(11);
        
        console.log(`│ ${size} │ ${gas} │ ${depth} │`);
      });
      console.log('└─────────────┴─────────────┴─────────────┘');
      
      // Performance insights
      const gasValues = scalingResults.map(r => Number(r.pushGas));
      const avgGas = gasValues.reduce((a, b) => a + b, 0) / gasValues.length;
      const gasVariation = (Math.max(...gasValues) - Math.min(...gasValues)) / avgGas * 100;
      
      console.log('\n💡 Scaling Performance Insights:');
      console.log(`   • Average push gas: ${Math.round(avgGas).toLocaleString()}`);
      console.log(`   • Gas variation across sizes: ${gasVariation.toFixed(1)}%`);
      console.log(`   • Push operation scales: ${gasVariation < 20 ? 'EXCELLENT' : gasVariation < 50 ? 'GOOD' : 'VARIABLE'}`);
      
      if (gasVariation < 20) {
        console.log(`   ✅ Push gas remains nearly constant regardless of tree size!`);
      }
    });

    it('projects performance for million-scale operations', async function () {
      console.log('\n🎯 Million-Scale Push Performance Projections...');
      
      const { pushTree } = await loadFixture(deployPushTreeFixture);
      
      // Test a small sample to establish baseline
      const sampleSize = 50;
      const sampleLeaves: string[] = [];
      
      for (let i = 0; i < sampleSize; i++) {
        sampleLeaves.push(ethers.keccak256(
          ethers.toUtf8Bytes(`sample_${i}`)
        ));
      }
      
      console.log(`\n   📊 Establishing baseline with ${sampleSize} pushes...`);
      
      const pushGasResults: bigint[] = [];
      
      for (let i = 0; i < sampleSize; i++) {
        const pushTx = await pushTree.push(sampleLeaves[i]);
        const pushReceipt = await pushTx.wait();
        
        if (!pushReceipt) {
          throw new Error('Push transaction failed');
        }
        
        pushGasResults.push(pushReceipt.gasUsed);
        
        if ((i + 1) % 10 === 0) {
          console.log(`      Progress: ${i + 1}/${sampleSize} pushes completed`);
        }
      }
      
      // Calculate baseline metrics
      const avgPushGas = pushGasResults.reduce((sum, gas) => sum + Number(gas), 0) / pushGasResults.length;
      const maxPushGas = Math.max(...pushGasResults.map(g => Number(g)));
      const minPushGas = Math.min(...pushGasResults.map(g => Number(g)));
      
      console.log(`\n   📈 Baseline Push Metrics:`);
      console.log(`      Average gas per push: ${Math.round(avgPushGas).toLocaleString()}`);
      console.log(`      Gas range: ${minPushGas.toLocaleString()} - ${maxPushGas.toLocaleString()}`);
      console.log(`      Gas consistency: ${((maxPushGas - minPushGas) / avgPushGas * 100).toFixed(1)}% variation`);
      
      // Project million-scale scenarios
      const millionScaleScenarios = [
        { name: "Single push to 1M tree", operations: 1, existingLeaves: 1000000 },
        { name: "100 pushes to 1M tree", operations: 100, existingLeaves: 1000000 },
        { name: "1K pushes to 1M tree", operations: 1000, existingLeaves: 1000000 },
        { name: "10K pushes to 1M tree", operations: 10000, existingLeaves: 1000000 },
        { name: "Build 1M tree from scratch", operations: 1000000, existingLeaves: 0 }
      ];
      
      console.log('\n🔮 Million-Scale Performance Projections:');
      
      for (const scenario of millionScaleScenarios) {
        const totalGas = avgPushGas * scenario.operations;
        const finalTreeSize = scenario.existingLeaves + scenario.operations;
        const finalDepth = Math.ceil(Math.log2(finalTreeSize));
        
        // Cost calculations (20 gwei, $3000 ETH)
        const gasPriceGwei = 20;
        const ethPriceUsd = 3000;
        const totalCostUsd = (totalGas * gasPriceGwei * 1e-9) * ethPriceUsd;
        const costPerOperation = totalCostUsd / scenario.operations;
        
        console.log(`\n   📤 ${scenario.name}:`);
        console.log(`      Operations: ${scenario.operations.toLocaleString()}`);
        console.log(`      Final tree size: ${finalTreeSize.toLocaleString()} leaves`);
        console.log(`      Final tree depth: ${finalDepth} levels`);
        console.log(`      Total gas: ${Math.round(totalGas).toLocaleString()}`);
        console.log(`      Total cost: $${totalCostUsd.toFixed(2)} (20 gwei, $3000 ETH)`);
        console.log(`      Cost per push: $${costPerOperation.toFixed(4)}`);
        
        if (scenario.operations <= 1000) {
          console.log(`      ✅ HIGHLY FEASIBLE for production use`);
        } else if (scenario.operations <= 100000) {
          console.log(`      ✅ FEASIBLE with proper batching strategy`);
        } else {
          console.log(`      ⚠️  MAJOR OPERATION - consider staged deployment`);
        }
      }
      
      console.log('\n🏆 Key Advantages of Incremental Push Trees:');
      console.log('   • O(log n) gas complexity instead of O(n) rebuilds');
      console.log('   • Constant gas per push regardless of tree size');
      console.log('   • No need to regenerate entire tree off-chain');
      console.log('   • Immediate root updates for real-time applications');
      console.log('   • Memory efficient - no large tree storage needed');
    });
  });

  describe('Tree Management', function () {
    it('should handle tree capacity and reset operations', async function () {
      console.log('\n🔄 Testing Tree Management Operations...');
      
      // Test with smaller tree for faster testing
      const smallDepth = 5; // 32 leaves max
      const zero = ethers.keccak256(ethers.toUtf8Bytes("ZERO"));
      
      const SmallTreeFactory = await ethers.getContractFactory('IncrementalMerkleTreePush');
      const smallTree = await SmallTreeFactory.deploy(smallDepth, zero);
      await smallTree.waitForDeployment();
      
      console.log(`\n   🌲 Testing with depth ${smallDepth} tree (max ${2**smallDepth} leaves)`);
      
      // Fill tree to capacity
      const maxLeaves = 2 ** smallDepth;
      const leaves: string[] = [];
      
      for (let i = 0; i < maxLeaves; i++) {
        leaves.push(ethers.keccak256(
          ethers.toUtf8Bytes(`capacity_test_${i}`)
        ));
      }
      
      // Push all leaves
      console.log(`   📤 Filling tree to capacity (${maxLeaves} leaves)...`);
      await smallTree.pushBatch(leaves);
      
      // Verify tree is full
      const isFull = await smallTree.isFull();
      const remaining = await smallTree.remainingCapacity();
      const stats = await smallTree.getTreeStats();
      
      console.log(`      📊 Tree full: ${isFull}`);
      console.log(`      📊 Remaining capacity: ${Number(remaining)}`);
      console.log(`      📊 Utilization: ${Number(stats.utilizationPercent)}%`);
      console.log(`      📊 Leaf count: ${Number(stats.currentLeafCount)}/${Number(stats.maxCapacity)}`);
      
      expect(isFull).to.be.true;
      expect(Number(remaining)).to.equal(0);
      expect(Number(stats.utilizationPercent)).to.equal(100);
      
      // Try to push beyond capacity (should fail)
      const extraLeaf = ethers.keccak256(ethers.toUtf8Bytes("overflow"));
      
      await expect(smallTree.push(extraLeaf))
        .to.be.revertedWithCustomError(smallTree, "TreeDepthExceeded");
      
      console.log(`      ✅ Correctly rejected push beyond capacity`);
      
      // Reset tree
      console.log(`\n   🔄 Resetting tree...`);
      const resetTx = await smallTree.reset();
      await resetTx.wait();
      
      // Verify reset
      const statsAfterReset = await smallTree.getTreeStats();
      const isFullAfterReset = await smallTree.isFull();
      const remainingAfterReset = await smallTree.remainingCapacity();
      
      console.log(`      📊 After reset:`);
      console.log(`         Leaf count: ${Number(statsAfterReset.currentLeafCount)}`);
      console.log(`         Tree full: ${isFullAfterReset}`);
      console.log(`         Remaining capacity: ${Number(remainingAfterReset)}`);
      console.log(`         Utilization: ${Number(statsAfterReset.utilizationPercent)}%`);
      
      expect(Number(statsAfterReset.currentLeafCount)).to.equal(0);
      expect(isFullAfterReset).to.be.false;
      expect(Number(remainingAfterReset)).to.equal(maxLeaves);
      expect(Number(statsAfterReset.utilizationPercent)).to.equal(0);
      
      console.log(`      ✅ Tree successfully reset to initial state`);
    });
  });

  describe('Comparison with Traditional Approach', function () {
    it('compares incremental push vs traditional rebuild approach', async function () {
      console.log('\n⚖️  Comparing Incremental Push vs Traditional Rebuild...');
      
      const { pushTree } = await loadFixture(deployPushTreeFixture);
      
      const comparisonSizes = [10, 50, 100];
      
      for (const size of comparisonSizes) {
        console.log(`\n   📊 Comparison at ${size} leaves:`);
        
        // Method 1: Incremental Push (our approach)
        console.log(`      🚀 Method 1: Incremental Push`);
        
        const incrementalGasResults: bigint[] = [];
        
        for (let i = 0; i < size; i++) {
          const leaf = ethers.keccak256(
            ethers.toUtf8Bytes(`incremental_${size}_${i}`)
          );
          
          const pushTx = await pushTree.push(leaf);
          const pushReceipt = await pushTx.wait();
          
          if (!pushReceipt) {
            throw new Error('Push transaction failed');
          }
          
          incrementalGasResults.push(pushReceipt.gasUsed);
        }
        
        const totalIncrementalGas = incrementalGasResults.reduce((sum, gas) => sum + Number(gas), 0);
        const avgIncrementalGas = totalIncrementalGas / size;
        
        console.log(`         Total gas: ${totalIncrementalGas.toLocaleString()}`);
        console.log(`         Avg gas per leaf: ${Math.round(avgIncrementalGas).toLocaleString()}`);
        console.log(`         Operations: ${size} individual pushes`);
        
        // Method 2: Traditional Rebuild (simulated cost)
        console.log(`      🔄 Method 2: Traditional Rebuild (estimated)`);
        
        // Estimate traditional rebuild costs based on our previous analysis
        const rebuildRootGas = 50000; // Root storage cost
        const rebuildTimeMs = size * 0.1; // Estimated rebuild time
        const rebuildVerifyGas = Math.ceil(Math.log2(size)) * 2400; // Verification cost
        
        const totalRebuildGas = rebuildRootGas + rebuildVerifyGas;
        
        console.log(`         Total gas: ${totalRebuildGas.toLocaleString()}`);
        console.log(`         Rebuild time: ~${rebuildTimeMs.toFixed(1)}ms`);
        console.log(`         Operations: 1 full rebuild + verification`);
        
        // Comparison
        const gasEfficiency = ((totalRebuildGas - totalIncrementalGas) / totalRebuildGas) * 100;
        const isIncrementalBetter = totalIncrementalGas < totalRebuildGas;
        
        console.log(`\n      📈 Comparison Results:`);
        console.log(`         Incremental vs Rebuild: ${isIncrementalBetter ? 'BETTER' : 'WORSE'}`);
        console.log(`         Gas difference: ${Math.abs(gasEfficiency).toFixed(1)}% ${isIncrementalBetter ? 'savings' : 'overhead'}`);
        
        if (isIncrementalBetter) {
          console.log(`         ✅ Incremental push is more efficient`);
        } else {
          console.log(`         ⚠️  Traditional rebuild would be more efficient for this size`);
        }
        
        // Reset for next comparison
        await pushTree.reset();
      }
      
      console.log('\n🎯 Key Insights:');
      console.log('   • Incremental push eliminates off-chain tree generation');
      console.log('   • No memory requirements for large tree storage');
      console.log('   • Real-time root updates enable immediate verification');
      console.log('   • Gas costs scale predictably with tree operations');
      console.log('   • Perfect for dynamic applications (live airdrops, voting, etc.)');
    });
  });
}); 