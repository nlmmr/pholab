import React, { useMemo, useState } from 'react';
import * as THREE from 'three';

interface PhysicalTaskSheetProps {
  /** World position on the desk */
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Raw text lines of the task (rendered directly onto paper texture) */
  taskLines: string[];
  markingSchemeLines: string[];
}

function renderPaperTexture(lines: string[], title: string): THREE.CanvasTexture {
  const W = 794; // A4-like proportion
  const H = 1123;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Paper base – slightly off-white with very subtle grain
  ctx.fillStyle = '#f9f6f0';
  ctx.fillRect(0, 0, W, H);

  // Grain simulation
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.015})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  // Header bar
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, W, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('INTERNATIONAL PHYSICS OLYMPIAD', W / 2, 26);
  ctx.font = '16px "JetBrains Mono", monospace';
  ctx.fillText(title, W / 2, 50);

  // IPhO logo ring decoration
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(40, 32, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W - 40, 32, 22, 0, Math.PI * 2);
  ctx.stroke();

  // Body text
  ctx.fillStyle = '#111827';
  ctx.textAlign = 'left';

  let y = 90;
  for (const raw of lines) {
    const line = raw ?? '';

    // Section headers (all-caps lines)
    if (line.match(/^[A-Z0-9\s\(\)\.]+:?$/) && line.length > 3 && !line.match(/^\d/)) {
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      ctx.fillStyle = '#1e3a8a';
      ctx.fillText(line, 36, y);
      y += 20;
      // Underline
      ctx.strokeStyle = '#1e3a8a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(36, y - 4);
      ctx.lineTo(W - 36, y - 4);
      ctx.stroke();
      y += 4;
    } else if (line.startsWith('  ')) {
      // Indented formula / code block
      ctx.font = '13px "JetBrains Mono", monospace';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(line, 60, y);
      y += 18;
    } else if (line.trim() === '') {
      y += 10;
    } else {
      // Normal body text
      ctx.font = '13px Arial, sans-serif';
      ctx.fillStyle = '#1f2937';

      // Word wrap at 72 chars
      const words = line.split(' ');
      let row = '';
      const maxW = W - 72;
      for (const word of words) {
        const test = row + (row ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxW - 36) {
          ctx.fillText(row, 36, y);
          y += 17;
          row = word;
        } else {
          row = test;
        }
      }
      if (row) {
        ctx.fillText(row, 36, y);
        y += 17;
      }
    }

    if (y > H - 60) break;
  }

  // Footer with page number
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PhOLab — Open Source Physics Olympiad Simulator', W / 2, H - 20);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export const PhysicalTaskSheet: React.FC<PhysicalTaskSheetProps> = ({
  position = [-0.55, 0.011, 0.2],
  rotation = [0, 0.15, 0],
  taskLines,
  markingSchemeLines,
}) => {
  const [showScheme, setShowScheme] = useState(false);

  const taskTex = useMemo(() => renderPaperTexture(taskLines, 'EXPERIMENTAL TASK — OPTICS'), [taskLines]);
  const schemeTex = useMemo(() => renderPaperTexture(markingSchemeLines, 'MARKING SCHEME'), [markingSchemeLines]);

  const currentTex = showScheme ? schemeTex : taskTex;

  // A4 paper dimensions scaled to world units (A4 = 21 cm × 29.7 cm)
  const W = 0.21;
  const H = 0.297;

  return (
    <group position={position} rotation={rotation}>
      {/* Slightly raised paper stack (2-3 mm) for depth */}
      <mesh receiveShadow position={[0, -0.001, 0]}>
        <boxGeometry args={[W + 0.002, 0.003, H + 0.002]} />
        <meshStandardMaterial color="#e8dfd0" roughness={0.9} />
      </mesh>

      {/* Face of top sheet with printed task */}
      <mesh
        position={[0, 0.002, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ interactLabel: showScheme ? 'Marking Scheme — clique para ver Enunciado' : 'Enunciado da Prova IPhO — clique para ver Marking Scheme' }}
        onClick={(e) => { e.stopPropagation(); setShowScheme(s => !s); }}
      >
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={currentTex} roughness={0.85} />
      </mesh>

      {/* Subtle paper edge shadow on desk */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W + 0.012, H + 0.012]} />
        <meshBasicMaterial color="#00000015" transparent opacity={0.12} depthWrite={false} />
      </mesh>

      {/* Flip-page corner dog-ear indicator */}
      <mesh position={[W / 2 - 0.01, 0.003, -H / 2 + 0.01]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[0.022, 0.022]} />
        <meshStandardMaterial color="#d1c4a8" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
