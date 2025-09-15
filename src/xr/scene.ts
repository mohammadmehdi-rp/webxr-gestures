import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { VRButton } from "three/examples/jsm/webxr/VRButton";
import { XRHandModelFactory } from "three/examples/jsm/webxr/XRHandModelFactory";

export class View3D {
  container: HTMLElement;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
  });
  controls: OrbitControls;
  handL!: THREE.Group;
  handR!: THREE.Group;
  pinchActive = { left: false, right: false };
  grabbingHand: "left" | "right" | null = null;

  raycaster = new THREE.Raycaster();
  ndc = new THREE.Vector2(0, 0);
  cursor = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 16, 16),
    new THREE.MeshStandardMaterial({
      emissive: 0x333333,
      metalness: 0,
      roughness: 1,
    })
  );

  // pick/drag (desktop gesture)
  objects: THREE.Object3D[] = [];
  hovered: THREE.Mesh | null = null;
  dragging: {
    obj: THREE.Mesh;
    plane: THREE.Plane;
    offset: THREE.Vector3;
  } | null = null;

  // XR controller grab
  controller1!: THREE.Group;
  controller2!: THREE.Group;
  controllerGrabbing: {
    controller: THREE.Object3D;
    prevParent: THREE.Object3D | null;
  } | null = null;

  mainObject: THREE.Object3D | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    // renderer
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)); // cap DPI
    this.renderer.shadowMap.enabled = false; // we don’t need shadowing here
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.xr.enabled = true; // XR on
    this.renderer.xr.setReferenceSpaceType("local-floor");
    container.appendChild(this.renderer.domElement);
    container.appendChild(VRButton.createButton(this.renderer)); // shows "Enter VR"

    // Exit VR button + Esc
    const exitBtn = document.createElement("button");
    exitBtn.id = "xrExit";
    exitBtn.textContent = "Exit VR (Esc)";
    exitBtn.style.display = "none"; // start hidden
    document.body.appendChild(exitBtn);

    const endXR = () => this.renderer.xr.getSession()?.end();
    exitBtn.onclick = endXR;
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") endXR();
    });
    this.renderer.xr.addEventListener("sessionstart", () => {
      document.getElementById("left")!.style.display = "none";
    });
    this.renderer.xr.addEventListener("sessionend", () => {
      document.getElementById("left")!.style.display = "";
    });

    // Show/hide with session lifecycle
    this.renderer.xr.addEventListener("sessionstart", () => {
      exitBtn.style.display = "block";
    });
    this.renderer.xr.addEventListener("sessionend", () => {
      exitBtn.style.display = "none";
    });

    // camera & controls (controls disabled in XR automatically)
    this.camera.position.set(0, 1.4, 2.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // scene basics
    this.scene.background = new THREE.Color(0x0a0c10);
    const amb = new THREE.AmbientLight(0xffffff, 0.5);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 5, 2);
    dir.castShadow = true;
    this.scene.add(amb, dir);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x2a2f3a,
        metalness: 0,
        roughness: 1,
      })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // demo cube (will be replaced by setMainObject())
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshStandardMaterial({
        color: 0x6aa9ff,
        metalness: 0.1,
        roughness: 0.7,
      })
    );
    cube.position.set(0, 0.3, -0.2);
    this.setMainObject(cube);

    // cursor
    this.cursor.castShadow = false;
    this.cursor.receiveShadow = false;
    this.scene.add(this.cursor);

    // XR controllers
    this.initXRControllers();
    this.initXRHands();
    this.renderer.xr.addEventListener("sessionstart", () => {
      document.body.classList.add("xr-active");
      this.onResize(); // re-measure container and resize canvas
      this.placeModelInFrontOfXRCamera?.();
    });
    this.renderer.xr.addEventListener("sessionend", () => {
      document.body.classList.remove("xr-active");
      this.onResize();
    });
    // sizing
    this.onResize();
    window.addEventListener("resize", () => this.onResize());

    // XR-safe loop
    this.renderer.setAnimationLoop(this.animate);
  }

  private initXRHands() {
    // WebXR hands (index 0 = left, 1 = right in most runtimes)
    this.handL = this.renderer.xr.getHand(0);
    this.handR = this.renderer.xr.getHand(1);

    // simple visual so you can see joints
    const factory = new XRHandModelFactory();
    this.handL.add(factory.createHandModel(this.handL, "spheres"));
    this.handR.add(factory.createHandModel(this.handR, "spheres"));

    this.scene.add(this.handL, this.handR);
  }

  /** Returns true if pinch (thumb-tip close to index-tip) */
  private isPinching(hand: THREE.Group, threshold = 0.025): boolean {
    const h: any = hand as any;
    if (!h.joints) return false;
    const tip = h.joints["index-finger-tip"];
    const thumb = h.joints["thumb-tip"];
    if (!tip || !thumb) return false;

    const a = new THREE.Vector3().setFromMatrixPosition(tip.matrixWorld);
    const b = new THREE.Vector3().setFromMatrixPosition(thumb.matrixWorld);
    return a.distanceTo(b) <= threshold; // ~2.5 cm
  }

  private updateXRHands() {
    if (!this.handL || !this.handR) return;
    // detect pinch per hand
    const pinL = this.isPinching(this.handL);
    const pinR = this.isPinching(this.handR);

    // start grab
    if (!this.grabbingHand && this.mainObject) {
      if (pinR) {
        (this.handR as any).attach(this.mainObject);
        this.grabbingHand = "right";
      } else if (pinL) {
        (this.handL as any).attach(this.mainObject);
        this.grabbingHand = "left";
      }
    }

    // release
    if (this.grabbingHand === "right" && !pinR) {
      (this.scene as any).attach(this.mainObject!);
      this.grabbingHand = null;
    } else if (this.grabbingHand === "left" && !pinL) {
      (this.scene as any).attach(this.mainObject!);
      this.grabbingHand = null;
    }
  }

  private placeModelInFrontOfXRCamera(distance = 1.2) {
    if (!this.mainObject) return;
    const xrCam = this.renderer.xr.getCamera(); // ArrayCamera in XR
    const headPos = new THREE.Vector3().setFromMatrixPosition(
      xrCam.matrixWorld
    );
    const fwd = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(xrCam.quaternion)
      .normalize();
    const pos = headPos.clone().add(fwd.multiplyScalar(distance));
    // keep the model on the floor (y=0) since we normalized it to rest on y=0
    pos.y = 0;
    this.mainObject.position.copy(pos);
    // optional: face the user
    this.mainObject.lookAt(new THREE.Vector3(headPos.x, 0, headPos.z));
  }

  onResize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    const o: any = this.mainObject;
    if (o?.isSplatCloud && o.updateViewportScale) {
      o.updateViewportScale(this.renderer);
    }
  }

  setCursorFromNDC(nx: number, ny: number, depth = 1.0) {
    this.ndc.set(nx, ny);
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(nx, ny, 0.5)
      .unproject(this.camera)
      .sub(origin)
      .normalize();
    this.cursor.position.copy(origin).add(dir.multiplyScalar(depth));
  }

  private animate = () => {
    if (this.renderer.xr.isPresenting) {
      // XR: update hand pinch/grab each frame
      this.updateXRHands();
    } else {
      // Desktop: only do hover/drag picking outside XR
      this.updatePicking();
      this.controls.update();
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updatePicking() {
    if (!this.objects.length || this.dragging) {
      // keep dragging branch, but skip expensive "hover" when splats or nothing
      if (!this.dragging) return;
    }
    this.raycaster.setFromCamera(this.ndc, this.camera);

    if (this.dragging) {
      const intersectPoint = new THREE.Vector3();
      const ray = this.raycaster.ray;
      this.dragging.plane.intersectLine(
        new THREE.Line3(
          ray.origin,
          ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))
        ),
        intersectPoint
      );
      this.dragging.obj.position.copy(intersectPoint.add(this.dragging.offset));
      return;
    }

    const hits = this.raycaster.intersectObjects(
      this.objects,
      false
    ) as THREE.Intersection<THREE.Mesh>[];
    const top = hits.length ? hits[0].object : null;

    if (top !== this.hovered) {
      if (this.hovered) {
        const m = this.hovered.material as THREE.MeshStandardMaterial;
        m.emissive?.set(0x000000);
        this.hovered.scale.setScalar(1);
      }
      this.hovered = top;
      if (this.hovered) {
        const m = this.hovered.material as THREE.MeshStandardMaterial;
        if (m.emissive) m.emissive.set(0x223344);
        this.hovered.scale.setScalar(1.04);
      }
    }
  }

  // ---------- public API you already use ----------
  addPickablesFrom(root: THREE.Object3D) {
    root.traverse((o) => {
      const m = o as any;
      if (m.isMesh) this.objects.push(m); // Points won't be added (good)
    });
  }
  clearPickables() {
    this.objects.length = 0;
  }

  setMainObject(obj: THREE.Object3D) {
    if (this.mainObject) this.scene.remove(this.mainObject);
    this.mainObject = obj;
    this.scene.add(obj);
    const o: any = obj;
    if (o?.isSplatCloud && o.updateViewportScale) {
      o.updateViewportScale(this.renderer);
    }
    this.clearPickables();
    this.addPickablesFrom(obj);
    this.frameObject(obj);
  }

  frameObject(obj: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const maxSide = Math.max(size.x, size.y, size.z);
    const dist =
      (maxSide * 1.8) /
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
    const dir = new THREE.Vector3(0, 0.2, 1).normalize();
    this.camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
  }

  startDrag(): boolean {
    if (!this.mainObject) return false;
    this.raycaster.setFromCamera(this.ndc, this.camera);

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir).normalize();

    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      camDir,
      this.mainObject.position.clone()
    );

    const ray = this.raycaster.ray;
    const line = new THREE.Line3(
      ray.origin,
      ray.origin.clone().add(ray.direction.clone().multiplyScalar(100))
    );
    const hit = new THREE.Vector3();
    if (!dragPlane.intersectLine(line, hit)) return false;

    const offset = this.mainObject.position.clone().sub(hit);
    this.dragging = {
      obj: this.mainObject as THREE.Mesh,
      plane: dragPlane,
      offset,
    };
    return true;
  }

  endDrag() {
    this.dragging = null;
  }

  // ---------- XR controllers ----------
  private initXRControllers() {
    const c1 = this.renderer.xr.getController(0);
    const c2 = this.renderer.xr.getController(1);
    this.controller1 = c1;
    this.controller2 = c2;

    // a tiny pointer visual so you see where controllers are
    const pointerGeo = new THREE.CylinderGeometry(0.002, 0.002, 0.08, 8);
    const pointerMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mkPointer = () => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(pointerGeo, pointerMat);
      m.rotation.x = Math.PI / 2;
      m.position.z = -0.04;
      g.add(m);
      return g;
    };

    c1.add(mkPointer());
    c2.add(mkPointer());
    this.scene.add(c1, c2);

    // Grab the whole mainObject while pressing trigger/squeeze
    const onStart = (e: any) => this.startXRGrab(e.target as THREE.Object3D);
    const onEnd = () => this.endXRGrab();

    c1.addEventListener("selectstart", onStart);
    c1.addEventListener("selectend", onEnd);
    c1.addEventListener("squeezestart", onStart);
    c1.addEventListener("squeezeend", onEnd);

    c2.addEventListener("selectstart", onStart);
    c2.addEventListener("selectend", onEnd);
    c2.addEventListener("squeezestart", onStart);
    c2.addEventListener("squeezeend", onEnd);
  }

  private startXRGrab(controller: THREE.Object3D) {
    if (!this.mainObject || this.controllerGrabbing) return;
    // attach(child) preserves world transform (no math needed)
    const prevParent = this.mainObject.parent || this.scene;
    (controller as any).attach(this.mainObject);
    this.controllerGrabbing = { controller, prevParent };
  }

  private endXRGrab() {
    if (!this.mainObject || !this.controllerGrabbing) return;
    const { prevParent } = this.controllerGrabbing;
    (prevParent as any).attach(this.mainObject);
    this.controllerGrabbing = null;
  }
}
