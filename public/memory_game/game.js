// game.js
const boardSize = 4; // 4x4 grid
const cardValues = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']; // Unique pairs
let cards = [];
let flippedCards = [];
let matchedCards = [];
let moves = 0;

// Function to initialize the game
function initGame() {
    cards = [];
    flippedCards = [];
    matchedCards = [];
    moves = 0;

    // Shuffle the card values and create pairs
    const gameValues = [...cardValues, ...cardValues];
    shuffle(gameValues);

    // Create the card elements
    const gameBoard = document.getElementById('game-board');
    gameBoard.innerHTML = ''; // Clear any existing cards
    gameValues.forEach(value => {
        const card = document.createElement('div');
        card.classList.add('card');
        card.dataset.value = value;
        card.addEventListener('click', flipCard);
        gameBoard.appendChild(card);
    });
}

// Shuffle function to randomize the card values
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Function to handle card flip
function flipCard(event) {
    const card = event.target;
    if (flippedCards.length < 2 && !card.classList.contains('flipped') && !card.classList.contains('matched')) {
        card.classList.add('flipped');
        card.textContent = card.dataset.value;
        flippedCards.push(card);

        // Check if two cards are flipped
        if (flippedCards.length === 2) {
            moves++;
            document.getElementById('status').textContent = `Moves: ${moves}`;

            // Check for a match
            if (flippedCards[0].dataset.value === flippedCards[1].dataset.value) {
                flippedCards.forEach(card => card.classList.add('matched'));
                matchedCards.push(...flippedCards);
                flippedCards = [];
                // Check if the game is over
                if (matchedCards.length === cards.length) {
                    setTimeout(() => alert(`You won! Total moves: ${moves}`), 200);
                    
                }
            } else {
                // If no match, flip the cards back
                setTimeout(() => {
                    flippedCards.forEach(card => {
                        card.classList.remove('flipped');
                        card.textContent = '';
                    });
                    flippedCards = [];
                }, 1000);
            }
        }
    }
}

// Initialize the game when the page loads
window.onload = initGame;
