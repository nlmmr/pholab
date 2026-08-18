import React from 'react';
import * as THREE from 'three';
import { LaserConfig } from '../../physics/types';
import { TextSprite } from './TextSprite';

interface LaserSourceProps {
  laser: LaserConfig;
  isOn: boolean;
  onTogglePower: () => void;
  beamLengthM: number;
}

export const LaserSource: React.FC<LaserSourceProps> = ({
  laser,
  isOn,
  onTogglePower,
  beamLengthM
}) => {
  const laserColorHex = laser.wavelengthNm < 500 ? '#8b5cf6' : laser.wavelengthNm < 600 ? '#10b981' : '#ef4444';

  return (
    <group>
      {/* Diode Laser Housing */}
      <mesh castShadow rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.07, 24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Front Collimator & Brass Aperture Ring */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.036, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.015, 0.006, 24]} />
        <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Rear Cap */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.036, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.005, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Power Toggle Switch */}
      <group
        position={[-0.038, 0.012, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePower();
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.006, 0.008, 0.006]} />
          <meshStandardMaterial color={isOn ? '#10b981' : '#ef4444'} roughness={0.3} />
        </mesh>
      </group>

      {/* Laser Emission Indicator LED */}
      <mesh position={[0, 0.017, 0]}>
        <sphereGeometry args={[0.003, 16, 16]} />
        <meshBasicMaterial color={isOn ? laserColorHex : '#475569'} />
      </mesh>

      {/* Laser Model Text Badge */}
      <TextSprite
        text={`${Math.round(laser.wavelengthNm)}nm ${laser.nominalPowerMw}mW`}
        position={[0, 0.024, 0.017]}
        color="#fbbf24"
        fontSize={14}
        scale={0.012}
      />

      {/* Volumetric Laser Beam */}
      {isOn && beamLengthM > 0.01 && (
        <group position={[0.038 + beamLengthM / 2, 0, 0]}>
          {/* Intense Inner Core Ray */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.0008, 0.001, beamLengthM, 16]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>

          {/* Colored Waist Haze */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.0022, 0.003, beamLengthM, 16]} />
            <meshBasicMaterial
              color={laserColorHex}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>

          {/* Atmospheric Scattering Halo */}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.006, 0.008, beamLengthM, 16]} />
            <meshBasicMaterial
              color={laserColorHex}
              transparent
              opacity={0.08}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};
