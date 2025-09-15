export type Handed = "Left" | "Right";
export interface Landmark {
  x: number;
  y: number;
  z: number;
} // normalized [0..1], origin top-left
export interface HandFrame {
  handedness: Handed;
  landmarks: Landmark[]; // 21 points
  time: number; // ms
}

export type OnHands = (hands: HandFrame[]) => void;

const VISION_BUNDLE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";
const HAND_TASK_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

/**
 * HandTracker — minimal wrapper that:
 * - loads the MediaPipe Tasks vision bundle & hand model from CDN
 * - runs detectForVideo() on each animation frame (throttled)
 * - draws landmarks on a provided 2D canvas
 * - emits a clean array of hands via onHands()
 */
export class HandTracker {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHands: OnHands;
  private running = false;
  private handLandmarker: any; // typed 'any' since we load via CDN

  constructor(
    video: HTMLVideoElement,
    overlayCanvas: HTMLCanvasElement,
    onHands: OnHands
  ) {
    this.video = video;
    this.canvas = overlayCanvas;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas not supported");
    this.ctx = ctx;
    this.onHands = onHands;
  }

  async init() {
    // Dynamic import from CDN
    const vision: any = await import(/* @vite-ignore */ VISION_BUNDLE_URL);
    const { FilesetResolver, HandLandmarker } = vision;

    const filesetResolver = await FilesetResolver.forVisionTasks(WASM_ROOT);
    this.handLandmarker = await HandLandmarker.createFromOptions(
      filesetResolver,
      {
        baseOptions: { modelAssetPath: HAND_TASK_URL },
        runningMode: "VIDEO",
        numHands: 2,
      }
    );

    // Match canvas backing size to the actual video pixels
    this.resizeToVideo();
    window.addEventListener("resize", () => this.resizeToVideo());

    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.handLandmarker) this.handLandmarker.close();
  }

  private resizeToVideo() {
    const vw = this.video.videoWidth || this.video.clientWidth;
    const vh = this.video.videoHeight || this.video.clientHeight;
    if (vw && vh) {
      this.canvas.width = vw;
      this.canvas.height = vh;
    }
  }

  private loop = () => {
    if (!this.running) return;
    const now = performance.now();

    // Draw current frame’s landmarks
    const results = this.handLandmarker?.detectForVideo(this.video, now);
    const hands: HandFrame[] = [];

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (results?.landmarks?.length) {
      // results.landmarks: Landmark[][] (normalized), results.handedness: categories per hand
      for (let i = 0; i < results.landmarks.length; i++) {
        const lm = results.landmarks[i];
        const label = results.handedness?.[i]?.[0]?.categoryName || "Right";
        const handedness: Handed = label === "Left" ? "Left" : "Right";

        // Draw points and short bones
        this.drawHand(lm, handedness);

        hands.push({
          handedness,
          landmarks: lm.map((p: any) => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
          time: now,
        });
      }
    }

    // Emit to app
    this.onHands(hands);

    requestAnimationFrame(this.loop);
  };


  private drawHand(lm: any[], handed: Handed) {
    // Convert normalized → pixel
    const W = this.canvas.width,
      H = this.canvas.height;
    const px = (i: number) => lm[i].x * W;
    const py = (i: number) => lm[i].y * H;

    // Bones (light)
    const bones: [number, number][] = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4], // thumb
      [0, 5],
      [5, 6],
      [6, 7],
      [7, 8], // index
      [0, 9],
      [9, 10],
      [10, 11],
      [11, 12], // middle
      [0, 13],
      [13, 14],
      [14, 15],
      [15, 16], // ring
      [0, 17],
      [17, 18],
      [18, 19],
      [19, 20], // pinky
    ];

    this.ctx.lineWidth = 2;
    this.ctx.globalAlpha = 0.9;
    this.ctx.strokeStyle = handed === "Left" ? "#6de38e" : "#69b3ff";
    this.ctx.fillStyle = handed === "Left" ? "#6de38e" : "#69b3ff";

    this.ctx.beginPath();
    for (const [a, b] of bones) {
      this.ctx.moveTo(px(a), py(a));
      this.ctx.lineTo(px(b), py(b));
    }
    this.ctx.stroke();

    // Joints
    for (let i = 0; i < lm.length; i++) {
      this.ctx.beginPath();
      this.ctx.arc(px(i), py(i), 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Label
    this.ctx.font = "12px system-ui";
    this.ctx.fillText(handed, px(0) + 8, py(0) - 8);
  }
}
