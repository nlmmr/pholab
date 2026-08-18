import React, { useRef, useState } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { TextSprite } from './TextSprite';

interface MicrometerPhotodetectorProps {
  transversePosMm: number;
  onTransverseChange: (newMm: number) => void;
  isLaserIlluminated?: boolean;
  alignmentEfficiency: number; // 0.0 to 1.0 – set by mechanical alignment engine
}

export const MicrometerPhotodetector: React.FC<MicrometerPhotodetectorProps> = ({
  transversePosMm,
  onTransverseChange,
  isLaserIlluminated = false,
  alignmentEfficiency = 1.0,
}) => {
  const zOffset = transversePosMm / 1000;
  const thimbleAngle = (transversePosMm / 0.5) * 2 * Math.PI; // 0.5 mm per revolution

  // Tangential drag state
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const startPosMmRef = useRef(transversePosMm);
  const [isHovered, setIsHovered] = useState(false);

  // Each px of drag = 0.005 mm (fine tangential rotation)
  const MM_PER_PX = 0.005;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartYRef.current = e.nativeEvent.clientY;
    startPosMmRef.current = transversePosMm;
    (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    const deltaY = e.nativeEvent.clientY - dragStartYRef.current;
    // Drag up → positive (move away from viewer), drag down → negative
    const newMm = THREE.MathUtils.clamp(
      startPosMmRef.current - deltaY * MM_PER_PX,
      -25.0,
      25.0
    );
    const snapped = Math.round(newMm * 100) / 100; // 0.01 mm precision
    onTransverseChange(snapped);
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    isDraggingRef.current = false;
  };

  return (
    <group>
      {/* Base Dovetail Translation Stage */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.04, 0.02, 0.09]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Micrometer Barrel & Rotating Thimble group */}
      <group position={[0, 0, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
        {/* Fixed Sleeve with 0.5 mm longitudinal lines */}
        <mesh position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.03, 24]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.7} />
        </mesh>

        {/* Reference line on sleeve */}
        <mesh position={[0, 0.015, 0.007]}>
          <boxGeometry args={[0.001, 0.03, 0.001]} />
          <meshStandardMaterial color="#111827" />
        </mesh>

        {/* Rotating Thimble — tangential drag target */}
        <group
          position={[0, 0.03 + zOffset * 0.5, 0]}
          rotation={[thimbleAngle, 0, 0]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
        >
          <mesh castShadow userData={{ interactLabel: `Micrômetro: ${transversePosMm >= 0 ? '+' : ''}${transversePosMm.toFixed(2)} mm — arrastar para girar` }}>
            <cylinderGeometry args={[0.009, 0.009, 0.025, 24]} />
            <meshStandardMaterial
              color={isHovered ? '#4b5563' : '#334155'}
              roughness={0.4}
              metalness={0.8}
            />
          </mesh>

          {/* Thimble degree graduation lines (25 divisions) */}
          {Array.from({ length: 25 }, (_, i) => {
            const ang = (i / 25) * Math.PI * 2;
            const r = 0.0095;
            return (
              <mesh key={i} position={[Math.cos(ang) * r, 0, Math.sin(ang) * r]} rotation={[0, ang, 0]}>
                <boxGeometry args={[0.001, i % 5 === 0 ? 0.008 : 0.005, 0.001]} />
                <meshStandardMaterial color="#111827" />
              </mesh>
            );
          })}

          {/* Knurled Grip Ring */}
          <mesh position={[0, 0.014, 0]}>
            <cylinderGeometry args={[0.0095, 0.0095, 0.006, 24]} />
            <meshStandardMaterial color="#1e293b" roughness={0.8} metalness={0.5} />
          </mesh>
        </group>
      </group>

      {/* Moving Slide Carriage */}
      <group position={[0, 0.018, zOffset]}>
        <mesh castShadow>
          <boxGeometry args={[0.032, 0.016, 0.035]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Photodiode Aperture Tube */}
        <mesh position={[-0.018, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.006, 0.006, 0.01, 24]} />
          <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.8} />
        </mesh>

        {/* Silicon detector chip */}
        <mesh position={[-0.0235, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <circleGeometry args={[0.003, 16]} />
          <meshStandardMaterial
            color={alignmentEfficiency > 0.5 ? '#0284c7' : '#374151'}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>

        {/* Illuminated spot when laser is on beam */}
        {isLaserIlluminated && alignmentEfficiency > 0.2 && (
          <mesh position={[-0.0238, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <circleGeometry args={[0.0012 * alignmentEfficiency, 16]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={alignmentEfficiency} />
          </mesh>
        )}

        {/* BNC Output Port on back of detector */}
        <group position={[0.018, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh>
            <cylinderGeometry args={[0.005, 0.005, 0.008, 16]} />
            <meshStandardMaterial color="#d97706" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>

        {/* Position vernier engraving */}
        <TextSprite
          text={`${transversePosMm >= 0 ? '+' : ''}${transversePosMm.toFixed(2)} mm`}
          position={[0, 0.013, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          color="#fbbf24"
          fontSize={16}
          scale={0.012}
        />
      </group>
    </group>
  );
};
