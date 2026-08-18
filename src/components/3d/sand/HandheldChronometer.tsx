import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TextSprite } from '../TextSprite';

interface HandheldChronometerProps {
  position?: [number, number, number];
  timeSeconds: number;
  isRunning: boolean;
  onToggleStartStop: () => void;
  onReset: () => void;
}

export const HandheldChronometer: React.FC<HandheldChronometerProps> = ({
  position = [0.15, 0.025, 0.28],
  timeSeconds,
  isRunning,
  onToggleStartStop,
  onReset,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lcdTexRef = useRef<THREE.CanvasTexture | null>(null);

  const lcdTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    canvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    lcdTexRef.current = tex;
    return tex;
  }, []);

  useFrame(() => {
    if (canvasRef.current && lcdTexRef.current) {
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.fillStyle = '#8395a7';
      ctx.fillRect(0, 0, 256, 128);

      const mins = Math.floor(timeSeconds / 60);
      const secs = (timeSeconds % 60).toFixed(2).padStart(5, '0');
      const timeStr = `${String(mins).padStart(2, '0')}:${secs}`;

      ctx.fillStyle = '#101418';
      ctx.font = 'bold 50px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeStr, 128, 64);

      lcdTexRef.current.needsUpdate = true;
    }
  });

  return (
    <group position={position} rotation={[-Math.PI / 6, 0, 0]}>
      {/* Stopwatch casing (k) */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.045, 0.045, 0.016, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} />
      </mesh>

      {/* Top crown / lanyard ring */}
      <mesh position={[0, 0.048, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.01, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
      </mesh>

      {/* LCD Display Face */}
      <mesh position={[0, 0, 0.009]}>
        <planeGeometry args={[0.065, 0.035]} />
        <meshStandardMaterial map={lcdTexture} roughness={0.1} />
      </mesh>

      {/* START/STOP Button (Right shoulder) */}
      <group
        position={[0.045, 0.03, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStartStop();
        }}
      >
        <mesh castShadow>
          <cylinderGeometry args={[0.006, 0.006, 0.008, 16]} />
          <meshStandardMaterial color={isRunning ? '#ef4444' : '#10b981'} roughness={0.4} />
        </mesh>
        <TextSprite
          text={isRunning ? 'STOP' : 'START'}
          position={[0, 0.012, 0]}
          color="#ffffff"
          fontSize={10}
          scale={0.006}
        />
      </group>

      {/* RESET Button (Left shoulder) */}
      <group
        position={[-0.045, 0.03, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onReset();
        }}
      >
        <mesh castShadow>
          <cylinderGeometry args={[0.006, 0.006, 0.008, 16]} />
          <meshStandardMaterial color="#64748b" roughness={0.4} />
        </mesh>
        <TextSprite text="RESET" position={[0, 0.012, 0]} color="#ffffff" fontSize={10} scale={0.006} />
      </group>

      <TextSprite
        text="CRONÔMETRO (k)"
        position={[0, -0.032, 0.01]}
        color="#94a3b8"
        fontSize={10}
        scale={0.006}
      />
    </group>
  );
};
