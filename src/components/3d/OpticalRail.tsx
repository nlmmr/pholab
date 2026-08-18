import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ProceduralTextures } from './textures/ProceduralTextures';

interface OpticalRailProps {
  position?: [number, number, number];
}

export const OpticalRail: React.FC<OpticalRailProps> = ({
  position = [0, 0.035, -0.05]
}) => {
  const scaleTexture = useMemo(() => ProceduralTextures.createRailScaleTexture(), []);

  return (
    <group position={position}>
      {/* Main Extruded Aluminum Rail Body (1000 mm long, 50 mm wide, 35 mm high) */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[1.04, 0.035, 0.06]} />
        <meshStandardMaterial
          color="#94a3b8"
          roughness={0.35}
          metalness={0.8}
        />
      </mesh>

      {/* Top Center Dovetail / V-Groove Guide */}
      <mesh position={[0, 0.018, 0]}>
        <boxGeometry args={[1.03, 0.004, 0.02]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Front Inclined Bevel with Laser-Etched Millimeter Ruler */}
      <mesh position={[0, 0.005, 0.031]} rotation={[-0.2, 0, 0]}>
        <planeGeometry args={[1.0, 0.024]} />
        <meshStandardMaterial
          map={scaleTexture}
          roughness={0.3}
          metalness={0.3}
        />
      </mesh>

      {/* Heavy Anodized End Support Feet with Leveling Thumbscrews */}
      {[-0.51, 0.51].map((xPos, idx) => (
        <group key={`foot-${idx}`} position={[xPos, -0.018, 0]}>
          {/* Foot Base Block */}
          <mesh castShadow position={[0, 0, 0]}>
            <boxGeometry args={[0.04, 0.015, 0.12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.7} />
          </mesh>

          {/* Leveling Screws */}
          {[-0.045, 0.045].map((zPos, zIdx) => (
            <mesh key={`screw-${zIdx}`} position={[0, -0.01, zPos]}>
              <cylinderGeometry args={[0.012, 0.012, 0.008, 16]} />
              <meshStandardMaterial color="#d97706" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
