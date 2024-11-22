// game.js

const canvas = document.getElementById("flappy-game");
const ctx = canvas.getContext("2d");

// Game variables
let birdY = canvas.height / 2;
let birdX = 50;
let birdWidth = 20;
let birdHeight = 20;
let birdVelocity = 0;
let birdGravity = 0.6;
let birdFlap = -7; // Flap speed
let birdFlapInterval = 0;

let pipes = [];
let pipeWidth = 40;
let pipeGap = 100;
let pipeSpacing = 300;
let pipeSpeed = 2;
let score = 0;
let gameOver = false;

// Draw the bird
function drawBird() {
    ctx.fillStyle = "#FF0";
    ctx.fillRect(birdX, birdY, birdWidth, birdHeight);
}

// Bird flap (tapping space bar or clicking)
function birdFlapHandler() {
    birdVelocity = birdFlap; // Make the bird move upwards
}

// Gravity (bird falling down)
function applyGravity() {
    birdVelocity += birdGravity;
    birdY += birdVelocity;

    // If the bird hits the ground
    if (birdY + birdHeight > canvas.height) {
        birdY = canvas.height - birdHeight;
        gameOver = true;
    }

    // If the bird goes too high, stop it
    if (birdY < 0) {
        birdY = 0;
    }
}

// Draw pipes
function drawPipes() {
    pipes.forEach(pipe => {
        ctx.fillStyle = "#00FF00";
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight);
        ctx.fillRect(pipe.x, canvas.height - pipe.bottomHeight, pipeWidth, pipe.bottomHeight);
    });
}

// Move pipes and detect collisions
function movePipes() {
    pipes.forEach((pipe, index) => {
        pipe.x -= pipeSpeed;
        
        // Check if the pipe is off-screen and remove it
        if (pipe.x + pipeWidth < 0) {
            pipes.splice(index, 1);
            score++;
        }

        // Check if the bird collides with the pipe
        if (
            birdX + birdWidth > pipe.x &&
            birdX < pipe.x + pipeWidth &&
            (birdY < pipe.topHeight || birdY + birdHeight > canvas.height - pipe.bottomHeight)
        ) {
            gameOver = true;
        }
    });
}

// Spawn new pipes
function generatePipes() {
    if (pipes.length === 0 || pipes[pipes.length - 1].x <= canvas.width - pipeSpacing) {
        let topHeight = Math.floor(Math.random() * (canvas.height - pipeGap));
        let bottomHeight = canvas.height - topHeight - pipeGap;
        pipes.push({ x: canvas.width, topHeight: topHeight, bottomHeight: bottomHeight });
    }
}

// Update the score
function updateScore() {
    document.getElementById("score").textContent = `Score: ${score}`;
}

// Game loop
function gameLoop() {
    if (gameOver) {
        alert("Game Over! Final Score: " + score);
        window.location = "";
        return;
    }

    setTimeout(function () {
        clearCanvas();
        applyGravity();
        generatePipes();
        movePipes();
        drawBird();
        drawPipes();
        updateScore();
        gameLoop();
    }, 1000 / 60); // 60 frames per second
}

// Clear the canvas
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Listen for flap input (click or spacebar)
document.addEventListener("keydown", function (event) {
    if (event.key === " " || event.key === "ArrowUp") {
        birdFlapHandler();
    } else if (event.key === " " || event.key === "Space") {
        birdFlapHandler();
    }
});

document.addEventListener("click", birdFlapHandler);

// Start the game
gameLoop();
