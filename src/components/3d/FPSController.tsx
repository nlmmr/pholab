import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface FPSControllerRef {
  requestPointerLock: () => void;
  releasePointerLock: () => void;
  isLocked: boolean;
}

interface FPSControllerProps {
  onLockChange?: (locked: boolean) => void;
  onHoverChange?: (label: string | null) => void;
}

// Lab boundary constants (desk surface area)
const BOUNDS_X: [number, number] = [-1.2, 1.2];
const BOUNDS_Z: [number, number] = [-0.5, 1.4];
const STAND_Y = 0.52;   // Normal eye height
const CROUCH_Y = 0.20;  // Crouched to beam level (~17 cm above table surface)

export const FPSController: React.FC<FPSControllerProps> = ({
  onLockChange,
  onHoverChange,
}) => {
  const { camera, gl, raycaster, scene } = useThree();

  const keysRef = useRef<Record<string, boolean>>({});
  const isLockedRef = useRef(false);
  const crouchRef = useRef(false);
  const zoomRef = useRef(false);
  const velocityRef = useRef(new THREE.Vector3());
  const pitchRef = useRef(0);
  const yawRef = useRef(0);
  const targetYRef = useRef(STAND_Y);

  const defaultFov = 65;
  const zoomFov = 18;

  // Initialise camera position
  useEffect(() => {
    camera.position.set(0, STAND_Y, 0.9);
    camera.rotation.order = 'YXZ';
    pitchRef.current = 0;
    yawRef.current = 0;
  }, [camera]);

  // Keyboard handlers
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    keysRef.current[e.code] = true;
    if (e.code === 'KeyC' || e.code === 'ControlLeft') {
      crouchRef.current = !crouchRef.current;
      targetYRef.current = crouchRef.current ? CROUCH_Y : STAND_Y;
    }
  }, []);

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current[e.code] = false;
  }, []);

  // Mouse move (PointerLock)
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!isLockedRef.current) return;
    const sens = zoomRef.current ? 0.0008 : 0.002;
    yawRef.current -= e.movementX * sens;
    pitchRef.current = THREE.MathUtils.clamp(
      pitchRef.current - e.movementY * sens,
      -Math.PI / 3,
      Math.PI / 3
    );
  }, []);

  // Right-click zoom
  const onMouseDown = useCallback((e: MouseEvent) => {
    if (e.button === 2) zoomRef.current = true;
  }, []);
  const onMouseUp = useCallback((e: MouseEvent) => {
    if (e.button === 2) zoomRef.current = false;
  }, []);

  // PointerLock
  const onPointerLockChange = useCallback(() => {
    isLockedRef.current = document.pointerLockElement === gl.domElement;
    onLockChange?.(isLockedRef.current);
  }, [gl.domElement, onLockChange]);

  const requestLock = useCallback(() => {
    gl.domElement.requestPointerLock();
  }, [gl.domElement]);

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    gl.domElement.addEventListener('click', requestLock);
    gl.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      gl.domElement.removeEventListener('click', requestLock);
    };
  }, [onKeyDown, onKeyUp, onMouseMove, onMouseDown, onMouseUp, onPointerLockChange, requestLock, gl.domElement]);

  useFrame((_, delta) => {
    if (!isLockedRef.current) return;

    const dt = Math.min(delta, 0.05);

    // Apply rotation
    camera.rotation.order = 'YXZ';
    camera.rotation.y = yawRef.current;
    camera.rotation.x = pitchRef.current;

    // FOV zoom
    const targetFov = zoomRef.current ? zoomFov : defaultFov;
    (camera as THREE.PerspectiveCamera).fov = THREE.MathUtils.lerp(
      (camera as THREE.PerspectiveCamera).fov,
      targetFov,
      dt * 12
    );
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    // WASD movement
    const speed = crouchRef.current ? 0.6 : 1.2;
    const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
    const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));

    const move = new THREE.Vector3();
    if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) move.addScaledVector(forward, speed);
    if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) move.addScaledVector(forward, -speed);
    if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) move.addScaledVector(right, -speed);
    if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) move.addScaledVector(right, speed);

    // Smooth velocity
    velocityRef.current.lerp(move, dt * 10);
    camera.position.addScaledVector(velocityRef.current, dt);

    // Boundary clamping
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, BOUNDS_X[0], BOUNDS_X[1]);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, BOUNDS_Z[0], BOUNDS_Z[1]);

    // Smooth crouch / stand
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetYRef.current, dt * 10);

    // Raycaster hover detection for interactive labels
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    const hit = hits.find(h => h.object.userData?.interactLabel);
    onHoverChange?.(hit ? hit.object.userData.interactLabel as string : null);
  });

  return null;
};
