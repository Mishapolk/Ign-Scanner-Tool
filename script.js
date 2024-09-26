let scanning = false;
let paused = false;
let usernames = [];
let currentProgress = 0;
let totalProgress = 0;
let startTime = null;

// Function to check a single Minecraft username using the Mojang API
async function checkUsername() {
    const username = document.getElementById('username').value;
    const outputDiv = document.getElementById('output');
    const errorDiv = document.getElementById('error');

    // Clear previous output and errors
    outputDiv.innerHTML = '';
    errorDiv.innerHTML = '';

    if (!username || username.length > 16) {
        errorDiv.innerHTML = "A username can only be 16 characters long.";
        return;
    }

    const regex = /^[a-zA-Z0-9_]+$/;
    if (!regex.test(username)) {
        errorDiv.innerHTML = "The username cannot contain any special characters.";
        return;
    }

    const apiUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;

    try {
        const response = await fetch(apiUrl);
        if (response.ok) {
            const data = await response.json();
            outputDiv.innerHTML = `<p><strong>${username}</strong> is claimed. ID: ${data.id}</p>`;
        } else if (response.status === 204) {
            outputDiv.innerHTML = `<p><strong>${username}</strong> is available.</p>`;
        } else {
            errorDiv.innerHTML = "An error occurred while checking the username.";
        }
    } catch (error) {
        errorDiv.innerHTML = "Failed to fetch data from the API.";
    }
}

// Function to start the scanning process
function startScan() {
    const estimatedTimeDiv = document.getElementById('estimated-time');
    estimatedTimeDiv.style.color = 'white';
    estimatedTimeDiv.innerHTML = 'Estimated time: 0m 0s';
    
    usernames = generateUsernames(3); // Example with length of 3 characters
    totalProgress = usernames.length;
    currentProgress = 0;

    document.getElementById('start-scan').disabled = true;
    document.getElementById('pause-resume-scan').disabled = false;
    document.getElementById('stop-scan').disabled = false;

    scanning = true;
    paused = false;
    startTime = Date.now();
    scanUsernames();
}

// Function to pause or resume the scanning process
function pauseResumeScan() {
    paused = !paused;
    const button = document.getElementById('pause-resume-scan');
    if (paused) {
        button.textContent = 'Resume';
    } else {
        button.textContent = 'Pause';
        scanUsernames();
    }
}

// Function to stop the scanning process
function stopScan() {
    scanning = false;
    paused = false;
    document.getElementById('start-scan').disabled = false;
    document.getElementById('pause-resume-scan').disabled = true;
    document.getElementById('stop-scan').disabled = true;
}

// Function to scan usernames with progress and estimated time
async function scanUsernames() {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const estimatedTimeDiv = document.getElementById('estimated-time');
    const outputDiv = document.getElementById('output');

    while (scanning && currentProgress < totalProgress && !paused) {
        const username = usernames[currentProgress];
        const apiUrl = `https://api.mojang.com/users/profiles/minecraft/${username}`;
        
        try {
            const response = await fetch(apiUrl);
            if (response.ok) {
                const data = await response.json();
                outputDiv.innerHTML += `<p><strong>${username}</strong> is claimed. ID: ${data.id}</p>`;
            } else if (response.status === 204) {
                outputDiv.innerHTML += `<p><strong>${username}</strong> is available.</p>`;
            } else {
                outputDiv.innerHTML += `<p>Error checking username: ${username}</p>`;
            }
        } catch (error) {
            outputDiv.innerHTML += `<p>Failed to check username: ${username}</p>`;
        }

        currentProgress += 1;
        progressBar.value = (currentProgress / totalProgress) * 100;
        progressText.innerHTML = `${currentProgress}/${totalProgress}`;

        // Calculate elapsed time and estimate remaining time
        const elapsedTime = (Date.now() - startTime) / 1000; // seconds
        const estimatedTotalTime = (elapsedTime / currentProgress) * totalProgress;
        const estimatedTimeRemaining = estimatedTotalTime - elapsedTime;

        estimatedTimeDiv.innerHTML = `Estimated time: ${formatTime(estimatedTimeRemaining)}`;

        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate some delay
    }

    if (currentProgress === totalProgress) {
        scanning = false;
        document.getElementById('start-scan').disabled = false;
        document.getElementById('pause-resume-scan').disabled = true;
        document.getElementById('stop-scan').disabled = true;
        estimatedTimeDiv.innerHTML = 'Scan Complete!';
        estimatedTimeDiv.style.color = 'green';
    }
}

// Function to format time in minutes and seconds
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
}

// Function to generate possible usernames based on character length
function generateUsernames(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
    const results = [];
    
    const generateCombination = (prefix, remainingLength) => {
        if (remainingLength === 0) {
            results.push(prefix);
            return;
        }

        for (let char of chars) {
            generateCombination(prefix + char, remainingLength - 1);
        }
    };

    generateCombination('', length);
    return results;
}
