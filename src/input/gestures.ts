export type Handed = "Left" | "Right";
export interface Landmark {
  x: number;
  y: number;
  z: number;
}
export interface HandFrame {
  handedness: Handed;
  landmarks: Landmark[];
  time: number;
}

export type Gesture = "None" | "Open" | "Fist" | "Pinch" | "Point";

export function classifySingleHand(h: HandFrame): Gesture {
  const L = h.landmarks;
  if (!L || L.length < 21) return "None";

  const wrist = L[0];

  // helpers
  const d = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);
  const dot = (ax: number, ay: number, bx: number, by: number) =>
    ax * bx + ay * by;
  function angleCos(tip: number, pip: number, mcp: number) {
    const v1x = L[tip].x - L[pip].x,
      v1y = L[tip].y - L[pip].y;
    const v2x = L[mcp].x - L[pip].x,
      v2y = L[mcp].y - L[pip].y;
    const n1 = Math.hypot(v1x, v1y) || 1e-6,
      n2 = Math.hypot(v2x, v2y) || 1e-6;
    return dot(v1x / n1, v1y / n1, v2x / n2, v2y / n2); // ~ -1 when straight, > -0.2 when curled
  }
  function extended(tip: number, pip: number, mcp: number) {
    // combine angle + length ratio for stability
    const cos = angleCos(tip, pip, mcp); // straight ≈ -1
    const ratio = d(L[tip], wrist) / (d(L[mcp], wrist) + 1e-6); // open ≳ 1, curled < 1
    return cos < -0.35 && ratio > 0.85;
  }

  // Thumb–index pinch first (dominates other labels)
  const pinchDist = d(L[4], L[8]) / (d(L[5], wrist) + 1e-3);
  if (pinchDist < 0.35) return "Pinch";

  // Finger states
  const idxExt = extended(8, 6, 5);
  const midExt = extended(12, 10, 9);
  const rngExt = extended(16, 14, 13);
  const pkyExt = extended(20, 18, 17);

  const extCount =
    (idxExt ? 1 : 0) + (midExt ? 1 : 0) + (rngExt ? 1 : 0) + (pkyExt ? 1 : 0);

  // Point: index extended, others curled
  if (idxExt && !midExt && !rngExt && !pkyExt) return "Point";

  // Open/Fist by count
  if (extCount >= 3) return "Open";
  if (extCount <= 1) return "Fist";

  return "None";
}
