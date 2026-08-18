import React, { useMemo } from 'react';
import { TextSprite } from './TextSprite';

interface ExamClockProps {
  position?: [number, number, number];
  secondsRemaining: number;
  isRunning: boolean;
}

export const ExamClock: React.FC<ExamClockProps> = ({
  position = [0.72, 0.05, -0.32],
  secondsRemaining,
  isRunning
}) => {
  const timeFormatted = useMemo(() => {
    const hrs = Math.floor(secondsRemaining / 3600);
    const mins = Math.floor((secondsRemaining % 3600) / 60);
    const secs = secondsRemaining % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [secondsRemaining]);

  return (
    <group position={position} rotation={[0, -0.25, 0]}>
      {/* Clock Casing */}
      <mesh castShadow receiveShadow position={[0, 0.04, 0]}>
        <boxGeometry args={[0.16, 0.08, 0.06]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Faceplate */}
      <mesh position={[0, 0.042, 0.031]}>
        <boxGeometry args={[0.14, 0.06, 0.002]} />
        <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.4} />
      </mesh>

      {/* Recessed LCD Window */}
      <mesh position={[0, 0.045, 0.032]}>
        <planeGeometry args={[0.12, 0.04]} />
        <meshStandardMaterial color="#05140e" roughness={0.1} metalness={0.2} />
      </mesh>

      {/* Glowing Digital Time Text */}
      <TextSprite
        text={timeFormatted}
        position={[0, 0.045, 0.033]}
        color="#34d399"
        fontSize={28}
        scale={0.025}
      />

      {/* Status LED */}
      <mesh position={[0.05, 0.068, 0.032]}>
        <circleGeometry args={[0.003, 16]} />
        <meshBasicMaterial color={isRunning ? '#10b981' : '#f59e0b'} />
      </mesh>
    </group>
  );
};
