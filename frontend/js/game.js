
export function createRunnerGame() {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas?.getContext("2d");
  const scoreElement = document.getElementById("gameScore");
  const overlay = document.getElementById("gameOverlay");
  const message = document.getElementById("gameMessage");
  const instructions = document.getElementById("gameInstructions");
  const startButton = document.getElementById("gameStartBtn");

  const laneX = [280, 400, 520];

  let playerLane = 1;
  let playerJump = 0;
  let jumpVelocity = 0;

  let obstacles = [];
  let coins = [];
  let powerUps = [];

  let lives = 3;
  let shieldActive = false;
  let shieldUntil = 0;

  let combo = 0;
  let lastCoinCollectedAt = 0;

  let score = 0;
  let bonusScore = 0;
  let highScore = 0;
  let collectedCoins = 0;

  let running = false;
  let paused = false;
  let countdownActive = false;
  let countdownStartTimestamp = 0;
  let goUntilTimestamp = 0;

  let lastFrame = 0;
  let lastObstacle = 0;
  let lastCoin = 0;
  let lastPowerUp = 0;
  let lastMove = 0;

  let animationId = 0;
  let actionQueue = [];
  let obstacleSpeed = 230;

  let soundEnabled = true;
  let audioContext = null;

  // Load saved high score.
  try {
    highScore =
      Number(localStorage.getItem("visionRunHighScore")) || 0;
  } catch (error) {
    console.warn("High score storage unavailable.", error);
  }

  // Check required HTML elements.
  if (
    !canvas ||
    !ctx ||
    !scoreElement ||
    !overlay ||
    !message ||
    !instructions ||
    !startButton
  ) {
    console.error("VisionRun initialization failed.");
    return {
      start: () => {},
      setAction: () => {}
    };
  }

  // Create Sound button if it does not exist.
  let soundButton = document.getElementById("soundBtn");

  if (!soundButton) {
    soundButton = document.createElement("button");
    soundButton.id = "soundBtn";
    soundButton.type = "button";
    soundButton.className = "button secondary";
    soundButton.style.marginTop = "10px";
    startButton.insertAdjacentElement("afterend", soundButton);
  }

  // Create Pause button if it does not exist.
  let pauseButton = document.getElementById("pauseBtn");

  if (!pauseButton) {
    pauseButton = document.createElement("button");
    pauseButton.id = "pauseBtn";
    pauseButton.type = "button";
    pauseButton.className = "button secondary";
    pauseButton.style.marginTop = "10px";
    pauseButton.style.marginLeft = "8px";
    soundButton.insertAdjacentElement("afterend", pauseButton);
  }

  // Update Sound button.
  function updateSoundButton() {
    soundButton.textContent = soundEnabled
      ? "🔊 Sound ON"
      : "🔇 Sound OFF";

    soundButton.setAttribute(
      "aria-pressed",
      String(soundEnabled)
    );
  }

  // Update Pause button.
  function updatePauseButton() {
    pauseButton.textContent = paused
      ? "▶ Resume"
      : "⏸ Pause";

    pauseButton.disabled = !running || countdownActive;

    pauseButton.setAttribute(
      "aria-pressed",
      String(paused)
    );
  }

  // Sound effects.
  function playSound(type) {
    if (!soundEnabled) return;

    try {
      const AudioClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioClass) return;

      if (!audioContext) {
        audioContext = new AudioClass();
      }

      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }

      const sounds = {
        coin: {
          frequency: 950,
          duration: 0.13,
          wave: "sine"
        },
        shield: {
          frequency: 620,
          duration: 0.25,
          wave: "sine"
        },
        hit: {
          frequency: 250,
          duration: 0.22,
          wave: "square"
        },
        jump: {
          frequency: 420,
          duration: 0.16,
          wave: "triangle"
        },
        gameover: {
          frequency: 180,
          duration: 0.42,
          wave: "sawtooth"
        }
      };

      const sound = sounds[type];
      if (!sound) return;

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = sound.wave;

      oscillator.frequency.setValueAtTime(
        sound.frequency,
        now
      );

      if (type === "gameover") {
        oscillator.frequency.exponentialRampToValueAtTime(
          75,
          now + sound.duration
        );
      }

      if (type === "jump") {
        oscillator.frequency.exponentialRampToValueAtTime(
          700,
          now + sound.duration
        );
      }

      gain.gain.setValueAtTime(0.0001, now);

      gain.gain.exponentialRampToValueAtTime(
        0.12,
        now + 0.015
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + sound.duration
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + sound.duration);
    } catch (error) {
      console.warn("Sound playback unavailable:", error);
    }
  }

  // Calculate final score, including bonus points.
  function getTotalScore() {
    return Math.floor(score) + bonusScore;
  }

  // Save score to Spring Boot + MySQL.
  async function saveScoreToBackend(finalScore) {
    let playerName = null;

    try {
      playerName = localStorage.getItem("visionRunPlayerName");
    } catch (error) {
      console.warn("Could not read player name.", error);
    }

    // Ask for the player's name on the first game.
    if (!playerName) {
      playerName = window.prompt("Enter your player name:");

      if (!playerName || !playerName.trim()) {
        console.warn(
          "Score not saved: player name is required."
        );
        return false;
      }

      playerName = playerName.trim();

      try {
        localStorage.setItem(
          "visionRunPlayerName",
          playerName
        );
      } catch (error) {
        console.warn("Could not store player name.", error);
      }
    }

    try {
      const response = await fetch(
        "http://localhost:8080/api/scores",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            playerName,
            score: Math.max(0, Math.floor(finalScore)),
            coinsCollected: Math.max(0, collectedCoins)
          })
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const savedScore = await response.json();

      console.log(
        "VisionRun score saved successfully:",
        savedScore
      );

      // Refresh leaderboard after the backend saves the score.
      window.dispatchEvent(
        new Event("visionrun-score-saved")
      );

      return true;
    } catch (error) {
      console.error(
        "Could not save VisionRun score to backend:",
        error
      );

      return false;
    }
  }

  // PART 1 ENDS HERE.
  // PART 2 STARTS WITH: // Start or restart game

  // Start or restart game
  function start() {
    cancelAnimationFrame(animationId);

    playerLane = 1;
    playerJump = 0;
    jumpVelocity = 0;

    obstacles = [];
    coins = [];
    powerUps = [];

    lives = 3;
    shieldActive = false;
    shieldUntil = 0;

    combo = 0;
    lastCoinCollectedAt = 0;

    score = 0;
    bonusScore = 0;
    collectedCoins = 0;

    obstacleSpeed = 230;

    lastObstacle = 0;
    lastCoin = 0;
    lastPowerUp = 0;
    lastFrame = 0;
    lastMove = 0;

    actionQueue = [];

    running = true;
    paused = false;
    countdownActive = true;
    countdownStartTimestamp = 0;
    goUntilTimestamp = 0;

    scoreElement.textContent = "0";
    message.textContent = "3";
    instructions.textContent =
      "Get ready! Game starts in 3 seconds.";

    startButton.textContent = "Restart Game";
    overlay.hidden = false;

    updatePauseButton();

    drawRoad();
    drawCoins();
    drawPowerUps();
    drawObstacles();
    drawPlayer();

    if (audioContext?.state === "suspended") {
      audioContext.resume().catch(() => {});
    }

    animationId = requestAnimationFrame(frame);
  }

  // Game over
  function endGame() {
    if (!running) return;

    running = false;
    paused = false;
    countdownActive = false;

    cancelAnimationFrame(animationId);
    updatePauseButton();
    playSound("gameover");

    const finalScore = getTotalScore();

    // Save score to backend and refresh leaderboard on success.
    void saveScoreToBackend(finalScore);

    const isNewHighScore = finalScore > highScore;

    if (isNewHighScore) {
      highScore = finalScore;

      try {
        localStorage.setItem(
          "visionRunHighScore",
          String(highScore)
        );
      } catch (error) {
        console.warn("Could not save high score.", error);
      }
    }

    message.textContent = isNewHighScore
      ? "NEW HIGH SCORE!"
      : "GAME OVER";

    instructions.textContent =
      `Score: ${finalScore} | Coins: ${collectedCoins} | Best: ${highScore}`;

    startButton.textContent = "Restart Game";
    overlay.hidden = false;
  }

  // Pause and resume
  function togglePause() {
    if (!running || countdownActive) return;

    if (!paused) {
      paused = true;

      cancelAnimationFrame(animationId);

      message.textContent = "PAUSED";
      instructions.textContent =
        "Click Resume to continue playing.";

      overlay.hidden = false;
    } else {
      paused = false;

      lastFrame = 0;
      lastMove = 0;
      actionQueue = [];

      overlay.hidden = true;

      animationId = requestAnimationFrame(frame);
    }

    updatePauseButton();
  }

  // Player movement
  function move(direction) {
    if (
      !running ||
      paused ||
      countdownActive ||
      goUntilTimestamp
    ) {
      return;
    }

    if (direction === "LEFT") {
      playerLane = Math.max(0, playerLane - 1);
    } else if (direction === "RIGHT") {
      playerLane = Math.min(2, playerLane + 1);
    } else if (
      direction === "JUMP" &&
      playerJump === 0
    ) {
      jumpVelocity = 430;
      playSound("jump");
    }
  }

  // Webcam pose detection input
  function setAction(action) {
    if (
      !running ||
      paused ||
      countdownActive ||
      goUntilTimestamp
    ) {
      return;
    }

    if (["RUN", "WAITING", "TRACKING"].includes(action)) {
      actionQueue = [];
      return;
    }

    if (
      ["LEFT", "RIGHT", "JUMP"].includes(action) &&
      !actionQueue.includes(action)
    ) {
      actionQueue.push(action);
    }
  }

  // Draw road and game information.
  function drawRoad() {
    const gradient = ctx.createLinearGradient(
      0, 0, 0, canvas.height
    );

    gradient.addColorStop(0, "#172c43");
    gradient.addColorStop(1, "#07111f");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#253449";
    ctx.beginPath();
    ctx.moveTo(220, 0);
    ctx.lineTo(580, 0);
    ctx.lineTo(720, 440);
    ctx.lineTo(80, 440);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#6ee7ef";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(220, 0);
    ctx.lineTo(80, 440);
    ctx.moveTo(580, 0);
    ctx.lineTo(720, 440);
    ctx.stroke();

    ctx.strokeStyle = "#8294a8";
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 15]);

    ctx.beginPath();
    ctx.moveTo(340, 0);
    ctx.lineTo(293, 440);
    ctx.moveTo(460, 0);
    ctx.lineTo(507, 440);
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.fillStyle = "#e6f4ff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("VISIONRUN", 400, 28);

    ctx.textAlign = "left";
    ctx.font = "bold 14px Arial";

    ctx.fillStyle = "#6ee7ef";
    ctx.fillText(`BEST: ${highScore}`, 18, 28);

    ctx.fillStyle = "#ffd166";
    ctx.fillText(`COINS: ${collectedCoins}`, 18, 50);

    ctx.fillStyle = "#ffffff";
    ctx.fillText(
      `SPEED: ${Math.round(obstacleSpeed)}`,
      18, 72
    );

    ctx.fillStyle = "#ff8798";
    ctx.fillText(
      `LIVES: ${"♥ ".repeat(lives).trim() || "0"}`,
      18, 94
    );

    ctx.fillStyle = shieldActive
      ? "#69e7ff"
      : "#9eafc2";

    ctx.fillText(
      shieldActive ? "SHIELD: ACTIVE" : "SHIELD: NONE",
      18, 116
    );

    ctx.textAlign = "right";
    ctx.fillStyle = "#ffd166";

    ctx.fillText(
      `COMBO: x${Math.min(5, 1 + Math.floor(combo / 3))}`,
      canvas.width - 18, 50
    );

    ctx.fillStyle = "#e6f4ff";
    ctx.fillText(
      `SCORE: ${getTotalScore()}`,
      canvas.width - 18, 28
    );

    ctx.textAlign = "left";
  }

  // Draw player
  function drawPlayer() {
    const x = laneX[playerLane];
    const y = 355 - playerJump;

    // Player shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, 386, 24, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = "#6ee7ef";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x - 7, y + 12);
    ctx.lineTo(x - 13, y + 36);
    ctx.moveTo(x + 7, y + 12);
    ctx.lineTo(x + 13, y + 36);
    ctx.stroke();

    // Body
    ctx.fillStyle = "#4f8cff";
    ctx.fillRect(x - 15, y - 17, 30, 34);

    // Head
    ctx.fillStyle = "#f4c7a1";
    ctx.beginPath();
    ctx.arc(x, y - 29, 12, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = "#07111f";
    ctx.fillRect(x - 8, y - 32, 16, 5);

    // Arms
    ctx.strokeStyle = "#f4c7a1";
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.moveTo(x - 14, y - 10);
    ctx.lineTo(x - 26, y + 3);
    ctx.moveTo(x + 14, y - 10);
    ctx.lineTo(x + 26, y + 3);
    ctx.stroke();

    // Shield effect
    if (shieldActive) {
      ctx.strokeStyle = "#42d9ff";
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(x, y, 37, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "rgba(66,217,255,0.12)";
      ctx.fill();
    }
  }

  // Create an obstacle
  function spawnObstacle() {
    obstacles.push({
      lane: Math.floor(Math.random() * 3),
      y: -35,
      size: 28
    });
  }

  // Create a coin
  function spawnCoin() {
    coins.push({
      lane: Math.floor(Math.random() * 3),
      y: -25,
      radius: 12,
      rotation: 0
    });
  }

  // Create a shield power-up
  function spawnPowerUp() {
    powerUps.push({
      lane: Math.floor(Math.random() * 3),
      y: -30,
      radius: 15,
      rotation: 0
    });
  }

  // Draw obstacles
  function drawObstacles() {
    for (const obstacle of obstacles) {
      const progress = Math.max(
        0,
        (obstacle.y + 35) / 475
      );

      const x =
        400 +
        (laneX[obstacle.lane] - 400) *
        Math.min(1, progress);

      const size =
        obstacle.size * (0.65 + progress * 0.7);

      ctx.fillStyle = "#ff647c";
      ctx.fillRect(
        x - size / 2,
        obstacle.y - size / 2,
        size,
        size
      );

      ctx.strokeStyle = "#ffe1e7";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        x - size / 2,
        obstacle.y - size / 2,
        size,
        size
      );
    }
  }

  // Draw coins
  function drawCoins() {
    for (const coin of coins) {
      const progress = Math.max(
        0,
        (coin.y + 25) / 465
      );

      const x =
        400 +
        (laneX[coin.lane] - 400) *
        Math.min(1, progress);

      const radius =
        coin.radius * (0.65 + progress * 0.65);

      ctx.save();
      ctx.translate(x, coin.y);
      ctx.rotate(coin.rotation);

      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.ellipse(
        0, 0,
        radius * 0.72,
        radius,
        0, 0, Math.PI * 2
      );
      ctx.fill();

      ctx.strokeStyle = "#fff1a8";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = "#9b6700";
      ctx.font = `bold ${Math.max(10, radius)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("$", 0, 1);

      ctx.restore();
    }
  }

  // PART 2 ENDS HERE.
  // PART 3 STARTS WITH drawPowerUps().

  // Draw shield power-ups
  function drawPowerUps() {
    for (const item of powerUps) {
      const progress = Math.max(0, (item.y + 30) / 470);

      const x =
        400 +
        (laneX[item.lane] - 400) * Math.min(1, progress);

      ctx.save();
      ctx.translate(x, item.y);
      ctx.rotate(item.rotation);

      ctx.fillStyle = "#42d9ff";
      ctx.beginPath();
      ctx.moveTo(0, -item.radius);
      ctx.lineTo(item.radius, -5);
      ctx.lineTo(item.radius * 0.7, item.radius * 0.65);
      ctx.lineTo(0, item.radius);
      ctx.lineTo(-item.radius * 0.7, item.radius * 0.65);
      ctx.lineTo(-item.radius, -5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "#e0fbff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#073449";
      ctx.font = "bold 15px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("S", 0, 1);

      ctx.restore();
    }
  }

  // Main game loop
  function frame(timestamp) {
    if (!running || paused) return;

    try {
      // Three-second countdown
      if (countdownActive) {
        if (!countdownStartTimestamp) {
          countdownStartTimestamp = timestamp;
        }

        const elapsedSeconds = Math.floor(
          (timestamp - countdownStartTimestamp) / 1000
        );

        const countdownNumber = 3 - elapsedSeconds;

        if (countdownNumber > 0) {
          message.textContent = String(countdownNumber);
          instructions.textContent = "Get ready!";
        } else if (countdownNumber === 0) {
          message.textContent = "GO!";
          instructions.textContent =
            "Move left/right and jump to survive!";
        } else {
          countdownActive = false;
          goUntilTimestamp = timestamp + 400;

          overlay.hidden = false;

          lastObstacle = timestamp;
          lastCoin = timestamp;
          lastPowerUp = timestamp;
          lastFrame = timestamp;

          updatePauseButton();
        }

        drawRoad();
        drawCoins();
        drawPowerUps();
        drawObstacles();
        drawPlayer();

        animationId = requestAnimationFrame(frame);
        return;
      }

      // Brief GO message
      if (goUntilTimestamp) {
        if (timestamp < goUntilTimestamp) {
          message.textContent = "GO!";

          drawRoad();
          drawCoins();
          drawPowerUps();
          drawObstacles();
          drawPlayer();

          animationId = requestAnimationFrame(frame);
          return;
        }

        goUntilTimestamp = 0;
        overlay.hidden = true;
      }

      // Calculate frame time
      const dt = lastFrame
        ? Math.min((timestamp - lastFrame) / 1000, 0.04)
        : 0;

      lastFrame = timestamp;

      // Process queued movements
      if (actionQueue.length && timestamp - lastMove > 250) {
        move(actionQueue.shift());
        lastMove = timestamp;
      }

      // Jump physics
      if (playerJump > 0 || jumpVelocity > 0) {
        playerJump += jumpVelocity * dt;
        jumpVelocity -= 1000 * dt;

        if (playerJump <= 0) {
          playerJump = 0;
          jumpVelocity = 0;
        }
      }

      // Spawn obstacles
      if (timestamp - lastObstacle > 1050) {
        spawnObstacle();
        lastObstacle = timestamp;
      }

      // Spawn coins
      if (timestamp - lastCoin > 850) {
        spawnCoin();
        lastCoin = timestamp;
      }

      // Spawn shield power-ups
      if (timestamp - lastPowerUp > 9000) {
        spawnPowerUp();
        lastPowerUp = timestamp;
      }

      // Move obstacles
      for (const obstacle of obstacles) {
        obstacle.y += obstacleSpeed * dt;
      }

      // Move coins
      for (const coin of coins) {
        coin.y += obstacleSpeed * dt;
        coin.rotation += dt * 3;
      }

      // Move power-ups
      for (const item of powerUps) {
        item.y += obstacleSpeed * dt;
        item.rotation += dt * 2;
      }

      // Obstacle collision and lives
      for (const obstacle of obstacles) {
        const inPlayerZone =
          obstacle.y > 320 && obstacle.y < 390;

        const sameLane = obstacle.lane === playerLane;
        const notJumping = playerJump < 45;

        if (inPlayerZone && sameLane && notJumping) {
          obstacle.y = 500;

          if (shieldActive) {
            shieldActive = false;
            shieldUntil = 0;
            playSound("hit");
          } else {
            lives--;
            combo = 0;
            playSound("hit");

            if (lives <= 0) {
              endGame();
              return;
            }
          }
        }
      }

      // Collect coins and increase combo multiplier
      coins = coins.filter(coin => {
        const inPlayerZone =
          coin.y > 320 && coin.y < 390;

        const sameLane = coin.lane === playerLane;

        if (inPlayerZone && sameLane) {
          if (timestamp - lastCoinCollectedAt > 3000) {
            combo = 0;
          }

          combo++;
          lastCoinCollectedAt = timestamp;

          const multiplier = Math.min(
            5,
            1 + Math.floor(combo / 3)
          );

          bonusScore += 50 * multiplier;
          collectedCoins++;

          playSound("coin");
          return false;
        }

        return coin.y < 480;
      });

      // Collect shield power-ups
      powerUps = powerUps.filter(item => {
        const inPlayerZone =
          item.y > 320 && item.y < 390;

        const sameLane = item.lane === playerLane;

        if (inPlayerZone && sameLane) {
          shieldActive = true;
          shieldUntil = timestamp + 8000;

          playSound("shield");
          return false;
        }

        return item.y < 480;
      });

      // Shield expires after eight seconds
      if (shieldActive && timestamp > shieldUntil) {
        shieldActive = false;
      }

      // Remove obstacles that have left the screen
      obstacles = obstacles.filter(
        obstacle => obstacle.y < 480
      );

      // Increase score and difficulty
      score += dt * 10;

      obstacleSpeed = Math.min(
        380,
        230 + score * 0.15
      );

      scoreElement.textContent = String(getTotalScore());

      // Render everything
      drawRoad();
      drawCoins();
      drawPowerUps();
      drawObstacles();
      drawPlayer();

      animationId = requestAnimationFrame(frame);
    } catch (error) {
      running = false;
      paused = false;

      console.error("VisionRun game loop error:", error);

      message.textContent = "GAME ERROR";
      instructions.textContent =
        "Check the browser Console.";

      startButton.textContent = "Restart Game";
      overlay.hidden = false;

      updatePauseButton();
    }
  }

  // PART 3 ENDS HERE.
  // PART 4 STARTS WITH function queueAction(action).

  // Queue player actions
  function queueAction(action) {
    if (["LEFT", "RIGHT", "JUMP"].includes(action)) {
      setAction(action);
    }
  }

  // Start or restart button
  startButton.addEventListener("click", start);

  // Pause / Resume button
  pauseButton.addEventListener("click", togglePause);

  // Sound ON / OFF button
  soundButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;

    updateSoundButton();

    if (soundEnabled) {
      try {
        const AudioClass =
          window.AudioContext || window.webkitAudioContext;

        if (AudioClass && !audioContext) {
          audioContext = new AudioClass();
        }

        if (audioContext?.state === "suspended") {
          audioContext.resume().catch(() => {});
        }

        playSound("coin");
      } catch (error) {
        console.warn("Could not enable audio.", error);
      }
    }
  });

  // Initialize button states
  updateSoundButton();
  updatePauseButton();

  // On-screen movement controls
  document.getElementById("leftBtn")?.addEventListener(
    "click",
    () => queueAction("LEFT")
  );

  document.getElementById("rightBtn")?.addEventListener(
    "click",
    () => queueAction("RIGHT")
  );

  document.getElementById("jumpBtn")?.addEventListener(
    "click",
    () => queueAction("JUMP")
  );

  // Keyboard controls
  window.addEventListener("keydown", event => {
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(
        event.key
      )
    ) {
      event.preventDefault();
    }

    if (event.repeat) return;

    if (
      event.key === "ArrowLeft" ||
      event.key.toLowerCase() === "a"
    ) {
      queueAction("LEFT");
    } else if (
      event.key === "ArrowRight" ||
      event.key.toLowerCase() === "d"
    ) {
      queueAction("RIGHT");
    } else if (
      event.key === "ArrowUp" ||
      event.key === " "
    ) {
      queueAction("JUMP");
    } else if (event.key.toLowerCase() === "p") {
      togglePause();
    }
  });

  // Draw the initial screen
  drawRoad();
  drawCoins();
  drawPowerUps();
  drawPlayer();

  message.textContent = "READY TO RUN?";

  instructions.textContent =
    `Best Score: ${highScore}. Collect coins for bonus points!`;

  startButton.textContent = "Start Game";

  updateSoundButton();
  updatePauseButton();

  // Return functions used by app.js
  return {
    start,
    setAction
  };
}
