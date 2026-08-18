import * as THREE from 'three';

export type KspGizmoMode = 'place' | 'offset' | 'rotate';

export class KspGizmoController {
  public group = new THREE.Group();
  public mode: KspGizmoMode = 'offset';
  public targetObject: THREE.Object3D | null = null;
  public snapEnabled = true; // Angle snap (5 deg / 15 deg) & Linear snap (5mm)

  public onDragStart?: () => void;
  public onDragEnd?: () => void;
  public onTransformChanged?: () => void;

  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  public isDragging = false;
  private activeHandle: string | null = null;

  // Drag calculation variables
  private initialObjectPos = new THREE.Vector3();
  private initialObjectRot = new THREE.Euler();
  private dragPlane = new THREE.Plane();
  private dragPlaneIntersect = new THREE.Vector3();
  private dragStartIntersect = new THREE.Vector3();
  private dragAxisVector = new THREE.Vector3();

  // Visual Groups
  private offsetGroup = new THREE.Group();
  private rotateGroup = new THREE.Group();
  private hitboxes: THREE.Mesh[] = [];

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.buildKspGizmoMeshes();
    this.group.add(this.offsetGroup);
    this.group.add(this.rotateGroup);
    this.group.visible = false;
    this.setMode('offset');

    this.bindEvents();
  }

  private buildKspGizmoMeshes() {
    const handleMat = (color: string) =>
      new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.92,
      });

    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false, depthTest: false });

    // -------------------------------------------------------------
    // 1. OFFSET GIZMO (KSP Mode 2: X Red, Y Green, Z Blue, XZ Amber Plane)
    // -------------------------------------------------------------
    // X-Axis Arrow (Red)
    const shaftX = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.16, 12), handleMat('#ef4444'));
    shaftX.rotation.z = -Math.PI / 2;
    shaftX.position.x = 0.08;
    const headX = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 16), handleMat('#ef4444'));
    headX.rotation.z = -Math.PI / 2;
    headX.position.x = 0.18;
    const pickX = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8), hitboxMat);
    pickX.rotation.z = -Math.PI / 2;
    pickX.position.x = 0.1;
    pickX.name = 'handle_offset_x';
    this.offsetGroup.add(shaftX, headX, pickX);
    this.hitboxes.push(pickX);

    // Y-Axis Arrow (Green)
    const shaftY = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.16, 12), handleMat('#10b981'));
    shaftY.position.y = 0.08;
    const headY = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 16), handleMat('#10b981'));
    headY.position.y = 0.18;
    const pickY = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8), hitboxMat);
    pickY.position.y = 0.1;
    pickY.name = 'handle_offset_y';
    this.offsetGroup.add(shaftY, headY, pickY);
    this.hitboxes.push(pickY);

    // Z-Axis Arrow (Blue)
    const shaftZ = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.16, 12), handleMat('#3b82f6'));
    shaftZ.rotation.x = Math.PI / 2;
    shaftZ.position.z = 0.08;
    const headZ = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 16), handleMat('#3b82f6'));
    headZ.rotation.x = Math.PI / 2;
    headZ.position.z = 0.18;
    const pickZ = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 8), hitboxMat);
    pickZ.rotation.x = Math.PI / 2;
    pickZ.position.z = 0.1;
    pickZ.name = 'handle_offset_z';
    this.offsetGroup.add(shaftZ, headZ, pickZ);
    this.hitboxes.push(pickZ);

    // Ground Plane Square (XZ Plane - Amber)
    const planeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 0.06),
      new THREE.MeshBasicMaterial({ color: '#f59e0b', depthTest: false, transparent: true, opacity: 0.5, side: THREE.DoubleSide })
    );
    planeMesh.rotation.x = Math.PI / 2;
    planeMesh.position.set(0.04, 0.002, 0.04);
    const pickXZ = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.08), hitboxMat);
    pickXZ.position.set(0.04, 0.002, 0.04);
    pickXZ.name = 'handle_offset_xz';
    this.offsetGroup.add(planeMesh, pickXZ);
    this.hitboxes.push(pickXZ);

    // -------------------------------------------------------------
    // 2. ROTATE GIZMO (KSP Mode 3: 3 Orthogonal Torus Rings)
    // -------------------------------------------------------------
    // Pitch Ring (X-Axis - Red)
    const ringX = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.004, 8, 48), handleMat('#ef4444'));
    ringX.rotation.y = Math.PI / 2;
    const pickRotX = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 24), hitboxMat);
    pickRotX.rotation.y = Math.PI / 2;
    pickRotX.name = 'handle_rotate_x';
    this.rotateGroup.add(ringX, pickRotX);
    this.hitboxes.push(pickRotX);

    // Yaw Ring (Y-Axis - Green)
    const ringY = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.004, 8, 48), handleMat('#10b981'));
    ringY.rotation.x = Math.PI / 2;
    const pickRotY = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 24), hitboxMat);
    pickRotY.rotation.x = Math.PI / 2;
    pickRotY.name = 'handle_rotate_y';
    this.rotateGroup.add(ringY, pickRotY);
    this.hitboxes.push(pickRotY);

    // Roll Ring (Z-Axis - Blue)
    const ringZ = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.004, 8, 48), handleMat('#3b82f6'));
    const pickRotZ = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 24), hitboxMat);
    pickRotZ.name = 'handle_rotate_z';
    this.rotateGroup.add(ringZ, pickRotZ);
    this.hitboxes.push(pickRotZ);
  }

  public attach(object: THREE.Object3D | null) {
    this.targetObject = object;
    if (object) {
      this.group.position.copy(object.position);
      this.group.visible = true;
      this.updateScale();
    } else {
      this.group.visible = false;
      this.isDragging = false;
    }
  }

  public setMode(mode: KspGizmoMode) {
    this.mode = mode;
    this.offsetGroup.visible = mode === 'offset';
    this.rotateGroup.visible = mode === 'rotate';
  }

  public toggleSnap() {
    this.snapEnabled = !this.snapEnabled;
  }

  public updateScale() {
    if (!this.targetObject || !this.group.visible) return;
    this.group.position.copy(this.targetObject.position);

    // Keep constant pixel apparent size in perspective view
    const dist = this.camera.position.distanceTo(this.group.position);
    const factor = Math.max(0.35, dist * 0.45);
    this.group.scale.set(factor, factor, factor);
  }

  private bindEvents() {
    this.domElement.addEventListener('pointerdown', this.onPointerDown, true);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
  }

  public dispose() {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown, true);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === '1') {
      this.setMode('place');
    } else if (e.key === '2' || e.key === 'w' || e.key === 'W') {
      this.setMode('offset');
    } else if (e.key === '3' || e.key === 'e' || e.key === 'E') {
      this.setMode('rotate');
    } else if (e.key === 'c' || e.key === 'C') {
      this.toggleSnap();
    } else if (e.key === 'Escape') {
      this.attach(null);
    }
  };

  private getMousePos(e: PointerEvent) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.targetObject || !this.group.visible) return;
    if (e.button !== 0) return; // Left Click Only

    this.getMousePos(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.hitboxes, false);

    if (intersects.length > 0) {
      e.stopPropagation();
      e.preventDefault();
      this.isDragging = true;
      this.activeHandle = intersects[0].object.name;

      if (this.onDragStart) this.onDragStart();

      this.initialObjectPos.copy(this.targetObject.position);
      this.initialObjectRot.copy(this.targetObject.rotation);

      // Define calculation plane facing camera or aligned with axes
      if (this.activeHandle === 'handle_offset_xz') {
        this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), this.group.position);
      } else {
        const camDir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion);
        this.dragPlane.setFromNormalAndCoplanarPoint(camDir, this.group.position);
      }

      this.raycaster.ray.intersectPlane(this.dragPlane, this.dragStartIntersect);

      // Define 1D Axis Vector
      if (this.activeHandle === 'handle_offset_x') this.dragAxisVector.set(1, 0, 0);
      else if (this.activeHandle === 'handle_offset_y') this.dragAxisVector.set(0, 1, 0);
      else if (this.activeHandle === 'handle_offset_z') this.dragAxisVector.set(0, 0, 1);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isDragging || !this.targetObject || !this.activeHandle) return;
    this.getMousePos(e);

    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneIntersect)) {
      const delta = new THREE.Vector3().subVectors(this.dragPlaneIntersect, this.dragStartIntersect);

      // --- KSP OFFSET (MODE 2) ---
      if (this.mode === 'offset') {
        if (this.activeHandle === 'handle_offset_x') {
          let dx = delta.x;
          if (this.snapEnabled) dx = Math.round(dx / 0.005) * 0.005; // 5mm snap
          this.targetObject.position.x = this.initialObjectPos.x + dx;
        } else if (this.activeHandle === 'handle_offset_y') {
          let dy = delta.y;
          if (this.snapEnabled) dy = Math.round(dy / 0.005) * 0.005;
          this.targetObject.position.y = Math.max(0.005, this.initialObjectPos.y + dy);
        } else if (this.activeHandle === 'handle_offset_z') {
          let dz = delta.z;
          if (this.snapEnabled) dz = Math.round(dz / 0.005) * 0.005;
          this.targetObject.position.z = this.initialObjectPos.z + dz;
        } else if (this.activeHandle === 'handle_offset_xz') {
          let dx = delta.x;
          let dz = delta.z;
          if (this.snapEnabled) {
            dx = Math.round(dx / 0.01) * 0.01;
            dz = Math.round(dz / 0.01) * 0.01;
          }
          this.targetObject.position.x = this.initialObjectPos.x + dx;
          this.targetObject.position.z = this.initialObjectPos.z + dz;
        }
      }
      // --- KSP ROTATE (MODE 3) ---
      else if (this.mode === 'rotate') {
        const stepRad = (5.0 * Math.PI) / 180; // 5 deg angular step
        if (this.activeHandle === 'handle_rotate_y') {
          let dAngle = delta.x * 3.5;
          if (this.snapEnabled) dAngle = Math.round(dAngle / stepRad) * stepRad;
          this.targetObject.rotation.y = this.initialObjectRot.y + dAngle;
        } else if (this.activeHandle === 'handle_rotate_x') {
          let dAngle = delta.y * 3.5;
          if (this.snapEnabled) dAngle = Math.round(dAngle / stepRad) * stepRad;
          this.targetObject.rotation.x = this.initialObjectRot.x + dAngle;
        } else if (this.activeHandle === 'handle_rotate_z') {
          let dAngle = delta.x * 3.5;
          if (this.snapEnabled) dAngle = Math.round(dAngle / stepRad) * stepRad;
          this.targetObject.rotation.z = this.initialObjectRot.z + dAngle;
        }
      }

      this.group.position.copy(this.targetObject.position);
      if (this.onTransformChanged) this.onTransformChanged();
    }
  };

  private onPointerUp = () => {
    if (this.isDragging) {
      this.isDragging = false;
      this.activeHandle = null;
      if (this.onDragEnd) this.onDragEnd();
    }
  };
}
