import "./style.css";
import * as THREE from "three";
import { loadAny } from "./xr/loaders";
import { HandTracker } from "./input/hands";
import type { HandFrame } from "./input/hands";
import { classifySingleHand, type Gesture } from "./input/gestures";
import { Debounce } from "./input/smoothing";
import { View3D } from "./xr/scene";
import { loadSplatJSON, loadPLYAsSplats } from "./splats/loadSplat";

const SAMPLE_HELMET =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb";

const SAMPLE_FOX =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Fox/glTF/Fox.gltf"; // loads Fox.gltf + .bin + textures automatically

const SAMPLE_BUNNY = "/models/bunny.ply";

const video = document.getElementById("webcam") as HTMLVideoElement;
const overlay = document.getElementById("overlay") as HTMLCanvasElement;
const statusEl = document.getElementById("status")!;
const fpsEl = document.getElementById("fps")!;
const resEl = document.getElementById("res")!;
const camEl = document.getElementById("cam")!;
const handsEl = document.getElementById("hands")!;
let gestureChip = document.querySelector(
  "#hud .chip.gesture"
) as HTMLSpanElement | null;
if (!gestureChip) {
  gestureChip = document.createElement("span");
  gestureChip.className = "chip gesture";
  gestureChip.textContent = "Gesture: —";
  document.getElementById("hud")!.appendChild(gestureChip);
}

// 3D view on the right
const view = new View3D(document.getElementById("right")!);

// --- File input
const fileInput = document.getElementById("file") as HTMLInputElement;
fileInput.addEventListener("change", async (e: any) => {
  const files: File[] = Array.from(e.target.files || []);
  if (!files.length) return;
  statusEl.textContent = "Loading mesh…";
  try {
    const first = files[0];
    const isPLY =
      files.length === 1 && first.name.toLowerCase().endsWith(".ply");
    const obj = isPLY
      ? await loadPLYAsSplats(URL.createObjectURL(first))
      : await loadAny(files.length === 1 ? first : files);
    view.setMainObject(obj);
    statusEl.textContent = "Mesh loaded";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Load failed (see console)";
    alert(
      "Could not load that selection. Tips:\n- For OBJ, select OBJ + MTL + textures together\n- For glTF, select .gltf + .bin + textures, OR use a .glb"
    );
  } finally {
    fileInput.value = "";
  }
});

// --- Buttons
document.getElementById("btnFit")!.addEventListener("click", () => {
  if (view.mainObject) view.frameObject(view.mainObject);
});
document.getElementById("btnCube")!.addEventListener("click", () => {
  // rebuild a cube and set as main
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.4, 0.4),
    new THREE.MeshStandardMaterial({
      color: 0x6aa9ff,
      metalness: 0.1,
      roughness: 0.7,
    })
  );
  cube.position.set(0, 0.3, -0.2);
  view.setMainObject(cube);
});
document.getElementById("sampleHelmet")!.addEventListener("click", async () => {
  statusEl.textContent = "Loading DamagedHelmet…";
  try {
    const o = await loadAny(SAMPLE_HELMET);
    view.setMainObject(o);
    statusEl.textContent = "DamagedHelmet loaded";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Sample load failed";
  }
});

document.getElementById("sampleFox")!.addEventListener("click", async () => {
  statusEl.textContent = "Loading Fox…";
  try {
    const o = await loadAny(SAMPLE_FOX);
    view.setMainObject(o);
    statusEl.textContent = "Fox loaded";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Sample load failed";
  }
});

document.getElementById("sampleBunny")!.addEventListener("click", async () => {
  statusEl.textContent = "Loading Bunny…";
  try {
    const o = await loadAny(SAMPLE_BUNNY);
    view.setMainObject(o);
    statusEl.textContent = "Bunny loaded";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Sample load failed";
  }
});
// Local tiny sample JSON
const SAMPLE_SPLATS = "/models/sample_splats.json";

// File picker for splats
const splatFile = document.getElementById("splatFile") as HTMLInputElement;
splatFile.addEventListener("change", async (e: any) => {
  const f = e.target.files?.[0];
  if (!f) return;
  statusEl.textContent = "Loading splats…";
  try {
    const lower = f.name.toLowerCase();
    const obj = lower.endsWith(".ply")
      ? await loadPLYAsSplats(URL.createObjectURL(f))
      : await loadSplatJSON(f);
    view.setMainObject(obj);
    statusEl.textContent = "Splats loaded";
    applySplatTweaks();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Splat load failed";
    alert("Could not load splats.");
  } finally {
    splatFile.value = "";
  }
});

document.getElementById("sampleSplats")!.addEventListener("click", async () => {
  statusEl.textContent = "Loading sample splats…";
  try {
    const obj = await loadSplatJSON(SAMPLE_SPLATS);
    view.setMainObject(obj);
    applySplatTweaks();
    statusEl.textContent = "Sample splats loaded";
  } catch (e) {
    console.error(e);
    statusEl.textContent = "Sample splats failed";
  }
});

// Tweaks
const sigma = document.getElementById("sigma") as HTMLInputElement;
const sOpacity = document.getElementById("sOpacity") as HTMLInputElement;
function applySplatTweaks() {
  const obj = view.mainObject as any;
  if (!obj) return;
  if (obj instanceof (THREE.Points as any)) {
    (obj as any).sigmaPixels = parseFloat(sigma.value);
    (obj as any).globalOpacity = parseFloat(sOpacity.value);
  }
}
sigma.oninput = sOpacity.oninput = applySplatTweaks;

// --- Drag & drop on the right view
const dropZone = document.getElementById("right")!;
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
});
// drag & drop (supports folder/multi-file drops)
dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  const files = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
  if (!files.length) return;
  statusEl.textContent = "Loading mesh…";
  try {
    const obj = await loadAny(files.length === 1 ? files[0] : files);
    view.setMainObject(obj);
    statusEl.textContent = "Mesh loaded";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Load failed (see console)";
    alert("Could not load that selection. See console for details.");
  }
});

const FLIP_X = false;

// Debouncers + pinch state
const pinchDebR = new Debounce(80),
  pinchDebL = new Debounce(80);
let wasPinchingRight = false;

async function setupWebcam() {
  statusEl.textContent = "Requesting camera…";
  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
      facingMode: "user",
    },
    audio: false,
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = stream.getVideoTracks()[0];
    const settings = track.getSettings();

    camEl.textContent =
      track.label && track.label.trim()
        ? track.label
        : settings.deviceId || "Default";
    resEl.textContent = `${settings.width}×${settings.height}`;

    video.srcObject = stream;
    await video.play();
    await new Promise<void>((r) =>
      video.videoWidth ? r() : (video.onloadedmetadata = () => r())
    );

    statusEl.textContent = "Camera ready";
    startFPSCounter();
    await startHandTracker();
  } catch (err: any) {
    console.error(err);
    statusEl.textContent = "Camera error (see console)";
    alert(
      "Could not access the webcam. Please allow camera permission and reload."
    );
  }
}

async function startHandTracker() {
  statusEl.textContent = "Loading hand model…";

  const onHands = (hands: HandFrame[]) => {
    handsEl.textContent = String(hands.length);
    statusEl.textContent = hands.length ? "Tracking hands" : "No hands";

    const right = hands.find((h) => h.handedness === "Right");
    const left = hands.find((h) => h.handedness === "Left");

    // --- fingertip → cursor
    if (right && right.landmarks.length >= 9) {
      const tip = right.landmarks[8]; // index fingertip
      let nx = (FLIP_X ? 1 - tip.x : tip.x) * 2 - 1;
      const ny = -(tip.y * 2 - 1);
      view.setCursorFromNDC(nx, ny, 1.0);
    }

    // --- gestures
    const gR: Gesture = right ? classifySingleHand(right) : "None";
    const gL: Gesture = left ? classifySingleHand(left) : "None";

    // Debounce pinch label
    const now = performance.now();
    const pinchR = pinchDebR.on(gR === "Pinch", now);
    const pinchL = pinchDebL.on(gL === "Pinch", now);

    let label = "—";
    if (pinchR) label = "Right: Pinch";
    else if (pinchL) label = "Left: Pinch";
    else if (gR !== "None") label = `Right: ${gR}`;
    else if (gL !== "None") label = `Left: ${gL}`;
    gestureChip!.textContent = `Gesture: ${label}`;

    // --- pick/drag with right-hand pinch
    const isPinchingRight = pinchR || gR === "Pinch"; // combine debounced + raw
    if (isPinchingRight && !wasPinchingRight) {
      // pinch started
      view.startDrag();
    } else if (!isPinchingRight && wasPinchingRight) {
      // pinch ended
      view.endDrag();
    }
    wasPinchingRight = isPinchingRight;
  };

  const tracker = new HandTracker(video, overlay, onHands);
  await tracker.init();
  statusEl.textContent = "Tracking hands";
}

function startFPSCounter() {
  let last = performance.now(),
    frames = 0,
    acc = 0;
  const tick = (now: number) => {
    const dt = now - last;
    last = now;
    frames++;
    acc += dt;
    if (acc >= 500) {
      fpsEl.textContent = String(Math.round((frames * 1000) / acc));
      frames = 0;
      acc = 0;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

setupWebcam();
