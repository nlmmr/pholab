import * as THREE from 'three';

export class SimpleOrbitControls {
  public camera: THREE.Camera;
  public domElement: HTMLElement;
  public target = new THREE.Vector3(0, 0, 0);

  public enableDamping = true;
  public dampingFactor = 0.08;
  public minDistance = 0.2;
  public maxDistance = 4.0;
  public maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below table
  public minPolarAngle = 0.05;

  private isPointerDown = false;
  private isRightClick = false;
  private previousMousePosition = { x: 0, y: 0 };
  private spherical = new THREE.Spherical();
  private sphericalDelta = new THREE.Spherical();
  private panOffset = new THREE.Vector3();

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
    this.isPointerDown = true;
    this.isRightClick = e.button === 2;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isPointerDown) return;

    const deltaX = e.clientX - this.previousMousePosition.x;
    const deltaY = e.clientY - this.previousMousePosition.y;
    this.previousMousePosition = { x: e.clientX, y: e.clientY };

    if (this.isRightClick) {
      // Pan target
      const panSpeed = 0.002 * (this.spherical.radius / 2);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
      this.panOffset.addScaledVector(right, -deltaX * panSpeed);
      this.panOffset.addScaledVector(up, deltaY * panSpeed);
    } else {
      // Orbit angles
      const rotateSpeed = 0.005;
      this.sphericalDelta.theta -= deltaX * rotateSpeed;
      this.sphericalDelta.phi -= deltaY * rotateSpeed;
    }
  };

  private onPointerUp = () => {
    this.isPointerDown = false;
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    this.spherical.radius = THREE.MathUtils.clamp(
      this.spherical.radius * zoomFactor,
      this.minDistance,
      this.maxDistance
    );
  };

  public update() {
    this.target.add(this.panOffset);
    this.panOffset.set(0, 0, 0);

    this.spherical.theta += this.sphericalDelta.theta;
    this.spherical.phi += this.sphericalDelta.phi;

    // Restrict phi to avoid flipping
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
}
