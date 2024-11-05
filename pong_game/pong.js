// pong.js
const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');

// Set up game variables
const paddleWidth = 10, paddleHeight = 80;
let playerY = canvas.height / 2 - paddleHeight / 2;
let aiY = canvas.height / 2 - paddleHeight / 2;
let playerSpeed = 0;
let aiSpeed = 4;
let ballX = canvas.width / 2, ballY = canvas.height / 2;
let ballSpeedX = 4, ballSpeedY = 4;
let playerScore = 0, aiScore = 0;

// Draw the paddles and ball
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);  // Clear the canvas

    // Draw the player paddle
    ctx.fillStyle = '#fff';
    ctx.fillRect(10, playerY, paddleWidth, paddleHeight);

    // Draw the AI paddle
    ctx.fillRect(canvas.width - 10 - paddleWidth, aiY, paddleWidth, paddleHeight);

    // Draw the ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);
    ctx.fill();
}

// Move the paddles
function movePaddles() {
    // Player paddle movement (up/down with arrow keys)
    playerY += playerSpeed;

    // Prevent the player paddle from going out of bounds
    if (playerY < 0) playerY = 0;
    if (playerY + paddleHeight > canvas.height) playerY = canvas.height - paddleHeight;

    // AI paddle movement (simple AI, follow the ball)
    if (aiY + paddleHeight / 2 < ballY) {
        aiY += aiSpeed;
    } else if (aiY + paddleHeight / 2 > ballY) {
        aiY -= aiSpeed;
    }

    // Prevent the AI paddle from going out of bounds
    if (aiY < 0) aiY = 0;
    if (aiY + paddleHeight > canvas.height) aiY = canvas.height - paddleHeight;
}

// Move the ball
function moveBall() {
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Ball collision with top and bottom walls
    if (ballY <= 0 || ballY >= canvas.height) {
        ballSpeedY = -ballSpeedY;
    }

    // Ball collision with paddles
    if (ballX <= 10 + paddleWidth && ballY >= playerY && ballY <= playerY + paddleHeight) {
        ballSpeedX = -ballSpeedX;
    }
    if (ballX >= canvas.width - 10 - paddleWidth && ballY >= aiY && ballY <= aiY + paddleHeight) {
        ballSpeedX = -ballSpeedX;
    }

    // Ball out of bounds (scoring)
    if (ballX <= 0) {
        aiScore++;
        resetBall();
    }
    if (ballX >= canvas.width) {
        playerScore++;
        resetBall();
    }
}

// Reset ball to the center
function resetBall() {
    ballX = canvas.width / 2;
    ballY = canvas.height / 2;
    ballSpeedX = -ballSpeedX;
    ballSpeedY = 4 * (Math.random() > 0.5 ? 1 : -1);  // Randomize Y speed
}

// Update the score
function updateScore() {
    document.getElementById('score').textContent = `Player: ${playerScore} | AI: ${aiScore}`;
}

// Control the player paddle with arrow keys
function keyDownHandler(event) {
    if (event.key === 'ArrowUp') {
        playerSpeed = -8;  // Move up
    } else if (event.key === 'ArrowDown') {
        playerSpeed = 8;   // Move down
    }
}

// Stop paddle movement when key is released
function keyUpHandler(event) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        playerSpeed = 0;
    }
}

// Main game loop
function gameLoop() {
    draw();
    movePaddles();
    moveBall();
    updateScore();
    requestAnimationFrame(gameLoop);  // Keep the game loop running
}

// Event listeners for keyboard input
document.addEventListener('keydown', keyDownHandler);
document.addEventListener('keyup', keyUpHandler);

// Start the game loop
gameLoop();
