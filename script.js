// Get the canvas element and its 2D rendering context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game scaling variables
let gameScale = 1;
let baseWidth = 1500;
let baseHeight = 900;

// Initialize canvas size and scaling
function initializeCanvas() {
  const maxWidth = window.innerWidth - 20;
  const maxHeight = window.innerHeight - 80;

  const scaleX = maxWidth / baseWidth;
  const scaleY = maxHeight / baseHeight;
  gameScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond original size

  canvas.width = baseWidth;
  canvas.height = baseHeight;
  canvas.style.width = baseWidth * gameScale + "px";
  canvas.style.height = baseHeight * gameScale + "px";

  // Disable image smoothing for crisp pixel art
  ctx.imageSmoothingEnabled = false;
}

// Handle window resize
function handleResize() {
  initializeCanvas();
}

window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", () => {
  setTimeout(handleResize, 100); // Delay to ensure orientation change is complete
});

// Initialize on load
initializeCanvas();

// Game constants
const WATER_LEVEL = canvas.height - 100;
let ANVIL_SPAWN_RATE = 180; // Will be adjusted for mobile
const BALL_JUMP_POWER = -12;
const SQUISH_DURATION = 60;
const MAX_ANVILS_ON_SCREEN = 15;
const MAX_ANVILS_ON_SEESAW = 8;
const MAX_PARTICLES = 100;

// Detect if on mobile device
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);

// Adjust game difficulty for mobile
if (isMobile) {
  ANVIL_SPAWN_RATE = 220; // Slower spawn rate on mobile for better performance
}

const PHYSICS = {
  gravity: 0.5,
  friction: 0.98,
  moveSpeed: 0.3,
  angleSmoothing: 0.08,
  torqueScale: 0.0001,
  maxAngle: 0.4,
};

const OBJECTS = {
  ball: { radius: 15, weight: 1 },
  anvil: { width: 25, height: 35, weight: 10, spawnVelocity: 3 },
  seesaw: { width: canvas.width * 0.7, height: 25 },
};

let seesawAngle = 0;
let targetSeesawAngle = 0;
const seesawX = canvas.width / 2;
const seesawY = WATER_LEVEL - 250;
const seesawWidth = OBJECTS.seesaw.width;
const seesawHeight = OBJECTS.seesaw.height;

// Ball properties
const ball = {
  x: seesawX,
  y: seesawY - 50,
  radius: OBJECTS.ball.radius,
  velocityX: 0,
  velocityY: 0,
  onSeesaw: false,
  isSquished: false,
  squishTimer: 0,
  squishAmount: 1.0,
};

// Lives system
let lives = 3;
let respawning = false;

// Anvils system
let anvils = [];
let anvilSpawnTimer = 0;

let splash = { active: false, x: 0, y: 0, particles: [], timer: 0 };

// Game timing
let lastTime = 0;

// Keyboard controls
const keys = {};

// Unified drawing functions
function drawRect(x, y, width, height, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function drawMetallicBall(x, y, radius, squishAmount = 1.0) {
  ctx.save();
  if (squishAmount !== 1.0) {
    ctx.translate(x, y);
    ctx.scale(1.5, squishAmount);
    ctx.translate(-x, -y);
  }

  // Metal ball base
  ctx.fillStyle = "#4A4A4A";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Metal gradient effect
  const gradient = ctx.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.3,
    0,
    x,
    y,
    radius
  );
  gradient.addColorStop(0, "#E0E0E0");
  gradient.addColorStop(0.4, "#808080");
  gradient.addColorStop(1, "#2A2A2A");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Bright metallic shine
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(x - radius * 0.4, y - radius * 0.4, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Smaller highlight (only for normal sized balls)
  if (radius > 10) {
    ctx.fillStyle = "#F0F0F0";
    ctx.beginPath();
    ctx.arc(x + radius * 0.2, y - radius * 0.2, radius * 0.15, 0, Math.PI * 2);
    ctx.fill();
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

// Touch event handlers for mobile
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    touchStartX = (touch.clientX - rect.left) / gameScale;
    touchStartY = (touch.clientY - rect.top) / gameScale;
    touchStartTime = Date.now();
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
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
    if (touchDuration < 200 && distance < 30) {
      keys["ArrowUp"] = true;
      setTimeout(() => (keys["ArrowUp"] = false), 100);
    }
    // Swipe gestures
    else if (distance > 50) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe - move left/right
        if (deltaX > 0) {
          keys["ArrowRight"] = true;
          setTimeout(() => (keys["ArrowRight"] = false), 200);
        } else {
          keys["ArrowLeft"] = true;
          setTimeout(() => (keys["ArrowLeft"] = false), 200);
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          keys["ArrowDown"] = true;
          setTimeout(() => (keys["ArrowDown"] = false), 100);
        } else {
          keys["ArrowUp"] = true;
          setTimeout(() => (keys["ArrowUp"] = false), 100);
        }
      }
    }

    touchStartX = null;
    touchStartY = null;
    touchStartTime = null;
  },
  { passive: false }
);

// Prevent default touch behaviors
canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false }
);

function handleInput() {
  const airControlFactor = ball.onSeesaw ? 1.8 : 0.3; // Strong but balanced control on seesaw
  const controls = {
    ArrowLeft: () => (ball.velocityX -= PHYSICS.moveSpeed * airControlFactor),
    ArrowRight: () => (ball.velocityX += PHYSICS.moveSpeed * airControlFactor),
    ArrowUp: () => {
      if (ball.onSeesaw || ball.velocityY >= -2)
        ball.velocityY = BALL_JUMP_POWER;
    },
    ArrowDown: () => {
      if (ball.onSeesaw) ball.velocityY += PHYSICS.moveSpeed;
    },
  };

  Object.entries(controls).forEach(([key, action]) => {
    if (keys[key]) action();
  });
}

function updateBall() {
  if (respawning) return;

  if (ball.isSquished) {
    if (--ball.squishTimer <= 0) {
      ball.isSquished = false;
      ball.squishAmount = 1.0;
    }
    return;
  }

  if (!ball.onSeesaw) ball.velocityY += PHYSICS.gravity;

  // Clamp velocities to prevent clipping through objects
  ball.velocityX = Math.max(-15, Math.min(15, ball.velocityX));
  ball.velocityY = Math.max(-20, Math.min(20, ball.velocityY));

  ball.x += ball.velocityX;
  ball.y += ball.velocityY;
  ball.velocityX *= PHYSICS.friction;

  // Boundary checks
  if (ball.x < ball.radius) {
    ball.x = ball.radius;
    ball.velocityX *= -0.7;
  }
  if (ball.x > canvas.width - ball.radius) {
    ball.x = canvas.width - ball.radius;
    ball.velocityX *= -0.7;
  }
  if (ball.y < ball.radius) {
    ball.y = ball.radius;
    ball.velocityY *= -0.7;
  }

  if (ball.y + ball.radius >= WATER_LEVEL) {
    createSplash(ball.x, WATER_LEVEL, "ball");
    ballFellInWater();
    return;
  }
  if (ball.y > canvas.height - ball.radius) {
    ball.y = canvas.height - ball.radius;
    ball.velocityY *= -0.7;
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

  // After squish animation, lose life and respawn
  setTimeout(() => {
    ballFellInWater();
  }, 1000);
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
        }
      : {
          count: 12,
          speed: 7,
          upwardBias: 3,
          size: 3,
          life: 30,
        };

  // Main particles
  for (let i = 0; i < config.count; i++) {
    const angle = (i / config.count) * Math.PI * 2;
    splash.particles.push({
      x,
      y,
      velocityX: Math.cos(angle) * (config.speed + Math.random()),
      velocityY:
        Math.sin(angle) * (config.speed + Math.random()) -
        Math.random() * config.upwardBias,
      size: config.size + Math.random() * 3,
      life: config.life + Math.random() * 20,
      type,
    });
  }

  // Extra big droplets for anvil splashes
  if (type === "anvil") {
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI - Math.PI / 2;
      const speed = 6 + Math.random() * impactForce;
      splash.particles.push({
        x,
        y,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed - (3 + impactForce * 0.8),
        size: 6 + Math.random() * 4,
        life: 50 + Math.random() * 30,
        type,
      });
    }
  }
}

function updateSplash() {
  if (!splash.active) return;
  if (--splash.timer <= 0) splash.active = false;
  updateParticles(splash.particles, 0.2);
}

function drawSplash() {
  if (!splash.active) return;

  splash.particles.forEach((particle) => {
    const maxLife = particle.type === "anvil" ? 80 : 50;
    const alpha = particle.life / maxLife; // Fade out over time

    // Different colors for different splash types
    let baseColor, highlightAlpha;
    if (particle.type === "anvil") {
      baseColor = `rgba(70, 130, 180, ${alpha})`; // Darker blue for anvil splash
      highlightAlpha = alpha * 0.7; // More prominent highlight
    } else {
      baseColor = `rgba(135, 206, 235, ${alpha})`; // Light blue for ball splash
      highlightAlpha = alpha * 0.6;
    }

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();

    // Add white highlight for water droplet effect
    ctx.fillStyle = `rgba(255, 255, 255, ${highlightAlpha})`;
    ctx.beginPath();
    ctx.arc(
      particle.x - particle.size * 0.3,
      particle.y - particle.size * 0.3,
      particle.size * 0.4,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });
}

function respawnBall() {
  respawning = true;
  Object.assign(ball, {
    x: seesawX,
    y: 50,
    velocityX: 0,
    velocityY: 2,
    onSeesaw: false,
    isSquished: false,
    squishTimer: 0,
    squishAmount: 1.0,
  });

  // Prevent ball from immediately colliding with anvils during respawn
  setTimeout(() => (respawning = false), 500);
}
function spawnAnvil() {
  // Don't spawn if too many anvils already exist
  if (anvils.length >= MAX_ANVILS_ON_SCREEN) return;

  anvils.push({
    x: Math.random() * canvas.width,
    y: -30,
    width: OBJECTS.anvil.width,
    height: OBJECTS.anvil.height,
    velocityY: OBJECTS.anvil.spawnVelocity,
    crushedBall: false,
    hitSeesaw: false,
    slideDirection: 0,
    fallingOff: false,
    hitWater: false,
  });
}

// Helper functions
function checkRectCircleCollision(rect, circle) {
  return (
    Math.abs(rect.x - circle.x) < rect.width / 2 + circle.radius &&
    Math.abs(rect.y - circle.y) < rect.height / 2 + circle.radius
  );
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

  for (let i = anvils.length - 1; i >= 0; i--) {
    const anvil = anvils[i];
    updateAnvilPhysics(anvil);
    updateAnvilBallCollision(anvil);
    updateAnvilSeesawInteraction(anvil, i);

    if (anvil.y > canvas.height + 50) anvils.splice(i, 1);
  }
}

function updateAnvilPhysics(anvil) {
  anvil.y += anvil.velocityY;
  if (anvil.fallingOff) anvil.velocityY += 0.3;

  if (anvil.y + anvil.height / 2 >= WATER_LEVEL && !anvil.hitWater) {
    anvil.hitWater = true;
    createSplash(anvil.x, WATER_LEVEL, "anvil", Math.abs(anvil.velocityY) + 3);
  }
}

function updateAnvilBallCollision(anvil) {
  if (anvil.crushedBall || respawning) return;

  if (
    checkRectCircleCollision(anvil, {
      x: ball.x,
      y: ball.y,
      radius: ball.radius,
    })
  ) {
    if (!anvil.hitSeesaw || anvil.fallingOff) {
      // Anvil is falling or not on seesaw - crush the ball
      anvil.crushedBall = true;
      if (ball.onSeesaw || ball.y >= canvas.height - 150) squishBall();
      else ballFellInWater();
    } else {
      // Anvil is on seesaw - handle interaction but don't let ball get stuck
      handleBallAnvilInteraction(anvil);
    }
  }
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

  if (
    anvil.x >= bounds.left &&
    anvil.x <= bounds.right &&
    anvil.y + anvil.height / 2 >= bounds.top - 5 &&
    !anvil.hitSeesaw
  ) {
    landAnvilOnSeesaw(anvil, bounds);
  }

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
    const { x, y, width, height } = anvil;
    const halfW = width / 2;
    const halfH = height / 2;

    // Anvil body (dark gray)
    drawRect(x - halfW, y - halfH, width, height, "#2A2A2A");

    // Anvil top (wider part)
    drawRect(x - halfW - 3, y - halfH, width + 6, 8, "#404040");

    // Anvil bottom (wider part)
    drawRect(x - halfW - 2, y + halfH - 6, width + 4, 6, "#404040");

    // Metallic shine
    drawRect(x - halfW + 2, y - halfH + 2, 4, height - 4, "#606060");
  });
}

function updateSeesawPhysics() {
  seesawAngle += (targetSeesawAngle - seesawAngle) * PHYSICS.angleSmoothing;

  let leftTorque = 0,
    rightTorque = 0,
    anvilsOnSeesaw = 0;

  if (ball.onSeesaw) {
    const ballTorque = Math.abs(ball.x - seesawX) * OBJECTS.ball.weight;
    if (ball.x < seesawX) leftTorque += ballTorque;
    else rightTorque += ballTorque;
  }

  anvils.forEach((anvil) => {
    if (anvil.hitSeesaw && !anvil.fallingOff) {
      anvilsOnSeesaw++;
      const anvilTorque = Math.abs(anvil.x - seesawX) * OBJECTS.anvil.weight;
      if (anvil.x < seesawX) leftTorque += anvilTorque;
      else rightTorque += anvilTorque;
    }
  });

  const netTorque = rightTorque - leftTorque;
  targetSeesawAngle =
    netTorque * PHYSICS.torqueScale * (anvilsOnSeesaw > 0 ? 1.2 : 1);

  const safeMaxAngle = Math.min(
    PHYSICS.maxAngle,
    Math.abs(Math.atan((WATER_LEVEL - seesawY - 50) / (seesawWidth / 2)))
  );
  targetSeesawAngle = Math.max(
    -safeMaxAngle,
    Math.min(safeMaxAngle, targetSeesawAngle)
  );
}

function checkSeesawCollision() {
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
      ball.y = seesawHeightAtBallX - ball.radius;
      ball.velocityY = 0;

      // Realistic physics: ball rolls down slope based on angle
      const slopeForce = Math.sin(seesawAngle) * 0.08;
      ball.velocityX += slopeForce;

      // Extra push at extreme angles to prevent getting stuck
      if (Math.abs(seesawAngle) > PHYSICS.maxAngle * 0.85) {
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
  // Handle timing for browser tab switching
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  // Skip frame if too much time passed (tab was unfocused)
  if (deltaTime > 100) {
    requestAnimationFrame(animate);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  handleInput();
  updateBall();
  updateAnvils();
  updateSeesawPhysics(); // Update seesaw physics smoothly
  updateSplash(); // Update splash particles

  // Draw background elements first
  drawSky();
  drawSun();
  drawClouds();
  drawWater();

  // Draw game elements
  drawSeesaw();
  drawAnvils();
  drawBall();
  drawSplash(); // Draw splash effect
  drawLives();

  // Game over check
  if (lives <= 0) {
    ctx.fillStyle = "#FF0000";
    ctx.font = "48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "left"; // Reset alignment
    return; // Stop the game loop
  }

  requestAnimationFrame(animate);
}

animate();
