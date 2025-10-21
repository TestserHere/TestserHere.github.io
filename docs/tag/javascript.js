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
    tagCooldown: 1000, // 1 second cooldown for tagging
    gravity: 0.7, // Increased gravity to reduce jump height
    obstacles: [],
    playerCollisions: [] // Track which players are currently colliding
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
    
    // Create obstacles
    createObstacles();
    
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
            x: 100 + (i * 100),
            y: gameState.canvas.height - 100, // Start on ground
            vx: 0,
            vy: 0,
            speed: 4,
            jumpSpeed: -15, // Increased jump power
            radius: 20,
            width: 30,
            height: 40,
            color: playerColors[i],
            isTagger: i === 0,
            onGround: false,
            facing: 1, // 1 for right, -1 for left
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
                // Jump if on ground
                if (player.onGround) {
                    player.vy = player.jumpSpeed;
                    player.onGround = false;
                }
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
        player.x = 100 + (index * 100);
        player.y = gameState.canvas.height - 100; // Start on ground
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
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

// Create jungle platformer layout inspired by the image
function createObstacles() {
    const W = gameState.canvas.width;
    const H = gameState.canvas.height;
    gameState.obstacles = [
        // === Ground (long and flat for running) ===
        { x: 0, y: H - 20, width: W, height: 20, type: 'ground' },
    
        // === Lower platforms (easy jumps, plenty of room) ===
        { x: 100, y: H - 120, width: 200, height: 15, type: 'platform' },
        { x: 450, y: H - 150, width: 200, height: 15, type: 'platform' },
        { x: 800, y: H - 120, width: 200, height: 15, type: 'platform' },
    
        // === Mid-level platforms (moderate jumps, slower pacing) ===
        { x: 200, y: H - 250, width: 150, height: 15, type: 'platform' },
        { x: 600, y: H - 270, width: 150, height: 15, type: 'platform' },
        { x: 950, y: H - 250, width: 150, height: 15, type: 'platform' },
    
        // === High escape areas (harder to reach, good for dodging) ===
        { x: 350, y: H - 380, width: 120, height: 15, type: 'platform' },
        { x: 750, y: H - 380, width: 120, height: 15, type: 'platform' },
    
        // === Jump pads (gentle placement — easy to hit) ===
        { x: 30, y: H - 40, width: 50, height: 12, type: 'jumppad' },
        { x: 320, y: H - 40, width: 50, height: 12, type: 'jumppad' },
        { x: 720, y: H - 40, width: 50, height: 12, type: 'jumppad' },
    
        // === Optional connector platforms (wider for easy landing) ===
        { x: 400, y: H - 220, width: 80, height: 10, type: 'platform' },
        { x: 800, y: H - 220, width: 80, height: 10, type: 'platform' }
    ];
            
}

// Update player positions with platformer physics
function updatePlayers() {
    if (!gameState.gameRunning) return;
    
    gameState.players.forEach(player => {
        // Apply horizontal movement and update facing direction
        if (player.keys.left) {
            player.vx = -player.speed;
            player.facing = -1;
        } else if (player.keys.right) {
            player.vx = player.speed;
            player.facing = 1;
        } else {
            player.vx *= 0.8; // Friction
        }
        
        // Apply gravity
        player.vy += gameState.gravity;
        
        // Update position
        player.x += player.vx;
        player.y += player.vy;
        
        // Check collision with obstacles
        checkObstacleCollisions(player);
        
        // Keep players within canvas bounds
        player.x = Math.max(player.width/2, Math.min(gameState.canvas.width - player.width/2, player.x));
        
        // Check if player is on ground (improved ground detection)
        player.onGround = false;
        gameState.obstacles.forEach(obstacle => {
            if (player.x < obstacle.x + obstacle.width &&
                player.x + player.width > obstacle.x &&
                player.y + player.height >= obstacle.y - 2 &&
                player.y + player.height <= obstacle.y + 5 &&
                player.vy >= 0) {
                player.onGround = true;
            }
        });
    });
    
    // Check for player collisions (tagging)
    checkPlayerCollisions();
}

// Check obstacle collisions
function checkObstacleCollisions(player) {
    gameState.obstacles.forEach(obstacle => {
        // Check if player is colliding with obstacle
        if (player.x < obstacle.x + obstacle.width &&
            player.x + player.width > obstacle.x &&
            player.y < obstacle.y + obstacle.height &&
            player.y + player.height > obstacle.y) {
            
            // Calculate overlap amounts
            const overlapLeft = (player.x + player.width) - obstacle.x;
            const overlapRight = (obstacle.x + obstacle.width) - player.x;
            const overlapTop = (player.y + player.height) - obstacle.y;
            const overlapBottom = (obstacle.y + obstacle.height) - player.y;
            
            // Find the smallest overlap to determine collision direction
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
            
            if (minOverlap === overlapLeft) {
                // Collision from left side
                player.x = obstacle.x - player.width;
                player.vx = 0;
            } else if (minOverlap === overlapRight) {
                // Collision from right side
                player.x = obstacle.x + obstacle.width;
                player.vx = 0;
            } else if (minOverlap === overlapTop) {
                // Collision from top (landing on platform)
                player.y = obstacle.y - player.height;
                player.vy = 0;
                player.onGround = true;
                
                // Special effect for jump pads
                if (obstacle.type === 'jumppad') {
                    player.vy = -20; // Super jump boost!
                    player.onGround = false;
                }
            } else if (minOverlap === overlapBottom) {
                // Collision from bottom (hitting ceiling)
                player.y = obstacle.y + obstacle.height;
                player.vy = 0;
            }
        }
    });
}

// Check for collisions between players (tagging with proper collision detection)
function checkPlayerCollisions() {
    const currentTime = Date.now();
    
    // Check if we're in cooldown period
    if (currentTime - gameState.lastTagTime < gameState.tagCooldown) {
        return;
    }
    
    const tagger = gameState.players[gameState.taggerIndex];
    
    gameState.players.forEach((player, index) => {
        if (index !== gameState.taggerIndex) {
            // Check if players are touching (rectangle collision)
            const isColliding = tagger.x < player.x + player.width &&
                               tagger.x + tagger.width > player.x &&
                               tagger.y < player.y + player.height &&
                               tagger.y + tagger.height > player.y;
            
            // Create collision key for tracking
            const collisionKey = `${Math.min(gameState.taggerIndex, index)}-${Math.max(gameState.taggerIndex, index)}`;
            
            if (isColliding) {
                // Check if this collision is new (not already tracked)
                if (!gameState.playerCollisions.includes(collisionKey)) {
                    // New collision detected - tag the player
                    const oldTaggerIndex = gameState.taggerIndex;
                    
                    gameState.players[oldTaggerIndex].isTagger = false;
                    player.isTagger = true;
                    gameState.taggerIndex = index;
                    
                    // Update cooldown timer (1 second)
                    gameState.lastTagTime = currentTime;
                    
                    // Track this collision
                    gameState.playerCollisions.push(collisionKey);
                    
                    updatePlayerInfo();
                    
                    // Visual feedback for tagging
                    console.log(`Player ${index + 1} tagged Player ${oldTaggerIndex + 1}!`);
                }
            } else {
                // Players are no longer colliding, remove from tracking
                const collisionIndex = gameState.playerCollisions.indexOf(collisionKey);
                if (collisionIndex !== -1) {
                    gameState.playerCollisions.splice(collisionIndex, 1);
                }
            }
        }
    });
}

// Render the game
function render() {
    // Clear canvas with platformer background
    const gradient = gameState.ctx.createLinearGradient(0, 0, 0, gameState.canvas.height);
    gradient.addColorStop(0, '#87CEEB'); // Sky blue at top
    gradient.addColorStop(0.6, '#98FB98'); // Light green in middle
    gradient.addColorStop(1, '#8B4513'); // Brown ground at bottom
    
    gameState.ctx.fillStyle = gradient;
    gameState.ctx.fillRect(0, 0, gameState.canvas.width, gameState.canvas.height);
    
    // Draw obstacles/platforms
    drawObstacles();
    
    // Draw players
    gameState.players.forEach(player => {
        drawPlayer(player);
    });
}

// Draw obstacles with better visuals
function drawObstacles() {
    gameState.obstacles.forEach(obstacle => {
        // Different styles based on type
        if (obstacle.type === 'ground') {
            // Ground platform
            gameState.ctx.fillStyle = '#8B4513';
            gameState.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // Grass texture
            gameState.ctx.fillStyle = '#228B22';
            gameState.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, 5);
            
            // Ground pattern
            gameState.ctx.strokeStyle = '#654321';
            gameState.ctx.lineWidth = 1;
            for (let i = 0; i < obstacle.width; i += 20) {
                gameState.ctx.beginPath();
                gameState.ctx.moveTo(obstacle.x + i, obstacle.y);
                gameState.ctx.lineTo(obstacle.x + i, obstacle.y + obstacle.height);
                gameState.ctx.stroke();
            }
            
        } else if (obstacle.type === 'platform') {
            // Regular platform
            gameState.ctx.fillStyle = '#654321';
            gameState.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // Top highlight
            gameState.ctx.fillStyle = '#8B4513';
            gameState.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, 3);
            
            // Side shadow
            gameState.ctx.fillStyle = '#4A2C17';
            gameState.ctx.fillRect(obstacle.x + obstacle.width - 3, obstacle.y, 3, obstacle.height);
            
            // Wood grain
            gameState.ctx.strokeStyle = '#2F1B14';
            gameState.ctx.lineWidth = 1;
            for (let i = 0; i < obstacle.width; i += 15) {
                gameState.ctx.beginPath();
                gameState.ctx.moveTo(obstacle.x + i, obstacle.y);
                gameState.ctx.lineTo(obstacle.x + i, obstacle.y + obstacle.height);
                gameState.ctx.stroke();
            }
            
        } else if (obstacle.type === 'wall') {
            // Vertical wall
            gameState.ctx.fillStyle = '#696969';
            gameState.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // Stone texture
            gameState.ctx.strokeStyle = '#2F4F4F';
            gameState.ctx.lineWidth = 2;
            gameState.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // Stone pattern
            gameState.ctx.fillStyle = '#778899';
            gameState.ctx.fillRect(obstacle.x + 3, obstacle.y + 3, obstacle.width - 6, obstacle.height - 6);
            
        } else if (obstacle.type === 'jumppad') {
            // Jump pad (purple platform that boosts you up)
            gameState.ctx.fillStyle = '#9370DB';
            gameState.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            
            // Glow effect
            gameState.ctx.shadowColor = '#9370DB';
            gameState.ctx.shadowBlur = 15;
            gameState.ctx.fillStyle = '#BA55D3';
            gameState.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            gameState.ctx.shadowBlur = 0;
            
            // Jump pad pattern (arrows pointing up)
            gameState.ctx.fillStyle = 'white';
            gameState.ctx.beginPath();
            gameState.ctx.moveTo(obstacle.x + obstacle.width/2, obstacle.y + 2);
            gameState.ctx.lineTo(obstacle.x + obstacle.width/2 - 4, obstacle.y + 8);
            gameState.ctx.lineTo(obstacle.x + obstacle.width/2 + 4, obstacle.y + 8);
            gameState.ctx.closePath();
            gameState.ctx.fill();
            
            // Magical sparkles
            gameState.ctx.fillStyle = 'white';
            gameState.ctx.fillRect(obstacle.x + 5, obstacle.y + 3, 2, 2);
            gameState.ctx.fillRect(obstacle.x + obstacle.width - 7, obstacle.y + 5, 2, 2);
            gameState.ctx.fillRect(obstacle.x + obstacle.width/2 - 3, obstacle.y + 6, 2, 2);
            gameState.ctx.fillRect(obstacle.x + obstacle.width/2 + 3, obstacle.y + 6, 2, 2);
        }
        
        // Border for all obstacles
        gameState.ctx.strokeStyle = '#2F1B14';
        gameState.ctx.lineWidth = 2;
        gameState.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
}

// Draw grid pattern with perspective
function drawGrid() {
    gameState.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    gameState.ctx.lineWidth = 1;
    
    // Vertical lines with perspective (closer together at bottom)
    for (let x = 0; x < gameState.canvas.width; x += 40) {
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(x, 0);
        gameState.ctx.lineTo(x, gameState.canvas.height);
        gameState.ctx.stroke();
    }
    
    // Horizontal lines with perspective (closer together at bottom)
    for (let y = 0; y < gameState.canvas.height; y += 30) {
        const perspective = 0.3 + (y / gameState.canvas.height) * 0.7;
        const lineWidth = gameState.canvas.width * perspective;
        const offset = (gameState.canvas.width - lineWidth) / 2;
        
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(offset, y);
        gameState.ctx.lineTo(offset + lineWidth, y);
        gameState.ctx.stroke();
    }
    
    // Add horizon line
    gameState.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    gameState.ctx.lineWidth = 2;
    gameState.ctx.beginPath();
    gameState.ctx.moveTo(0, gameState.canvas.height * 0.8);
    gameState.ctx.lineTo(gameState.canvas.width, gameState.canvas.height * 0.8);
    gameState.ctx.stroke();
}

// Draw a creative player character
function drawPlayer(player) {
    // Draw shadow
    gameState.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    gameState.ctx.fillRect(player.x - 5, player.y + player.height - 5, player.width + 10, 8);
    
    // Draw player body (rounded rectangle)
    gameState.ctx.fillStyle = player.color;
    gameState.ctx.fillRect(player.x + 2, player.y + 2, player.width - 4, player.height - 4);
    
    // Draw head (circle)
    gameState.ctx.fillStyle = player.color;
    gameState.ctx.beginPath();
    gameState.ctx.arc(player.x + player.width/2, player.y + 8, 8, 0, Math.PI * 2);
    gameState.ctx.fill();
    
    // Draw body (rounded rectangle)
    gameState.ctx.fillStyle = player.color;
    gameState.ctx.fillRect(player.x + 4, player.y + 12, player.width - 8, player.height - 16);
    
    // Draw arms
    const armOffset = player.facing * 3;
    gameState.ctx.fillStyle = player.color;
    gameState.ctx.fillRect(player.x + armOffset, player.y + 15, 6, 12);
    gameState.ctx.fillRect(player.x + player.width - 6 + armOffset, player.y + 15, 6, 12);
    
    // Draw legs
    gameState.ctx.fillStyle = player.color;
    gameState.ctx.fillRect(player.x + 6, player.y + player.height - 8, 6, 8);
    gameState.ctx.fillRect(player.x + player.width - 12, player.y + player.height - 8, 6, 8);
    
    // Draw eyes
    const eyeOffset = player.facing * 2;
    gameState.ctx.fillStyle = 'white';
    gameState.ctx.beginPath();
    gameState.ctx.arc(player.x + player.width/2 - 3 + eyeOffset, player.y + 6, 2, 0, Math.PI * 2);
    gameState.ctx.fill();
    gameState.ctx.beginPath();
    gameState.ctx.arc(player.x + player.width/2 + 3 + eyeOffset, player.y + 6, 2, 0, Math.PI * 2);
    gameState.ctx.fill();
    
    // Draw pupils
    gameState.ctx.fillStyle = 'black';
    gameState.ctx.beginPath();
    gameState.ctx.arc(player.x + player.width/2 - 3 + eyeOffset, player.y + 6, 1, 0, Math.PI * 2);
    gameState.ctx.fill();
    gameState.ctx.beginPath();
    gameState.ctx.arc(player.x + player.width/2 + 3 + eyeOffset, player.y + 6, 1, 0, Math.PI * 2);
    gameState.ctx.fill();
    
    // Draw mouth
    gameState.ctx.strokeStyle = 'black';
    gameState.ctx.lineWidth = 1;
    gameState.ctx.beginPath();
    gameState.ctx.arc(player.x + player.width/2, player.y + 8, 3, 0, Math.PI);
    gameState.ctx.stroke();
    
    // Draw border
    gameState.ctx.strokeStyle = 'white';
    gameState.ctx.lineWidth = 2;
    gameState.ctx.strokeRect(player.x, player.y, player.width, player.height);
    
    // Draw tagger indicator (crown above head)
    if (player.isTagger) {
        // Crown
        gameState.ctx.fillStyle = '#FFD700';
        gameState.ctx.beginPath();
        gameState.ctx.moveTo(player.x + player.width/2 - 8, player.y - 5);
        gameState.ctx.lineTo(player.x + player.width/2 - 4, player.y - 15);
        gameState.ctx.lineTo(player.x + player.width/2, player.y - 5);
        gameState.ctx.lineTo(player.x + player.width/2 + 4, player.y - 15);
        gameState.ctx.lineTo(player.x + player.width/2 + 8, player.y - 5);
        gameState.ctx.closePath();
        gameState.ctx.fill();
        
        // Crown border
        gameState.ctx.strokeStyle = '#FFA500';
        gameState.ctx.lineWidth = 2;
        gameState.ctx.stroke();
        
        // Add glow effect for tagger
        gameState.ctx.shadowColor = '#FFD700';
        gameState.ctx.shadowBlur = 15;
        gameState.ctx.strokeStyle = '#FFD700';
        gameState.ctx.lineWidth = 3;
        gameState.ctx.strokeRect(player.x, player.y, player.width, player.height);
        gameState.ctx.shadowBlur = 0;
    }
    
    // Draw player number badge
    gameState.ctx.fillStyle = 'white';
    gameState.ctx.fillRect(player.x + player.width - 12, player.y + 2, 10, 10);
    gameState.ctx.fillStyle = 'black';
    gameState.ctx.font = 'bold 8px Arial';
    gameState.ctx.textAlign = 'center';
    gameState.ctx.fillText(player.id + 1, player.x + player.width - 7, player.y + 9);
}

// Main game loop
function gameLoop() {
    updatePlayers();
    render();
    requestAnimationFrame(gameLoop);
}


// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    initGame();
    
    // Set default to 2 players
    document.querySelector('.player-btn').classList.add('active');
    setPlayers(2);
});
