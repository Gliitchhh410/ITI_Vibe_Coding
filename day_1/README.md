# QuickSort Lab: Implementation, Optimization, & Benchmarking

This project is a complete lab implementation of the QuickSort algorithm, featuring recursive and iterative implementations, other standard sorting algorithms (MergeSort, HeapSort) for comparison, Vitest unit testing, a performance benchmarking suite, and a live Canvas-based visualization interface.

---

## 1. QuickSort: How It Works & Key Components

QuickSort is a highly efficient, Divide-and-Conquer sorting algorithm. It selects a **pivot** element from the array and partitions the other elements into two sub-arrays according to whether they are less than or greater than the pivot. The sub-arrays are then sorted recursively.

### Key Components
1. **Pivot Selection:** Choosing which element will act as the boundary.
2. **Partitioning:** Rearranging the array such that:
   - All elements less than the pivot are placed before it.
   - All elements greater than or equal to the pivot are placed after it.
   - The pivot lands in its final sorted index.
3. **Divide and Conquer:** Recursively repeating this operation on the left and right partitions.

---

## 2. Enhancements & Optimizations

Standard QuickSort has a major vulnerability: if the array is already sorted (or reverse sorted) and the leftmost or rightmost element is chosen as the pivot, the partition split becomes highly unbalanced ($N-1$ and $0$ elements). This degrades performance to $O(N^2)$ and can trigger a stack overflow in recursive implementations.

To address this, we implemented the following enhancements in [src/quicksort.js](file:///d:/ITI/Vibe%20Coding/day_1/src/quicksort.js):

### A. Median-of-Three Pivot Selection
Before partitioning, we look at the first, middle, and last elements of the current subarray, sort them, and place the median value at `right - 1` to use as the pivot. This guarantees that we pick a highly representative pivot, making the worst-case $O(N^2)$ practically impossible.

### B. Insertion Sort Fallback
For small subarrays (size $\le 10$), the overhead of function calls and partitioning in QuickSort is higher than the simple $O(N^2)$ loop of Insertion Sort. By falling back to Insertion Sort for small slices, we reduce the constant overhead factors significantly.

### C. Iterative Implementation (Stack-Based)
For extremely large arrays, deep recursion can exceed the maximum call stack size of the JavaScript engine. We implemented `quickSortIterative`, which replaces the call stack with an explicit stack array storing the boundary indices (`left` and `right`) of subarrays to be sorted.

---

## 3. Algorithm Complexity Matrix

| Algorithm | Best Case | Average Case | Worst Case | Space Complexity | Stable? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **QuickSort (Optimized)** | $O(N \log N)$ | $O(N \log N)$ | $O(N \log N)$* | $O(\log N)$ (call stack) | No |
| **QuickSort (Naive)** | $O(N \log N)$ | $O(N \log N)$ | $O(N^2)$ | $O(N)$ (call stack) | No |
| **MergeSort** | $O(N \log N)$ | $O(N \log N)$ | $O(N \log N)$ | $O(N)$ | Yes |
| **HeapSort** | $O(N \log N)$ | $O(N \log N)$ | $O(N \log N)$ | $O(1)$ | No |
| **JS Built-in Sort** | $O(N)$ | $O(N \log N)$ | $O(N \log N)$ | $O(N)$ | Yes |

*\* The worst case for Median-of-Three QuickSort is $O(N^2)$, but it requires a very specific, adversarial input layout which is extremely rare in real-world data.*

---

## 4. Unit Testing & Debugging Process

Unit tests are written using **Vitest** in [tests/quicksort.test.js](file:///d:/ITI/Vibe%20Coding/day_1/tests/quicksort.test.js) and cover:
- Empty array `[]` and single-element array `[42]` (edge cases)
- Standard unsorted array
- Already sorted and reverse-sorted arrays (testing pivot resilience)
- Arrays containing duplicates (testing partitioning bounds)
- Invalid types (non-arrays or non-numeric elements)
- Extremely large random datasets (1,000 items)

### Intentional Bug Demonstration (Step 8)
We introduced a naive buggy function `quickSortBuggy` where the pivot was swapped incorrectly during Lomuto partitioning:
```javascript
// BUG: Swap pivot with target[i] instead of target[i + 1]
const tmp = target[i];
target[i] = target[r];
target[r] = tmp;
```
When running tests, this bug caused:
1. **Infinite Recursion:** The partition index was set to `i` (which could be the same as `left - 1`), causing the same subarray size to be passed recursively without shrinking.
2. **RangeError:** JavaScript threw `Maximum call stack size exceeded`.

**Copilot Chat-style Diagnosis & Fix:**
- **Identified Cause:** Lomuto partitioning requires elements smaller than the pivot to be shifted. If we place the pivot at index `i` instead of `i + 1`, we fail to exclude the pivot from the next recursive ranges, leading to infinite loops when sorting nearly sorted inputs.
- **Resolution:** Correct the swap to target index `i + 1` and return `i + 1` as the partition pivot index. This guarantees that the partition shrinks by at least one element each round.

---

## 5. Performance Benchmarking Summary

Our live benchmarking suite in [src/benchmark.js](file:///d:/ITI/Vibe%20Coding/day_1/src/benchmark.js) compares execution times on $N = 1000$ arrays.

### Key Observations:
1. **Optimized QuickSort vs. Basic QuickSort on Sorted Arrays:** Naive QuickSort hits a high call stack depth or slow execution speeds on pre-sorted arrays. The optimized version with median-of-three handles sorted/reversed arrays virtually as fast as random arrays.
2. **QuickSort vs. MergeSort:** QuickSort typically outperforms MergeSort on random arrays due to lower constant factors and in-place operations, whereas MergeSort must allocate temporary memory slices.
3. **JS Built-in Sort:** Built-in V8 engines use Timsort (hybrid merge/insertion sort) which is extremely fast, especially on partially sorted inputs, where it runs in $O(N)$ time.

---

## 6. How GitHub Copilot Assisted the Process

During development, Copilot was used to:
1. **Code Generation:** Instantly generated boilerplate for recursive QuickSort, HeapSort, and MergeSort.
2. **Optimization Prompting:** By asking: *"How do I optimize QuickSort to prevent O(N^2) on sorted arrays?"*, Copilot suggested Median-of-Three pivot selection and Insertion Sort threshold fallback, writing the logic cleanly.
3. **Refactoring:** Copilot assisted in converting the recursive algorithm to stack-based iterative logic by mapping the push/pop bounds operations.
4. **Writing Test Suites:** Automatically filled out assertions for various edge cases (empty, negative, sorted, large arrays) in Vitest.
