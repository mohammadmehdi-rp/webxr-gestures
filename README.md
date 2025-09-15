# Gesture-Based Hand Tracking UI in WebXR

A browser app that lets you manipulate 3D content with **hand gestures** (webcam), **VR controllers**, and **XR hand-tracking pinches**. Supports standard meshes (**GLB/GLTF**, **OBJ+MTL+textures**, **PLY**) and a lightweight **Gaussian splats** viewer (JSON & PLY). Built with **Three.js**, **WebXR**, and **MediaPipe Hands**—fully client-side.


## ✨ Features

* **Webcam hand tracking** → gestures: *Pinch, Open, Fist, Point* (debounced + smoothed)
* **Three.js scene**: fingertip cursor, hover highlight, **pinch-to-drag** active model
* **Loaders**

  * GLB/GLTF (PBR), OBJ **with MTL + textures**, PLY
  * Drag-and-drop **multi-file** sets (OBJ+MTL+PNGs) and file picker
  * Sample buttons (Helmet, Fox, Bunny/local)
* **Gaussian splats** (isotropic point sprites) with **σ** (softness) & **opacity** sliders
* **WebXR VR**

  * Enter/Exit VR (local-floor), fullscreen XR layout
  * **Controller grab** (trigger/squeeze)
  * **XR hand pinch-grab** (Quest); optional **two-hand pinch** to scale/rotate
* **Performance**: AA off, DPR cap, throttled landmark inference, PLY downsample, raycast throttling

## 🧱 Project Structure

```
src/
  input/
    hands.ts            # MediaPipe wrapper + canvas overlay
    gestures.ts         # geometric gesture classifier + debounce
    smoothing.ts        # Debounce helper (erasableSyntaxOnly-safe)
  xr/
    scene.ts            # View3D: renderer, scene, picking, VR, controllers, hands
    loaders.ts          # GLTF/OBJ+MTL/PLY + multi-file URL map + normalize/frame
  splats/
    splatViewer.ts      # ShaderMaterial-based isotropic Gaussian sprites
    loadSplat.ts        # JSON & PLY → splats (+normalize, downsample)
  types/
    three-examples.d.ts # minimal shims (examples typings)
public/
  models/
    sample_splats.json  # tiny demo
    bunny.ply           # (put your local copy here)
index.html, style.css, main.ts, vite.config.ts, tsconfig.json
```

## 🚀 Quick Start

```bash
# 1) Install
npm i

# 2) Dev (HTTP on desktop)
npm run dev
# open the printed URL

# 3) Production
npm run build
npm run preview
```

### VR on Quest (HTTPS)

WebXR on a headset needs **HTTPS** (non-localhost):

```bash
npm i -D @vitejs/plugin-basic-ssl
```

`vite.config.ts`

```ts
import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
export default defineConfig({
  plugins: [basicSsl()],
  server: { https: true, host: true } // exposes LAN IP over HTTPS
});
```

* On Quest: open **https\://<YOUR-LAN-IP>:5173/** in the **Meta Quest Browser**.
* Quest settings → **Hand tracking: ON**. Site permissions → allow **Hand tracking**.
* Put controllers down to switch to hands.

In code (already set):

```ts
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local-floor");
renderer.xr.setSessionInit({
  requiredFeatures: ["local-floor"],
  optionalFeatures: ["hand-tracking", "layers"]
});
```

## 🎮 How to Use

### Desktop (webcam)

* **Pointing:** move right index fingertip — a small sphere cursor follows.
* **Pick/Drag:** **pinch** (thumb+index) to grab the active model; move; release to drop.
* **HUD:** gesture label, FPS, camera info.

### VR (WebXR)

* **Enter VR:** click the button; scene goes full-width.
* **Controllers:** **trigger/squeeze** to grab/release the model.
* **Hands (Quest):** **pinch** to grab; *(optional)* **two-hand pinch** → scale by distance, rotate by yaw twist.
* **Exit VR:** “Exit VR (Esc)” button, **Esc**, or the VRButton toggle.

## 🧪 No-Headset Testing (WebXR Emulator Plugin)

You can exercise VR paths without a headset using a DevTools extension.

**Plugins (pick one):**

* **WebXR API Emulator** (Mozilla MR) — Chrome/Edge/Firefox
* **Immersive Web Emulator (IWE)** — Chrome/Edge

**Setup:**

1. Install the extension, open your app, then **DevTools → “WebXR”** tab.
2. Pick a device profile (e.g., *Oculus Quest 2*).
3. Enable **Emulate pose with mouse & keyboard**

   * Right-mouse drag = look; **W/A/S/D** = move; **Q/E** = down/up.
4. **Input Sources → Add** a **Left/Right Controller** or **Left/Right Hand**.
5. Reload, click **Enter VR**, and use panel buttons to trigger **select/squeeze** or **pinch**.
6. End session via our **Exit VR** button or the emulator’s **End session**.

**Notes:** Emulators approximate poses/latency; hand emulation varies. Disable the emulator when testing on real hardware.

## 📦 Loading Assets

* **Sample buttons:** Helmet (GLB), Fox (GLTF), Bunny (PLY/local).
* **File picker / Drag-and-drop:**

  * **OBJ**: select **.obj + .mtl + textures/** together (multi-select).
  * **GLTF**: select **.gltf + .bin + textures/** or use a **.glb**.
  * **PLY**: loads as mesh via `loadAny(...)`; or as **splats** via *Load Splats…*.

> If a remote URL 404s/CORS-blocks, copy files into **`/public/models/`** and load via `/models/...`.

## 🌈 Gaussian Splats (JSON format)

`/public/models/sample_splats.json` example:

```json
{
  "points": [
    { "p":[0,0.6,0],   "rgb":[1.0,0.5,0.1], "size":0.12 },
    { "p":[0.3,0.6,0], "rgb":[0.2,0.7,1.0], "size":0.10 },
    { "p":[-0.3,0.6,0],"rgb":[0.9,0.2,0.2], "size":0.10 }
  ]
}
```

* `p`: world position (meters), `rgb`: color 0..1, `size`: **world radius**.
* Use **σ** and **Opacity** sliders to tune softness/accumulation.
* For PLY as splats: load via *Load Splats…* (downsamples for performance).

## ⚙️ Configuration (tweak points)

* **Hand tracking rate:** `detectIntervalMs` in `hands.ts` (\~66 ms → \~15 Hz).
* **Pinch debounce:** `new Debounce(80)` in `main.ts` (ms).
* **Gesture thresholds:** `gestures.ts` (pinch distance, extension angles).
* **Renderer perf:** `scene.ts`

  * `antialias: false`, `setPixelRatio(Math.min(devicePixelRatio, 1.25))`, shadows off.
* **Raycast skip:** `updatePicking()` returns early when dragging or when no pickables.
* **PLY downsample (splats):** `MAX_POINTS` in `loadSplat.ts` (e.g., 30k).
* **Cursor flip:** `FLIP_X` in `main.ts` if webcam feels mirrored.

## 🧩 Type Shims

If your editor complains about Three example modules, keep minimal decls in `src/types/three-examples.d.ts` for:

* `OrbitControls`, `GLTFLoader`, `OBJLoader`, `PLYLoader`, `MTLLoader`
* `VRButton`, `XRHandModelFactory`

> Remove shims when your Three version includes these typings to avoid duplicates.

## 🛠️ Troubleshooting

* **“WebXR not supported”**

  * Use Chrome/Edge (with VR runtime) or Quest Browser; HTTPS required except `http://localhost`.
  * Check `navigator.xr` and `isSessionSupported('immersive-vr')`.
* **No hands in VR**

  * Ensure `renderer.xr.setSessionInit({ optionalFeatures: ["hand-tracking"] })`, enable hand tracking in device settings & site permissions; put controllers down.
* **OBJ is grey**

  * Load **.mtl + textures/** together, or prefer **.glb**.
* **Bunny/remote files do nothing**

  * Likely CORS—use `/public/models/...`.
* **Low FPS**

  * AA off, DPR cap (≤1.25), throttle hand detection (\~15 Hz), downsample big PLY (≤30k), skip hover raycasts on splats, optional `AdditiveBlending` for splats.

## 🧪 Demo 

1. Webcam HUD → open hand / pinch → label updates.
2. **DamagedHelmet** → hover highlight → **pinch-drag**.
3. **Fox** → confirm whole model drags (top-level object).
4. **Sample Splats** → adjust σ/opacity; drag cloud.
5. **Enter VR** → controller grab → enable **hand tracking** → pinch-grab; two-hand scale/rotate.
6. **Exit VR**.

## 📚 References 

\[1] B. Kerbl, G. Kopanas, T. Leimkühler, and G. Drettakis, “3D Gaussian Splatting for Real-Time Radiance Field Rendering,” *ACM Trans. Graph.*, vol. 42, no. 4, 2023.
\[2] W3C Immersive Web WG, “WebXR Device API,” *W3C Rec/WD*, 2025.
\[3] W3C, “WebXR Hand Input Module — Level 1,” *W3C WD*, 2024.
\[4] MDN Web Docs, “WebXR Device API — Overview & Usage,” 2025.
\[5] three.js docs, “WebXRManager,” “OrbitControls,” “Loaders.”
\[6] Khronos, “glTF 2.0 Specification,” 2021.
\[7] G. Turk, “The PLY Polygon File Format,” 1994.

## 📝 License & Attribution

* Include licenses for any third-party models in `/public/models/`.
* glTF Sample Models carry permissive licenses (see their repo).
* This template’s code is intended for academic coursework—cite appropriately.

## ✉️ Acknowledgments

* MediaPipe Hands (Google) for robust, fast landmarking in the browser.
* Three.js & the Immersive Web community for WebXR + examples.
* Khronos glTF Sample Models & Stanford/Princeton repositories for test assets.
