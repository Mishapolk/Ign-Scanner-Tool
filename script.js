let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let isGameActive = true;
const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

const statusDisplay = document.getElementById('status');

function handleResultValidation() {
    let roundWon = false;
    for (let i = 0; i <= 7; i++) {
        const winCondition = winningConditions[i];
        let a = board[winCondition[0]];
        let b = board[winCondition[1]];
        let c = board[winCondition[2]];
        if (a === '' || b === '' || c === '') {
            continue;
        }
        if (a === b && b === c) {
            roundWon = true;
            break;
        }
    }

    if (roundWon) {
        statusDisplay.innerHTML = `Player ${currentPlayer} has won!`;
        isGameActive = false;
        return;
    }

    if (!board.includes('')) {
        statusDisplay.innerHTML = `It's a draw!`;
        isGameActive = false;
        return;
    }

    changePlayer();
}

function changePlayer() {
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    statusDisplay.innerHTML = `Player ${currentPlayer}'s turn`;
}

function makeMove(cellIndex) {
    if (board[cellIndex] === '' && isGameActive) {
        board[cellIndex] = currentPlayer;
        document.getElementById(`cell-${cellIndex}`).innerHTML = currentPlayer;
        handleResultValidation();
    }
}

function resetGame() {
    board = ['', '', '', '', '', '', '', '', ''];
    isGameActive = true;
    currentPlayer = 'X';
    statusDisplay.innerHTML = `Player X's turn`;
    document.querySelectorAll('.cell').forEach(cell => cell.innerHTML = '');
}
