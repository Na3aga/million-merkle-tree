/**
 * Generate a range of numbers
 * @param start Starting number (inclusive)
 * @param end Ending number (exclusive) - optional, if not provided, start becomes end and start becomes 0
 * @param step Step size (default: 1)
 */
export function range(start: number, end?: number, step: number = 1): number[] {
  if (end === undefined) {
    end = start;
    start = 0;
  }
  
  const result: number[] = [];
  for (let i = start; i < end; i += step) {
    result.push(i);
  }
  return result;
}

/**
 * Generate combinations of items
 * @param items Array of items to combine
 * @param size Size of each combination
 */
export function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (size > items.length) return [];
  if (size === items.length) return [items];
  
  const result: T[][] = [];
  
  for (let i = 0; i <= items.length - size; i++) {
    const rest = combinations(items.slice(i + 1), size - 1);
    for (const combination of rest) {
      result.push([items[i], ...combination]);
    }
  }
  
  return result;
}

/**
 * Generate permutations of items
 * @param items Array of items to permute
 * @param size Size of each permutation (optional, defaults to items.length)
 */
export function permutations<T>(items: T[], size?: number): T[][] {
  if (size === undefined) size = items.length;
  if (size === 0) return [[]];
  if (size > items.length) return [];
  
  const result: T[][] = [];
  
  for (let i = 0; i < items.length; i++) {
    const rest = permutations(
      items.slice(0, i).concat(items.slice(i + 1)), 
      size - 1
    );
    for (const permutation of rest) {
      result.push([items[i], ...permutation]);
    }
  }
  
  return result;
}

/**
 * Chunk an array into smaller arrays of specified size
 * @param items Array to chunk
 * @param size Size of each chunk
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * Zip multiple arrays together
 * @param arrays Arrays to zip
 */
export function zip<T>(...arrays: T[][]): T[][] {
  const minLength = Math.min(...arrays.map(arr => arr.length));
  const result: T[][] = [];
  
  for (let i = 0; i < minLength; i++) {
    result.push(arrays.map(arr => arr[i]));
  }
  
  return result;
}

/**
 * Create cartesian product of arrays
 * @param arrays Arrays to create cartesian product from
 */
export function cartesian<T>(...arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, curr) => {
    const result: T[][] = [];
    for (const a of acc) {
      for (const c of curr) {
        result.push([...a, c]);
      }
    }
    return result;
  }, [[]]);
} 