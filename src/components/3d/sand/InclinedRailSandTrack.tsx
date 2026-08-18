import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TextSprite } from '../TextSprite';

interface InclinedRailSandTrackProps {
  position?: [number, number, number];
  railAngleDeg: number;
  releaseDistanceCm: number;
  isRolling: boolean;
  ballStoppingDistanceCm: number;
  onRollComplete?: () => void;
}

export const InclinedRailSandTrack: React.FC<InclinedRailSandTrackProps> = ({
  position = [0.35, 0.02, 0],
  railAngleDeg = 5.0,
  releaseDistanceCm = 50.0,
  isRolling,
  ballStoppingDistanceCm,
  onRollComplete,
}) => {
  const ballMeshRef = useRef<THREE.Mesh>(null);
  const rollProgressRef = useRef(0);

  const thetaRad = (railAngleDeg * Math.PI) / 180;
  const railLengthM = 1.0;
  const releaseDistanceM = releaseDistanceCm / 100;

  // Rail height at top: h = L * sin(theta)
  const topHeightY = railLengthM * Math.sin(thetaRad);

  useFrame((_, delta) => {
    if (isRolling && ballMeshRef.current) {
      rollProgressRef.current += delta * 0.9;

      if (rollProgressRef.current < 1.0) {
        // Rolling down the rail: from release point to bottom
        const t = rollProgressRef.current;
        const currentDistOnRail = releaseDistanceM * (1 - t * t); // accelerating
        
        // Position along the inclined rail
        const railX = (currentDistOnRail - railLengthM / 2) * Math.cos(thetaRad);
        const railY = currentDistOnRail * Math.sin(thetaRad) + 0.015;
        ballMeshRef.current.position.set(railX, railY, 0);
      } else if (rollProgressRef.current < 1.6) {
        // Rolling and braking inside the sand track
        const tSand = (rollProgressRef.current - 1.0) / 0.6;
        const stoppingM = (ballStoppingDistanceCm / 100) * (1 - Math.pow(1 - tSand, 2)); // decelerating
        const sandStartX = (0 - railLengthM / 2) * Math.cos(thetaRad);
        ballMeshRef.current.position.set(sandStartX - stoppingM, 0.012, 0);
      } else {
        onRollComplete?.();
      }
    } else if (ballMeshRef.current) {
      // Idle at release point
      rollProgressRef.current = 0;
      const railX = (releaseDistanceM - railLengthM / 2) * Math.cos(thetaRad);
      const railY = releaseDistanceM * Math.sin(thetaRad) + 0.015;
      ballMeshRef.current.position.set(railX, railY, 0);
    }
  });

  return (
    <group position={position}>
      {/* Inclined 1m Aluminium Rail (h) */}
      <group position={[0, topHeightY / 2, 0]} rotation={[0, 0, -thetaRad]}>
        {/* Extruded V-Profile Rail */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[railLengthM, 0.012, 0.024]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Inner V-groove line */}
        <mesh position={[0, 0.006, 0]}>
          <boxGeometry args={[railLengthM, 0.002, 0.006]} />
          <meshStandardMaterial color="#334155" metalness={0.5} />
        </mesh>
      </group>

      {/* Support Stand under elevated end of rail */}
      <group position={[(railLengthM / 2) * Math.cos(thetaRad), 0, 0]}>
        <mesh position={[0, topHeightY / 2, 0]} castShadow>
          <cylinderGeometry args={[0.006, 0.006, topHeightY, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} />
        </mesh>
        <TextSprite
          text={`θ = ${railAngleDeg.toFixed(1)}°`}
          position={[0, topHeightY + 0.03, 0]}
          color="#f59e0b"
          fontSize={12}
          scale={0.008}
        />
      </group>

      {/* Wooden Track with Sand Bed at the bottom (j) */}
      <group position={[-railLengthM / 2 - 0.28, 0.015, 0]}>
        {/* Wooden frame */}
        <mesh receiveShadow>
          <boxGeometry args={[0.60, 0.03, 0.12]} />
          <meshStandardMaterial color="#854d0e" roughness={0.7} />
        </mesh>
        {/* Uniform Sand layer in track */}
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[0.58, 0.012, 0.10]} />
          <meshStandardMaterial color="#d4b483" roughness={0.9} />
        </mesh>
        {/* Metric scale on wooden track */}
        <TextSprite
          text="Calha de Areia (Braking Track)"
          position={[0, 0.025, 0.06]}
          color="#64748b"
          fontSize={10}
          scale={0.007}
        />
      </group>

      {/* Ball #4 rolling on rail & sand */}
      <mesh ref={ballMeshRef} castShadow>
        <sphereGeometry args={[0.008, 24, 24]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.1} />
      </mesh>
    </group>
  );
};
