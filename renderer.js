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

let scanning = false;
let paused = false;
let scanData = {};
let totalPausedTime = 0;
let pauseStartTime = 0;

// Populate username length options (1 to 16)
for (let i = 1; i <= 16; i++) {
  const option = document.createElement('option');
  option.value = i;
  option.text = i;
  if (i === 3) {
    option.selected = true; // Default selection
  }
  usernameLengthSelect.appendChild(option);
}

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

  const proxyUrl = "https://web-production-787c.up.railway.app/";
  const apiUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;

  fetchWithRetry(proxyUrl + apiUrl)
    .then((data) => {
      if (data === null || (data && data.errorMessage && data.errorMessage.includes("Couldn't find any profile with name"))) {
        outputDiv.innerHTML += `<span style="color:green;">${username} is available</span><br>`;
      } else if (data && data.id) {
        outputDiv.innerHTML += `<span style="color:red;">${username} is claimed - ${data.id}</span><br>`;
      } else {
        outputDiv.innerHTML += `<span style="color:red;">Error: Unexpected response</span><br>`;
      }
    })
    .catch((error) => {
      outputDiv.innerHTML += `<span style="color:red;">Error: ${error}</span><br>`;
    });
}

checkButton.addEventListener('click', checkUsername);

// Fetch with Retry Function (Retries indefinitely until success)
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

// Scan Function
async function launchScan() {
  if (scanning) {
    errorMessage.textContent = "A scan is already in progress.";
    return;
  }

  const includeLetters = includeLettersCheckbox.checked;
  const includeNumbers = includeNumbersCheckbox.checked;
  const includeUnderscore = includeUnderscoreCheckbox.checked;
  const length = parseInt(usernameLengthSelect.value);
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
  pauseScanButton.textContent = 'Pause';
  pauseScanButton.disabled = false;
  stopScanButton.disabled = false;

  scanNextUsername(includeClaimed);
}

async function scanNextUsername(includeClaimed) {
  if (!scanning || paused || scanData.scanned >= scanData.total) {
    if (scanData.scanned >= scanData.total) {
      // Scan complete
      scanning = false;
      pauseScanButton.disabled = true;
      stopScanButton.disabled = true;
      warningMessage.textContent = "Scan complete.";
    }
    return;
  }

  const { value: username, done } = scanData.generator.next();

  if (done) {
    // Scan complete
    scanning = false;
    pauseScanButton.disabled = true;
    stopScanButton.disabled = true;
    warningMessage.textContent = "Scan complete.";
    return;
  }

  const proxyUrl = "https://web-production-787c.up.railway.app/";
  const apiUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;

  try {
    const data = await fetchWithRetry(proxyUrl + apiUrl);

    if (data === null) {
      // Username is available
      outputDiv.innerHTML += `<span style="color:green;">${username} is available</span><br>`;
    } else if (data && data.id) {
      if (includeClaimed) {
        // Username is claimed
        outputDiv.innerHTML += `<span style="color:red;">${username} is claimed - ${data.id}</span><br>`;
      }
      // If includeClaimed is not checked, do not display claimed usernames
    }

    scanData.scanned++;
    updateProgress();

    // Scroll to bottom to show the latest result
    outputDiv.scrollTop = outputDiv.scrollHeight;

    // Proceed to the next username asynchronously to keep the UI responsive
    setTimeout(() => scanNextUsername(includeClaimed), 0);
  } catch (error) {
    // This catch block should rarely be reached due to retries in fetchWithRetry
    scanData.scanned++;
    updateProgress();
    setTimeout(() => scanNextUsername(includeClaimed), 0);
  }
}

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
  estimatedTimeLabel.textContent = `Estimated time: ${formatTime(estimatedTimeRemaining)}`;
}

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

// Pause and Stop Functions
function pauseScan() {
  paused = true;
  pauseScanButton.textContent = 'Resume';
  pauseStartTime = Date.now();
}

function resumeScan() {
  paused = false;
  pauseScanButton.textContent = 'Pause';
  // Calculate paused duration and add to scanData.pausedTime
  const pausedDuration = Date.now() - pauseStartTime;
  scanData.pausedTime += pausedDuration;
  scanNextUsername(includeClaimedCheckbox.checked);
}

pauseScanButton.addEventListener('click', () => {
  if (paused) resumeScan();
  else pauseScan();
});

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
}

stopScanButton.addEventListener('click', stopScan);
launchScanButton.addEventListener('click', launchScan);

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
    saveMessage.style.color = 'red';
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
  saveMessage.style.color = 'green';
}

saveOutputButton.addEventListener('click', saveOutput);
