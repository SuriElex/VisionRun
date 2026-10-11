import { FilesetResolver, PoseLandmarker, DrawingUtils } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32';

const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';

export async function createPoseDetector() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.55,
    minPosePresenceConfidence: 0.55,
    minTrackingConfidence: 0.55
  });
  return { landmarker, DrawingUtils, connections: PoseLandmarker.POSE_CONNECTIONS };
}

export function drawPose(ctx, canvas, video, landmarks, DrawingUtilsClass) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  const drawingUtils = new DrawingUtilsClass(ctx);
  drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
    color: '#6ee7ef', lineWidth: 3
  });
  drawingUtils.drawLandmarks(landmarks, {
    color: '#f8fbff', fillColor: '#4f8cff', lineWidth: 1, radius: 4
  });
}
