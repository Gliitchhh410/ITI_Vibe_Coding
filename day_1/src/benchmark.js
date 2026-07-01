import { quickSortRecursive, quickSortIterative, quickSortBasic } from './quicksort.js';
import { mergeSort, heapSort, builtInSort } from './sorting.js';

// Get high-resolution timestamp function available in the environment
const getNow = () => {
  if (typeof window !== 'undefined' && window.performance) {
    return window.performance.now();
  }
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now();
  }
  return Date.now();
};

/**
 * Generates test datasets.
 */
export function generateDataset(type, size) {
  const arr = [];
  if (type === 'random') {
    for (let i = 0; i < size; i++) {
      arr.push(Math.floor(Math.random() * size * 10));
    }
  } else if (type === 'sorted') {
    for (let i = 0; i < size; i++) {
      arr.push(i);
    }
  } else if (type === 'reversed') {
    for (let i = size - 1; i >= 0; i--) {
      arr.push(i);
    }
  } else if (type === 'duplicates') {
    const base = [1, 2, 3, 4, 5];
    for (let i = 0; i < size; i++) {
      arr.push(base[i % base.length]);
    }
  }
  return arr;
}

/**
 * Benchmarks a single algorithm on a given array.
 * Runs the sort multiple times for small arrays to get a reliable reading,
 * or runs once for larger arrays.
 */
function measureExecutionTime(sortFunc, arr) {
  const copy = [...arr];
  const start = getNow();
  try {
    sortFunc(copy);
  } catch (err) {
    return { error: err.message };
  }
  const end = getNow();
  return end - start;
}

/**
 * Runs benchmarks for all algorithms for a given size and array profile.
 */
export function runBenchmarkSuite(size) {
  const profiles = ['random', 'sorted', 'reversed', 'duplicates'];
  const algorithms = {
    'QuickSort (Recursive Optimized)': quickSortRecursive,
    'QuickSort (Iterative)': quickSortIterative,
    'QuickSort (Basic)': (arr) => {
      // Basic quicksort can stack overflow on sorted array of size 5000+
      // So we cap the size or handle error
      if (size > 3000) {
        throw new Error('Skipped to prevent StackOverflow');
      }
      return quickSortBasic(arr);
    },
    'MergeSort': mergeSort,
    'HeapSort': heapSort,
    'Built-in JS Sort': builtInSort
  };

  const results = {};

  profiles.forEach(profile => {
    results[profile] = {};
    const data = generateDataset(profile, size);
    
    Object.keys(algorithms).forEach(algoName => {
      const sortFunc = algorithms[algoName];
      try {
        const time = measureExecutionTime(sortFunc, data);
        results[profile][algoName] = typeof time === 'number' ? parseFloat(time.toFixed(4)) : time;
      } catch (err) {
        results[profile][algoName] = { error: err.message };
      }
    });
  });

  return results;
}
