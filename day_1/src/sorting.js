/**
 * Sorting algorithms for comparison with QuickSort.
 */

/**
 * MergeSort implementation (Recursive, Stable).
 * Time Complexity: O(N log N) in all cases.
 * Space Complexity: O(N) due to temporary arrays.
 * 
 * @param {Array<number>} arr 
 * @returns {Array<number>} sorted array (new copy)
 */
export function mergeSort(arr) {
  if (arr.length <= 1) return [...arr];
  
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  
  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let l = 0;
  let r = 0;
  
  while (l < left.length && r < right.length) {
    if (left[l] <= right[r]) {
      result.push(left[l]);
      l++;
    } else {
      result.push(right[r]);
      r++;
    }
  }
  
  return result.concat(left.slice(l)).concat(right.slice(r));
}

/**
 * HeapSort implementation (In-place, Unstable).
 * Time Complexity: O(N log N) in all cases.
 * Space Complexity: O(1) auxiliary space.
 * 
 * @param {Array<number>} arr 
 * @param {boolean} [inplace=false]
 * @returns {Array<number>} sorted array
 */
export function heapSort(arr, inplace = false) {
  const targetArr = inplace ? arr : [...arr];
  const n = targetArr.length;
  
  // Build max heap
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(targetArr, n, i);
  }
  
  // Extract elements from heap one by one
  for (let i = n - 1; i > 0; i--) {
    // Move current root to end
    swap(targetArr, 0, i);
    // Heapify root element on the reduced heap
    heapify(targetArr, i, 0);
  }
  
  return targetArr;
}

function heapify(arr, n, i) {
  let largest = i;
  const left = 2 * i + 1;
  const right = 2 * i + 2;
  
  if (left < n && arr[left] > arr[largest]) {
    largest = left;
  }
  
  if (right < n && arr[right] > arr[largest]) {
    largest = right;
  }
  
  if (largest !== i) {
    swap(arr, i, largest);
    heapify(arr, n, largest);
  }
}

function swap(arr, i, j) {
  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
}

/**
 * Wrapper for the native JavaScript V8 Array.prototype.sort().
 * Typically uses Timsort (hybrid insertion/merge sort).
 * 
 * @param {Array<number>} arr 
 * @returns {Array<number>} sorted array
 */
export function builtInSort(arr) {
  return [...arr].sort((a, b) => a - b);
}
