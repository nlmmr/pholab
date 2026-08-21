import * as THREE from 'three';

export class SimpleOrbitControls {
  public camera: THREE.Camera;
  public domElement: HTMLElement;
  public target = new THREE.Vector3(0, 0.05, 0);

  public enableDamping = true;
  public dampingFactor = 0.08;
  public minDistance = 0.05; // 5 cm close zoom for inspecting millimeter marks
  public maxDistance = 4.5;
  public maxPolarAngle = Math.PI / 2 - 0.01; // Prevent camera going below table surface
  public minPolarAngle = 0.02;

  public isLocked = false; // When true (e.g. dragging Gimbal), camera ignores inputs

  private isOrbiting = false;
  private isPanning = false;
  private previousMousePosition = { x: 0, y: 0 };
  private spherical = new THREE.Spherical();
  private sphericalDelta = new THREE.Spherical();
  private panOffset = new THREE.Vector3();
  private focusSpherical: THREE.Spherical | null = null;
  private focusTarget: THREE.Vector3 | null = null;
  private activePointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;

  constructor(camera: THREE.Camera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;

    // Initialize spherical coordinates from camera's current position relative to target
    const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
    this.spherical.setFromVector3(offset);

    this.bindEvents();
  }

  private bindEvents() {
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose() {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.isLocked) return;

    this.focusSpherical = null;
    this.focusTarget = null;
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    this.previousMousePosition = { x: e.clientX, y: e.clientY };

    if (e.pointerType === 'touch') {
      if (this.activePointers.size === 2) {
        const [first, second] = [...this.activePointers.values()];
        this.pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
        this.isOrbiting = false;
      } else {
        this.isOrbiting = true;
      }
      e.preventDefault();
      return;
    }

    if (e.button === 1) {
      // Middle Mouse Click -> Pan Camera (Blender / CAD standard)
      this.isPanning = true;
      e.preventDefault();
    } else if (e.button === 0) {
      // Left Mouse Click -> Orbit Camera
      this.isOrbiting = true;
    } else if (e.button === 2) {
      // Right Click -> Secondary Pan option for users without a middle button
      this.isPanning = true;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.isLocked) return;
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (e.pointerType === 'touch' && this.activePointers.size >= 2) {
      const [first, second] = [...this.activePointers.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      if (this.pinchDistance > 0 && distance > 0) {
        this.spherical.radius = THREE.MathUtils.clamp(
          this.spherical.radius * (this.pinchDistance / distance),
          this.minDistance,
          this.maxDistance,
        );
      }
      this.pinchDistance = distance;
      return;
    }
    if (!this.isOrbiting && !this.isPanning) return;

    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };

    if (this.isPanning) {
      // Pan Camera: move both target and camera along camera's view plane
      const panSpeed = 0.0012 * Math.max(0.2, this.spherical.radius);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

      this.panOffset.addScaledVector(right, -deltaX * panSpeed);
      this.panOffset.addScaledVector(up, deltaY * panSpeed);
    } else if (this.isOrbiting) {
      // Orbit Camera: rotate spherical theta & phi
      const rotateSpeed = 0.0045;
      this.sphericalDelta.theta -= deltaX * rotateSpeed;
      this.sphericalDelta.phi -= deltaY * rotateSpeed;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size === 1) {
      const [remaining] = [...this.activePointers.values()];
      this.previousMousePosition = remaining;
      this.isOrbiting = true;
    } else {
      this.isOrbiting = false;
    }
    if (this.activePointers.size < 2) this.pinchDistance = 0;
    this.isPanning = false;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.isLocked) return;
    e.preventDefault();

    // Exponential smooth zooming
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    this.spherical.radius = THREE.MathUtils.clamp(
      this.spherical.radius * zoomFactor,
      this.minDistance,
      this.maxDistance
    );
  };

  public update() {
    if (this.focusSpherical && this.focusTarget) {
      this.target.lerp(this.focusTarget, 0.12);
      this.spherical.radius = THREE.MathUtils.lerp(this.spherical.radius, this.focusSpherical.radius, 0.12);
      this.spherical.theta = THREE.MathUtils.lerp(this.spherical.theta, this.focusSpherical.theta, 0.12);
      this.spherical.phi = THREE.MathUtils.lerp(this.spherical.phi, this.focusSpherical.phi, 0.12);
      if (
        this.target.distanceTo(this.focusTarget) < 0.002 &&
        Math.abs(this.spherical.radius - this.focusSpherical.radius) < 0.002
      ) {
        this.target.copy(this.focusTarget);
        this.spherical.copy(this.focusSpherical);
        this.focusTarget = null;
        this.focusSpherical = null;
      }
    }
    this.target.add(this.panOffset);
    this.panOffset.set(0, 0, 0);

    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;

    // Restrict phi to avoid flipping camera over top or clipping beneath table
    this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi, this.minPolarAngle, this.maxPolarAngle);
    this.spherical.radius = THREE.MathUtils.clamp(this.spherical.radius, this.minDistance, this.maxDistance);

    if (this.enableDamping) {
      this.sphericalDelta.theta *= 1 - this.dampingFactor;
      this.sphericalDelta.phi *= 1 - this.dampingFactor;
    } else {
      this.sphericalDelta.set(0, 0, 0);
    }

    const offset = new THREE.Vector3().setFromSpherical(this.spherical);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  public setView(position: THREE.Vector3, target: THREE.Vector3) {
    this.focusTarget = target.clone();
    this.focusSpherical = new THREE.Spherical().setFromVector3(position.clone().sub(target));
  }
}
