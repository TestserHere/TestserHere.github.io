// Game state
let gameState = {
    players: [],
    numPlayers: 2,
    gameRunning: false,
    gameStarted: false,
    timeLeft: 120,
    taggerIndex: 0,
    gameTimer: null,
    canvas: null,
    ctx: null,
    lastTagTime: 0,
    tagCooldown: 500 // 500ms cooldown between tags
};

// Player colors
const playerColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];

// Key mappings for each player
const keyMappings = {
    0: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
    1: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
    2: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL' },
    3: { up: 'KeyT', down: 'KeyG', left: 'KeyF', right: 'KeyH' }
};

// Initialize game
function initGame() {
    gameState.canvas = document.getElementById('gameCanvas');
    gameState.ctx = gameState.canvas.getContext('2d');
    
    // Set up event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Set up fullscreen functionality
    setupFullscreen();
    
    // Initialize players
    createPlayers();
    
    // Start game loop
    gameLoop();
}

// Create players based on selected number
function createPlayers() {
    gameState.players = [];
    
    for (let i = 0; i < gameState.numPlayers; i++) {
        const player = {
            id: i,
            x: 100 + (i * 150),
            y: 100 + (i * 100),
            vx: 0,
            vy: 0,
            speed: 3,
            radius: 15,
            color: playerColors[i],
            isTagger: i === 0,
            keys: {
                up: false,
                down: false,
                left: false,
                right: false
            }
        };
        gameState.players.push(player);
    }
    
    updatePlayerInfo();
}

// Set number of players
function setPlayers(num) {
    gameState.numPlayers = num;
    
    // Update button states
    document.querySelectorAll('.player-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the correct button
    const buttons = document.querySelectorAll('.player-btn');
    buttons.forEach((btn, index) => {
        if (btn.textContent.includes(num)) {
            btn.classList.add('active');
        }
    });
    
    // Update control groups visibility
    document.querySelectorAll('.control-group').forEach((group, index) => {
        if (index < num) {
            group.style.display = 'block';
        } else {
            group.style.display = 'none';
        }
    });
    
    // Update player info visibility
    document.querySelectorAll('.player-item').forEach((item, index) => {
        if (index < num) {
            item.classList.remove('inactive');
        } else {
            item.classList.add('inactive');
        }
    });
    
    createPlayers();
}

// Handle key down events
function handleKeyDown(event) {
    // Prevent default behavior for arrow keys to avoid page scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
    }
    
    if (!gameState.gameRunning) {
        if (event.code === 'Space') {
            event.preventDefault();
            startGame();
        }
        return;
    }
    
    // Check each player's keys
    gameState.players.forEach((player, playerIndex) => {
        const mapping = keyMappings[playerIndex];
        if (mapping) {
            if (event.code === mapping.up) {
                event.preventDefault();
                player.keys.up = true;
            }
            if (event.code === mapping.down) {
                event.preventDefault();
                player.keys.down = true;
            }
            if (event.code === mapping.left) {
                event.preventDefault();
                player.keys.left = true;
            }
            if (event.code === mapping.right) {
                event.preventDefault();
                player.keys.right = true;
            }
        }
    });
}

// Handle key up events
function handleKeyUp(event) {
    gameState.players.forEach((player, playerIndex) => {
        const mapping = keyMappings[playerIndex];
        if (mapping) {
            if (event.code === mapping.up) player.keys.up = false;
            if (event.code === mapping.down) player.keys.down = false;
            if (event.code === mapping.left) player.keys.left = false;
            if (event.code === mapping.right) player.keys.right = false;
        }
    });
}

// Start the game
function startGame() {
    if (gameState.gameStarted) return;
    
    gameState.gameRunning = true;
    gameState.gameStarted = true;
    gameState.timeLeft = 120;
    gameState.taggerIndex = 0;
    
    // Reset all players
    gameState.players.forEach((player, index) => {
        player.isTagger = index === 0;
        player.x = 100 + (index * 150);
        player.y = 100 + (index * 100);
        player.vx = 0;
        player.vy = 0;
    });
    
    // Start timer
    gameState.gameTimer = setInterval(() => {
        gameState.timeLeft--;
        document.getElementById('timer').textContent = gameState.timeLeft;
        
        if (gameState.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
    
    document.getElementById('gameStatus').textContent = 'Game Running! Avoid the tagger!';
    updatePlayerInfo();
}

// End the game
function endGame() {
    gameState.gameRunning = false;
    clearInterval(gameState.gameTimer);
    
    const tagger = gameState.players[gameState.taggerIndex];
    document.getElementById('gameStatus').textContent = `Game Over! Player ${gameState.taggerIndex + 1} (Tagger) loses!`;
    
    // Update player statuses
    gameState.players.forEach((player, index) => {
        const statusElement = document.getElementById(`player${index + 1}-status`);
        if (index === gameState.taggerIndex) {
            statusElement.textContent = 'Lost (Tagger)';
            statusElement.className = 'status';
        } else {
            statusElement.textContent = 'Winner!';
            statusElement.className = 'status winner';
        }
    });
}

// Update player information display
function updatePlayerInfo() {
    gameState.players.forEach((player, index) => {
        const statusElement = document.getElementById(`player${index + 1}-status`);
        if (player.isTagger) {
            statusElement.textContent = 'Tagger';
            statusElement.className = 'status tagger';
        } else {
            statusElement.textContent = gameState.gameRunning ? 'Running' : 'Ready';
            statusElement.className = gameState.gameRunning ? 'status running' : 'status';
        }
    });
}

// Update player positions
function updatePlayers() {
    if (!gameState.gameRunning) return;
    
    gameState.players.forEach(player => {
        // Reset velocity
        player.vx = 0;
        player.vy = 0;
        
        // Apply movement based on keys
        if (player.keys.up) player.vy = -player.speed;
        if (player.keys.down) player.vy = player.speed;
        if (player.keys.left) player.vx = -player.speed;
        if (player.keys.right) player.vx = player.speed;
        
        // Update position
        player.x += player.vx;
        player.y += player.vy;
        
        // Keep players within canvas bounds
        player.x = Math.max(player.radius, Math.min(gameState.canvas.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(gameState.canvas.height - player.radius, player.y));
    });
    
    // Check for collisions
    checkCollisions();
}

// Check for collisions between players
function checkCollisions() {
    const currentTime = Date.now();
    
    // Check if we're in cooldown period
    if (currentTime - gameState.lastTagTime < gameState.tagCooldown) {
        return;
    }
    
    const tagger = gameState.players[gameState.taggerIndex];
    
    gameState.players.forEach((player, index) => {
        if (index !== gameState.taggerIndex) {
            const dx = tagger.x - player.x;
            const dy = tagger.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < tagger.radius + player.radius) {
                // Collision detected - switch tagger
                // First, remove tagger status from current tagger
                gameState.players[gameState.taggerIndex].isTagger = false;
                
                // Then assign tagger status to the new player
                player.isTagger = true;
                gameState.taggerIndex = index;
                
                // Update cooldown timer
                gameState.lastTagTime = currentTime;
                
                updatePlayerInfo();
            }
        }
    });
}

// Render the game
function render() {
    // Clear canvas
    gameState.ctx.fillStyle = '#2c3e50';
    gameState.ctx.fillRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Draw grid pattern
    drawGrid();
    
    // Draw players
    gameState.players.forEach(player => {
        drawPlayer(player);
    });
}

// Draw grid pattern
function drawGrid() {
    gameState.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    gameState.ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x < gameState.canvas.width; x += 40) {
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(x, 0);
        gameState.ctx.lineTo(x, gameState.canvas.height);
        gameState.ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < gameState.canvas.height; y += 40) {
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(0, y);
        gameState.ctx.lineTo(gameState.canvas.width, y);
        gameState.ctx.stroke();
    }
}

// Draw a player
function drawPlayer(player) {
    // Draw player circle
    gameState.ctx.fillStyle = player.color;
    gameState.ctx.beginPath();
    gameState.ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    gameState.ctx.fill();
    
    // Draw border
    gameState.ctx.strokeStyle = 'white';
    gameState.ctx.lineWidth = 2;
    gameState.ctx.stroke();
    
    // Draw tagger indicator (white arrow on top pointing down)
    if (player.isTagger) {
        gameState.ctx.fillStyle = 'white';
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(player.x, player.y - player.radius - 15);
        gameState.ctx.lineTo(player.x - 6, player.y - player.radius - 5);
        gameState.ctx.lineTo(player.x + 6, player.y - player.radius - 5);
        gameState.ctx.closePath();
        gameState.ctx.fill();
    }
    
    // Draw player number
    gameState.ctx.fillStyle = 'white';
    gameState.ctx.font = 'bold 12px Arial';
    gameState.ctx.textAlign = 'center';
    gameState.ctx.fillText(player.id + 1, player.x, player.y + 4);
}

// Main game loop
function gameLoop() {
    updatePlayers();
    render();
    requestAnimationFrame(gameLoop);
}

// Setup fullscreen functionality
function setupFullscreen() {
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            // Enter fullscreen
            document.documentElement.requestFullscreen().then(() => {
                document.body.classList.add('fullscreen');
                fullscreenBtn.textContent = 'Exit Fullscreen';
                // Resize canvas for fullscreen
                resizeCanvas();
            }).catch(err => {
                console.log('Error attempting to enable fullscreen:', err);
            });
        } else {
            // Exit fullscreen
            document.exitFullscreen().then(() => {
                document.body.classList.remove('fullscreen');
                fullscreenBtn.textContent = 'Enter Fullscreen';
                // Resize canvas back to normal
                resizeCanvas();
            }).catch(err => {
                console.log('Error attempting to exit fullscreen:', err);
            });
        }
    });
    
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('fullscreen');
            fullscreenBtn.textContent = 'Enter Fullscreen';
            resizeCanvas();
        }
    });
}

// Resize canvas based on current state
function resizeCanvas() {
    if (document.body.classList.contains('fullscreen')) {
        gameState.canvas.width = window.innerWidth - 20;
        gameState.canvas.height = window.innerHeight - 120;
    } else {
        gameState.canvas.width = 800;
        gameState.canvas.height = 600;
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    initGame();
    
    // Set default to 2 players
    document.querySelector('.player-btn').classList.add('active');
    setPlayers(2);
});
