import React, { useMemo } from 'react';
import * as THREE from 'three';
import { TextSprite } from '../TextSprite';

interface SandBoxBowlProps {
  position?: [number, number, number];
  isSandLeveled: boolean;
  craterDiameterMm: number;
  craterDepthMm: number;
  hasCrater: boolean;
  onStirAndLevel: () => void;
}

export const SandBoxBowl: React.FC<SandBoxBowlProps> = ({
  position = [-0.25, 0.04, 0],
  isSandLeveled,
  craterDiameterMm,
  craterDepthMm,
  hasCrater,
  onStirAndLevel,
}) => {
  // Generate deformable sand surface geometry with real crater profile
  const { sandGeometry } = useMemo(() => {
    const radius = 0.12; // 24 cm diameter bowl
    const segments = 48;
    const geom = new THREE.CylinderGeometry(radius, radius * 0.95, 0.05, segments, 16);
    
    if (hasCrater && craterDiameterMm > 0) {
      const craterRadiusM = (craterDiameterMm / 2) / 1000;
      const craterDepthM = (craterDepthMm) / 1000;
      const posAttr = geom.attributes.position;

      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);

        // Only deform the top surface (y > 0.02)
        if (y > 0.02) {
          const dist = Math.sqrt(x * x + z * z);
          if (dist < craterRadiusM) {
            // Parabolic / Gaussian crater bowl depression with raised rim
            const normDist = dist / craterRadiusM;
            const depression = Math.cos(normDist * (Math.PI / 2)) * craterDepthM;
            const rimElevation = Math.exp(-Math.pow((dist - craterRadiusM) / 0.015, 2)) * 0.003;
            posAttr.setY(i, y - depression + rimElevation);
          }
        }
      }
      geom.computeVertexNormals();
    }
    return { sandGeometry: geom };
  }, [hasCrater, craterDiameterMm, craterDepthMm]);

  return (
    <group position={position}>
      {/* Outer Plastic Containment Box (a) */}
      <mesh receiveShadow position={[0, -0.01, 0]}>
        <boxGeometry args={[0.34, 0.07, 0.34]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.4} metalness={0.1} />
      </mesh>
      
      {/* Inner Cavity of Box */}
      <mesh position={[0, 0.005, 0]}>
        <boxGeometry args={[0.32, 0.05, 0.32]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} />
      </mesh>

      {/* Sand Bowl (b) */}
      <mesh castShadow receiveShadow position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.13, 0.11, 0.06, 36]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.2} metalness={0.1} />
      </mesh>

      {/* Dynamic Sand Bed with Impact Crater */}
      <mesh geometry={sandGeometry} castShadow receiveShadow position={[0, 0.035, 0]}>
        <meshStandardMaterial color="#d4b483" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Crater Measurement Ring Visualizer (when crater is present) */}
      {hasCrater && (
        <group position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <ringGeometry args={[(craterDiameterMm / 2000) - 0.001, (craterDiameterMm / 2000) + 0.001, 32]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
          </mesh>
          <TextSprite
            text={`D = ${craterDiameterMm.toFixed(1)} mm`}
            position={[0, (craterDiameterMm / 2000) + 0.015, 0]}
            color="#f59e0b"
            fontSize={13}
            scale={0.008}
          />
        </group>
      )}

      {/* Stir & Level Tool (Spoon/Ruler near the box) */}
      <group
        position={[0.20, 0.02, 0.05]}
        rotation={[0, 0.3, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onStirAndLevel();
        }}
      >
        {/* Spoon mesh */}
        <mesh castShadow>
          <boxGeometry args={[0.012, 0.004, 0.16]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.2} />
        </mesh>
        <TextSprite
          text={isSandLeveled ? '✓ Areia Nivelada' : '⚠ Misturar Areia (Colher)'}
          position={[0, 0.03, 0]}
          color={isSandLeveled ? '#10b981' : '#f59e0b'}
          fontSize={11}
          scale={0.007}
        />
      </group>
    </group>
  );
};
