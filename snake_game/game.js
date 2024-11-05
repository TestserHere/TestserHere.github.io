// game.js
const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const gridSize = 20;  // The grid size in pixels
let snake = [{ x: 9 * gridSize, y: 9 * gridSize }];  // Snake starting position (center of grid)
let direction = 'RIGHT';  // Initial direction of movement
let food = { x: 5 * gridSize, y: 5 * gridSize };  // Initial food position
let score = 0;

// Function to draw the snake on the canvas
function drawSnake() {
    snake.forEach(segment => {
        ctx.fillStyle = 'lime';
        ctx.fillRect(segment.x, segment.y, gridSize, gridSize);
    });
}

// Function to draw the food on the canvas
function drawFood() {
    ctx.fillStyle = 'red';
    ctx.fillRect(food.x, food.y, gridSize, gridSize);
}

// Function to move the snake based on the current direction
function moveSnake() {
    const head = { ...snake[0] };
    
    if (direction === 'RIGHT') head.x += gridSize;
    if (direction === 'LEFT') head.x -= gridSize;
    if (direction === 'UP') head.y -= gridSize;
    if (direction === 'DOWN') head.y += gridSize;

    snake.unshift(head);
    // Check if snake eats the food
    if (head.x === food.x && head.y === food.y) {
        score += 10;  // Increase score when food is eaten
        spawnFood();  // Respawn food
    } else {
        snake.pop();  // Remove the last segment of the snake
    }
}

// Function to check for collisions
function checkCollisions() {
    // Check if snake hits the walls
    if (snake[0].x < 0 || snake[0].x >= canvas.width || snake[0].y < 0 || snake[0].y >= canvas.height) {
        return true;
    }

    // Check if snake hits its own body
    for (let i = 1; i < snake.length; i++) {
        if (snake[i].x === snake[0].x && snake[i].y === snake[0].y) {
            return true;
        }
    }

    return false;
}

// Function to spawn food at random positions
function spawnFood() {
    food = {
        x: Math.floor(Math.random() * (canvas.width / gridSize)) * gridSize,
        y: Math.floor(Math.random() * (canvas.height / gridSize)) * gridSize
    };
}

// Function to update the score on the screen
function updateScore() {
    document.getElementById('score').textContent = `Score: ${score}`;
}

// Function to clear the canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Function to handle keyboard inputs
function changeDirection(event) {
    if (event.key === 'ArrowUp' && direction !== 'DOWN') direction = 'UP';
    if (event.key === 'ArrowDown' && direction !== 'UP') direction = 'DOWN';
    if (event.key === 'ArrowLeft' && direction !== 'RIGHT') direction = 'LEFT';
    if (event.key === 'ArrowRight' && direction !== 'LEFT') direction = 'RIGHT';
}

// Function to run the game loop
function gameLoop() {
    clearCanvas();  // Clear the canvas
    moveSnake();  // Move the snake
    if (checkCollisions()) {
        alert(`Game Over! Final Score: ${score}`);
        snake = [{ x: 9 * gridSize, y: 9 * gridSize }];  // Reset snake position
        score = 0;  // Reset score
        window.location = "";
    } else {
        drawSnake();  // Draw the snake
        drawFood();  // Draw the food
        updateScore();  // Update score display
        setTimeout(gameLoop, 100);  // Keep running the game loop every 100ms
    }
}

// Event listener for keyboard input
document.addEventListener('keydown', changeDirection);

// Start the game
gameLoop();
