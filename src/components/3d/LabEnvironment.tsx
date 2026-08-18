import React from 'react';
import * as THREE from 'three';

interface LabEnvironmentProps {
  onFloorClick?: () => void;
}

export const LabEnvironment: React.FC<LabEnvironmentProps> = ({ onFloorClick }) => {
  return (
    <group>
      {/* Ambient and Studio Key / Fill Lights */}
      <ambientLight intensity={0.45} color="#e2e8f0" />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={15}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
        color="#ffffff"
      />
      <directionalLight position={[-3, 3, -2]} intensity={0.3} color="#93c5fd" />
      <pointLight position={[0, 2, 0]} intensity={0.2} color="#f8fafc" />

      {/* Main Laboratory Bench (1.8m x 0.9m x 0.05m tabletop at y = 0) */}
      <group position={[0, -0.025, 0]}>
        {/* Table Top Surface (Antistatic dark matte epoxy resin) */}
        <mesh receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[1.8, 0.05, 0.9]} />
          <meshStandardMaterial
            color="#1e293b"
            roughness={0.65}
            metalness={0.15}
          />
        </mesh>

        {/* Table Edge Trim (Anodized aluminum bevel) */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.81, 0.052, 0.91]} />
          <meshStandardMaterial
            color="#334155"
            roughness={0.4}
            metalness={0.6}
            wireframe={false}
          />
        </mesh>

        {/* Heavy Duty Steel Table Legs */}
        <mesh position={[-0.82, -0.4, -0.38]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.8, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
        </mesh>
        <mesh position={[0.82, -0.4, -0.38]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.8, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
        </mesh>
        <mesh position={[-0.82, -0.4, 0.38]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.8, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
        </mesh>
        <mesh position={[0.82, -0.4, 0.38]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.8, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.8} />
        </mesh>
      </group>

      {/* Laboratory Floor (Polished concrete / tile floor) */}
      <mesh
        position={[0, -0.82, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        onClick={onFloorClick}
      >
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial
          color="#0b0f17"
          roughness={0.85}
          metalness={0.1}
        />
      </mesh>

      {/* Background Laboratory Wall */}
      <mesh position={[0, 1.2, -2.5]} receiveShadow>
        <planeGeometry args={[12, 5]} />
        <meshStandardMaterial color="#111827" roughness={0.9} />
      </mesh>
    </group>
  );
};
