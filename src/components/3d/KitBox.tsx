import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OpticalElementType } from '../../physics/types';
import { TextSprite } from './TextSprite';

interface KitBoxProps {
  isOpen: boolean;
  isOnFloor: boolean;
  onToggleOpen: () => void;
  onToggleFloor: () => void;
  unpackedElements: Set<string>;
  onUnpackElement: (type: OpticalElementType, id: string) => void;
}

export const KitBox: React.FC<KitBoxProps> = ({
  isOpen,
  isOnFloor,
  onToggleOpen,
  onToggleFloor,
  unpackedElements,
  onUnpackElement
}) => {
  const lidGroupRef = useRef<THREE.Group>(null);
  const currentLidAngle = useRef<number>(0);

  useFrame((_, delta) => {
    const targetAngle = isOpen ? -Math.PI * 0.6 : 0;
    currentLidAngle.current = THREE.MathUtils.lerp(
      currentLidAngle.current,
      targetAngle,
      delta * 8
    );
    if (lidGroupRef.current) {
      lidGroupRef.current.rotation.x = currentLidAngle.current;
    }
  });

  const position: [number, number, number] = isOnFloor
    ? [-0.65, -0.75, 0.45]
    : [-0.6, 0.04, 0.25];

  return (
    <group position={position} rotation={[0, 0.1, 0]}>
      {/* Wooden Case Base */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.42, 0.08, 0.32]} />
        <meshStandardMaterial
          color="#382212"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Brass Corner Brackets */}
      {[-0.205, 0.205].map((x, xi) =>
        [-0.155, 0.155].map((z, zi) => (
          <mesh key={`corner-${xi}-${zi}`} position={[x, 0, z]}>
            <boxGeometry args={[0.015, 0.082, 0.015]} />
            <meshStandardMaterial
              color="#d97706"
              metalness={0.8}
              roughness={0.3}
            />
          </mesh>
        ))
      )}

      {/* Dark Velvet/Foam Insert Tray */}
      <mesh position={[0, 0.015, 0]}>
        <boxGeometry args={[0.39, 0.06, 0.29]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Box Label Plate */}
      <mesh position={[0, 0.005, 0.161]}>
        <planeGeometry args={[0.18, 0.03]} />
        <meshStandardMaterial color="#d97706" metalness={0.7} roughness={0.3} />
      </mesh>
      <TextSprite
        text="IPhO OPTICS KIT"
        position={[0, 0.005, 0.162]}
        color="#111827"
        fontSize={18}
        scale={0.018}
      />

      {/* Interactive Foam Cutout Slots with Kit Items */}
      {isOpen && (
        <group position={[0, 0.05, 0]}>
          {/* Laser Diode Cutout */}
          {!unpackedElements.has('laser_source') && (
            <group
              position={[-0.12, 0.01, -0.08]}
              onClick={(e) => {
                e.stopPropagation();
                onUnpackElement('laser_source', 'diode-laser-green');
              }}
            >
              <mesh castShadow>
                <boxGeometry args={[0.08, 0.03, 0.04]} />
                <meshStandardMaterial color="#10b981" metalness={0.5} roughness={0.3} />
              </mesh>
              <TextSprite text="LASER 532nm" position={[0, 0.025, 0]} fontSize={14} color="#ffffff" scale={0.012} />
            </group>
          )}

          {/* Single Slit Target */}
          {!unpackedElements.has('single_slit') && (
            <group
              position={[-0.02, 0.01, -0.08]}
              onClick={(e) => {
                e.stopPropagation();
                onUnpackElement('single_slit', 'single-slit-aperture');
              }}
            >
              <mesh castShadow>
                <cylinderGeometry args={[0.018, 0.018, 0.025, 16]} />
                <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
              </mesh>
              <TextSprite text="FENDA (80µm)" position={[0, 0.025, 0]} fontSize={14} color="#f8fafc" scale={0.012} />
            </group>
          )}

          {/* Double Slit Target */}
          {!unpackedElements.has('double_slit') && (
            <group
              position={[0.06, 0.01, -0.08]}
              onClick={(e) => {
                e.stopPropagation();
                onUnpackElement('double_slit', 'double-slit-aperture');
              }}
            >
              <mesh castShadow>
                <cylinderGeometry args={[0.018, 0.018, 0.025, 16]} />
                <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.3} />
              </mesh>
              <TextSprite text="DUPLA (250µm)" position={[0, 0.025, 0]} fontSize={14} color="#f8fafc" scale={0.012} />
            </group>
          )}

          {/* Grating Target */}
          {!unpackedElements.has('diffraction_grating') && (
            <group
              position={[0.13, 0.01, -0.08]}
              onClick={(e) => {
                e.stopPropagation();
                onUnpackElement('diffraction_grating', 'diffraction-grating-target');
              }}
            >
              <mesh castShadow>
                <boxGeometry args={[0.035, 0.035, 0.01]} />
                <meshStandardMaterial color="#3b82f6" metalness={0.4} roughness={0.4} />
              </mesh>
              <TextSprite text="REDE (d)" position={[0, 0.025, 0]} fontSize={14} color="#f8fafc" scale={0.012} />
            </group>
          )}

          {/* Polarizer Target */}
          {!unpackedElements.has('polarizer') && (
            <group
              position={[-0.12, 0.01, 0.06]}
              onClick={(e) => {
                e.stopPropagation();
                onUnpackElement('polarizer', 'polarizer-rotary');
              }}
            >
              <mesh castShadow>
                <cylinderGeometry args={[0.022, 0.022, 0.015, 24]} />
                <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
              </mesh>
              <TextSprite text="POLARIZADOR" position={[0, 0.025, 0]} fontSize={14} color="#f8fafc" scale={0.012} />
            </group>
          )}

          {/* Photodetector & Micrometer Stage */}
          {!unpackedElements.has('photodetector_stage') && (
            <group
              position={[0.0, 0.015, 0.06]}
              onClick={(e) => {
                e.stopPropagation();
                onUnpackElement('photodetector_stage', 'photodetector-micrometer-stage');
              }}
            >
              <mesh castShadow>
                <boxGeometry args={[0.07, 0.04, 0.05]} />
                <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.4} />
              </mesh>
              <TextSprite text="DETECTOR + MIC" position={[0, 0.032, 0]} fontSize={14} color="#34d399" scale={0.012} />
            </group>
          )}

          {/* Projection Screen */}
          {!unpackedElements.has('projection_screen') && (
            <group
              position={[0.12, 0.015, 0.06]}
              onClick={(e) => {
                e.stopPropagation();
                onUnpackElement('projection_screen', 'projection-screen-mm');
              }}
            >
              <mesh castShadow>
                <boxGeometry args={[0.06, 0.06, 0.008]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.8} />
              </mesh>
              <TextSprite text="ANTEPARO MM" position={[0, 0.042, 0]} fontSize={14} color="#1e3a8a" scale={0.012} />
            </group>
          )}
        </group>
      )}

      {/* Hinged Lid */}
      <group position={[0, 0.04, -0.16]} ref={lidGroupRef}>
        <mesh
          castShadow
          position={[0, 0.015, 0.16]}
          onClick={(e) => {
            e.stopPropagation();
            onToggleOpen();
          }}
        >
          <boxGeometry args={[0.422, 0.03, 0.322]} />
          <meshStandardMaterial color="#2d1a0c" roughness={0.6} metalness={0.1} />
        </mesh>

        {/* Latch Hook */}
        <mesh position={[0, 0.015, 0.322]}>
          <boxGeometry args={[0.04, 0.02, 0.01]} />
          <meshStandardMaterial color="#d97706" metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Move to Floor / Table Helper */}
      <group
        position={[0, 0.12, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFloor();
        }}
      >
        <TextSprite
          text={isOnFloor ? '🔼 COLOCAR NA MESA' : '🔽 COLOCAR NO CHÃO'}
          position={[0, 0, 0]}
          fontSize={16}
          color="#94a3b8"
          backgroundColor="#1e293b"
          scale={0.02}
        />
      </group>
    </group>
  );
};
