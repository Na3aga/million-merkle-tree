import { ethers } from "hardhat";

/**
 * Random generators for test data
 */
export const generators = {
  /**
   * Generate a random bytes32 value
   */
  bytes32(): string {
    return ethers.keccak256(ethers.randomBytes(32));
  },

  /**
   * Generate a random address
   */
  address(): string {
    return ethers.Wallet.createRandom().address;
  },

  /**
   * Generate a random uint256 value
   */
  uint256(): bigint {
    return BigInt(ethers.randomBytes(32).reduce((acc, byte, i) => 
      acc + (BigInt(byte) << BigInt(8 * i)), 0n
    ));
  },

  /**
   * Generate a random boolean
   */
  boolean(): boolean {
    return Math.random() < 0.5;
  },

  /**
   * Generate a random string of specified length
   */
  string(length: number = 10): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Generate a random number within a range
   */
  number(min: number = 0, max: number = 1000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}; 