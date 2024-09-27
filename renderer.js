const usernameInput = document.getElementById('username');
const checkButton = document.getElementById('check-username');
const errorMessage = document.getElementById('error-message');
const searchClaimedCheckbox = document.getElementById('search-claimed');
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

let scanning = false;
let paused = false;
let scanData = {};

// Populate username length options (including 1 and 2)
for (let i = 1; i <= 16; i++) {
  const option = document.createElement('option');
  option.value = i;
  option.text = i;
  if (i === 3) {
    option.selected = true;  // Default selection
  }
  usernameLengthSelect.appendChild(option);
}

// Single Username Lookup Function
function checkUsername() {
  const username = usernameInput.value.trim();
  if (username.length > 16 || username.length === 0) {
    errorMessage.textContent = "A username must be between 1 and 16 characters long";
    return;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errorMessage.textContent = "The username cannot contain any special characters";
    return;
  }
  errorMessage.textContent = "";
  outputDiv.innerHTML = "";

  const proxyUrl = "https://web-production-787c.up.railway.app/";
  const apiUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;

  fetch(proxyUrl + apiUrl)
    .then((response) => {
      if (response.status === 204) {
        return null;
      }
      return response.json();
    })
    .then((data) => {
      if (data === null || (data && data.errorMessage === "Couldn't find any profile with name")) {
        outputDiv.innerHTML += `<span style="color:green;">${username} is available</span><br>`;
      } else if (data && data.id) {
        outputDiv.innerHTML += `<span style="color:red;">${username} is claimed - ${data.id}</span><br>`;
      } else {
        outputDiv.innerHTML += `<span>Error: Unexpected response</span><br>`;
      }
    })
    .catch((error) => {
      outputDiv.innerHTML += `<span>Error: ${error}</span><br>`;
    });
}

checkButton.addEventListener('click', checkUsername);

// Fetch with Retry Function
function fetchWithRetry(url, retries = 5, delay = 1000) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((response) => {
        if (response.status === 204) return resolve(null);
        return response.json();
      })
      .then((data) => {
        if (data === null || (data && data.errorMessage === "Couldn't find any profile with name")) {
          resolve(data);  // Username available
        } else if (data && data.id) {
          resolve(data);  // Username claimed
        } else {
          reject('Rate limit or error');  // Retry
        }
      })
      .catch(() => {
        if (retries === 0) reject('Failed after retries');
        else setTimeout(() => resolve(fetchWithRetry(url, retries - 1, delay)), delay);
      });
  });
}

// Scan Function
function launchScan() {
  const includeLetters = includeLettersCheckbox.checked;
  const includeNumbers = includeNumbersCheckbox.checked;
  const includeUnderscore = includeUnderscoreCheckbox.checked;
  const length = parseInt(usernameLengthSelect.value);

  if (!includeLetters && !includeNumbers && !includeUnderscore) {
    errorMessage.textContent = "You must include at least one of letters, numbers, or underscores.";
    return;
  }

  const usernames = generateUsernames(length, includeLetters, includeNumbers, includeUnderscore);
  scanData = {
    usernames,
    total: usernames.length,
    scanned: 0,
    startTime: Date.now()
  };

  outputDiv.innerHTML = '';
  progressBarInner.style.width = '0%';
  progressText.textContent = `0/${scanData.total}`;

  scanning = true;
  paused = false;
  pauseScanButton.disabled = false;
  stopScanButton.disabled = false;

  scanNextUsername();
}

function scanNextUsername() {
  if (!scanning || paused || scanData.scanned >= scanData.total) return;

  const username = scanData.usernames[scanData.scanned];
  const proxyUrl = "https://web-production-787c.up.railway.app/";
  const apiUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;

  fetchWithRetry(proxyUrl + apiUrl)
    .then((data) => {
      if (data === null || (data && data.errorMessage === "Couldn't find any profile with name")) {
        outputDiv.innerHTML += `<span style="color:green;">${username} is available</span><br>`;
      } else if (data && data.id) {
        outputDiv.innerHTML += `<span style="color:red;">${username} is claimed - ${data.id}</span><br>`;
      } else {
        outputDiv.innerHTML += `<span>Error checking ${username}: Unexpected response</span><br>`;
      }
      scanData.scanned++;
      updateProgress();
      setTimeout(scanNextUsername, 10);  // Slight delay to prevent blocking
    })
    .catch((error) => {
      outputDiv.innerHTML += `<span>Error checking ${username}: ${error}</span><br>`;
      scanData.scanned++;
      updateProgress();
      setTimeout(scanNextUsername, 10);  // Continue with the next username
    });
}

function updateProgress() {
  const progress = (scanData.scanned / scanData.total) * 100;
  progressBarInner.style.width = `${progress}%`;
  progressText.textContent = `${scanData.scanned}/${scanData.total}`;

  // Calculate estimated time remaining
  const elapsedTime = (Date.now() - scanData.startTime) / 1000;
  const estimatedTotalTime = (elapsedTime / scanData.scanned) * scanData.total;
  const estimatedTimeRemaining = estimatedTotalTime - elapsedTime;
  estimatedTimeLabel.textContent = `Estimated time: ${formatTime(estimatedTimeRemaining)}`;
}

function formatTime(seconds) {
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
}

function resumeScan() {
  paused = false;
  pauseScanButton.textContent = 'Pause';
  scanNextUsername();
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
  progressBarInner.style.width = '0%';
  progressText.textContent = '0/0';
  estimatedTimeLabel.textContent = 'Estimated time: 0h 0m 0s';
}

stopScanButton.addEventListener('click', stopScan);
launchScanButton.addEventListener('click', launchScan);

// Generate Usernames Function
function generateUsernames(length, includeLetters, includeNumbers, includeUnderscore) {
  let chars = [];
  if (includeLetters) chars = chars.concat('abcdefghijklmnopqrstuvwxyz'.split(''));
  if (includeNumbers) chars = chars.concat('0123456789'.split(''));
  if (includeUnderscore) chars.push('_');

  if (chars.length === 0) {
    errorMessage.textContent = "You must include at least one of letters, numbers, or underscores.";
    return [];
  }

  const usernames = [];

  function helper(prefix, depth) {
    if (depth === 0) {
      usernames.push(prefix);
      return;
    }
    for (let i = 0; i < chars.length; i++) {
      helper(prefix + chars[i], depth - 1);
    }
  }

  helper('', length);
  return usernames;
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
