import React from 'react';
import * as THREE from 'three';
import { BallSpec } from '../../../types/pholab';
import { TextSprite } from '../TextSprite';

interface SteelBallsStandProps {
  position?: [number, number, number];
  dropHeightCm: number;
  selectedBall: BallSpec;
  ballsList: BallSpec[];
  onSelectBall: (ball: BallSpec) => void;
  onDropBall: () => void;
  isDropping: boolean;
}

export const SteelBallsStand: React.FC<SteelBallsStandProps> = ({
  position = [-0.25, 0, -0.22],
  dropHeightCm,
  selectedBall,
  ballsList,
  onSelectBall,
  onDropBall,
  isDropping,
}) => {
  // Height in meters above the sand surface (sand surface is at y ~ 0.075)
  const dropHeightM = dropHeightCm / 100;
  const guideHeightY = 0.075 + dropHeightM;

  return (
    <group position={position}>
      {/* Wooden Base Tray (f1) */}
      <mesh castShadow receiveShadow position={[0, 0.01, 0]}>
        <boxGeometry args={[0.22, 0.02, 0.22]} />
        <meshStandardMaterial color="#854d0e" roughness={0.7} />
      </mesh>

      {/* Rubber feet (4 corners) */}
      {[-0.09, 0.09].flatMap((x) =>
        [-0.09, 0.09].map((z) => (
          <mesh key={`foot-${x}-${z}`} position={[x, 0.003, z]}>
            <cylinderGeometry args={[0.008, 0.008, 0.006, 12]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
        ))
      )}

      {/* Vertical Stainless Steel Rod (f4) — 1.2m tall */}
      <mesh castShadow position={[0, 0.61, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 1.2, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Clamping Collar & Thumbscrew (f2) at height h */}
      <group position={[0, guideHeightY, 0]}>
        {/* Collar block */}
        <mesh castShadow>
          <boxGeometry args={[0.022, 0.025, 0.025]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Thumbscrew knob */}
        <mesh position={[-0.016, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.007, 0.007, 0.012, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
        {/* Horizontal Guide Rod (f3) reaching out to center of sand bowl */}
        <mesh position={[0, 0, 0.11]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.22, 16]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>

        {/* Selected Steel Ball ready at guide tip */}
        {!isDropping && (
          <mesh position={[0, -0.01, 0.22]} castShadow>
            <sphereGeometry args={[(selectedBall.diameterMm / 2) / 1000 * 2.5, 24, 24]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.95} roughness={0.1} />
          </mesh>
        )}

        {/* Height label on guide */}
        <TextSprite
          text={`h = ${dropHeightCm.toFixed(0)} cm`}
          position={[0.04, 0, 0.11]}
          color="#f59e0b"
          fontSize={12}
          scale={0.008}
        />
      </group>

      {/* Ball Container on the base tray with 4 selectable balls */}
      <group position={[0.06, 0.025, 0.05]}>
        <mesh receiveShadow>
          <boxGeometry args={[0.08, 0.015, 0.08]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} />
        </mesh>
        {ballsList.map((ball, idx) => {
          const xOffset = ((idx % 2) - 0.5) * 0.03;
          const zOffset = (Math.floor(idx / 2) - 0.5) * 0.03;
          const isCurrent = ball.id === selectedBall.id;

          return (
            <group
              key={ball.id}
              position={[xOffset, 0.015, zOffset]}
              onClick={(e) => {
                e.stopPropagation();
                onSelectBall(ball);
              }}
            >
              <mesh castShadow>
                <sphereGeometry args={[(ball.diameterMm / 2000) * 2.2, 16, 16]} />
                <meshStandardMaterial
                  color={isCurrent ? '#f59e0b' : '#cbd5e1'}
                  metalness={0.9}
                  roughness={0.2}
                />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
};
