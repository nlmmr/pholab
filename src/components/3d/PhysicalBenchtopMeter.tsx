import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TextSprite } from './TextSprite';

interface PhysicalBenchtopMeterProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  measuredPowerMw: number;
  isOn: boolean;
  unitMode: 'uW' | 'mW' | 'Lux';
  onTogglePower: () => void;
  onTare: () => void;
  onCycleUnit: () => void;
}

export const PhysicalBenchtopMeter: React.FC<PhysicalBenchtopMeterProps> = ({
  position = [0.55, 0.02, 0.22],
  rotation = [0, -0.6, 0],
  measuredPowerMw,
  isOn,
  unitMode,
  onTogglePower,
  onTare,
  onCycleUnit,
}) => {
  const lcdRef = useRef<THREE.CanvasTexture | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const displayTickRef = useRef(0);
  const displayValueRef = useRef('------');

  // Create LCD canvas texture
  const lcdTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 192;
    canvasRef.current = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    lcdRef.current = tex;
    return tex;
  }, []);

  useFrame((_, delta) => {
    displayTickRef.current += delta;
    // Update display at ~30 Hz with digit jitter
    if (displayTickRef.current > 0.033) {
      displayTickRef.current = 0;

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;

      // LCD background
      ctx.fillStyle = isOn ? '#05160b' : '#030c07';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (isOn) {
        let display = '0.000';
        let unit = 'µW';
        const jitter = (Math.random() - 0.5) * 0.004;

        if (unitMode === 'uW') {
          const v = measuredPowerMw * 1000 + jitter;
          display = Math.max(0, v).toFixed(2);
          unit = 'µW';
        } else if (unitMode === 'mW') {
          const v = measuredPowerMw + jitter * 0.001;
          display = Math.max(0, v).toFixed(4);
          unit = 'mW';
        } else {
          const v = measuredPowerMw * 683 + jitter * 683;
          display = Math.max(0, v).toFixed(1);
          unit = 'Lux';
        }

        // Primary readout — 7-segment style font
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 82px "JetBrains Mono", "Courier New", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(display, 390, 96);

        // Unit label
        ctx.fillStyle = '#16a34a';
        ctx.font = 'bold 32px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(unit, 400, 80);

        // Secondary info row
        ctx.fillStyle = '#15803d';
        ctx.font = '18px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('PM-100D   16-BIT ADC', 14, 168);

        // TARE indicator
        ctx.textAlign = 'right';
        ctx.fillText('RNG AUTO', canvas.width - 14, 168);
      }

      if (lcdRef.current) lcdRef.current.needsUpdate = true;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* === Main Instrument Enclosure === */}
      {/* Outer casing – dark brushed ABS plastic */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.09, 0.15]} />
        <meshStandardMaterial color="#111827" roughness={0.55} metalness={0.2} />
      </mesh>

      {/* Rubber feet (4 corners) */}
      {[-0.095, 0.095].flatMap(x =>
        [-0.06, 0.06].map((z, i) => (
          <mesh key={`foot-${x}-${z}`} position={[x, -0.047, z]}>
            <cylinderGeometry args={[0.008, 0.008, 0.004, 12]} />
            <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
          </mesh>
        ))
      )}

      {/* Front panel bevel (slightly lighter) */}
      <mesh position={[0, 0.001, 0.076]}>
        <boxGeometry args={[0.208, 0.086, 0.002]} />
        <meshStandardMaterial color="#1e2a3a" roughness={0.4} metalness={0.3} />
      </mesh>

      {/* === LCD Window === */}
      <mesh position={[-0.03, 0.018, 0.078]}>
        <planeGeometry args={[0.13, 0.055]} />
        <meshStandardMaterial map={lcdTexture} roughness={0.05} emissiveMap={lcdTexture} emissive={new THREE.Color(1, 1, 1)} emissiveIntensity={isOn ? 0.18 : 0} />
      </mesh>

      {/* LCD bezel */}
      <mesh position={[-0.03, 0.018, 0.0775]}>
        <boxGeometry args={[0.136, 0.061, 0.001]} />
        <meshStandardMaterial color="#0a0f1a" roughness={0.2} />
      </mesh>

      {/* === Knob / Brand Label === */}
      <TextSprite
        text="PM-100D DIGITAL PHOTOMETER"
        position={[0.04, 0.037, 0.079]}
        fontSize={10}
        color="#64748b"
        scale={0.009}
      />

      {/* === POWER Rocker Switch === */}
      <group
        position={[-0.085, -0.008, 0.079]}
        onClick={(e) => { e.stopPropagation(); onTogglePower(); }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.018, 0.026, 0.005]} />
          <meshStandardMaterial color={isOn ? '#16a34a' : '#7f1d1d'} roughness={0.3} />
        </mesh>
        <TextSprite
          text={isOn ? 'ON' : 'OFF'}
          position={[0, 0.018, 0.003]}
          fontSize={12}
          color="#ffffff"
          scale={0.007}
        />
      </group>

      {/* === ZERO/TARE Button === */}
      <group
        position={[0.045, -0.016, 0.079]}
        onClick={(e) => { e.stopPropagation(); onTare(); }}
      >
        <mesh castShadow>
          <cylinderGeometry args={[0.008, 0.008, 0.006, 16]} />
          <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.5} />
        </mesh>
        <TextSprite text="ZERO" position={[0, 0.01, 0.003]} fontSize={11} color="#94a3b8" scale={0.007} />
      </group>

      {/* === UNIT Cycle Button === */}
      <group
        position={[0.075, -0.016, 0.079]}
        onClick={(e) => { e.stopPropagation(); onCycleUnit(); }}
      >
        <mesh castShadow>
          <cylinderGeometry args={[0.008, 0.008, 0.006, 16]} />
          <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.5} />
        </mesh>
        <TextSprite text="UNIT" position={[0, 0.01, 0.003]} fontSize={11} color="#94a3b8" scale={0.007} />
      </group>

      {/* === BNC Input Socket (front) === */}
      <group position={[-0.06, -0.018, 0.079]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.007, 0.007, 0.01, 16]} />
          <meshStandardMaterial color="#d97706" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Inner pin */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.002, 0.002, 0.015, 8]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.9} />
        </mesh>
        <TextSprite text="INPUT" position={[0, -0.014, 0.006]} fontSize={9} color="#64748b" scale={0.006} />
      </group>

      {/* Power indicator LED */}
      <mesh position={[-0.085, 0.022, 0.079]}>
        <circleGeometry args={[0.004, 16]} />
        <meshBasicMaterial color={isOn ? '#22c55e' : '#374151'} />
      </mesh>

      {/* Assign interactive userData for FPS hover detection */}
      <mesh
        position={[0, 0, 0.079]}
        visible={false}
        userData={{ interactLabel: isOn ? 'Fotômetro PM-100D (ligado)' : 'Fotômetro PM-100D — clique POWER para ligar' }}
      >
        <planeGeometry args={[0.22, 0.09]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
};
