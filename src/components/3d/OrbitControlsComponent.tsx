import React, { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface OrbitControlsComponentProps {
  presetTarget?: [number, number, number];
  presetPos?: [number, number, number];
  minDistance?: number;
  maxDistance?: number;
  maxPolarAngle?: number;
}

export const OrbitControlsComponent: React.FC<OrbitControlsComponentProps> = ({
  presetTarget = [0, 0.1, 0],
  presetPos = [0, 0.7, 0.95],
  minDistance = 0.15,
  maxDistance = 2.5,
  maxPolarAngle = Math.PI / 2 + 0.05
}) => {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.maxPolarAngle = maxPolarAngle;
    controls.target.set(...presetTarget);
    controlsRef.current = controls;

    return () => {
      controls.dispose();
    };
  }, [camera, gl]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.target.set(...presetTarget);
      camera.position.set(...presetPos);
      controlsRef.current.update();
    }
  }, [presetTarget, presetPos, camera]);

  useFrame(() => {
    controlsRef.current?.update();
  });

  return null;
};
