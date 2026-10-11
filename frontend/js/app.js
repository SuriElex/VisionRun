
import { startCamera, stopCamera } from './camera.js';
import { createPoseDetector } from './poseDetection.js';
import { createMovementController } from './movementController.js';
import { createRunnerGame } from './game.js';
import { createLeaderboard } from './leaderboard.js';

const $ = (id) => document.getElementById(id);

const video = $('webcam');
const canvas = $('poseCanvas');
const ctx = canvas?.getContext('2d');

const startBtn = $('startBtn');
const stopBtn = $('stopBtn');

let stream = null;
let detector = null;
let drawingUtilsClass = null;
let poseConnections = [];
let animationId = 0;

let lastVideoTime = -1;
let lastFpsAt = performance.now();
let frames = 0;
let fps = 0;

let running = false;
let modelReady = false;
let lastDebugAt = 0;
let lastGameAction = 'RUN';

const movement = createMovementController();
const game = createRunnerGame();

// Initialize leaderboard and load saved scores.
const leaderboard = createLeaderboard();

function setMetric(id, text, good = false) {
  const el = $(id);
  if (!el) return;

  el.textContent = text;
  el.className = good ? 'good' : 'muted';
}

function setBadge(state, label) {
  const el = $('cameraBadge');
  if (!el) return;

  el.className = `status-badge ${state}`;

  if (el.lastElementChild) {
    el.lastElementChild.textContent = label;
  }
}

function markDone(id, done) {
  const el = $(id);
  if (el) el.classList.toggle('done', done);
}

function showError(message) {
  const box = $('errorBox');
  if (!box) return;

  box.textContent = message;
  box.hidden = false;
}

function clearError() {
  const box = $('errorBox');
  if (!box) return;

  box.hidden = true;
  box.textContent = '';
}

function resizeCanvas() {
  if (!video || !canvas || !ctx) return;

  const width = video.videoWidth || 640;
  const height = video.videoHeight || 480;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

async function start() {
  if (!startBtn || !stopBtn || !video || !canvas || !ctx) {
    showError('Required camera or game elements are missing from index.html.');
    return;
  }

  startBtn.disabled = true;
  clearError();
  setBadge('idle', 'Starting…');

  try {
    const placeholder = $('cameraPlaceholder');
    if (placeholder) placeholder.hidden = true;

    stream = await startCamera(video);

    setMetric('cameraMetric', 'Ready', true);
    markDone('checkCamera', true);
    setBadge('live', 'Camera on');

    resizeCanvas();

    if (!modelReady) {
      setMetric('modelMetric', 'Loading…');

      const result = await createPoseDetector();

      detector = result.landmarker;
      drawingUtilsClass = result.DrawingUtils;
      poseConnections = result.connections;

      modelReady = true;
      setMetric('modelMetric', 'Ready', true);
    }

    running = true;
    stopBtn.disabled = false;
    lastVideoTime = -1;
    lastGameAction = 'RUN';
    lastFpsAt = performance.now();
    frames = 0;

    const poseTag = $('poseTag');
    if (poseTag) poseTag.textContent = 'Looking for body…';

    animationId = requestAnimationFrame(loop);

    console.log('VisionRun camera and pose detection started.');
  } catch (err) {
    stopCamera(video);
    stream = null;
    running = false;

    const placeholder = $('cameraPlaceholder');
    if (placeholder) placeholder.hidden = false;

    setBadge('error', 'Needs attention');
    setMetric('cameraMetric', 'Unavailable');

    showError(
      err.name === 'NotAllowedError'
        ? 'Camera permission was blocked. Allow camera access and try again.'
        : err.name === 'NotFoundError'
          ? 'No camera was found. Connect or enable a camera.'
          : err.message || 'Could not start camera.'
    );

    console.error('VisionRun start error:', err);
  } finally {
    startBtn.disabled = false;
  }
}

function loop() {
  if (!running || !detector || !video || !ctx || !canvas) {
    return;
  }

  if (video.readyState < 2) {
    animationId = requestAnimationFrame(loop);
    return;
  }

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    resizeCanvas();

    const result = detector.detectForVideo(
      video,
      performance.now()
    );

    const landmarks = result.landmarks?.[0] ?? null;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (landmarks) {
      const drawing = new drawingUtilsClass(ctx);

      drawing.drawConnectors(landmarks, poseConnections, {
        color: '#6ee7ef',
        lineWidth: 3
      });

      drawing.drawLandmarks(landmarks, {
        color: '#f8fbff',
        fillColor: '#4f8cff',
        lineWidth: 1,
        radius: 4
      });

      setMetric('bodyMetric', 'Detected', true);
      markDone('checkPose', true);

      const output = movement.classify(landmarks);
      const action = output.action;

      const actionName = $('actionName');
      const actionHint = $('actionHint');
      const poseTag = $('poseTag');
      const actionDisplay = $('actionDisplay');

      if (actionName) actionName.textContent = action;
      if (actionHint) actionHint.textContent = output.hint;
      if (poseTag) poseTag.textContent = `POSE OK · ${action}`;

      const isMovement = ['LEFT', 'RIGHT', 'JUMP'].includes(action);

      if (actionDisplay) {
        actionDisplay.classList.toggle('active', isMovement);
      }

      markDone('checkMove', isMovement);

      // Send a new movement to the game only once.
      if (isMovement && action !== lastGameAction) {
        game.setAction(action);
        console.log('Game movement:', action);
      }

      lastGameAction = action;

      const now = performance.now();

      if (now - lastDebugAt >= 500) {
        console.log('MOVEMENT OUTPUT:', output);
        lastDebugAt = now;
      }
    } else {
      setMetric('bodyMetric', 'Not found');

      const poseTag = $('poseTag');
      const actionName = $('actionName');
      const actionHint = $('actionHint');
      const actionDisplay = $('actionDisplay');

      if (poseTag) poseTag.textContent = 'Looking for body…';
      if (actionName) actionName.textContent = 'WAITING';

      if (actionHint) {
        actionHint.textContent =
          'Stand back so your shoulders, hips and knees are visible.';
      }

      actionDisplay?.classList.remove('active');

      markDone('checkPose', false);
      markDone('checkMove', false);

      lastGameAction = 'WAITING';
    }

    ctx.restore();

    frames++;

    const now = performance.now();

    if (now - lastFpsAt >= 1000) {
      fps = Math.round(
        (frames * 1000) / (now - lastFpsAt)
      );

      frames = 0;
      lastFpsAt = now;

      setMetric('fpsMetric', `${fps} FPS`, fps >= 15);
    }
  }

  animationId = requestAnimationFrame(loop);
}

function stop() {
  running = false;

  cancelAnimationFrame(animationId);

  stopCamera(video);
  stream = null;

  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const placeholder = $('cameraPlaceholder');
  if (placeholder) placeholder.hidden = false;

  setBadge('idle', 'Not started');
  setMetric('cameraMetric', 'Off');
  setMetric('bodyMetric', '—');
  setMetric('fpsMetric', '— FPS');

  const poseTag = $('poseTag');
  const actionName = $('actionName');
  const actionHint = $('actionHint');
  const actionDisplay = $('actionDisplay');

  if (poseTag) poseTag.textContent = 'Waiting for body…';
  if (actionName) actionName.textContent = 'WAITING';

  if (actionHint) {
    actionHint.textContent = 'Start the camera and stand in view.';
  }

  actionDisplay?.classList.remove('active');

  const strong = placeholder?.querySelector('strong');
  if (strong) {
    strong.textContent = 'Your camera preview will appear here';
  }

  markDone('checkCamera', false);
  markDone('checkPose', false);
  markDone('checkMove', false);

  lastGameAction = 'RUN';

  if (stopBtn) stopBtn.disabled = true;
  if (startBtn) startBtn.disabled = false;
}

if (startBtn) startBtn.addEventListener('click', start);
if (stopBtn) stopBtn.addEventListener('click', stop);

window.addEventListener('resize', () => {
  if (running) resizeCanvas();
});

window.addEventListener('beforeunload', () => {
  if (stream) stopCamera(video);
  if (detector) detector.close();
});
