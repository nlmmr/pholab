import React, { useMemo } from 'react';
import * as THREE from 'three';
import { PolarizerParameters } from '../../physics/types';
import { ProceduralTextures } from './textures/ProceduralTextures';
import { TextSprite } from './TextSprite';

interface PolarizerHolderProps {
  params?: PolarizerParameters;
  onAngleChange: (newAngle: number) => void;
  isLaserIlluminated?: boolean;
}

export const PolarizerHolder: React.FC<PolarizerHolderProps> = ({
  params,
  onAngleChange,
  isLaserIlluminated = false
}) => {
  const angle = params?.angleDegrees || 0;
  const protractorTexture = useMemo(() => ProceduralTextures.createProtractorTexture(), []);

  const handleRotate = (deltaDeg: number) => {
    let newA = (angle + deltaDeg) % 360;
    if (newA < 0) newA += 360;
    onAngleChange(Math.round(newA));
  };

  return (
    <group>
      {/* Outer Fixed Protractor Bezel with 360° Engravings */}
      <mesh castShadow rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.034, 0.034, 0.004, 32]} />
        <meshStandardMaterial
          map={protractorTexture}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      {/* Rotating Polaroid Core */}
      <group rotation={[(angle * Math.PI) / 180, 0, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.003, 32]} />
          <meshStandardMaterial
            color="#334155"
            roughness={0.1}
            metalness={0.1}
            transparent
            opacity={0.7}
          />
        </mesh>

        {/* Indicator Line */}
        <mesh position={[0.002, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.001, 0.04]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} />
        </mesh>
      </group>

      {/* Laser Spot on Polarizer */}
      {isLaserIlluminated && (
        <mesh position={[0.0025, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.002, 16]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Fine Rotary Adjustment */}
      <group position={[0, -0.045, 0]}>
        <TextSprite
          text={`ÂNGULO: ${angle}°`}
          position={[0, 0.008, 0]}
          color="#fbbf24"
          fontSize={14}
          scale={0.012}
        />

        {/* Step Buttons */}
        <group
          position={[-0.015, -0.012, 0]}
          onClick={(e) => {
            e.stopPropagation();
            handleRotate(-5);
          }}
        >
          <mesh>
            <boxGeometry args={[0.008, 0.006, 0.004]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <TextSprite text="-5°" position={[0, 0, 0.003]} fontSize={14} color="#ffffff" scale={0.008} />
        </group>

        <group
          position={[0.015, -0.012, 0]}
          onClick={(e) => {
            e.stopPropagation();
            handleRotate(5);
          }}
        >
          <mesh>
            <boxGeometry args={[0.008, 0.006, 0.004]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <TextSprite text="+5°" position={[0, 0, 0.003]} fontSize={14} color="#ffffff" scale={0.008} />
        </group>
      </group>
    </group>
  );
};
