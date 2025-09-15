import { SplatCloud, type SplatPoint } from "./splatViewer";
import * as THREE from "three";

// JSON format we support:
// { "points":[ {"p":[x,y,z], "rgb":[r,g,b], "a":0.8, "size":0.03}, ... ] }
export async function loadSplatJSON(src: File | string): Promise<SplatCloud> {
  const text =
    typeof src === "string"
      ? await (await fetch(src)).text()
      : await src.text();
  const json = JSON.parse(text);
  const pts: SplatPoint[] = (json.points || []) as SplatPoint[];
  const cloud = new SplatCloud(pts);
  normalizeObject(cloud, 1.0);
  return cloud;
}

// Fallback: load a PLY as colored points; give every point a default size
export async function loadPLYAsSplats(url: string): Promise<SplatCloud> {
  const THREE_ANY = THREE as any;
  const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader");
  const loader = new PLYLoader();
  const geo = await loader.loadAsync(url);
  // If PLY has colors, THREE's PLYLoader will include them as attributes 'color'
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const col = geo.getAttribute("color") as THREE.BufferAttribute | undefined;

  const pts: SplatPoint[] = [];
  for (let i = 0; i < pos.count; i++) {
    const p: [number, number, number] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    let rgb: [number, number, number] | undefined;
    if (col) rgb = [col.getX(i), col.getY(i), col.getZ(i)];
    pts.push({ p, rgb, size: 0.02, a: 1.0 });
  }
  const cloud = new SplatCloud(pts);
  normalizeObject(cloud, 1.0);
  return cloud;
}

function normalizeObject(obj: THREE.Object3D, targetSize = 1.0) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxSide = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxSide;
  obj.scale.setScalar(scale);

  const box2 = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  obj.position.sub(center);
  const minY = box2.min.y - center.y;
  obj.position.y -= minY;
}
