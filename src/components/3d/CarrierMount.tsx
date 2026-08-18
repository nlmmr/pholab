import React, { useRef, useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { TextSprite } from './TextSprite';

interface CarrierMountProps {
  carrierId: string;
  positionMm: number;
  isLocked: boolean;
  isSelected?: boolean;
  onPositionChange: (newPosMm: number) => void;
  onToggleLock: () => void;
  onSelect: () => void;
  children?: React.ReactNode;
}

export const CarrierMount: React.FC<CarrierMountProps> = ({
  carrierId,
  positionMm,
  isLocked,
  isSelected,
  onPositionChange,
  onToggleLock,
  onSelect,
  children
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number>(0);
  const startPosMm = useRef<number>(positionMm);

  const xWorld = (positionMm / 1000) - 0.5;

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect();
    if (!isLocked) {
      setIsDragging(true);
      dragStartX.current = e.point.x;
      startPosMm.current = positionMm;
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isDragging && !isLocked) {
      e.stopPropagation();
      const deltaXWorld = e.point.x - dragStartX.current;
      const deltaMm = deltaXWorld * 1000;
      const newPos = Math.max(0, Math.min(1000, Math.round(startPosMm.current + deltaMm)));
      onPositionChange(newPos);
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (isDragging) {
      e.stopPropagation();
      setIsDragging(false);
    }
  };

  return (
    <group
      position={[xWorld, 0.053, -0.05]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Carrier Slider Saddle Block */}
      <mesh castShadow receiveShadow position={[0, 0.005, 0]}>
        <boxGeometry args={[0.045, 0.018, 0.075]} />
        <meshStandardMaterial
          color={isSelected ? '#3b82f6' : '#1e293b'}
          roughness={0.4}
          metalness={0.7}
        />
      </mesh>

      {/* Vernier / Cursor Index Plate */}
      <mesh position={[0, -0.005, 0.038]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[0.015, 0.012, 0.002]} />
        <meshStandardMaterial color="#ef4444" roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Position mm Text Label on Carrier */}
      <TextSprite
        text={`${Math.round(positionMm)} mm`}
        position={[0, 0.02, 0.038]}
        color="#fbbf24"
        fontSize={16}
        scale={0.014}
      />

      {/* Virtual Locking Thumbscrew */}
      <group
        position={[0, 0.005, -0.042]}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLock();
        }}
      >
        <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.01, 16]} />
          <meshStandardMaterial
            color={isLocked ? '#10b981' : '#d97706'}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        <TextSprite
          text={isLocked ? '🔒 TRAVADO' : '🔓 SOLTO'}
          position={[0, 0.015, 0]}
          color="#94a3b8"
          fontSize={14}
          scale={0.01}
        />
      </group>

      {/* Vertical Stainless Steel Post Collar */}
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.1, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Post Clamp Ring with Thumbscrew */}
      <mesh position={[0, 0.11, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.015, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Mounted Optical Element Children */}
      <group position={[0, 0.12, 0]}>{children}</group>
    </group>
  );
};
