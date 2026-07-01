/**
 * QuickSort implementations with optimizations (Median-of-Three, Insertion Sort fallback).
 * 
 * GitHub Copilot Explanation:
 * QuickSort is a Divide-and-Conquer algorithm. It picks an element as a pivot and partitions
 * the array around the picked pivot by placing all smaller elements to the left of the pivot
 * and all greater elements to the right.
 * 
 * Key Components:
 * - Pivot Selection: Choosing a pivot element.
 * - Partitioning: Rearranging the array so that elements smaller than pivot are on the left,
 *   and elements larger than pivot are on the right.
 * - Recursion / Stack: Recursively sorting the sub-arrays.
 */

/**
 * Insertion Sort fallback for small subarrays.
 * Insertion sort is faster for small array sizes (typically N < 10) due to low constant factors.
 * @param {Array<number>} arr - Array to sort
 * @param {number} left - Left index
 * @param {number} right - Right index
 */
function insertionSort(arr, left, right) {
  for (let i = left + 1; i <= right; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= left && arr[j] > key) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key;
  }
}

/**
 * Swap two elements in an array.
 */
function swap(arr, i, j) {
  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
}

/**
 * Median-of-three pivot selection.
 * Moves the median of first, middle, and last elements to the rightmost position (pivot).
 * This helps avoid the O(N^2) worst-case scenario on sorted or nearly sorted arrays.
 */
function medianOfThree(arr, left, right) {
  const mid = Math.floor((left + right) / 2);
  
  if (arr[left] > arr[mid]) swap(arr, left, mid);
  if (arr[left] > arr[right]) swap(arr, left, right);
  if (arr[mid] > arr[right]) swap(arr, mid, right);
  
  // Place pivot (mid) at right - 1 (a standard optimization)
  // Or just use the rightmost element as pivot after sorting the three
  // Let's place it at right - 1 to protect it during partitioning
  swap(arr, mid, right - 1);
  return arr[right - 1]; // Return pivot value
}

/**
 * Standard partition function using Lomuto or Hoare partitioning.
 * We'll use Lomuto partition with the pivot at right-1 (placed by medianOfThree).
 */
function partition(arr, left, right) {
  // If array length is very small, we shouldn't even call partition
  const pivot = medianOfThree(arr, left, right);
  const pivotIndex = right - 1;
  
  let i = left; // Index of smaller element
  
  // Since pivot is at right-1, loop goes from left+1 to right-2
  // Because left is <= pivot and right is >= pivot due to medianOfThree
  for (let j = left + 1; j < right - 1; j++) {
    if (arr[j] < pivot) {
      i++;
      swap(arr, i, j);
    }
  }
  
  // Swap the pivot element to its correct position (i + 1)
  swap(arr, i + 1, pivotIndex);
  return i + 1;
}

/**
 * Validate input to ensure it is a valid array of numbers.
 * @param {*} arr 
 */
function validateInput(arr) {
  if (!Array.isArray(arr)) {
    throw new TypeError("Input must be an array");
  }
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'number' || Number.isNaN(arr[i])) {
      throw new TypeError("Array elements must be valid numbers");
    }
  }
}

/**
 * Recursive QuickSort entry point.
 * @param {Array<number>} arr - Array to sort
 * @param {boolean} [inplace=false] - Whether to sort in-place (mutating the input array)
 * @returns {Array<number>} The sorted array
 */
export function quickSortRecursive(arr, inplace = false) {
  validateInput(arr);
  const targetArr = inplace ? arr : [...arr];
  
  const threshold = 10; // Subarrays smaller than 10 are sorted with insertion sort
  
  function solve(l, r) {
    if (r - l + 1 <= threshold) {
      insertionSort(targetArr, l, r);
      return;
    }
    
    // Partition and get pivot index
    const p = partition(targetArr, l, r);
    solve(l, p - 1);
    solve(p + 1, r);
  }
  
  if (targetArr.length > 1) {
    solve(0, targetArr.length - 1);
  }
  return targetArr;
}

/**
 * Iterative QuickSort using an explicit stack.
 * Prevents StackOverflow errors on extremely deep recursion.
 * @param {Array<number>} arr - Array to sort
 * @param {boolean} [inplace=false] - Whether to sort in-place
 * @returns {Array<number>} The sorted array
 */
export function quickSortIterative(arr, inplace = false) {
  validateInput(arr);
  const targetArr = inplace ? arr : [...arr];
  
  if (targetArr.length <= 1) {
    return targetArr;
  }
  
  const stack = [];
  
  // Push initial boundary
  stack.push(0);
  stack.push(targetArr.length - 1);
  
  const threshold = 10;
  
  while (stack.length > 0) {
    const right = stack.pop();
    const left = stack.pop();
    
    if (right - left + 1 <= threshold) {
      insertionSort(targetArr, left, right);
      continue;
    }
    
    // Partition
    const p = partition(targetArr, left, right);
    
    // Push left subarray
    if (p - 1 > left) {
      stack.push(left);
      stack.push(p - 1);
    }
    
    // Push right subarray
    if (p + 1 < right) {
      stack.push(p + 1);
      stack.push(right);
    }
  }
  
  return targetArr;
}

/**
 * Basic QuickSort implementation without optimizations (used for benchmarks and teaching).
 * Uses the rightmost element as pivot and recursive partitioning.
 */
export function quickSortBasic(arr, inplace = false) {
  validateInput(arr);
  const targetArr = inplace ? arr : [...arr];

  function basicPartition(a, l, r) {
    const pivot = a[r];
    let i = l - 1;
    for (let j = l; j < r; j++) {
      if (a[j] < pivot) {
        i++;
        swap(a, i, j);
      }
    }
    swap(a, i + 1, r);
    return i + 1;
  }

  function solve(l, r) {
    if (l < r) {
      const p = basicPartition(targetArr, l, r);
      solve(l, p - 1);
      solve(p + 1, r);
    }
  }

  solve(0, targetArr.length - 1);
  return targetArr;
}
