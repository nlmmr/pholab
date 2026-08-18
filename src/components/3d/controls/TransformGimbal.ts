import * as THREE from 'three';

export type GimbalMode = 'translate' | 'rotate';

export class TransformGimbal {
  public group = new THREE.Group();
  public mode: GimbalMode = 'translate';
  public targetObject: THREE.Object3D | null = null;
  public onTransformChanged?: () => void;

  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  private isDragging = false;
  private activeHandle: string | null = null;
  private plane = new THREE.Plane();
  private planeIntersect = new THREE.Vector3();
  private dragStartPoint = new THREE.Vector3();
  private initialObjectPos = new THREE.Vector3();
  private initialObjectRot = new THREE.Euler();
  private previousAngle = 0;

  // Visual Meshes
  private translateGroup = new THREE.Group();
  private rotateGroup = new THREE.Group();
  private handles: THREE.Mesh[] = [];

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    this.buildGimbalGeometry();
    this.group.add(this.translateGroup);
    this.group.add(this.rotateGroup);
    this.group.visible = false;
    this.setMode('translate');

    this.bindEvents();
  }

  private buildGimbalGeometry() {
    const handleMat = (color: string) =>
      new THREE.MeshBasicMaterial({ color, depthTest: false, depthWrite: false, transparent: true, opacity: 0.85 });

    // --- Translation Handles ---
    // X-Axis (Red)
    const arrowX = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15, 12), handleMat('#ef4444'));
    arrowX.rotation.z = -Math.PI / 2;
    arrowX.position.x = 0.075;
    arrowX.name = 'handle_trans_x';
    const coneX = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 12), handleMat('#ef4444'));
    coneX.rotation.z = -Math.PI / 2;
    coneX.position.x = 0.16;
    coneX.name = 'handle_trans_x';
    this.translateGroup.add(arrowX, coneX);
    this.handles.push(arrowX, coneX);

    // Y-Axis (Green)
    const arrowY = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15, 12), handleMat('#10b981'));
    arrowY.position.y = 0.075;
    arrowY.name = 'handle_trans_y';
    const coneY = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 12), handleMat('#10b981'));
    coneY.position.y = 0.16;
    coneY.name = 'handle_trans_y';
    this.translateGroup.add(arrowY, coneY);
    this.handles.push(arrowY, coneY);

    // Z-Axis (Blue)
    const arrowZ = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.15, 12), handleMat('#3b82f6'));
    arrowZ.rotation.x = Math.PI / 2;
    arrowZ.position.z = 0.075;
    arrowZ.name = 'handle_trans_z';
    const coneZ = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 12), handleMat('#3b82f6'));
    coneZ.rotation.x = Math.PI / 2;
    coneZ.position.z = 0.16;
    coneZ.name = 'handle_trans_z';
    this.translateGroup.add(arrowZ, coneZ);
    this.handles.push(arrowZ, coneZ);

    // Plane Handle (XZ Ground plane square - Amber)
    const planeGeom = new THREE.PlaneGeometry(0.05, 0.05);
    const planeMat = new THREE.MeshBasicMaterial({ color: '#f59e0b', depthTest: false, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    planeMesh.rotation.x = Math.PI / 2;
    planeMesh.position.set(0.035, 0.001, 0.035);
    planeMesh.name = 'handle_trans_xz';
    this.translateGroup.add(planeMesh);
    this.handles.push(planeMesh);

    // --- Rotation Rings ---
    // X Ring (Pitch - Red)
    const ringX = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.004, 8, 32), handleMat('#ef4444'));
    ringX.rotation.y = Math.PI / 2;
    ringX.name = 'handle_rot_x';
    this.rotateGroup.add(ringX);
    this.handles.push(ringX);

    // Y Ring (Yaw - Green)
    const ringY = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.004, 8, 32), handleMat('#10b981'));
    ringY.rotation.x = Math.PI / 2;
    ringY.name = 'handle_rot_y';
    this.rotateGroup.add(ringY);
    this.handles.push(ringY);

    // Z Ring (Roll - Blue)
    const ringZ = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.004, 8, 32), handleMat('#3b82f6'));
    ringZ.name = 'handle_rot_z';
    this.rotateGroup.add(ringZ);
    this.handles.push(ringZ);
  }

  public attach(object: THREE.Object3D | null) {
    this.targetObject = object;
    if (object) {
      this.group.position.copy(object.position);
      this.group.visible = true;
    } else {
      this.group.visible = false;
    }
  }

  public setMode(mode: GimbalMode) {
    this.mode = mode;
    this.translateGroup.visible = mode === 'translate';
    this.rotateGroup.visible = mode === 'rotate';
  }

  public toggleMode() {
    this.setMode(this.mode === 'translate' ? 'rotate' : 'translate');
  }

  public updateScale() {
    if (!this.targetObject) return;
    this.group.position.copy(this.targetObject.position);

    // Maintain constant screen size regardless of camera distance
    const dist = this.camera.position.distanceTo(this.group.position);
    const factor = Math.max(0.4, dist * 0.45);
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
    if (e.key === 'w' || e.key === 'W') {
      this.setMode('translate');
    } else if (e.key === 'e' || e.key === 'E') {
      this.setMode('rotate');
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
    this.getMousePos(e);

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.handles, false);

    if (intersects.length > 0) {
      e.stopPropagation();
      this.isDragging = true;
      this.activeHandle = intersects[0].object.name;

      this.initialObjectPos.copy(this.targetObject.position);
      this.initialObjectRot.copy(this.targetObject.rotation);

      // Define calculation plane facing camera or aligned with axes
      if (this.activeHandle === 'handle_trans_y' || this.activeHandle === 'handle_rot_y') {
        this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion), this.group.position);
      } else if (this.activeHandle === 'handle_trans_xz') {
        this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), this.group.position);
      } else {
        this.plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).applyQuaternion(this.camera.quaternion), this.group.position);
      }

      this.raycaster.ray.intersectPlane(this.plane, this.dragStartPoint);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isDragging || !this.targetObject || !this.activeHandle) return;
    this.getMousePos(e);

    this.raycaster.setFromCamera(this.mouse, this.camera);
    if (this.raycaster.ray.intersectPlane(this.plane, this.planeIntersect)) {
      const delta = new THREE.Vector3().subVectors(this.planeIntersect, this.dragStartPoint);

      if (this.mode === 'translate') {
        if (this.activeHandle === 'handle_trans_x') {
          this.targetObject.position.x = this.initialObjectPos.x + delta.x;
        } else if (this.activeHandle === 'handle_trans_y') {
          this.targetObject.position.y = Math.max(0.01, this.initialObjectPos.y + delta.y);
        } else if (this.activeHandle === 'handle_trans_z') {
          this.targetObject.position.z = this.initialObjectPos.z + delta.z;
        } else if (this.activeHandle === 'handle_trans_xz') {
          this.targetObject.position.x = this.initialObjectPos.x + delta.x;
          this.targetObject.position.z = this.initialObjectPos.z + delta.z;
        }
      } else if (this.mode === 'rotate') {
        if (this.activeHandle === 'handle_rot_y') {
          this.targetObject.rotation.y = this.initialObjectRot.y + delta.x * 3.0;
        } else if (this.activeHandle === 'handle_rot_x') {
          this.targetObject.rotation.x = this.initialObjectRot.x + delta.y * 3.0;
        } else if (this.activeHandle === 'handle_rot_z') {
          this.targetObject.rotation.z = this.initialObjectRot.z + delta.x * 3.0;
        }
      }

      this.group.position.copy(this.targetObject.position);
      if (this.onTransformChanged) this.onTransformChanged();
    }
  };

  private onPointerUp = () => {
    this.isDragging = false;
    this.activeHandle = null;
  };
}
