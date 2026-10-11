VISIONRUN — STAGE 01: CAMERA + POSE DETECTION

WHAT THIS STAGE DOES
- Opens the laptop webcam after you click Start camera.
- Uses MediaPipe Pose Landmarker to detect and draw body landmarks.
- Shows a prototype movement label: RUN, JUMP, LEFT, or RIGHT.
- Does not upload camera video to your backend.
- Does not yet include the runner game, Spring Boot, WebSocket, or MySQL. Those are later stages.

REQUIREMENTS
- Windows / macOS / Linux laptop with a webcam
- Updated Google Chrome or Microsoft Edge
- Internet connection (the MediaPipe library, WASM files, and pose model load from CDNs)
- VS Code and the Live Server extension (recommended)

RUN WITH VS CODE LIVE SERVER
1. Extract the VisionRun folder.
2. Open VS Code.
3. Select File > Open Folder... and open the VisionRun folder.
4. Install the extension named "Live Server" by Ritwick Dey if it is not installed.
5. In Explorer, right-click frontend/index.html and choose "Open with Live Server".
6. The browser should open an address similar to http://127.0.0.1:5500/frontend/.
7. Click "Start camera" and allow camera permission.
8. Stand far enough away so your shoulders, hips and knees are visible. Use good front lighting.
9. Move gently left/right and try lowering your body then rising. The labels are only a first prototype and may need threshold tuning.
10. Click "Stop camera" when finished.

IMPORTANT
- Do not open index.html by double-clicking it (file://); camera permission and module imports require a local web server.
- If camera permission was denied, use the camera/site-settings icon near the browser address bar to allow it, then reload.
- If the pose model does not load, check internet access, reload the page, and check the browser DevTools Console (F12).
- If you see a blank camera, close other apps using the webcam and try again.
- Movement classification is experimental: jumping detection uses hip movement and is not a production-quality classifier yet.
- If the browser blocks the GPU delegate, inspect the console. The next debugging step is to switch delegate from 'GPU' to 'CPU' in frontend/js/poseDetection.js.
