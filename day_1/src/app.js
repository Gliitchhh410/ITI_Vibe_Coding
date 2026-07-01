import { quickSortRecursiveGen, heapSortGen, mergeSortGen, insertionSortGen, drawArray } from './visualizer.js';
import { runBenchmarkSuite } from './benchmark.js';

// DOM Elements
const canvas = document.getElementById('visualizerCanvas');
const algoSelect = document.getElementById('algoSelect');
const sizeSlider = document.getElementById('sizeSlider');
const sizeVal = document.getElementById('sizeVal');
const speedSlider = document.getElementById('speedSlider');
const speedVal = document.getElementById('speedVal');
const customInput = document.getElementById('customInput');
const customBtn = document.getElementById('customBtn');
const errorMessage = document.getElementById('errorMessage');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');
const stepBtn = document.getElementById('stepBtn');
const statusText = document.getElementById('statusText');
const arrayTypeLabel = document.getElementById('arrayTypeLabel');
const benchmarkBtn = document.getElementById('benchmarkBtn');
const benchmarkCard = document.getElementById('benchmarkCard');
const benchBody = document.getElementById('benchBody');
const benchSizeLabel = document.getElementById('benchSizeLabel');

// State Variables
let currentArray = [];
let activeGenerator = null;
let isPlaying = false;
let animTimeout = null;

// Initialize
function init() {
  updateSizeLabel();
  updateSpeedLabel();
  generateNewArray();
  setupTabs();
}

// Update label helpers
function updateSizeLabel() {
  sizeVal.innerText = `${sizeSlider.value} elements`;
}

function updateSpeedLabel() {
  // Speed is input range 1 to 100.
  // Delay is mapped to (101 - speed) ms.
  const speed = speedSlider.value;
  speedVal.innerText = `${101 - speed}ms delay`;
}

// Generate new random array
function generateNewArray() {
  stopSorting();
  const size = parseInt(sizeSlider.value);
  currentArray = [];
  for (let i = 0; i < size; i++) {
    // Random numbers from 10 to 350 (fits canvas height nicely)
    currentArray.push(Math.floor(Math.random() * 340) + 10);
  }
  arrayTypeLabel.innerText = "Random Array";
  errorMessage.style.display = 'none';
  activeGenerator = null;
  drawCurrent();
  statusText.innerText = "Status: Idle";
}

// Draw current array state
function drawCurrent() {
  drawArray(canvas, currentArray, {}, null);
}

// Select Generator based on algorithm dropdown
function getGenerator() {
  // Clone current array so sorting operates on a fresh copy/inplace
  const arrCopy = [...currentArray];
  const algo = algoSelect.value;
  
  if (algo === 'quickSortRecursive') {
    return quickSortRecursiveGen(arrCopy);
  } else if (algo === 'heapSort') {
    return heapSortGen(arrCopy);
  } else if (algo === 'mergeSort') {
    return mergeSortGen(arrCopy);
  } else if (algo === 'insertionSort') {
    return insertionSortGen(arrCopy, 0, arrCopy.length - 1);
  }
  return null;
}

// Start sorting animation
function startSorting() {
  if (isPlaying) return;
  
  if (!activeGenerator) {
    activeGenerator = getGenerator();
  }
  
  isPlaying = true;
  startBtn.innerText = "Running";
  startBtn.disabled = true;
  pauseBtn.disabled = false;
  pauseBtn.innerText = "Pause";
  statusText.innerText = `Status: Sorting with ${algoSelect.value}...`;
  
  animate();
}

// Pause sorting animation
function pauseSorting() {
  if (!isPlaying) return;
  isPlaying = false;
  startBtn.innerText = "Resume";
  startBtn.disabled = false;
  pauseBtn.innerText = "Paused";
  statusText.innerText = "Status: Paused";
}

// Stop and reset all animations
function stopSorting() {
  isPlaying = false;
  if (animTimeout) {
    clearTimeout(animTimeout);
    animTimeout = null;
  }
  startBtn.innerText = "Sort";
  startBtn.disabled = false;
  pauseBtn.disabled = true;
  pauseBtn.innerText = "Pause";
}

// Step-by-step sorting step
function animate() {
  if (!isPlaying || !activeGenerator) return;
  
  const { value, done } = activeGenerator.next();
  
  if (done) {
    stopSorting();
    // Highlight all elements as sorted
    const finalHighlights = {};
    for (let i = 0; i < currentArray.length; i++) {
      finalHighlights[i] = 'sorted';
    }
    drawArray(canvas, currentArray, finalHighlights, null);
    statusText.innerText = "Status: Sorted!";
    activeGenerator = null;
    return;
  }
  
  // Update local array snapshot and draw
  currentArray = value.array;
  drawArray(canvas, currentArray, value.highlights || {}, value.range || null);
  
  const speed = parseInt(speedSlider.value);
  const delay = 101 - speed; // Mapping: 1ms (fastest) to 100ms (slowest)
  
  animTimeout = setTimeout(animate, delay);
}

// Trigger single step
function singleStep() {
  stopSorting();
  startBtn.innerText = "Resume";
  
  if (!activeGenerator) {
    activeGenerator = getGenerator();
  }
  
  const { value, done } = activeGenerator.next();
  if (done) {
    const finalHighlights = {};
    for (let i = 0; i < currentArray.length; i++) {
      finalHighlights[i] = 'sorted';
    }
    drawArray(canvas, currentArray, finalHighlights, null);
    statusText.innerText = "Status: Sorted (stepped to end)!";
    activeGenerator = null;
    return;
  }
  
  currentArray = value.array;
  drawArray(canvas, currentArray, value.highlights || {}, value.range || null);
  statusText.innerText = "Status: Stepped";
}

// Event Listeners
sizeSlider.addEventListener('input', () => {
  updateSizeLabel();
  generateNewArray();
});

speedSlider.addEventListener('input', () => {
  updateSpeedLabel();
});

algoSelect.addEventListener('change', () => {
  stopSorting();
  activeGenerator = null;
  drawCurrent();
  statusText.innerText = `Status: Switched to ${algoSelect.value}`;
});

resetBtn.addEventListener('click', generateNewArray);
startBtn.addEventListener('click', startSorting);
pauseBtn.addEventListener('click', pauseSorting);
stepBtn.addEventListener('click', singleStep);

// Apply custom array input
customBtn.addEventListener('click', () => {
  stopSorting();
  errorMessage.style.display = 'none';
  const val = customInput.value.trim();
  if (!val) return;
  
  try {
    const arr = val.split(',').map(item => {
      const num = parseFloat(item.trim());
      if (Number.isNaN(num)) {
        throw new Error(`Invalid number: "${item.trim()}"`);
      }
      return num;
    });
    
    if (arr.length < 2) {
      throw new Error("Please enter at least 2 numbers");
    }
    
    currentArray = arr;
    arrayTypeLabel.innerText = "Custom Array";
    activeGenerator = null;
    drawCurrent();
    statusText.innerText = "Status: Custom Array Loaded";
  } catch (err) {
    errorMessage.innerText = err.message;
    errorMessage.style.display = 'block';
  }
});

// Run and render Benchmarks
benchmarkBtn.addEventListener('click', () => {
  benchmarkBtn.disabled = true;
  benchmarkBtn.innerText = "Running Benchmarks...";
  statusText.innerText = "Status: Benchmarking in progress...";
  
  // Size for benchmark: 1000 is a good standard representation
  const size = 1000;
  benchSizeLabel.innerText = size;
  
  // Use setTimeout to allow UI thread to update first
  setTimeout(() => {
    try {
      const results = runBenchmarkSuite(size);
      renderBenchmarkTable(results);
      benchmarkCard.style.display = 'block';
      statusText.innerText = "Status: Benchmarks completed!";
    } catch (err) {
      statusText.innerText = `Status: Benchmark Error: ${err.message}`;
    } finally {
      benchmarkBtn.disabled = false;
      benchmarkBtn.innerText = "Run Live Benchmarks";
    }
  }, 100);
});

function renderBenchmarkTable(results) {
  benchBody.innerHTML = '';
  
  const algorithms = Object.keys(results.random);
  
  algorithms.forEach(algo => {
    const tr = document.createElement('tr');
    
    // Algorithm Name
    const tdName = document.createElement('td');
    tdName.innerHTML = `<strong>${algo}</strong>`;
    tr.appendChild(tdName);
    
    // Add columns for profiles
    const profiles = ['random', 'sorted', 'reversed', 'duplicates'];
    profiles.forEach(profile => {
      const tdVal = document.createElement('td');
      const val = results[profile][algo];
      
      if (typeof val === 'object' && val.error) {
        tdVal.innerHTML = `<span style="color: var(--error-color); font-size: 0.8rem;">${val.error}</span>`;
      } else {
        tdVal.innerText = `${val} ms`;
      }
      tr.appendChild(tdVal);
    });
    
    benchBody.appendChild(tr);
  });
}

// Set up tabs navigation
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// Run Initializer on load
init();
