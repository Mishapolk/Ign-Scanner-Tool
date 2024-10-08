// DOM Elements
const usernameInput = document.getElementById('username');
const checkButton = document.getElementById('check-username');
const errorMessage = document.getElementById('error-message');
const includeClaimedCheckbox = document.getElementById('include-claimed');
const usernameLengthSelect = document.getElementById('username-length');
const includeLettersCheckbox = document.getElementById('include-letters');
const includeNumbersCheckbox = document.getElementById('include-numbers');
const includeUnderscoreCheckbox = document.getElementById('include-underscore');
const launchScanButton = document.getElementById('launch-scan');
const pauseScanButton = document.getElementById('pause-scan');
const stopScanButton = document.getElementById('stop-scan');
const estimatedTimeLabel = document.getElementById('estimated-time');
const progressBarInner = document.getElementById('progress-bar-inner');
const progressText = document.getElementById('progress-text');
const outputDiv = document.getElementById('output');
const saveOutputButton = document.getElementById('save-output');
const saveMessage = document.getElementById('save-message');
const warningMessage = document.getElementById('warning-message');

// State Variables
let scanning = false;
let paused = false;
let scanData = {};
let totalPausedTime = 0;
let pauseStartTime = 0;

// Proxy URLs Array
const proxyUrls = [
  "https://web-production-99ed.up.railway.app/",
  "https://web-production-6259f.up.railway.app/",
  "https://web-production-9824.up.railway.app/",
  "https://web-production-034d.up.railway.app/",
  "https://web-production-787c.up.railway.app/"
];

// Number of concurrent workers (based on the number of proxies)
const numberOfWorkers = proxyUrls.length;

// Array to hold worker promises
let workers = [];

// Populate username length options (1 to 16) and set default to 3
function populateUsernameLength() {
  for (let i = 1; i <= 16; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.text = i;
    if (i === 3) {
      option.selected = true; // Default selection is 3
    }
    usernameLengthSelect.appendChild(option);
  }
}

// Run the function to populate the dropdown on page load
populateUsernameLength();

// Single Username Lookup Function
function checkUsername() {
  const username = usernameInput.value.trim();
  if (username.length === 0 || username.length > 16) {
    errorMessage.textContent = "A username must be between 1 and 16 characters long.";
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errorMessage.textContent = "The username cannot contain any special characters.";
    return;
  }
  errorMessage.textContent = "";
  outputDiv.innerHTML = "";

  const proxyUrl = proxyUrls[0]; // Use the first proxy for single checks
  const apiUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;

  fetchWithRetry(proxyUrl + apiUrl)
    .then((data) => {
      if (data === null || (data && data.errorMessage && data.errorMessage.includes("Couldn't find any profile with name"))) {
        outputDiv.innerHTML += `<span class="available">${username} is available</span>`;
      } else if (data && data.id) {
        outputDiv.innerHTML += `<span class="claimed">${username} is claimed - ${data.id}</span>`;
      } else {
        outputDiv.innerHTML += `<span class="error">Error: Unexpected response</span>`;
      }
    })
    .catch((error) => {
      outputDiv.innerHTML += `<span class="error">Error: ${error}</span>`;
    });
}

checkButton.addEventListener('click', checkUsername);

// Fetch with Retry Function for Individual API Calls (Retries indefinitely until success)
function fetchWithRetry(url, delay = 1000) {
  return new Promise((resolve) => {
    function attempt() {
      fetch(url)
        .then((response) => {
          if (response.status === 204) return resolve(null);
          return response.json();
        })
        .then((data) => {
          if (data === null || (data && data.errorMessage && data.errorMessage.includes("Couldn't find any profile with name"))) {
            resolve(null); // Username available
          } else if (data && data.id) {
            resolve(data); // Username claimed
          } else {
            // Retry on unexpected data
            setTimeout(attempt, delay);
          }
        })
        .catch(() => {
          // Retry on network error or rate limit
          setTimeout(attempt, delay);
        });
    }
    attempt();
  });
}

// Fetch with Retry Function for Bulk API (Retries indefinitely until success)
function fetchWithRetryBulk(usernamesBatch, proxyUrl, delay = 2000) {
  const apiUrl = "https://api.minecraftservices.com/minecraft/profile/lookup/bulk/byname";

  return new Promise((resolve, reject) => {
    function attempt() {
      fetch(proxyUrl + apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(usernamesBatch)
      })
        .then((response) => {
          if (!response.ok) {
            // Retry on BadRequest or other errors
            setTimeout(attempt, delay);
          } else {
            return response.json();
          }
        })
        .then((data) => {
          resolve(data);
        })
        .catch(() => {
          // Retry on network error or rate limit
          setTimeout(attempt, delay);
        });
    }
    attempt();
  });
}

// Launch Scan Function
function launchScan() {
  if (scanning) {
    errorMessage.textContent = "A scan is already in progress.";
    return;
  }

  // Disable individual username search during scan
  checkButton.disabled = true;
  checkButton.classList.add('flat');
  checkButton.classList.remove('active');

  const includeLetters = includeLettersCheckbox.checked;
  const includeNumbers = includeNumbersCheckbox.checked;
  const includeUnderscore = includeUnderscoreCheckbox.checked;
  const length = parseInt(usernameLengthSelect.value); // Get the selected value
  const includeClaimed = includeClaimedCheckbox.checked;

  // Warning for large scans
  if (length > 5) {
    warningMessage.textContent = "Warning: Scanning usernames longer than 5 characters may take a significant amount of time and resources.";
  } else {
    warningMessage.textContent = "";
  }

  if (length < 1 || length > 16) {
    errorMessage.textContent = "Username length must be between 1 and 16.";
    return;
  }

  if (!includeLetters && !includeNumbers && !includeUnderscore) {
    errorMessage.textContent = "You must include at least one of letters, numbers, or underscores.";
    return;
  }

  const totalPossibleUsernames = estimateTotalUsernames(length, includeLetters, includeNumbers, includeUnderscore);

  // Warn the user if the number of usernames is extremely large
  if (length === 16 && totalPossibleUsernames > 1e+6) { // Example threshold
    warningMessage.textContent += " Additionally, scanning a very large number of usernames may take a very long time.";
  }

  errorMessage.textContent = "";
  // Warning message already set above

  const usernameGenerator = generateUsernames(length, includeLetters, includeNumbers, includeUnderscore);

  scanData = {
    generator: usernameGenerator,
    total: totalPossibleUsernames,
    scanned: 0,
    startTime: Date.now(),
    pausedTime: 0,
  };

  outputDiv.innerHTML = '';
  progressBarInner.style.width = '0%';
  progressText.textContent = `0/${scanData.total}`;
  estimatedTimeLabel.textContent = `Estimated time: 0h 0m 0s`;

  scanning = true;
  paused = false;
  totalPausedTime = 0;

  // Update button states
  pauseScanButton.disabled = false;
  stopScanButton.disabled = false;

  // Animate buttons to "Active" state
  pauseScanButton.classList.remove('flat');
  pauseScanButton.classList.add('active');
  stopScanButton.classList.remove('flat');
  stopScanButton.classList.add('active');

  // Make Launch Scan button inactive
  launchScanButton.disabled = true;
  launchScanButton.classList.remove('active');
  launchScanButton.classList.add('flat');

  // Start worker functions
  startWorkers(includeClaimed);
}

launchScanButton.addEventListener('click', launchScan);

// Start Worker Functions
function startWorkers(includeClaimed) {
  for (let i = 0; i < numberOfWorkers; i++) {
    const worker = workerFunction(i, includeClaimed);
    workers.push(worker);
  }
}

// Worker Function
async function workerFunction(workerIndex, includeClaimed) {
  const proxyUrl = proxyUrls[workerIndex % proxyUrls.length];
  while (scanning) {
    if (paused) {
      await waitForResume();
    }

    // Get next batch of usernames
    const batch = getNextBatch();

    if (batch.length === 0) {
      // No more usernames to process
      handleScanCompletion();
      break;
    }

    try {
      const data = await fetchWithRetryBulk(batch, proxyUrl);

      // Create a set of claimed usernames from the response
      const claimedUsernamesSet = new Set(data.map((item) => item.name.toLowerCase()));

      batch.forEach((username) => {
        if (claimedUsernamesSet.has(username.toLowerCase())) {
          // Username is claimed
          if (includeClaimed) {
            outputDiv.innerHTML += `<span class="claimed">${username} is claimed</span>`;
          }
        } else {
          // Username is available
          outputDiv.innerHTML += `<span class="available">${username} is available</span>`;
        }
        scanData.scanned++;
      });

      updateProgress();

      // Scroll to bottom to show the latest result
      outputDiv.scrollTop = outputDiv.scrollHeight;
    } catch (error) {
      // Handle error (retry is already managed in fetchWithRetryBulk)
      console.error(`Worker ${workerIndex} encountered an error:`, error);
    }

    // Wait for 2 seconds before next request from this proxy
    await delay(2000);
  }
}

// Function to Get Next Batch of Usernames (up to 10)
function getNextBatch() {
  const batch = [];
  for (let i = 0; i < 10; i++) {
    const { value: username, done } = scanData.generator.next();
    if (done) break;
    batch.push(username);
  }
  return batch;
}

// Function to Wait Until Scan is Resumed
function waitForResume() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (!paused) {
        clearInterval(interval);
        resolve();
      }
    }, 500);
  });
}

// Handle Scan Completion Function
function handleScanCompletion() {
  if (!scanning) return; // Prevent multiple calls

  scanning = false;
  pauseScanButton.disabled = true;
  stopScanButton.disabled = true;
  warningMessage.textContent = "Scan complete.";

  // Animate buttons back to "Flat" state
  pauseScanButton.classList.add('flat');
  pauseScanButton.classList.remove('active');
  stopScanButton.classList.add('flat');
  stopScanButton.classList.remove('active');

  // Re-enable Launch Scan button
  launchScanButton.disabled = false;
  launchScanButton.classList.remove('flat');
  launchScanButton.classList.add('active');

  // Re-enable individual username search
  checkButton.disabled = false;
  checkButton.classList.remove('flat');
  checkButton.classList.add('active');

  // Clear workers array
  workers = [];
}

// Update Progress Function
function updateProgress() {
  const progress = (scanData.scanned / scanData.total) * 100;
  progressBarInner.style.width = `${progress}%`;
  progressText.textContent = `${scanData.scanned}/${scanData.total}`;

  // Calculate estimated time remaining
  const now = Date.now();
  const elapsedTime = (now - scanData.startTime - scanData.pausedTime) / 1000; // in seconds
  const averageTimePerScan = scanData.scanned > 0 ? elapsedTime / scanData.scanned : 0;
  const estimatedTotalTime = averageTimePerScan * scanData.total;
  const estimatedTimeRemaining = estimatedTotalTime - elapsedTime;

  // Format ETA based on conditions
  let formattedETA = formatTime(estimatedTimeRemaining);
  if (estimatedTimeRemaining > 36000) { // Above 10 hours
    const hours = Math.floor(estimatedTimeRemaining / 3600);
    formattedETA = `${hours}h`;
  }
  if (estimatedTimeRemaining > 3.6e6) { // Above 1000 hours
    formattedETA = `${(estimatedTimeRemaining / 3.6e6).toExponential(2)}h`;
  }

  estimatedTimeLabel.textContent = `Estimated time: ${formattedETA}`;
}

// Format Time Function
function formatTime(seconds) {
  if (seconds < 0 || isNaN(seconds)) {
    return '0h 0m 0s';
  }
  const hours = Math.floor(seconds / 3600);
  seconds = seconds % 3600;
  const minutes = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${hours}h ${minutes}m ${sec}s`;
}

// Pause and Resume Functions
function pauseScan() {
  paused = true;
  pauseScanButton.textContent = 'Resume';
  warningMessage.textContent = "Scan paused.";
  pauseStartTime = Date.now();
}

function resumeScan() {
  paused = false;
  pauseScanButton.textContent = 'Pause';
  warningMessage.textContent = "Scan resumed.";
  totalPausedTime += Date.now() - pauseStartTime;
}

pauseScanButton.addEventListener('click', () => {
  if (paused) resumeScan();
  else pauseScan();
});

// Stop Scan Function
function stopScan() {
  scanning = false;
  paused = false;
  pauseScanButton.disabled = true;
  stopScanButton.disabled = true;
  pauseScanButton.textContent = 'Pause';
  progressBarInner.style.width = '0%';
  progressText.textContent = '0/0';
  estimatedTimeLabel.textContent = 'Estimated time: 0h 0m 0s';
  warningMessage.textContent = "Scan stopped.";

  // Animate buttons back to "Flat" state
  pauseScanButton.classList.add('flat');
  pauseScanButton.classList.remove('active');
  stopScanButton.classList.add('flat');
  stopScanButton.classList.remove('active');

  // Re-enable Launch Scan button
  launchScanButton.disabled = false;
  launchScanButton.classList.remove('flat');
  launchScanButton.classList.add('active');

  // Re-enable individual username search
  checkButton.disabled = false;
  checkButton.classList.remove('flat');
  checkButton.classList.add('active');

  // Clear workers array
  workers = [];
}

stopScanButton.addEventListener('click', stopScan);

// Generate Usernames Generator Function
function generateUsernames(length, includeLetters, includeNumbers, includeUnderscore) {
  let chars = [];
  if (includeLetters) chars = chars.concat('abcdefghijklmnopqrstuvwxyz'.split(''));
  if (includeNumbers) chars = chars.concat('0123456789'.split(''));
  if (includeUnderscore) chars.push('_');

  if (chars.length === 0) {
    errorMessage.textContent = "You must include at least one of letters, numbers, or underscores.";
    return (function* () {})(); // Empty generator
  }

  function* generator() {
    const totalCombinations = Math.pow(chars.length, length);
    for (let i = 0; i < totalCombinations; i++) {
      let num = i;
      let username = '';
      for (let j = 0; j < length; j++) {
        username = chars[num % chars.length] + username;
        num = Math.floor(num / chars.length);
      }
      yield username;
    }
  }

  return generator();
}

// Estimate Total Usernames Function
function estimateTotalUsernames(length, includeLetters, includeNumbers, includeUnderscore) {
  let charsCount = 0;
  if (includeLetters) charsCount += 26;
  if (includeNumbers) charsCount += 10;
  if (includeUnderscore) charsCount += 1;
  return Math.pow(charsCount, length);
}

// Save Output Function
function saveOutput() {
  const content = outputDiv.innerText;
  if (content.trim() === '') {
    saveMessage.textContent = 'Textbox is empty. Nothing to save.';
    saveMessage.style.color = '#ff4d4d'; // Red color for error
    return;
  }
  const currentTime = new Date();
  const filename = currentTime.toISOString().replace(/[:.]/g, '-') + '_Output.txt';
  const fileBlob = new Blob([content], { type: 'text/plain' });

  const downloadLink = document.createElement('a');
  downloadLink.href = URL.createObjectURL(fileBlob);
  downloadLink.download = filename;
  downloadLink.click();

  saveMessage.textContent = 'Output saved to file!';
  saveMessage.style.color = '#00ff85'; // Green color for success
}

saveOutputButton.addEventListener('click', saveOutput);

// Utility Function to Delay Execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
