export function createMovementController() {
  let previousHipY = null;
  let lowHipY = null;
  let loweringAt = 0;

  let lastActionAt = 0;
  let lastDebugAt = 0;

  // Hold movement actions on screen.
  let heldAction = "RUN";
  let heldHint = "Lean left or right to change direction.";
  let actionUntil = 0;

  const COOLDOWN = 350;
  const ACTION_HOLD = 600;

  const LEAN_THRESHOLD = 0.16;
  const CENTER_THRESHOLD = 0.08;
  const JUMP_THRESHOLD = 0.025;

  function resetTracking() {
    previousHipY = null;
    lowHipY = null;
    loweringAt = 0;
  }

  function classify(landmarks, now = performance.now()) {
    if (!landmarks || landmarks.length < 29) {
      resetTracking();
      heldAction = "WAITING";
      heldHint = "Stand where your full body is visible.";
      actionUntil = 0;

      return { action: heldAction, hint: heldHint };
    }

    const point = (i) => landmarks[i];

    const leftShoulder = point(11);
    const rightShoulder = point(12);
    const leftHip = point(23);
    const rightHip = point(24);
    const leftKnee = point(25);
    const rightKnee = point(26);

    const required = [
      leftShoulder, rightShoulder,
      leftHip, rightHip,
      leftKnee, rightKnee
    ];

    const visible = required.every(
      p => p && (p.visibility ?? 1) > 0.35
    );

    if (!visible) {
      resetTracking();

      return {
        action: "TRACKING",
        hint: "Keep shoulders, hips and knees visible."
      };
    }

    const shoulderX =
      (leftShoulder.x + rightShoulder.x) / 2;

    const hipX =
      (leftHip.x + rightHip.x) / 2;

    const hipY =
      (leftHip.y + rightHip.y) / 2;

    const shoulderWidth = Math.max(
      0.04,
      Math.abs(leftShoulder.x - rightShoulder.x)
    );

    const lean = (shoulderX - hipX) / shoulderWidth;

    let detectedAction = null;
    let detectedHint = "";

    // Detect lowering followed by rising.
    if (previousHipY !== null) {
      if (hipY > previousHipY + 0.006) {
        if (lowHipY === null) {
          lowHipY = hipY;
          loweringAt = now;
        } else {
          lowHipY = Math.max(lowHipY, hipY);
        }
      }

      const roseFromLow =
        lowHipY !== null &&
        now - loweringAt < 1800 &&
        lowHipY - hipY > JUMP_THRESHOLD;

      if (
        roseFromLow &&
        now - lastActionAt >= COOLDOWN
      ) {
        detectedAction = "JUMP";
        detectedHint = "Jump gesture detected!";

        lowHipY = null;
        loweringAt = 0;
      }
    }

    // Detect left and right lean.
    if (!detectedAction && now - lastActionAt >= COOLDOWN) {
      if (lean < -LEAN_THRESHOLD) {
        detectedAction = "LEFT";
        detectedHint = "Left movement detected!";
      } else if (lean > LEAN_THRESHOLD) {
        detectedAction = "RIGHT";
        detectedHint = "Right movement detected!";
      }
    }

    // Save newly detected action and hold it on screen.
    if (detectedAction) {
      heldAction = detectedAction;
      heldHint = detectedHint;
      actionUntil = now + ACTION_HOLD;
      lastActionAt = now;
    }

    // Return to RUN only after the hold period expires.
    if (now >= actionUntil) {
      heldAction = "RUN";
      heldHint = Math.abs(lean) < CENTER_THRESHOLD
        ? "Centered. Lean left or right to move."
        : "Lean clearly left or right to change direction.";
    }

    previousHipY = hipY;

    if (lowHipY !== null && now - loweringAt > 1800) {
      lowHipY = null;
      loweringAt = 0;
    }

    if (now - lastDebugAt >= 500) {
      console.log("VisionRun movement debug:", {
        lean: Number(lean.toFixed(3)),
        action: heldAction
      });

      lastDebugAt = now;
    }

    return {
      action: heldAction,
      hint: heldHint
    };
  }

  return { classify };
}