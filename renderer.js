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

for (let i = 3; i <= 16; i++) {
  const option = document.createElement('option');
  option.value = i;
  option.text = i;
  usernameLengthSelect.appendChild(option);
}

function checkUsername() {
  const username = usernameInput.value.trim();
  if (username.length > 16) {
    errorMessage.textContent = "A username can only be 16 characters long";
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
      if (data && data.id) {
        outputDiv.innerHTML += `<span style="color:red;">${username} is claimed - ${data.id}</span><br>`;
      } else {
        outputDiv.innerHTML += `<span>Couldn't find any profile with name ${username}</span><br>`;
      }
    })
    .catch((error) => {
      outputDiv.innerHTML += `<span>Error: ${error}</span><br>`;
    });
}

checkButton.addEventListener('click', checkUsername);

// Helper function to generate all possible usernames for a given length
function generateUsernames(length, includeLetters, includeNumbers, includeUnderscore) {
  let chars = [];
  if (includeLetters) chars = chars.concat('abcdefghijklmnopqrstuvwxyz'.split(''));
  if (includeNumbers) chars = chars.concat('0123456789'.split(''));
  if (includeUnderscore) chars.push('_');
  
  // Return early if no characters are allowed
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

// Scan function to iterate over possible usernames
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

  scanNextUsername();
}

// Function to handle each username lookup during the scan
function scanNextUsername() {
  if (!scanning || paused || scanData.scanned >= scanData.total) {
    return;
  }

  const username = scanData.usernames[scanData.scanned];
  const proxyUrl = "https://web-production-787c.up.railway.app/";
  const apiUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;

  fetch(proxyUrl + apiUrl)
    .then((response) => {
      if (response.status === 204) return null;
      return response.json();
    })
    .then((data) => {
      if (data && data.id) {
        outputDiv.innerHTML += `<span style="color:red;">${username} is claimed - ${data.id}</span><br>`;
      } else {
        outputDiv.innerHTML += `<span>${username} is available</span><br>`;
      }
      scanData.scanned++;

      // Update progress bar
      const progress = (scanData.scanned / scanData.total) * 100;
      progressBarInner.style.width = `${progress}%`;
      progressText.textContent = `${scanData.scanned}/${scanData.total}`;

      // Calculate estimated time remaining
      const elapsedTime = (Date.now() - scanData.startTime) / 1000;
      const estimatedTotalTime = (elapsedTime / scanData.scanned) * scanData.total;
      const estimatedTimeRemaining = estimatedTotalTime - elapsedTime;
      estimatedTimeLabel.textContent = `Estimated time: ${formatTime(estimatedTimeRemaining)}`;
      
      scanNextUsername();
    })
    .catch((error) => {
      outputDiv.innerHTML += `<span>Error checking ${username}: ${error}</span><br>`;
      scanNextUsername();
    });
}

// Helper function to format time in minutes/seconds
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${minutes}m ${sec}s`;
}

// Pause and stop functions
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
  progressBarInner.style.width = '0%';
  progressText.textContent = '0/0';
  estimatedTimeLabel.textContent = 'Estimated time: 0m 0s';
}

stopScanButton.addEventListener('click', stopScan);

launchScanButton.addEventListener('click', launchScan);
