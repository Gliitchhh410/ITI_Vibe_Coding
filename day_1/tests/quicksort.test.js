import { describe, test, expect } from 'vitest';
import { quickSortRecursive, quickSortIterative } from '../src/quicksort.js';

describe('QuickSort Recursive', () => {
  test('should sort empty array', () => {
    expect(quickSortRecursive([])).toEqual([]);
  });

  test('should sort single element array', () => {
    expect(quickSortRecursive([42])).toEqual([42]);
  });

  test('should sort a standard unsorted array', () => {
    expect(quickSortRecursive([5, 3, 8, 4, 1, 2, 9])).toEqual([1, 2, 3, 4, 5, 8, 9]);
  });

  test('should sort an already sorted array', () => {
    expect(quickSortRecursive([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });

  test('should sort a reverse sorted array', () => {
    expect(quickSortRecursive([5, 4, 3, 2, 1])).toEqual([1, 2, 3, 4, 5]);
  });

  test('should sort an array with duplicate elements', () => {
    expect(quickSortRecursive([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5])).toEqual([1, 1, 2, 3, 3, 4, 5, 5, 5, 6, 9]);
  });

  test('should throw TypeErrors for invalid inputs', () => {
    expect(() => quickSortRecursive("not an array")).toThrow(TypeError);
    expect(() => quickSortRecursive([1, 2, "three"])).toThrow(TypeError);
    expect(() => quickSortRecursive([1, null, 3])).toThrow(TypeError);
  });

  test('should sort a large array', () => {
    const largeArr = Array.from({ length: 1000 }, () => Math.floor(Math.random() * 10000));
    const sorted = quickSortRecursive(largeArr);
    
    // Check if sorted
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i]).toBeLessThanOrEqual(sorted[i + 1]);
    }
  });
});

describe('QuickSort Iterative', () => {
  test('should sort empty array', () => {
    expect(quickSortIterative([])).toEqual([]);
  });

  test('should sort single element array', () => {
    expect(quickSortIterative([42])).toEqual([42]);
  });

  test('should sort a standard unsorted array', () => {
    expect(quickSortIterative([5, 3, 8, 4, 1, 2, 9])).toEqual([1, 2, 3, 4, 5, 8, 9]);
  });

  test('should sort an already sorted array', () => {
    expect(quickSortIterative([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });

  test('should sort a reverse sorted array', () => {
    expect(quickSortIterative([5, 4, 3, 2, 1])).toEqual([1, 2, 3, 4, 5]);
  });

  test('should sort an array with duplicate elements', () => {
    expect(quickSortIterative([3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5])).toEqual([1, 1, 2, 3, 3, 4, 5, 5, 5, 6, 9]);
  });

  test('should throw TypeErrors for invalid inputs', () => {
    expect(() => quickSortIterative("not an array")).toThrow(TypeError);
    expect(() => quickSortIterative([1, 2, "three"])).toThrow(TypeError);
  });
});

/**
 * INTENTIONAL BUG TEST (Step 8 of Lab)
 * We will write a test that intentionally checks for correct sort behaviour on a failing condition,
 * simulating a bug in pivot partitioning.
 * 
 * Let's say we had a bug where we forgot to return the partition index correctly, 
 * or did a swap off-by-one.
 * 
 * Here we write a test for an intentional buggy implementation: `quickSortBuggy`.
 */
function quickSortBuggy(arr) {
  if (arr.length <= 1) return arr;
  const target = [...arr];
  
  function solve(l, r) {
    if (l >= r) return;
    
    // INTENTIONAL BUG: We pick the rightmost element as pivot,
    // but in the swap we do swap(target, i, r) instead of swap(target, i + 1, r)
    // which results in incorrect partitions and unsorted arrays.
    const pivot = target[r];
    let i = l - 1;
    for (let j = l; j < r; j++) {
      if (target[j] < pivot) {
        i++;
        const tmp = target[i];
        target[i] = target[j];
        target[j] = tmp;
      }
    }
    
    // BUG HERE: We swapped target[i] with target[r] instead of target[i+1]
    const tmp = target[i];
    target[i] = target[r];
    target[r] = tmp;
    
    const p = i;
    
    solve(l, p - 1);
    solve(p + 1, r);
  }
  
  solve(0, target.length - 1);
  return target;
}

describe('QuickSort Intentional Bug Debugging', () => {
  test('should show bug in naive implementation', () => {
    const input = [3, 1, 2];
    let caughtError = null;
    let sorted = null;
    
    try {
      sorted = quickSortBuggy(input);
    } catch (e) {
      caughtError = e;
    }
    
    // The buggy implementation should either throw a Call Stack overflow (RangeError) or fail to sort
    if (caughtError) {
      expect(caughtError).toBeInstanceOf(RangeError);
    } else {
      expect(sorted).not.toEqual([1, 2, 3]);
    }
  });
});
