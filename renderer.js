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

for (let i = 3; i <= 16; i++) {
  const option = document.createElement('option');
  option.value = i;
  option.text = i;
  usernameLengthSelect.appendChild(option);
}

let scanning = false;
let paused = false;
let scanData = {};

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

  // Use your Railway-hosted CORS proxy to bypass CORS issues
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

// Add other scan-related functions here (launchScan, pauseScan, stopScan, etc.) as in previous examples.

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

