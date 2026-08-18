import * as THREE from 'three';

/**
 * Procedural texture generators for realistic engraved scientific instruments
 */

export class ProceduralTextures {
  /**
   * Generates a 2048x128 texture for the 1000 mm optical rail scale
   */
  public static createRailScaleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Brushed anodized aluminum base
    ctx.fillStyle = '#b0b8c4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle metallic horizontal grain
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let y = 0; y < canvas.height; y += 2) {
      ctx.fillRect(0, y, canvas.width, 1);
    }

    // Engraved scale markings (0 to 1000 mm)
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.5;
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    const totalMm = 1000;
    for (let mm = 0; mm <= totalMm; mm++) {
      const x = (mm / totalMm) * (canvas.width - 40) + 20;

      if (mm % 10 === 0) {
        // 10 mm major tick
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 48);
        ctx.stroke();

        // Number label (e.g. 0, 10, 20... in cm or mm)
        if (mm % 50 === 0) {
          ctx.fillText((mm / 10).toString(), x, 75);
        }
      } else if (mm % 5 === 0) {
        // 5 mm medium tick
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 32);
        ctx.stroke();
      } else {
        // 1 mm minor tick
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 18);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Generates a 1024x1024 millimetric grid texture for projection screen
   */
  public static createScreenGridTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Matte white/ivory laboratory screen background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridSize = 1024;
    const mmStep = 10.24; // ~100 mm total span

    // 1 mm minor lines (very faint)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
    ctx.lineWidth = 1;
    for (let p = 0; p <= gridSize; p += mmStep) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, gridSize);
      ctx.moveTo(0, p);
      ctx.lineTo(gridSize, p);
      ctx.stroke();
    }

    // 5 mm intermediate lines
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.lineWidth = 1.2;
    for (let p = 0; p <= gridSize; p += mmStep * 5) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, gridSize);
      ctx.moveTo(0, p);
      ctx.lineTo(gridSize, p);
      ctx.stroke();
    }

    // 10 mm major lines with numbers
    ctx.strokeStyle = 'rgba(30, 58, 138, 0.6)';
    ctx.fillStyle = '#1e3a8a';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.lineWidth = 1.8;
    for (let p = 0; p <= gridSize; p += mmStep * 10) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, gridSize);
      ctx.moveTo(0, p);
      ctx.lineTo(gridSize, p);
      ctx.stroke();
    }

    // Center Crosshair
    const center = gridSize / 2;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, gridSize);
    ctx.moveTo(0, center);
    ctx.lineTo(gridSize, center);
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Generates a 1024x1024 360-degree protractor dial texture
   */
  public static createProtractorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    const cx = 512;
    const cy = 512;
    const radius = 480;

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = '#f8fafc';
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let deg = 0; deg < 360; deg++) {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      let tickLen = 15;
      if (deg % 10 === 0) tickLen = 35;
      else if (deg % 5 === 0) tickLen = 25;

      const x1 = cx + (radius - tickLen) * cos;
      const y1 = cy + (radius - tickLen) * sin;
      const x2 = cx + radius * cos;
      const y2 = cy + radius * sin;

      ctx.lineWidth = deg % 10 === 0 ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      if (deg % 30 === 0) {
        const tx = cx + (radius - 60) * cos;
        const ty = cy + (radius - 60) * sin;
        ctx.fillText(deg.toString() + '°', tx, ty);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
}
