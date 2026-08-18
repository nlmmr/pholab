import React, { useMemo } from 'react';
import * as THREE from 'three';

interface TextSpriteProps {
  text: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  padding?: number;
  scale?: number;
}

/**
 * High-performance, zero-network-dependency 3D Text Sprite using Procedural HTML Canvas
 */
export const TextSprite: React.FC<TextSpriteProps> = ({
  text,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  fontSize = 24,
  color = '#ffffff',
  backgroundColor,
  scale = 0.04
}) => {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize * 2}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const lines = text.split('\n');
    const lineHeight = (fontSize * 2) * 1.2;
    const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, fontSize, color, backgroundColor]);

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[scale * 4, scale]} />
      <meshBasicMaterial map={texture} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
};
