import * as THREE from "three";

export type SplatPoint = {
  p: [number, number, number]; // position (meters)
  rgb?: [number, number, number]; // 0..1
  a?: number; // unused per-point; keep for future
  size?: number; // WORLD size radius (meters) — 0.03..0.12 is good
};

function makeGaussianMaterial() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSigma: { value: 0.9 },
      uOpacity: { value: 0.9 },
      uScale: { value: 1.0 }, // updated on resize
    },
    vertexShader: `
    // Built-ins from Three: modelViewMatrix, projectionMatrix, position, color
    attribute float aSize;     // world radius (meters)
    uniform float uScale;      // drawBufferHeight / 2
    varying vec3 vColor;

    void main() {
      vColor = color;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float dist = -mv.z;
      // Match PointsMaterial attenuation; keep a sensible minimum
      gl_PointSize = max(1.0, (aSize * uScale) / max(dist, 1e-3)) * 2.0;
      gl_Position = projectionMatrix * mv;
    }
  `,
    fragmentShader: `
    precision highp float;
    varying vec3 vColor;
    uniform float uSigma;
    uniform float uOpacity;

    void main() {
      vec2 uv = gl_PointCoord * 2.0 - 1.0;
      float r2 = dot(uv, uv);
      float sigma = max(uSigma, 0.1);
      float a = exp(-r2 / (2.0 * sigma * sigma));
      if (a < 0.001) discard;
      gl_FragColor = vec4(vColor, a * uOpacity);
    }
  `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
  });

  return mat;
}

export class SplatCloud extends THREE.Points {
  private _geom: THREE.BufferGeometry;
  private _mat: THREE.ShaderMaterial;
  /** tag so View3D can detect splats */
  readonly isSplatCloud = true;

  constructor(points: SplatPoint[]) {
    const n = points.length;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const size = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const p = points[i];
      pos[i * 3 + 0] = p.p[0];
      pos[i * 3 + 1] = p.p[1];
      pos[i * 3 + 2] = p.p[2];
      const c = p.rgb ?? [1, 1, 1];
      col[i * 3 + 0] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
      size[i] = p.size ?? 0.08; 
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geom.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

    const mat = makeGaussianMaterial();
    super(geom, mat);

    this._geom = geom;
    this._mat = mat;
    this.frustumCulled = false;
  }

  set sigmaPixels(s: number) {
    this._mat.uniforms.uSigma.value = s;
  }
  set globalOpacity(a: number) {
    this._mat.uniforms.uOpacity.value = a;
  }

  /** must be called on resize so points get correct pixel size */
  updateViewportScale(renderer: THREE.WebGLRenderer) {
    // Three uses drawBufferHeight/2 as 'scale' in PointsMaterial
    const v = new THREE.Vector2();
    renderer.getDrawingBufferSize(v);
    this._mat.uniforms.uScale.value = v.y / 2;
  }
}
