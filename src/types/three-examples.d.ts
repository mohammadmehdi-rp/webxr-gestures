declare module "three/examples/jsm/controls/OrbitControls" {
  import { Camera, EventDispatcher, MOUSE, TOUCH, Vector3 } from "three";

  export class OrbitControls extends EventDispatcher {
    constructor(object: Camera, domElement?: HTMLElement);

    // commonly used properties
    object: Camera;
    domElement: HTMLElement | null;
    enabled: boolean;

    target: Vector3; 
    minDistance: number;
    maxDistance: number;
    minZoom: number;
    maxZoom: number;

    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;

    enableDamping: boolean;
    dampingFactor: number;

    enableZoom: boolean;
    zoomSpeed: number;
    enableRotate: boolean;
    rotateSpeed: number;
    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;
    keyPanSpeed: number;

    autoRotate: boolean;
    autoRotateSpeed: number;

    keys: { LEFT: string; UP: string; RIGHT: string; BOTTOM: string };
    mouseButtons: { LEFT: MOUSE; MIDDLE: MOUSE; RIGHT: MOUSE };
    touches: { ONE: TOUCH; TWO: TOUCH };

    // common methods
    update(): void;
    saveState(): void;
    reset(): void;
    dispose(): void;
    getPolarAngle(): number;
    getAzimuthalAngle(): number;
    listenToKeyEvents(domElement: HTMLElement): void;
  }
}

declare module "three/examples/jsm/loaders/GLTFLoader" {
  import {
    AnimationClip,
    LoadingManager,
    Object3D,
    Group,
    Loader,
  } from "three";

  export interface GLTF {
    scene: Object3D;
    scenes: Object3D[];
    animations: AnimationClip[];
    cameras?: Object3D[];
    asset?: any;
    parser?: any;
    userData?: any;
  }

  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ): void;
    loadAsync(
      url: string,
      onProgress?: (event: ProgressEvent<EventTarget>) => void
    ): Promise<GLTF>;
    setPath(path: string): this;
    setResourcePath(path: string): this;
    setCrossOrigin(value: string): this;
    parse(
      data: ArrayBuffer | string,
      path: string,
      onLoad: (gltf: GLTF) => void,
      onError?: (event: unknown) => void
    ): void;
  }
}

declare module "three/examples/jsm/loaders/OBJLoader" {
  import { Group, LoadingManager, Loader } from "three";

  export class OBJLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (group: Group) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ): void;
    loadAsync(
      url: string,
      onProgress?: (event: ProgressEvent<EventTarget>) => void
    ): Promise<Group>;
    parse(text: string): Group;
    setPath(path: string): this;
    setMaterials(materials: any): this;
  }
}

declare module "three/examples/jsm/loaders/PLYLoader" {
  import { BufferGeometry, LoadingManager, Loader } from "three";

  export class PLYLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (geometry: BufferGeometry) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ): void;
    loadAsync(
      url: string,
      onProgress?: (event: ProgressEvent<EventTarget>) => void
    ): Promise<BufferGeometry>;
    parse(data: ArrayBuffer | string): BufferGeometry;
    setPropertyNameMapping(mapping: Record<string, string>): this;
  }
}

declare module "three/examples/jsm/loaders/MTLLoader" {
  import { Loader, LoadingManager } from "three";
  export class MTLLoader extends Loader {
    constructor(manager?: LoadingManager);
    setMaterialOptions(options: Record<string, any>): this;
    load(
      url: string,
      onLoad: (materials: any) => void,
      onProgress?: (e: ProgressEvent<EventTarget>) => void,
      onError?: (e: unknown) => void
    ): void;
    loadAsync(
      url: string,
      onProgress?: (e: ProgressEvent<EventTarget>) => void
    ): Promise<any>;
    parse(text: string, path: string): any;
    setTexturePath(path: string): this;
  }
}

declare module "three/examples/jsm/webxr/VRButton" {
  import { WebGLRenderer } from "three";

  export class VRButton {
    /** Creates and returns the DOM button that toggles WebXR VR sessions. */
    static createButton(renderer: WebGLRenderer): HTMLButtonElement;

    /** True if the browser has already granted an XR session. */
    static xrSessionIsGranted: boolean;

    /** (Optional) Some builds expose this helper; keep it optional. */
    static registerSessionGrantedListener?(renderer: WebGLRenderer): void;
  }
}

declare module "three/examples/jsm/webxr/XRHandModelFactory" {
  import { Object3D } from "three";
  export class XRHandModelFactory {
    createHandModel(
      hand: Object3D,
      model?: "mesh" | "spheres" | "boxes"
    ): Object3D;
  }
}
