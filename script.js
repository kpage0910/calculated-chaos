// Get the canvas element and its 2D rendering context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Detect if on mobile device (moved here to avoid hoisting issues)
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) ||
  (navigator.maxTouchPoints &&
    navigator.maxTouchPoints > 2 &&
    navigator.platform !== "MacIntel");

console.log(
  "Mobile detection:",
  isMobile,
  "Screen size:",
  window.innerWidth + "x" + window.innerHeight
);

// Game scaling variables
let gameScale = 1;
let baseWidth = 1500;
let baseHeight = 900;

// Initialize canvas size and scaling
function initializeCanvas() {
  const maxWidth = window.innerWidth - 20;
  const maxHeight = window.innerHeight - 100; // More space for UI elements

  if (isMobile) {
    // Mobile: Use much smaller base dimensions that fit the screen better
    const mobileWidth = Math.min(400, maxWidth);
    const mobileHeight = Math.min(600, maxHeight);

    canvas.width = mobileWidth;
    canvas.height = mobileHeight;

    // No additional scaling on mobile - use actual size
    canvas.style.width = mobileWidth + "px";
    canvas.style.height = mobileHeight + "px";
    gameScale = 1;
  } else {
    // Desktop: Keep original scaling behavior
    const scaleX = maxWidth / baseWidth;
    const scaleY = maxHeight / baseHeight;
    gameScale = Math.min(scaleX, scaleY, 1);

    canvas.width = baseWidth;
    canvas.height = baseHeight;

    // Apply scaling for display
    canvas.style.width = baseWidth * gameScale + "px";
    canvas.style.height = baseHeight * gameScale + "px";
  }

  // Disable image smoothing for crisp pixel art
  ctx.imageSmoothingEnabled = false;

  console.log(
    "Canvas initialized:",
    canvas.width,
    "x",
    canvas.height,
    "Scale:",
    gameScale,
    "Mobile:",
    isMobile
  );
}

// Handle window resize
function handleResize() {
  initializeCanvas();
  // Recalculate game constants based on new canvas size
  WATER_LEVEL = canvas.height - (isMobile ? 40 : 100); // Smaller water area on mobile
  seesawX = canvas.width / 2;
  seesawY = WATER_LEVEL - (isMobile ? 80 : 250); // Much closer to water on mobile
  seesawWidth = getObjects().seesaw.width;
  seesawHeight = getObjects().seesaw.height;

  // Reposition ball if it's on the seesaw
  if (ball.onSeesaw) {
    ball.x = seesawX;
    ball.y = seesawY - 50;
  }
}

// Handle orientation changes
function handleOrientationChange() {
  // Small delay to ensure orientation change is complete
  setTimeout(() => {
    handleResize();
  }, 100);
}

window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", handleOrientationChange);

// Initialize on load
initializeCanvas();

// Game constants (will be set after canvas initialization)
let WATER_LEVEL = canvas.height - (isMobile ? 40 : 100); // Smaller water area on mobile
let ANVIL_SPAWN_RATE = 180; // Will be adjusted for mobile
let BIG_ANVIL_SPAWN_RATE = 400; // Initialize this early
const BALL_JUMP_POWER = -12;
const AIR_JUMP_POWER = -8; // Weaker air jumps
const SQUISH_DURATION = 60;
const MAX_ANVILS_ON_SCREEN = 15;
const MAX_ANVILS_ON_SEESAW = 8;
const MAX_PARTICLES = 100;

// Adjust game difficulty for mobile
if (isMobile) {
  ANVIL_SPAWN_RATE = 220; // Slower spawn rate on mobile for better performance
  BIG_ANVIL_SPAWN_RATE = 500; // Also slower big anvil spawn rate on mobile
}

const PHYSICS = {
  gravity: 0.35, // Reduced from 0.5 for slower falling
  friction: 0.98,
  moveSpeed: 0.45, // Increased for stronger air control
  angleSmoothing: 0.08,
  torqueScale: 0.0001,
  maxAngle: 0.4,
};

// Mobile physics adjustments for consistent feel
const MOBILE_PHYSICS = {
  gravity: 0.38, // Slightly stronger gravity on mobile for better responsiveness
  friction: 0.94, // Reduced friction for more responsive movement (was 0.96)
  moveSpeed: 0.75, // Much stronger movement for touch controls (increased from 0.55)
  angleSmoothing: 0.09,
  torqueScale: 0.00012,
  maxAngle: 0.45,
};

// Get appropriate physics values based on device
function getPhysics() {
  return isMobile ? MOBILE_PHYSICS : PHYSICS;
}

const OBJECTS = {
  ball: { radius: 15, weight: 1 },
  anvil: { width: 25, height: 35, weight: 10, spawnVelocity: 2.5 }, // Reduced from 3
  bigAnvil: { width: 45, height: 60, weight: 25, spawnVelocity: 3 }, // Reduced from 4
  seesaw: { width: canvas.width * 0.7, height: 25 },
};

// Mobile object adjustments for consistent feel
const MOBILE_OBJECTS = {
  ball: { radius: 12, weight: 1 }, // Slightly smaller ball
  anvil: { width: 20, height: 28, weight: 10, spawnVelocity: 2.8 }, // Smaller anvils
  bigAnvil: { width: 35, height: 48, weight: 25, spawnVelocity: 3.3 }, // Smaller big anvils
  seesaw: { width: canvas.width * 0.75, height: 20 }, // Slightly smaller seesaw
};

// Get appropriate object values based on device
function getObjects() {
  return isMobile ? MOBILE_OBJECTS : OBJECTS;
}

// Seesaw variables - initialized early to avoid reference errors
let seesawAngle = 0;
let targetSeesawAngle = 0;
let seesawX = canvas.width / 2;
let seesawY = WATER_LEVEL - (isMobile ? 80 : 250); // Much closer to water on mobile
let seesawWidth = OBJECTS.seesaw.width;
let seesawHeight = OBJECTS.seesaw.height;

// Ball properties (radius will be set after device detection)
const ball = {
  x: seesawX,
  y: seesawY - 50,
  radius: 15, // Will be updated after mobile detection
  velocityX: 0,
  velocityY: 0,
  onSeesaw: false,
  isSquished: false,
  squishTimer: 0,
  squishAmount: 1.0,
  canJump: true,
  jumpPressed: false,
  airJumps: 0,
  maxAirJumps: 2, // Allow 2 air jumps before needing to land
};

// Initialize ball radius based on device (after ball object is defined)
ball.radius = getObjects().ball.radius;

// Lives system
let lives = 3;
let respawning = false;
let gameOver = false;

// Survival timer system
let gameStartTime = 0;
let survivalTime = 0;

// Anvils system
let anvils = [];
let anvilSpawnTimer = 0;
let bigAnvilSpawnTimer = 0;

let splash = { active: false, x: 0, y: 0, particles: [], timer: 0 };

// Water pocket system
let waterPockets = [];
const WATER_POCKET_SPAWN_RATE = 300; // Every 5 seconds (300 frames at 60fps)
let leftSideSpawnTimer = 0;
let rightSideSpawnTimer = 0;

const WATER_POCKET = {
  width: 200, // Much wider - was 80
  maxHeight: 200,
  riseSpeed: 4,
  fallSpeed: 2,
  lifetime: 180, // How long they stay up (frames)
  pushForce: -15, // Upward force when ball touches
};

// Mobile water pocket adjustments for smaller screens
const MOBILE_WATER_POCKET = {
  width: 60, // Even smaller for mobile to avoid seesaw overlap
  maxHeight: 120,
  riseSpeed: 4,
  fallSpeed: 2,
  lifetime: 180,
  pushForce: -15,
};

// Get appropriate water pocket values based on device
function getWaterPocket() {
  return isMobile ? MOBILE_WATER_POCKET : WATER_POCKET;
}

// Game timing
let lastTime = 0;

// Keyboard controls
const keys = {};

// Unified drawing functions
function drawRect(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function drawCircle(x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function createRadialGradient(x, y, radius, colorStops) {
  const gradient = ctx.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.3,
    0,
    x,
    y,
    radius
  );
  colorStops.forEach((stop) => gradient.addColorStop(stop.offset, stop.color));
  return gradient;
}

function drawMetallicBall(x, y, radius, squishAmount = 1.0) {
  ctx.save();
  if (squishAmount !== 1.0) {
    ctx.translate(x, y);
    ctx.scale(1.5, squishAmount);
    ctx.translate(-x, -y);
  }

  // Metal ball base
  drawCircle(x, y, radius, "#4A4A4A");

  // Metal gradient effect
  const gradient = createRadialGradient(x, y, radius, [
    { offset: 0, color: "#E0E0E0" },
    { offset: 0.4, color: "#808080" },
    { offset: 1, color: "#2A2A2A" },
  ]);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Bright metallic shine
  drawCircle(x - radius * 0.4, y - radius * 0.4, radius * 0.3, "#FFFFFF");

  // Smaller highlight (only for normal sized balls)
  if (radius > 10) {
    drawCircle(x + radius * 0.2, y - radius * 0.2, radius * 0.15, "#F0F0F0");
  }

  ctx.restore();
}

// Listen for key presses
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;
});

document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

// Touch controls for mobile
let touchStartX = null;
let touchStartY = null;
let touchStartTime = null;
let isTouching = false;
let touchDirection = null; // 'left', 'right', or null
let touchMoveThreshold = 15; // Reduced from default for more responsive swipes

// Touch event handlers for mobile
canvas.addEventListener(
  "touchstart",
  (e) => {
    if (!isMobile) return; // Only handle touch on actual mobile devices

    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = (touch.clientX - rect.left) / gameScale;
    touchStartY = (touch.clientY - rect.top) / gameScale;
    touchStartTime = Date.now();
    isTouching = true;
    touchDirection = null;
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
    if (!isMobile) return; // Only handle touch on actual mobile devices

    e.preventDefault();
    if (touchStartX === null || touchStartY === null) return;

    const touchDuration = Date.now() - touchStartTime;
    const rect = canvas.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const touchEndX = (touch.clientX - rect.left) / gameScale;
    const touchEndY = (touch.clientY - rect.top) / gameScale;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Tap (short touch with minimal movement) = jump
    if (touchDuration < 200 && distance < 20) {
      // Reduced distance threshold
      if (ball.canJump && !ball.jumpPressed) {
        ball.jumpPressed = true;
        if (ball.onSeesaw || ball.airJumps < ball.maxAirJumps) {
          ball.velocityY = ball.onSeesaw ? BALL_JUMP_POWER : AIR_JUMP_POWER;
          ball.onSeesaw = false;
          if (!ball.onSeesaw) ball.airJumps++;
        }
      }
    }
    // Swipe gestures for movement
    else if (distance > touchMoveThreshold) {
      // Use configurable threshold
      const physics = getPhysics();
      const airControlFactor = ball.onSeesaw ? 2.2 : 1.2; // Increased for mobile

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe - increased multiplier for faster response
        if (deltaX > 0) {
          ball.velocityX += physics.moveSpeed * airControlFactor * 2.5; // Increased from 2
        } else {
          ball.velocityX -= physics.moveSpeed * airControlFactor * 2.5; // Increased from 2
        }
      } else if (deltaY > 0) {
        // Downward swipe - fast fall
        if (!ball.onSeesaw) ball.velocityY += 2; // Increased from 1.5
      }
    }

    // Reset touch state
    isTouching = false;
    touchDirection = null;
    touchStartX = null;
    touchStartY = null;
    touchStartTime = null;
  },
  { passive: false }
);

// Prevent default touch behaviors and handle continuous movement
canvas.addEventListener(
  "touchmove",
  (e) => {
    if (!isMobile) return; // Only prevent default on actual mobile devices

    e.preventDefault();

    // Handle continuous movement during touch drag
    if (isTouching && touchStartX !== null && touchStartY !== null) {
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const currentX = (touch.clientX - rect.left) / gameScale;
      const currentY = (touch.clientY - rect.top) / gameScale;

      const deltaX = currentX - touchStartX;
      const deltaY = currentY - touchStartY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Only start continuous movement if we've moved enough
      if (distance > touchMoveThreshold) {
        const physics = getPhysics();
        const continuousMoveFactor = 0.3; // Reduced factor for smooth continuous movement

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Determine direction for continuous movement
          if (deltaX > touchMoveThreshold && touchDirection !== "right") {
            touchDirection = "right";
          } else if (
            deltaX < -touchMoveThreshold &&
            touchDirection !== "left"
          ) {
            touchDirection = "left";
          }

          // Apply continuous movement
          if (touchDirection === "right") {
            ball.velocityX += physics.moveSpeed * continuousMoveFactor;
          } else if (touchDirection === "left") {
            ball.velocityX -= physics.moveSpeed * continuousMoveFactor;
          }
        }
      }
    }
  },
  { passive: false }
);

// Play Again button event listener
document.addEventListener("DOMContentLoaded", () => {
  const playAgainButton = document.getElementById("playAgainButton");
  playAgainButton.addEventListener("click", resetGame);
});

function handleInput() {
  const physics = getPhysics();
  const airControlFactor = ball.onSeesaw
    ? isMobile
      ? 2.2
      : 1.8
    : isMobile
    ? 1.2
    : 0.8; // Enhanced mobile air control
  const controls = {
    ArrowLeft: () => (ball.velocityX -= physics.moveSpeed * airControlFactor),
    ArrowRight: () => (ball.velocityX += physics.moveSpeed * airControlFactor),
    ArrowUp: () => {
      const currentlyPressed = keys["ArrowUp"];

      if (currentlyPressed && !ball.jumpPressed) {
        if (ball.onSeesaw && ball.canJump) {
          // Regular jump from seesaw - full power
          ball.velocityY = BALL_JUMP_POWER;
          ball.canJump = false;
          ball.airJumps = 0; // Reset air jumps when jumping from seesaw
        } else if (!ball.onSeesaw && ball.airJumps < ball.maxAirJumps) {
          // Air jump - weaker power, limited uses
          ball.velocityY = AIR_JUMP_POWER;
          ball.airJumps++;
        }
      }

      ball.jumpPressed = currentlyPressed;
    },
    ArrowDown: () => {
      if (!ball.onSeesaw) ball.velocityY += 0.8; // Fast fall
    },
  };

  Object.entries(controls).forEach(([key, action]) => {
    if (keys[key]) action();
  });

  // Handle jump key release
  if (!keys["ArrowUp"]) {
    ball.jumpPressed = false;
  }
}

// Physics helper functions
function clampVelocity(velocity, min, max) {
  return Math.max(min, Math.min(max, velocity));
}

function applyBoundaryCollision(obj, bounds, restitution = 0.7) {
  if (obj.x < bounds.left) {
    obj.x = bounds.left;
    obj.velocityX *= -restitution;
  }
  if (obj.x > bounds.right) {
    obj.x = bounds.right;
    obj.velocityX *= -restitution;
  }
  if (obj.y < bounds.top) {
    obj.y = bounds.top;
    obj.velocityY *= -restitution;
  }
  if (obj.y > bounds.bottom) {
    obj.y = bounds.bottom;
    obj.velocityY *= -restitution;
  }
}

function updateBall() {
  if (respawning) return;

  const physics = getPhysics();

  if (ball.isSquished) {
    if (--ball.squishTimer <= 0) {
      ball.isSquished = false;
      ball.squishAmount = 1.0;
    } else {
      // Keep the squished ball on the seesaw surface if it was squished there
      if (ball.onSeesaw) {
        const bounds = getSeesawBounds();
        if (ball.x >= bounds.left && ball.x <= bounds.right) {
          const distanceFromCenter = ball.x - seesawX;
          const seesawHeightAtBallX =
            bounds.top + distanceFromCenter * Math.tan(seesawAngle);
          ball.y = seesawHeightAtBallX - ball.radius;
        }
      }
    }
    return;
  }

  if (!ball.onSeesaw) ball.velocityY += physics.gravity;

  // Clamp velocities to prevent clipping through objects
  ball.velocityX = clampVelocity(ball.velocityX, -15, 15);
  ball.velocityY = clampVelocity(ball.velocityY, -20, 20);

  ball.x += ball.velocityX;
  ball.y += ball.velocityY;

  // Apply different friction based on whether ball is on seesaw or in air
  if (ball.onSeesaw) {
    ball.velocityX *= physics.friction;
  } else {
    // Less air resistance when not on seesaw for better control
    ball.velocityX *= 0.99;
  }

  // Boundary checks
  const ballBounds = {
    left: ball.radius,
    right: canvas.width - ball.radius,
    top: ball.radius,
    bottom: canvas.height - ball.radius,
  };
  applyBoundaryCollision(ball, ballBounds);

  if (ball.y + ball.radius >= WATER_LEVEL) {
    createSplash(ball.x, WATER_LEVEL, "ball");
    ballFellInWater();
    return;
  }

  // Emergency reset if ball gets stuck outside playable area
  if (
    ball.x < -50 ||
    ball.x > canvas.width + 50 ||
    ball.y > canvas.height + 50
  ) {
    respawnBall();
    return;
  }

  checkSeesawCollision();
}

function ballFellInWater() {
  if (lives > 0) {
    lives--;
    respawnBall();
  }
}

function squishBall() {
  if (ball.isSquished) return; // Prevent multiple squishes

  ball.isSquished = true;
  ball.squishTimer = SQUISH_DURATION; // 1 second at 60fps
  ball.squishAmount = 0.2; // Very flat
  ball.velocityX = 0;
  ball.velocityY = 0;

  // Keep track of whether ball was on seesaw when squished
  // Don't change ball.onSeesaw state - let it maintain its current state
  // so the position updates can keep it on the seesaw surface

  // After squish animation, lose life and respawn
  setTimeout(() => {
    ballFellInWater();
  }, 1000);
}

// Particle system helpers
function createParticle(x, y, angle, speed, upwardBias, size, life, type) {
  return {
    x,
    y,
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed - Math.random() * upwardBias,
    size: size + Math.random() * 3,
    life: life + Math.random() * 20,
    type,
  };
}

function generateSplashParticles(x, y, config, type) {
  const particles = [];

  // Main particles
  for (let i = 0; i < config.count; i++) {
    const angle = (i / config.count) * Math.PI * 2;
    const speed = config.speed + Math.random();
    particles.push(
      createParticle(
        x,
        y,
        angle,
        speed,
        config.upwardBias,
        config.size,
        config.life,
        type
      )
    );
  }

  // Extra big droplets for anvil splashes
  if (type === "anvil") {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI - Math.PI / 2;
      const speed = 6 + Math.random() * config.impactForce;
      particles.push({
        x,
        y,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - (3 + config.impactForce * 0.8),
        size: 6 + Math.random() * 4,
        life: 50 + Math.random() * 30,
        type,
      });
    }
  }

  return particles;
}

function createSplash(x, y, type = "ball", impactForce = 1) {
  splash.active = true;
  splash.x = x;
  splash.y = y;
  splash.timer = type === "anvil" ? 60 : 30;

  if (!splash.particles) splash.particles = [];

  // Limit total particles to prevent memory issues
  if (splash.particles.length > MAX_PARTICLES) {
    splash.particles.splice(0, splash.particles.length - MAX_PARTICLES + 20);
  }

  const config =
    type === "anvil"
      ? {
          count: Math.min(25, 15 + Math.floor(impactForce * 2)),
          speed: 4 + impactForce * 1.2,
          upwardBias: 2 + impactForce * 0.5,
          size: 4 + impactForce * 0.3,
          life: 40 + impactForce * 3,
          impactForce,
        }
      : {
          count: 12,
          speed: 7,
          upwardBias: 3,
          size: 3,
          life: 30,
          impactForce: 0,
        };

  const newParticles = generateSplashParticles(x, y, config, type);
  splash.particles.push(...newParticles);
}

function updateSplash() {
  if (!splash.active) return;
  if (--splash.timer <= 0) splash.active = false;
  updateParticles(splash.particles, 0.2);
}

function spawnWaterPocketOnSide(side) {
  // Calculate seesaw bounds to avoid spawning under it
  const seesawBounds = getSeesawBounds();
  const seesawBuffer = isMobile ? 30 : 50; // Smaller buffer on mobile
  const avoidLeft = seesawBounds.left - seesawBuffer;
  const avoidRight = seesawBounds.right + seesawBuffer;

  const waterPocket = getWaterPocket();

  let spawnX;

  // Calculate available space on each side
  const leftSpaceWidth = avoidLeft - waterPocket.width / 2;
  const rightSpaceStart = avoidRight;
  const rightSpaceWidth = canvas.width - avoidRight - waterPocket.width / 2;

  if (side === "left" && leftSpaceWidth > waterPocket.width) {
    // Spawn on left side, fill most of the space
    spawnX =
      waterPocket.width / 2 +
      Math.random() * (leftSpaceWidth - waterPocket.width / 2);
  } else if (side === "right" && rightSpaceWidth > waterPocket.width) {
    // Spawn on right side, fill most of the space
    spawnX =
      rightSpaceStart +
      waterPocket.width / 2 +
      Math.random() * (rightSpaceWidth - waterPocket.width / 2);
  } else {
    // Fallback to edge spawning if not enough space
    if (side === "left") {
      spawnX = waterPocket.width / 2;
    } else {
      spawnX = canvas.width - waterPocket.width / 2;
    }
  }

  waterPockets.push({
    x: spawnX,
    y: WATER_LEVEL,
    height: 0,
    phase: "rising", // 'rising', 'active', 'falling'
    timer: 0,
    maxHeight: waterPocket.maxHeight * (0.7 + Math.random() * 0.6), // Random height variation
    particles: [],
    side: side, // Track which side this geyser is on
  });
}

function updateWaterPockets() {
  // Spawn geysers on left side every 5 seconds
  if (++leftSideSpawnTimer >= WATER_POCKET_SPAWN_RATE) {
    // Only spawn if there isn't already an active geyser on the left side
    const leftSideActive = waterPockets.some(
      (pocket) => pocket.side === "left" && pocket.height > 0
    );
    if (!leftSideActive) {
      spawnWaterPocketOnSide("left");
    }
    leftSideSpawnTimer = 0;
  }

  // Spawn geysers on right side every 5 seconds (offset by 2.5 seconds)
  if (++rightSideSpawnTimer >= WATER_POCKET_SPAWN_RATE) {
    // Only spawn if there isn't already an active geyser on the right side
    const rightSideActive = waterPockets.some(
      (pocket) => pocket.side === "right" && pocket.height > 0
    );
    if (!rightSideActive) {
      spawnWaterPocketOnSide("right");
    }
    rightSideSpawnTimer = 0;
  }

  // Update existing pockets
  for (let i = waterPockets.length - 1; i >= 0; i--) {
    const pocket = waterPockets[i];
    const waterPocket = getWaterPocket();
    pocket.timer++;

    switch (pocket.phase) {
      case "rising":
        pocket.height += waterPocket.riseSpeed;
        if (pocket.height >= pocket.maxHeight) {
          pocket.height = pocket.maxHeight;
          pocket.phase = "active";
          pocket.timer = 0;
        }
        break;

      case "active":
        // Stay at full height for a while
        if (pocket.timer >= waterPocket.lifetime) {
          pocket.phase = "falling";
          pocket.timer = 0;
        }
        break;

      case "falling":
        pocket.height -= waterPocket.fallSpeed;
        if (pocket.height <= 0) {
          waterPockets.splice(i, 1);
          continue;
        }
        break;
    }

    // Check collision with ball
    checkWaterPocketCollision(pocket);

    // Update water spray particles
    updateWaterPocketParticles(pocket);
  }
}

function checkWaterPocketCollision(pocket) {
  if (pocket.height <= 0) return;

  const waterPocket = getWaterPocket();
  const pocketTop = WATER_LEVEL - pocket.height;
  const pocketLeft = pocket.x - waterPocket.width / 2;
  const pocketRight = pocket.x + waterPocket.width / 2;

  // Check if ball is touching the water pocket
  if (
    ball.x >= pocketLeft &&
    ball.x <= pocketRight &&
    ball.y + ball.radius >= pocketTop &&
    ball.y - ball.radius <= WATER_LEVEL
  ) {
    // Launch the ball upward
    ball.velocityY = waterPocket.pushForce;
    ball.y = pocketTop - ball.radius; // Position ball on top of geyser

    // Add some horizontal movement toward seesaw center for better gameplay
    const directionToSeesaw = seesawX - ball.x;
    const horizontalHelp = Math.sign(directionToSeesaw) * 3;
    ball.velocityX += horizontalHelp;

    // Reset air jumps when rescued by water pocket
    ball.airJumps = 0;
    ball.onSeesaw = false;

    // Create splash effect at rescue point
    createSplash(ball.x, pocketTop, "ball");

    // Add extra particles to the pocket for visual feedback
    createWaterPocketParticles(pocket);
  }
}

function createWaterPocketParticles(pocket) {
  // Add spray particles when pocket is active
  const waterPocket = getWaterPocket();
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 3 + (Math.random() - 0.5) * (Math.PI / 2); // Spray upward
    const speed = 3 + Math.random() * 4;

    pocket.particles.push({
      x: pocket.x + (Math.random() - 0.5) * waterPocket.width * 0.8,
      y: WATER_LEVEL - pocket.height,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      size: 2 + Math.random() * 3,
      life: 30 + Math.random() * 20,
      type: "geyser",
    });
  }
}

function updateWaterPocketParticles(pocket) {
  // Add new particles during rising and active phases
  if (
    (pocket.phase === "rising" || pocket.phase === "active") &&
    Math.random() < 0.3
  ) {
    createWaterPocketParticles(pocket);
  }

  // Update existing particles
  updateParticles(pocket.particles, 0.15);

  // Limit particle count to prevent performance issues
  if (pocket.particles.length > 50) {
    pocket.particles.splice(0, pocket.particles.length - 50);
  }
}

function drawSplash() {
  if (!splash.active) return;

  splash.particles.forEach((particle) => {
    const maxLife = particle.type === "anvil" ? 80 : 50;
    const alpha = particle.life / maxLife; // Fade out over time

    // Different colors for different splash types
    const colorConfig =
      particle.type === "anvil"
        ? { base: `rgba(70, 130, 180, ${alpha})`, highlightAlpha: alpha * 0.7 }
        : {
            base: `rgba(135, 206, 235, ${alpha})`,
            highlightAlpha: alpha * 0.6,
          };

    drawCircle(particle.x, particle.y, particle.size, colorConfig.base);

    // Add white highlight for water droplet effect
    drawCircle(
      particle.x - particle.size * 0.3,
      particle.y - particle.size * 0.3,
      particle.size * 0.4,
      `rgba(255, 255, 255, ${colorConfig.highlightAlpha})`
    );
  });
}

function drawWaterPockets() {
  waterPockets.forEach((pocket) => {
    if (pocket.height <= 0) return;

    const waterPocket = getWaterPocket();
    const pocketTop = WATER_LEVEL - pocket.height;
    const pocketLeft = pocket.x - waterPocket.width / 2;
    const pocketRight = pocket.x + waterPocket.width / 2;

    // Draw water column with gradient
    const gradient = ctx.createLinearGradient(0, pocketTop, 0, WATER_LEVEL);
    gradient.addColorStop(0, "#87CEEB"); // Light blue at top
    gradient.addColorStop(0.5, "#4A90E2"); // Medium blue
    gradient.addColorStop(1, "#2E6AB8"); // Darker blue at bottom

    ctx.fillStyle = gradient;
    ctx.fillRect(pocketLeft, pocketTop, waterPocket.width, pocket.height);

    // Add white foam at the top
    if (pocket.phase === "rising" || pocket.phase === "active") {
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillRect(pocketLeft, pocketTop, waterPocket.width, 8);

      // Add some bubbles at the top
      for (let i = 0; i < 5; i++) {
        const bubbleX = pocketLeft + Math.random() * waterPocket.width;
        const bubbleY = pocketTop + Math.random() * 15;
        drawCircle(
          bubbleX,
          bubbleY,
          2 + Math.random() * 3,
          "rgba(255, 255, 255, 0.6)"
        );
      }
    }

    // Draw spray particles
    pocket.particles.forEach((particle) => {
      const alpha = particle.life / 50;
      drawCircle(
        particle.x,
        particle.y,
        particle.size,
        `rgba(135, 206, 235, ${alpha})`
      );

      // Add white highlight
      drawCircle(
        particle.x - particle.size * 0.3,
        particle.y - particle.size * 0.3,
        particle.size * 0.4,
        `rgba(255, 255, 255, ${alpha * 0.8})`
      );
    });
  });
}

// Ball state management
function resetBallState(x, y, velocityX = 0, velocityY = 0) {
  Object.assign(ball, {
    x,
    y,
    velocityX,
    velocityY,
    onSeesaw: false,
    isSquished: false,
    squishTimer: 0,
    squishAmount: 1.0,
    canJump: true,
    jumpPressed: false,
    airJumps: 0,
  });
}

function respawnBall() {
  respawning = true;
  resetBallState(seesawX, 50, 0, 2);

  // Prevent ball from immediately colliding with anvils during respawn
  setTimeout(() => (respawning = false), 500);
}

function resetGame() {
  // Reset game state
  gameOver = false;
  lives = 3;
  respawning = false;

  // Reset survival timer
  gameStartTime = 0;
  survivalTime = 0;

  // Reset ball
  resetBallState(seesawX, seesawY - 50);
  ball.radius = getObjects().ball.radius;

  // Clear anvils
  anvils = [];
  anvilSpawnTimer = 0;
  bigAnvilSpawnTimer = 0;

  // Clear water pockets
  waterPockets = [];
  leftSideSpawnTimer = 0;
  rightSideSpawnTimer = 150; // Offset right side by 2.5 seconds initially

  // Reset seesaw
  seesawAngle = 0;
  targetSeesawAngle = 0;

  // Clear splash effects
  splash = { active: false, x: 0, y: 0, particles: [], timer: 0 };

  // Hide game over screen
  const gameOverScreen = document.getElementById("gameOverScreen");
  gameOverScreen.classList.add("game-over-hidden");

  // Restart the game loop
  requestAnimationFrame(animate);
}

function showGameOver() {
  gameOver = true;

  // Format final survival time
  const minutes = Math.floor(survivalTime / 60);
  const seconds = Math.floor(survivalTime % 60);
  const timeString = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  // Update the survival time display
  const survivalTimeDisplay = document.getElementById("survivalTimeDisplay");
  survivalTimeDisplay.textContent = `You survived for: ${timeString}`;

  // Show the game over screen
  const gameOverScreen = document.getElementById("gameOverScreen");
  gameOverScreen.classList.remove("game-over-hidden");
}
function spawnAnvil() {
  // Don't spawn if too many anvils already exist
  if (anvils.length >= MAX_ANVILS_ON_SCREEN) return;

  const objects = getObjects();
  anvils.push({
    x: Math.random() * canvas.width,
    y: -30,
    width: objects.anvil.width,
    height: objects.anvil.height,
    velocityY: objects.anvil.spawnVelocity,
    crushedBall: false,
    hitSeesaw: false,
    slideDirection: 0,
    fallingOff: false,
    hitWater: false,
    isBig: false,
  });
}

function spawnBigAnvil() {
  // Don't spawn if too many anvils already exist
  if (anvils.length >= MAX_ANVILS_ON_SCREEN) return;

  const objects = getObjects();
  anvils.push({
    x: Math.random() * canvas.width,
    y: -60,
    width: objects.bigAnvil.width,
    height: objects.bigAnvil.height,
    velocityY: objects.bigAnvil.spawnVelocity,
    crushedBall: false,
    hitSeesaw: false,
    slideDirection: 0,
    fallingOff: false,
    hitWater: false,
    isBig: true,
    impactForce: 0, // Will be calculated when it hits the seesaw
  });
}

// Helper functions
function checkRectCircleCollision(rect, circle) {
  // More accurate rectangle-circle collision detection
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;

  // Calculate distances
  const dx = Math.abs(circle.x - rect.x);
  const dy = Math.abs(circle.y - rect.y);

  // Quick rejection test
  if (dx > halfWidth + circle.radius || dy > halfHeight + circle.radius) {
    return false;
  }

  // Easy cases - circle center is inside rectangle bounds
  if (dx <= halfWidth || dy <= halfHeight) {
    return true;
  }

  // Hard case - check corner collision
  const cornerDistSq =
    Math.pow(dx - halfWidth, 2) + Math.pow(dy - halfHeight, 2);
  return cornerDistSq <= Math.pow(circle.radius, 2);
}

function checkSweptCollisionWithSeesaw(anvil, bounds, velocity) {
  // Perform multiple collision checks along the movement path
  // This prevents fast-moving anvils from passing through the seesaw
  const steps = Math.max(3, Math.ceil(Math.abs(velocity) / 3)); // More steps for faster anvils
  const currentY = anvil.y;
  const currentBottom = anvil.y + anvil.height / 2;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps; // Interpolation factor (0 to 1)
    const testY = currentY + velocity * t;
    const testBottom = testY + anvil.height / 2;

    // Check if at any point along the path, the anvil crosses the seesaw
    if (currentBottom <= bounds.top && testBottom >= bounds.top) {
      return true;
    }
  }

  return false;
}

function getSeesawBounds() {
  return {
    left: seesawX - seesawWidth / 2,
    right: seesawX + seesawWidth / 2,
    top: seesawY - seesawHeight / 2,
  };
}

function calculateSlideDirection() {
  return seesawAngle > 0.05 ? 1 : seesawAngle < -0.05 ? -1 : 0;
}

function updateParticles(particles, gravity = 0.2) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.velocityX;
    p.y += p.velocityY;
    p.velocityY += gravity;
    if (--p.life <= 0) particles.splice(i, 1);
  }
}

function updateAnvils() {
  if (++anvilSpawnTimer >= ANVIL_SPAWN_RATE) {
    spawnAnvil();
    anvilSpawnTimer = 0;
  }

  // Spawn big anvils less frequently
  if (++bigAnvilSpawnTimer >= BIG_ANVIL_SPAWN_RATE) {
    spawnBigAnvil();
    bigAnvilSpawnTimer = 0;
  }

  for (let i = anvils.length - 1; i >= 0; i--) {
    const anvil = anvils[i];

    // Add gravity to falling anvils, but cap the velocity
    if (!anvil.hitSeesaw || anvil.fallingOff) {
      anvil.velocityY += 0.3; // Reduced from 0.4 for slower acceleration
      // Cap velocity to prevent pass-through - this is critical!
      const maxFallSpeed = anvil.isBig ? 10 : 8; // Reduced max speeds
      anvil.velocityY = Math.min(anvil.velocityY, maxFallSpeed);
    }

    updateAnvilPhysics(anvil); // This now handles collision detection internally
    updateAnvilBallCollision(anvil);
    updateAnvilSeesawInteraction(anvil, i);

    if (anvil.y > canvas.height + 50) anvils.splice(i, 1);
  }
}

function updateAnvilPhysics(anvil) {
  // Store the previous position before any movement
  const prevY = anvil.y;
  const prevBottom = anvil.y + anvil.height / 2;

  // Cap anvil velocity to prevent pass-through issues
  const maxVelocity = 12; // Further reduced for better collision detection
  anvil.velocityY = Math.min(anvil.velocityY, maxVelocity);

  // Check for seesaw collision BEFORE moving the anvil
  const bounds = getSeesawBounds();
  const isOverSeesaw = anvil.x >= bounds.left && anvil.x <= bounds.right;

  if (isOverSeesaw && !anvil.hitSeesaw && !anvil.fallingOff) {
    // Improved collision detection using swept collision
    // Check if anvil is approaching the seesaw from above
    const isApproachingFromAbove = prevBottom <= bounds.top + anvil.height;

    // Calculate where the anvil will be after movement
    const newY = anvil.y + anvil.velocityY;
    const newBottom = newY + anvil.height / 2;

    // Multiple collision checks to prevent pass-through:
    // 1. Traditional frame-based check
    const willCrossSeesaw = prevBottom <= bounds.top && newBottom >= bounds.top;

    // 2. Check if anvil is already very close to seesaw
    const isAlreadyAtSeesaw = prevBottom >= bounds.top - 3;

    // 3. Swept collision - check intermediate positions
    const sweptCollision = checkSweptCollisionWithSeesaw(
      anvil,
      bounds,
      anvil.velocityY
    );

    // 4. Safety check - if anvil would end up below seesaw surface, it must have hit
    const wouldPassThrough =
      newBottom > bounds.top + 5 && prevBottom <= bounds.top + 5;

    if (
      willCrossSeesaw ||
      isAlreadyAtSeesaw ||
      sweptCollision ||
      wouldPassThrough
    ) {
      // Stop the anvil exactly at the seesaw surface
      anvil.y = bounds.top - anvil.height / 2;
      anvil.velocityY = 0;
      landAnvilOnSeesaw(anvil, bounds);
      return; // Don't move the anvil further this frame
    }
  }

  // If no seesaw collision, move normally
  anvil.y += anvil.velocityY;
  if (anvil.fallingOff) anvil.velocityY += 0.3;

  // Water collision check
  if (anvil.y + anvil.height / 2 >= WATER_LEVEL && !anvil.hitWater) {
    anvil.hitWater = true;
    const baseImpactMagnitude =
      Math.abs(anvil.velocityY) + (anvil.isBig ? 6 : 3);
    // Enhance big anvil splash effects on mobile
    const mobileMultiplier = isMobile && anvil.isBig ? 1.3 : 1.0;
    const impactMagnitude = baseImpactMagnitude * mobileMultiplier;
    createSplash(anvil.x, WATER_LEVEL, "anvil", impactMagnitude);
  }
}

function updateAnvilBallCollision(anvil) {
  if (anvil.crushedBall || respawning) return;

  // Enhanced collision detection to prevent pass-through
  const ballNextX = ball.x + ball.velocityX;
  const ballNextY = ball.y + ball.velocityY;

  // Check both current position and predicted next position
  const currentCollision = checkRectCircleCollision(anvil, {
    x: ball.x,
    y: ball.y,
    radius: ball.radius,
  });

  const futureCollision = checkRectCircleCollision(anvil, {
    x: ballNextX,
    y: ballNextY,
    radius: ball.radius,
  });

  if (currentCollision || futureCollision) {
    if (!anvil.hitSeesaw || anvil.fallingOff) {
      // Anvil is falling or not on seesaw - deflect the ball realistically
      anvil.crushedBall = true;

      // Only crush the ball if it's already on the ground/seesaw (realistic crushing scenario)
      if (ball.onSeesaw || ball.y >= canvas.height - 150) {
        squishBall();
      } else {
        // Ball is mid-air - deflect it based on anvil impact
        handleMidAirAnvilCollision(anvil);
      }
    } else {
      // Anvil is on seesaw - handle interaction but don't let ball get stuck
      // Big anvils are more aggressive when interacting with the ball
      if (anvil.isBig) {
        handleBigAnvilBallInteraction(anvil);
      } else {
        handleBallAnvilInteraction(anvil);
      }
    }
  }
}

function handleBigAnvilBallInteraction(anvil) {
  // Big anvils push the ball more forcefully
  // Apply stronger effects on mobile to compensate for touch controls
  const mobileMultiplier = isMobile ? 1.3 : 1.0;

  if (ball.y < anvil.y - anvil.height / 2 && ball.velocityY >= 0) {
    ball.y = anvil.y - anvil.height / 2 - ball.radius;
    ball.velocityY = 0;
  } else if (Math.abs(ball.y - anvil.y) < anvil.height / 2 + ball.radius / 2) {
    // Push ball away from sides of big anvil with more force
    const pushDirection = ball.x < anvil.x ? -1 : 1;
    ball.x = anvil.x + pushDirection * (anvil.width / 2 + ball.radius + 5);
    ball.velocityX = pushDirection * 4 * mobileMultiplier; // Stronger push for big anvils, enhanced on mobile
  }
}

function handleMidAirAnvilCollision(anvil) {
  // Calculate collision vectors
  const dx = ball.x - anvil.x;
  const dy = ball.y - anvil.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance === 0) {
    // Handle edge case where ball and anvil are at same position
    ball.x += ball.radius + 5; // Move ball away
    return;
  }

  // Normalize collision direction
  const normalX = dx / distance;
  const normalY = dy / distance;

  // Calculate impact force based on anvil properties and velocity
  const objects = getObjects();
  const anvilMass = anvil.isBig
    ? objects.bigAnvil.weight
    : objects.anvil.weight;
  const baseImpactForce = Math.abs(anvil.velocityY) * anvilMass * 0.3;

  // Apply mobile multiplier for big anvils to make them more impactful on mobile
  const mobileMultiplier = isMobile && anvil.isBig ? 1.4 : 1.0;
  const impactForce = baseImpactForce * mobileMultiplier;

  // Apply deflection force to ball
  const deflectionPower = Math.min(impactForce, 15); // Cap the force to prevent crazy speeds

  // Immediate separation to prevent pass-through
  const anvilSize = Math.max(anvil.width, anvil.height) / 2;
  const minSeparation = ball.radius + anvilSize + 8; // Extra padding to ensure no overlap

  if (distance < minSeparation) {
    // Force immediate separation
    ball.x = anvil.x + normalX * minSeparation;
    ball.y = anvil.y + normalY * minSeparation;
  }

  // Calculate relative velocity for more realistic collision response
  const relativeVelX = ball.velocityX;
  const relativeVelY = ball.velocityY - anvil.velocityY;

  // Don't deflect if ball is already moving away from anvil
  const approachingSpeed = relativeVelX * normalX + relativeVelY * normalY;
  if (approachingSpeed > 0) return; // Ball is already moving away

  // Apply deflection force
  ball.velocityX += normalX * deflectionPower * 0.8;
  ball.velocityY += normalY * deflectionPower * 0.6;

  // Add some energy from the anvil's momentum
  ball.velocityY += anvil.velocityY * 0.3; // Transfer some of anvil's downward velocity

  // Add some randomness to make it feel more natural
  ball.velocityX += (Math.random() - 0.5) * 2;
  ball.velocityY += (Math.random() - 0.5) * 1;

  // Clamp velocities to prevent unrealistic speeds
  ball.velocityX = Math.max(-20, Math.min(20, ball.velocityX));
  ball.velocityY = Math.max(-20, Math.min(20, ball.velocityY));

  // Ball is no longer on seesaw after being hit
  ball.onSeesaw = false;
}

function handleBallAnvilInteraction(anvil) {
  // Only allow ball to land on top of anvil, not get stuck to it
  if (ball.y < anvil.y - anvil.height / 2 && ball.velocityY >= 0) {
    ball.y = anvil.y - anvil.height / 2 - ball.radius;
    ball.velocityY = 0;
    // Don't set ball.onSeesaw = true here - let the seesaw collision detection handle it
  } else if (Math.abs(ball.y - anvil.y) < anvil.height / 2 + ball.radius / 2) {
    // Push ball away from sides of anvil
    const pushDirection = ball.x < anvil.x ? -1 : 1;
    ball.x = anvil.x + pushDirection * (anvil.width / 2 + ball.radius + 2);
    ball.velocityX = pushDirection * 2; // Give a stronger push to avoid getting stuck
  }
}

function updateAnvilSeesawInteraction(anvil, i) {
  const bounds = getSeesawBounds();

  // Only handle anvils that are already on the seesaw
  if (anvil.hitSeesaw && !anvil.fallingOff) {
    updateAnvilOnSeesaw(anvil, i, bounds);
  }
}

function landAnvilOnSeesaw(anvil, bounds) {
  // Check if too many anvils are on seesaw
  const anvilsOnSeesawCount = anvils.filter(
    (a) => a.hitSeesaw && !a.fallingOff
  ).length;
  if (anvilsOnSeesawCount >= MAX_ANVILS_ON_SEESAW) {
    anvil.fallingOff = true;
    anvil.velocityY = 1;
    return;
  }

  let landingBlocked = false;
  let highestAnvilY = bounds.top;

  anvils.forEach((other, j) => {
    if (
      other.hitSeesaw &&
      !other.fallingOff &&
      Math.abs(anvil.x - other.x) < (anvil.width + other.width) / 2 + 10
    ) {
      landingBlocked = true;
      const otherTop = other.y - other.height / 2;
      if (otherTop < highestAnvilY) highestAnvilY = otherTop;
    }
  });

  anvil.hitSeesaw = true;

  // Calculate impact force for big anvils - make it much more dramatic!
  if (anvil.isBig) {
    // Base impact force from velocity, but add extra force for big anvils
    const baseImpact = Math.abs(anvil.velocityY) * 3; // Increased from 2
    const bigAnvilBonus = 8; // Extra impact just for being a big anvil
    anvil.impactForce = baseImpact + bigAnvilBonus;

    // If ball is on seesaw when big anvil hits, launch the ball dramatically!
    if (ball.onSeesaw && !respawning) {
      const anvilDistanceFromCenter = anvil.x - seesawX;
      const ballDistanceFromCenter = ball.x - seesawX;

      // Check if anvil and ball are on opposite sides of the seesaw
      const oppositeSides =
        anvilDistanceFromCenter * ballDistanceFromCenter < 0;

      if (oppositeSides) {
        // Calculate catapult effect - the further the anvil is from center, the stronger the launch
        const anvilLeverArm = Math.abs(anvilDistanceFromCenter);
        const ballLeverArm = Math.abs(ballDistanceFromCenter);
        const maxLeverArm = seesawWidth / 2;

        // Mechanical advantage: longer lever arm for anvil = more force
        const leverageRatio = anvilLeverArm / maxLeverArm;
        const launchMultiplier = 1.5 + leverageRatio * 3; // Increased: Up to 4.5x multiplier

        // Launch the ball away from the seesaw center
        const launchDirection = Math.sign(ballDistanceFromCenter); // 1 if ball is on right, -1 if on left
        const launchPower = anvil.impactForce * launchMultiplier;

        // Vertical launch (upward) - much stronger for big anvils
        ball.velocityY = -Math.min(launchPower * 2, 25); // Increased from 1.5 and 20

        // Horizontal launch (away from center, in direction ball is already positioned)
        ball.velocityX = launchDirection * Math.min(launchPower * 1.2, 18); // Increased from 0.8 and 15

        ball.onSeesaw = false;

        // Create stronger visual effect at impact point
        createSplash(anvil.x, bounds.top, "anvil", anvil.impactForce * 1.5);
      } else if (
        Math.abs(anvilDistanceFromCenter - ballDistanceFromCenter) < 50
      ) {
        // If they're on the same side and close together, just push the ball away more forcefully
        const pushDirection = ball.x > anvil.x ? 1 : -1;
        ball.velocityX = pushDirection * anvil.impactForce * 0.8; // Increased from 0.5
        ball.velocityY = -anvil.impactForce * 1.2; // Increased multiplier
        ball.onSeesaw = false;
      }
    }

    // Create a strong visual impact effect even if no ball interaction
    createSplash(anvil.x, bounds.top, "anvil", anvil.impactForce);
  }

  if (landingBlocked) {
    anvil.y = highestAnvilY - anvil.height / 2;
  } else {
    const anvilDistanceFromCenter = anvil.x - seesawX;
    anvil.y =
      bounds.top +
      anvilDistanceFromCenter * Math.tan(seesawAngle) -
      anvil.height / 2;
  }

  anvil.velocityY = 0;
  anvil.slideDirection = calculateSlideDirection();
}

function updateAnvilOnSeesaw(anvil, i, bounds) {
  const distanceFromCenter = anvil.x - seesawX;
  anvil.y =
    seesawY -
    seesawHeight / 2 +
    distanceFromCenter * Math.tan(seesawAngle) -
    anvil.height / 2;

  let blocked = false;
  anvils.forEach((other, j) => {
    if (j !== i && other.hitSeesaw && !other.fallingOff) {
      const distX = Math.abs(anvil.x - other.x);
      const distY = Math.abs(anvil.y - other.y);

      if (
        distX < (anvil.width + other.width) / 2 + 3 &&
        distY < (anvil.height + other.height) / 2 + 3
      ) {
        const pushDirection = anvil.x < other.x ? -1 : 1;
        const separation = (anvil.width + other.width) / 2 + 5 - distX;

        anvil.x -= pushDirection * (separation / 2 + 1);
        other.x += pushDirection * (separation / 2 + 1);

        if (
          (anvil.slideDirection > 0 && pushDirection > 0) ||
          (anvil.slideDirection < 0 && pushDirection < 0)
        ) {
          other.x += pushDirection * 2;
          other.slideDirection = pushDirection;
          if (other.x <= bounds.left || other.x >= bounds.right) {
            other.fallingOff = true;
            other.velocityY = 1;
          }
          blocked = true;
        }
      }
    }
  });

  anvil.slideDirection = calculateSlideDirection();
  if (!blocked && anvil.slideDirection !== 0)
    anvil.x += anvil.slideDirection * 2;
  if (anvil.x <= bounds.left || anvil.x >= bounds.right) {
    anvil.fallingOff = true;
    anvil.velocityY = 1;
  }
}

function drawAnvils() {
  anvils.forEach((anvil) => {
    const { x, y, width, height, isBig } = anvil;
    const halfW = width / 2;
    const halfH = height / 2;

    if (isBig) {
      // Big anvil - darker and more imposing
      // Draw a warning shadow when falling
      if (!anvil.hitSeesaw) {
        drawRect(
          x - halfW + 2,
          y - halfH + 2,
          width,
          height,
          "rgba(0, 0, 0, 0.3)"
        );
      }

      // Anvil body (very dark gray/black)
      drawRect(x - halfW, y - halfH, width, height, "#1A1A1A");

      // Anvil top (wider part) - darker
      drawRect(x - halfW - 4, y - halfH, width + 8, 12, "#2A2A2A");

      // Anvil bottom (wider part) - darker
      drawRect(x - halfW - 3, y + halfH - 8, width + 6, 8, "#2A2A2A");

      // Metallic shine - slightly darker
      drawRect(x - halfW + 3, y - halfH + 3, 6, height - 6, "#404040");

      // Additional shine line for big anvils
      drawRect(x - halfW + width - 8, y - halfH + 3, 3, height - 6, "#303030");

      // Red hot glow effect around big anvils
      if (!anvil.hitSeesaw) {
        ctx.save();
        ctx.shadowColor = "#FF4444";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw a subtle red outline
        ctx.strokeStyle = "#FF6666";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - halfW - 1, y - halfH - 1, width + 2, height + 2);

        ctx.restore();
      }
    } else {
      // Regular anvil (original code)
      // Anvil body (dark gray)
      drawRect(x - halfW, y - halfH, width, height, "#2A2A2A");

      // Anvil top (wider part)
      drawRect(x - halfW - 3, y - halfH, width + 6, 8, "#404040");

      // Anvil bottom (wider part)
      drawRect(x - halfW - 2, y + halfH - 6, width + 4, 6, "#404040");

      // Metallic shine
      drawRect(x - halfW + 2, y - halfH + 2, 4, height - 4, "#606060");
    }
  });
}

function updateSeesawPhysics() {
  const physics = getPhysics();
  const objects = getObjects();
  seesawAngle += (targetSeesawAngle - seesawAngle) * physics.angleSmoothing;

  let leftTorque = 0,
    rightTorque = 0,
    anvilsOnSeesaw = 0,
    bigAnvilImpactBonus = 0;

  if (ball.onSeesaw) {
    const ballTorque = Math.abs(ball.x - seesawX) * objects.ball.weight;
    if (ball.x < seesawX) leftTorque += ballTorque;
    else rightTorque += ballTorque;
  }

  anvils.forEach((anvil) => {
    if (anvil.hitSeesaw && !anvil.fallingOff) {
      anvilsOnSeesaw++;
      const anvilWeight = anvil.isBig
        ? objects.bigAnvil.weight
        : objects.anvil.weight;
      const anvilTorque = Math.abs(anvil.x - seesawX) * anvilWeight;

      // Add extra torque for big anvils that just landed (for dramatic effect)
      if (anvil.isBig && anvil.impactForce && anvil.impactForce > 0) {
        const impactTorque =
          anvil.impactForce * Math.abs(anvil.x - seesawX) * 1.2; // Increased from 0.5
        bigAnvilImpactBonus += anvil.x < seesawX ? -impactTorque : impactTorque;
        // Gradually reduce impact force over time, but slower so effect lasts longer
        anvil.impactForce *= 0.98; // Reduced from 0.95 for longer effect
        if (anvil.impactForce < 0.5) anvil.impactForce = 0; // Increased threshold
      }

      if (anvil.x < seesawX) leftTorque += anvilTorque;
      else rightTorque += anvilTorque;
    }
  });

  const netTorque = rightTorque - leftTorque + bigAnvilImpactBonus;

  // Apply a multiplier when big anvils are involved for more dramatic effect
  const bigAnvilMultiplier = bigAnvilImpactBonus !== 0 ? 1.8 : 1.0; // Extra multiplier for big anvils

  targetSeesawAngle =
    netTorque *
    physics.torqueScale *
    (anvilsOnSeesaw > 0 ? 1.2 : 1) *
    bigAnvilMultiplier;

  const safeMaxAngle = Math.min(
    physics.maxAngle,
    Math.abs(Math.atan((WATER_LEVEL - seesawY - 50) / (seesawWidth / 2)))
  );
  targetSeesawAngle = Math.max(
    -safeMaxAngle,
    Math.min(safeMaxAngle, targetSeesawAngle)
  );
}

function checkSeesawCollision() {
  const physics = getPhysics();
  const bounds = getSeesawBounds();

  if (ball.x >= bounds.left && ball.x <= bounds.right) {
    const distanceFromCenter = ball.x - seesawX;
    const seesawHeightAtBallX =
      bounds.top + distanceFromCenter * Math.tan(seesawAngle);

    if (
      ball.y >= seesawHeightAtBallX - ball.radius - 5 &&
      ball.y <= seesawHeightAtBallX + ball.radius + 20
    ) {
      ball.onSeesaw = true;
      ball.canJump = true; // Ball can jump again when on seesaw
      ball.airJumps = 0; // Reset air jumps when landing on seesaw
      ball.y = seesawHeightAtBallX - ball.radius;
      ball.velocityY = 0;

      // Realistic physics: ball rolls down slope based on angle
      const slopeForce = Math.sin(seesawAngle) * 0.08;
      ball.velocityX += slopeForce;

      // Extra push at extreme angles to prevent getting stuck
      if (Math.abs(seesawAngle) > physics.maxAngle * 0.85) {
        ball.velocityX += Math.sign(seesawAngle) * 0.15;
      }
    } else {
      ball.onSeesaw = false;
    }
  } else {
    ball.onSeesaw = false;
  }
}

function drawBall() {
  drawMetallicBall(ball.x, ball.y, ball.radius, ball.squishAmount);
}

function drawLives() {
  ctx.fillStyle = "#000";
  ctx.font = "20px Arial";
  ctx.fillText("Lives:", 20, 35);

  for (let i = 0; i < 3; i++) {
    const lifeX = 90 + i * 35;
    const lifeY = 25;
    const lifeRadius = 12;

    if (i < lives) {
      drawMetallicBall(lifeX, lifeY, lifeRadius);
    } else {
      ctx.strokeStyle = "#CCCCCC";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lifeX, lifeY, lifeRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Show air jumps remaining when not on seesaw
  if (!ball.onSeesaw) {
    ctx.fillStyle = "#000";
    ctx.font = "16px Arial";
    ctx.fillText("Air Jumps:", 20, 65);

    for (let i = 0; i < ball.maxAirJumps; i++) {
      const jumpX = 110 + i * 25;
      const jumpY = 58;
      const jumpRadius = 8;

      if (i < ball.maxAirJumps - ball.airJumps) {
        // Available air jumps - show as small blue circles
        drawCircle(jumpX, jumpY, jumpRadius, "#4A90E2");
      } else {
        // Used air jumps - show as empty circles
        ctx.strokeStyle = "#CCCCCC";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(jumpX, jumpY, jumpRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

function drawTimer() {
  // Format time as MM:SS
  const minutes = Math.floor(survivalTime / 60);
  const seconds = Math.floor(survivalTime % 60);
  const timeString = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  // Draw timer in top right corner
  ctx.fillStyle = "#000";
  ctx.font = "24px Arial";
  ctx.textAlign = "right";
  ctx.fillText("Time: " + timeString, canvas.width - 20, 35);

  // Reset text alignment for other text
  ctx.textAlign = "left";
}

function drawSky() {
  // Sky gradient from light blue at top to lighter blue at horizon
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height - 100);
  gradient.addColorStop(0, "#87CEEB"); // Sky blue at top
  gradient.addColorStop(0.7, "#B0E0E6"); // Powder blue
  gradient.addColorStop(1, "#E0F6FF"); // Very light blue at horizon

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height - 100);
}

function drawSun() {
  const sunX = canvas.width - 150;
  const sunY = 100;
  const sunRadius = 40;

  // Sun rays
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16;
    const rayLength = 25;
    const startX = sunX + Math.cos(angle) * (sunRadius + 5);
    const startY = sunY + Math.sin(angle) * (sunRadius + 5);
    const endX = sunX + Math.cos(angle) * (sunRadius + rayLength);
    const endY = sunY + Math.sin(angle) * (sunRadius + rayLength);

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  // Sun body
  const sunGradient = ctx.createRadialGradient(
    sunX - 10,
    sunY - 10,
    0,
    sunX,
    sunY,
    sunRadius
  );
  sunGradient.addColorStop(0, "#FFFF99"); // Light yellow center
  sunGradient.addColorStop(0.7, "#FFD700"); // Gold
  sunGradient.addColorStop(1, "#FFA500"); // Orange edge

  ctx.fillStyle = sunGradient;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds() {
  const time = Date.now() * 0.0005;
  const cloudData = [
    { x: 200, offset: 0, scale: 1.0 },
    { x: 500, offset: 1, scale: 0.8 },
    { x: 800, offset: 2, scale: 1.2 },
    { x: 1100, offset: 3, scale: 0.9 },
  ];

  cloudData.forEach((cloud) => {
    const x = cloud.x + Math.sin(time + cloud.offset) * (30 - cloud.offset * 5);
    const y = 60 + cloud.offset * 20;
    drawCloud(x, y, cloud.scale);
  });
}

function drawCloud(x, y, scale) {
  const cloudParts = [
    { x: 0, y: 0, r: 25 },
    { x: 25, y: 0, r: 35 },
    { x: 50, y: 0, r: 25 },
    { x: 15, y: -15, r: 20 },
    { x: 35, y: -10, r: 30 },
  ];

  // Draw shadow
  ctx.fillStyle = "rgba(200, 200, 200, 0.3)";
  ctx.beginPath();
  cloudParts.forEach((part) =>
    ctx.arc(
      x + part.x * scale + 2,
      y + part.y * scale + 2,
      part.r * scale,
      0,
      Math.PI * 2
    )
  );
  ctx.fill();

  // Draw main cloud
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  cloudParts.forEach((part) =>
    ctx.arc(
      x + part.x * scale,
      y + part.y * scale,
      part.r * scale,
      0,
      Math.PI * 2
    )
  );
  ctx.fill();
}

function drawWater() {
  const waterY = WATER_LEVEL;
  const waterHeight = 100;

  // Water base
  drawRect(0, waterY, canvas.width, waterHeight, "#4A90E2");

  // Water surface with waves
  ctx.fillStyle = "#5BA3F5";
  ctx.beginPath();
  ctx.moveTo(0, waterY);
  for (let x = 0; x <= canvas.width; x += 20) {
    const waveHeight = Math.sin((x + Date.now() * 0.003) * 0.02) * 3;
    ctx.lineTo(x, waterY + waveHeight);
  }
  ctx.lineTo(canvas.width, waterY + 20);
  ctx.lineTo(0, waterY + 20);
  ctx.closePath();
  ctx.fill();

  // Water reflections
  for (let i = 0; i < 5; i++) {
    const x = (canvas.width / 6) * (i + 1);
    const y = waterY + 10 + Math.sin(Date.now() * 0.002 + i) * 5;
    drawRect(x - 30, y, 60, 3, "#7BB8F7");
  }
}

function drawSeesaw() {
  ctx.save();
  ctx.translate(seesawX, seesawY);
  ctx.rotate(seesawAngle);

  drawRect(
    -seesawWidth / 2,
    -seesawHeight / 2,
    seesawWidth,
    seesawHeight,
    "#8B4513"
  );
  drawRect(-10, seesawHeight / 2, 20, 30, "#666");

  ctx.restore();
}

function animate(currentTime = 0) {
  try {
    // Handle timing for browser tab switching
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Skip frame if too much time passed (tab was unfocused)
    if (deltaTime > 100) {
      requestAnimationFrame(animate);
      return;
    }

    // Initialize game start time on first frame
    if (gameStartTime === 0 && !gameOver) {
      gameStartTime = currentTime;
    }

    // Update survival timer (only when game is active)
    if (!gameOver && !respawning && gameStartTime > 0) {
      survivalTime = (currentTime - gameStartTime) / 1000; // Convert to seconds
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Don't update game logic if game is over
    if (!gameOver) {
      handleInput();
      updateBall();
      updateAnvils();
      updateWaterPockets(); // Update water pocket system
      updateSeesawPhysics(); // Update seesaw physics smoothly
      updateSplash(); // Update splash particles
    }

    // Draw background elements first
    drawSky();
    drawSun();
    drawClouds();
    drawWater();
    drawWaterPockets(); // Draw water pockets after water

    // Draw game elements
    drawSeesaw();
    drawAnvils();
    drawBall();
    drawSplash(); // Draw splash effect
    drawLives();
    drawTimer(); // Draw survival timer

    // Game over check
    if (lives <= 0 && !gameOver) {
      showGameOver();
      return; // Stop the game loop
    }

    requestAnimationFrame(animate);
  } catch (error) {
    console.error("Animation error:", error);
    requestAnimationFrame(animate);
  }
}

animate();
