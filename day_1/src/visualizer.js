/**
 * Canvas-based Sorting Visualizer Engine.
 * Uses Generator functions (function*) to pause sorting execution,
 * capture frames of the array state, and animate them in real-time.
 */

// Colors for visual representations (Modern Dark Theme)
const COLORS = {
  background: '#0d0f12',
  barDefault: '#4a5568',      // Cool slate gray
  barCompare: '#06b6d4',      // Neon cyan
  barSwap: '#f59e0b',         // Warm amber
  barPivot: '#ef4444',        // Neon red
  barSorted: '#10b981',       // Emerald green
  barInactive: '#1e293b'      // Dark slate
};

/**
 * Generator version of Insertion Sort (used as fallback or individual visualizer).
 */
export function* insertionSortGen(arr, left, right) {
  for (let i = left + 1; i <= right; i++) {
    const key = arr[i];
    let j = i - 1;
    yield {
      array: [...arr],
      highlights: { [i]: 'pivot', [j]: 'compare' }
    };
    
    while (j >= left && arr[j] > key) {
      arr[j + 1] = arr[j];
      yield {
        array: [...arr],
        highlights: { [j + 1]: 'swap', [j]: 'swap' }
      };
      j--;
    }
    arr[j + 1] = key;
    yield {
      array: [...arr],
      highlights: { [j + 1]: 'sorted' }
    };
  }
}

/**
 * Helper to swap elements in visualizer and yield state.
 */
function swap(arr, i, j) {
  const temp = arr[i];
  arr[i] = arr[j];
  arr[j] = temp;
}

/**
 * Generator version of Partitioning for QuickSort.
 */
function* partitionGen(arr, left, right) {
  // Median of three pivot selection
  const mid = Math.floor((left + right) / 2);
  
  // Visual yield for initial bounds check
  yield { array: [...arr], highlights: { [left]: 'compare', [mid]: 'compare', [right]: 'compare' }, range: [left, right] };
  
  if (arr[left] > arr[mid]) swap(arr, left, mid);
  if (arr[left] > arr[right]) swap(arr, left, right);
  if (arr[mid] > arr[right]) swap(arr, mid, right);
  
  swap(arr, mid, right - 1);
  const pivot = arr[right - 1];
  const pivotIndex = right - 1;
  
  yield { array: [...arr], highlights: { [pivotIndex]: 'pivot' }, range: [left, right] };

  let i = left;
  for (let j = left + 1; j < right - 1; j++) {
    yield {
      array: [...arr],
      highlights: { [j]: 'compare', [pivotIndex]: 'pivot', [i]: 'swap' },
      range: [left, right]
    };
    
    if (arr[j] < pivot) {
      i++;
      swap(arr, i, j);
      yield {
        array: [...arr],
        highlights: { [i]: 'swap', [j]: 'swap', [pivotIndex]: 'pivot' },
        range: [left, right]
      };
    }
  }
  
  swap(arr, i + 1, pivotIndex);
  yield {
    array: [...arr],
    highlights: { [i + 1]: 'swap', [pivotIndex]: 'swap' },
    range: [left, right]
  };
  
  return i + 1;
}

/**
 * Generator version of QuickSort (Recursive Optimized).
 */
export function* quickSortRecursiveGen(arr, left = 0, right = arr.length - 1) {
  const threshold = 10;
  
  if (right - left + 1 <= threshold) {
    yield* insertionSortGen(arr, left, right);
    return;
  }
  
  // Get pivot using partitioning generator
  let p;
  const partGen = partitionGen(arr, left, right);
  while (true) {
    const { value, done } = partGen.next();
    if (done) {
      p = value;
      break;
    }
    yield value;
  }
  
  // Highlight pivot
  yield { array: [...arr], highlights: { [p]: 'sorted' }, range: [left, right] };
  
  // Recurse left
  yield* quickSortRecursiveGen(arr, left, p - 1);
  
  // Recurse right
  yield* quickSortRecursiveGen(arr, p + 1, right);
}

/**
 * Generator version of HeapSort.
 */
export function* heapSortGen(arr) {
  const n = arr.length;
  
  function* heapifyGen(a, len, idx) {
    let largest = idx;
    const left = 2 * idx + 1;
    const right = 2 * idx + 2;
    
    yield { array: [...a], highlights: { [idx]: 'pivot', [left]: 'compare', [right]: 'compare' } };
    
    if (left < len && a[left] > a[largest]) largest = left;
    if (right < len && a[right] > a[largest]) largest = right;
    
    if (largest !== idx) {
      swap(a, idx, largest);
      yield { array: [...a], highlights: { [idx]: 'swap', [largest]: 'swap' } };
      yield* heapifyGen(a, len, largest);
    }
  }
  
  // Build max heap
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    yield* heapifyGen(arr, n, i);
  }
  
  // Extract elements
  for (let i = n - 1; i > 0; i--) {
    swap(arr, 0, i);
    yield { array: [...arr], highlights: { [0]: 'swap', [i]: 'sorted' } };
    yield* heapifyGen(arr, i, 0);
  }
  
  yield { array: [...arr], highlights: { 0: 'sorted' } };
}

/**
 * Generator version of MergeSort.
 */
export function* mergeSortGen(arr, start = 0, end = arr.length - 1) {
  if (start >= end) return;
  
  const mid = Math.floor((start + end) / 2);
  yield* mergeSortGen(arr, start, mid);
  yield* mergeSortGen(arr, mid + 1, end);
  
  // Merge process with visualization
  yield* mergeGen(arr, start, mid, end);
}

function* mergeGen(arr, start, mid, end) {
  const leftArr = arr.slice(start, mid + 1);
  const rightArr = arr.slice(mid + 1, end + 1);
  
  let i = 0;
  let j = 0;
  let k = start;
  
  while (i < leftArr.length && j < rightArr.length) {
    yield {
      array: [...arr],
      highlights: { [start + i]: 'compare', [mid + 1 + j]: 'compare', [k]: 'pivot' },
      range: [start, end]
    };
    
    if (leftArr[i] <= rightArr[j]) {
      arr[k] = leftArr[i];
      i++;
    } else {
      arr[k] = rightArr[j];
      j++;
    }
    k++;
    yield { array: [...arr], highlights: { [k - 1]: 'swap' }, range: [start, end] };
  }
  
  while (i < leftArr.length) {
    arr[k] = leftArr[i];
    i++;
    k++;
    yield { array: [...arr], highlights: { [k - 1]: 'swap' }, range: [start, end] };
  }
  
  while (j < rightArr.length) {
    arr[k] = rightArr[j];
    j++;
    k++;
    yield { array: [...arr], highlights: { [k - 1]: 'swap' }, range: [start, end] };
  }
}

/**
 * Draws the current state of the array onto a HTML5 Canvas.
 * 
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {Array<number>} array - The array to render
 * @param {Object} highlights - Object mapping index to highlights: 'compare', 'swap', 'pivot', 'sorted'
 * @param {Array<number>} [range] - Active range [left, right]
 */
export function drawArray(canvas, array, highlights = {}, range = null) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);
  
  const n = array.length;
  const maxVal = Math.max(...array, 1);
  
  // Calculate sizing
  const spacing = 2;
  const totalSpacing = spacing * (n - 1);
  const barWidth = (width - totalSpacing) / n;
  
  for (let i = 0; i < n; i++) {
    const val = array[i];
    // Height ratio
    const barHeight = (val / maxVal) * (height - 30) + 10;
    
    const x = i * (barWidth + spacing);
    const y = height - barHeight;
    
    // Determine color
    let color = COLORS.barDefault;
    
    if (highlights[i]) {
      color = COLORS[ 'bar' + highlights[i].charAt(0).toUpperCase() + highlights[i].slice(1) ] || COLORS.barDefault;
    } else if (range) {
      const [l, r] = range;
      if (i < l || i > r) {
        color = COLORS.barInactive; // Dim element if out of active partition range
      }
    }
    
    ctx.fillStyle = color;
    
    // Draw rounded rectangles for modern look
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [Math.min(barWidth / 2, 4)]);
    ctx.fill();
    
    // Draw numbers under bars if there's enough space
    if (n <= 25) {
      ctx.fillStyle = '#94a3b8'; // light text
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(val.toString(), x + barWidth / 2, y - 5);
    }
  }
}
