import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader";

/** Accepts a File, a list/array of Files (OBJ+MTL+textures, GLTF+BIN), or a URL string. */
export async function loadAny(
  src: File | File[] | FileList | string
): Promise<THREE.Object3D> {
  // Build a local file map if multiple files are provided (drag & drop a folder or multi-select)
  const files = toFileArray(src);
  const hasMany = files.length > 1;
  const fm = hasMany ? new FileMap(files) : null;

  // Determine main entry
  const mainUrl = hasMany ? fm!.mainUrl() : await toObjectURL(src as any);
  const ext = extLower(mainUrl);

  // Use a LoadingManager so relative paths inside assets resolve to our in-memory file map
  const manager = new THREE.LoadingManager();
  if (fm) fm.applyTo(manager);

  try {
    if (ext === "glb" || ext === "gltf") {
      const gltfLoader = new GLTFLoader(manager);
      const gltf = await gltfLoader.loadAsync(mainUrl);
      const root = gltf.scene || gltf.scenes?.[0] || new THREE.Group();
      beautifyObject(root);
      normalizeObject(root, 1.0);
      return root;
    }

    if (ext === "obj") {
      const objLoader = new OBJLoader(manager);

      // If there is an MTL in the provided files, load & apply it
      const mtlUrl = fm?.findByExt("mtl");
      if (mtlUrl) {
        const mtlLoader = new MTLLoader(manager);
        const materials = await mtlLoader.loadAsync(mtlUrl);
        if (materials?.preload) materials.preload();
        if (materials) (objLoader as any).setMaterials(materials);
      }

      const group = await objLoader.loadAsync(mainUrl);
      const root: THREE.Object3D = group;
      beautifyObject(root);
      normalizeObject(root, 1.0);
      return root;
    }

    if (ext === "ply") {
      const plyLoader = new PLYLoader(manager);
      const geo = await plyLoader.loadAsync(mainUrl);
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ metalness: 0, roughness: 1 })
      );
      beautifyObject(mesh);
      normalizeObject(mesh, 1.0);
      return mesh;
    }

    throw new Error("Unsupported file type: " + ext);
  } finally {
    if (!fm && typeof src !== "string") {
      // single file — revoke its temporary object URL
      revokeObjectURL(mainUrl);
    }
  }
}

/* ---------- helpers ---------- */

function extLower(url: string): string {
  const q = url.split("?")[0];
  const n = q.split("#")[0];
  const p = n.split(".");
  return (p[p.length - 1] || "").toLowerCase();
}

function beautifyObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as any;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

function normalizeObject(obj: THREE.Object3D, targetSize = 1.0) {
  const box = new THREE.Box3().setFromObject(obj);
  if (box.isEmpty()) return;
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxSide = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxSide;
  obj.scale.setScalar(scale);

  // Recompute & place on floor
  const box2 = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  obj.position.sub(center);
  const minY = box2.min.y - center.y;
  obj.position.y -= minY;
}

function toFileArray(src: File | File[] | FileList | string): File[] {
  if (typeof src === "string") return [];
  if (src instanceof File) return [src];
  if (Array.isArray(src)) return src;
  // FileList
  return Array.from(src);
}

function revokeObjectURL(u: string) {
  if (u.startsWith("blob:")) URL.revokeObjectURL(u);
}

async function toObjectURL(src: File | string): Promise<string> {
  if (typeof src === "string") return src;
  return URL.createObjectURL(src);
}

/** Maps dropped files to URLs so loaders can request dependent files by relative path. */
class FileMap {
  private map: Map<string, string>;
  private entries: { name: string; url: string }[];

  constructor(files: File[]) {
    this.map = new Map();
    this.entries = files.map((f) => {
      const url = URL.createObjectURL(f);
      const name = basename(f.name).toLowerCase();
      this.map.set(name, url);
      return { name, url };
    });
  }

  applyTo(manager: THREE.LoadingManager) {
    manager.setURLModifier = ((url: string) => {
      // strip path to a base file name, try to match (case-insensitive)
      const base = basename(url).toLowerCase();
      const hit = this.map.get(base);
      return hit || url;
    }) as any;
  }

  mainUrl(): string {
    // pick a likely entry file (.glb, .gltf, .obj, .ply), prefer GLB
    const pref = ["glb", "gltf", "obj", "ply"];
    for (const ext of pref) {
      const hit = this.entries.find((e) => e.name.endsWith("." + ext));
      if (hit) return hit.url;
    }
    // fallback: first file
    return this.entries[0]?.url || "";
  }

  findByExt(ext: string): string | null {
    ext = ext.toLowerCase();
    const hit = this.entries.find((e) => e.name.endsWith("." + ext));
    return hit ? hit.url : null;
  }
}

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}
