/**
 * PhOLab 2.0 - Procedural PBR Texture Generators
 * 
 * Generates ultra-high-resolution procedural CanvasTextures for:
 * 1. 3-ring concentric goniometer protractor scale (2048x2048) with bilateral 0-80° markings
 * 2. Official controller faceplate serigraphy with IPhO 54th logo (1024x640)
 * 3. Metric thread bump map (pitch = 2mm profile)
 * 4. Diamond knurl bump map for precision adjustment knobs
 * 5. Directional brushed stainless steel / aluminum texture
 * 6. Protective cuvette film texture with official "One" serigraphy
 */

import * as THREE from 'three';

/**
 * 2048x2048 Ultra-High-Resolution CanvasTexture for the precision goniometer
 * protractor scale strictly following IPhO 2024 R1:
 * - Ring 1 (Outer): 1° fine tick marks across all 360°
 * - Ring 2 (Middle): 5° intermediate ticks and 10° major division markers
 * - Ring 3 (Inner): Bilateral symmetric degree numerals (0° to 80° on both sides of optical zero)
 */
export function createGoniometerTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  const center = 1024;
  ctx.clearRect(0, 0, 2048, 2048);

  // Annular dial disc with brushed metal appearance
  ctx.beginPath();
  ctx.arc(center, center, 960, 0, Math.PI * 2);
  ctx.arc(center, center, 620, 0, Math.PI * 2, true);
  const grad = ctx.createRadialGradient(center, center, 620, center, center, 960);
  grad.addColorStop(0, '#f8fafc');
  grad.addColorStop(0.2, '#f1f5f9');
  grad.addColorStop(0.5, '#e2e8f0');
  grad.addColorStop(0.8, '#f1f5f9');
  grad.addColorStop(1, '#e2e8f0');
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle concentric guide rings
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  [620, 680, 760, 840, 920, 960].forEach((r) => {
    ctx.beginPath();
    ctx.arc(center, center, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Highlight border rings
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(center, center, 960, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(center, center, 620, 0, Math.PI * 2);
  ctx.stroke();

  // Crosshair fiducial lines through center
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
  ctx.lineWidth = 2;
  [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((ang) => {
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(ang) * 620, center + Math.sin(ang) * 620);
    ctx.lineTo(center + Math.cos(ang) * 960, center + Math.sin(ang) * 960);
    ctx.stroke();
  });

  // Ring 1 & Ring 2: 1°, 5°, and 10° graduations
  for (let deg = 0; deg < 360; deg++) {
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const is10 = deg % 10 === 0;
    const is5 = deg % 5 === 0;

    let tickLength = 16; // Ring 1: 1° fine tick
    let lineWidth = 2;
    let strokeStyle = '#475569';

    if (is10) {
      tickLength = 52; // Ring 2: 10° major division
      lineWidth = 5;
      strokeStyle = '#0f172a';
    } else if (is5) {
      tickLength = 34; // Ring 2: 5° intermediate division
      lineWidth = 3.5;
      strokeStyle = '#1e293b';
    }

    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(center + cos * 960, center + sin * 960);
    ctx.lineTo(center + cos * (960 - tickLength), center + sin * (960 - tickLength));
    ctx.stroke();
  }

  // Ring 3 (Inner): Bilateral 0° to 80° angular markings on both sides of optical zero
  // Optical zero is along the longitudinal X axis (0° and 180°).
  // Symmetrical markings count 0° to 80° clockwise and counter-clockwise.
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const labelRadius = 860;

  for (let deg = 0; deg < 360; deg += 10) {
    // Bilateral offset from nearest optical zero (0° or 180°)
    let relativeAngle = deg <= 180 ? deg : 360 - deg;
    if (relativeAngle > 90) {
      relativeAngle = 180 - relativeAngle;
    }

    if (relativeAngle <= 80) {
      const rad = (deg * Math.PI) / 180;
      const lx = center + Math.cos(rad) * labelRadius;
      const ly = center + Math.sin(rad) * labelRadius;

      ctx.save();
      ctx.translate(lx, ly);
      // Tangent alignment for high readability
      ctx.rotate(rad + Math.PI / 2);
      ctx.fillText(`${relativeAngle}°`, 0, 0);
      ctx.restore();
    }
  }

  // Subtitle technical branding serigraphy on dial disc
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.font = '800 24px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('IPhO 2024 GONIOMETER ROTARY STAGE', center, center - 730);
  ctx.font = '600 18px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('DUAL-SIDED 0° - 80° SYMMETRIC VERNIER • 1° ACCURACY', center, center + 730);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/**
 * 1024x640 High-Resolution Faceplate Serigraphy CanvasTexture for the Electronic Controller.
 * Features official IPhO 54th logo, "Laser Current Controller", "5V Power Supply",
 * "Laser Key", and exact panel markings per R1.
 */
export function createSilkscreenTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  // Background molded white ABS chassis finish
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 1024, 640);

  // Subtle outer chamfer border line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 4;
  ctx.strokeRect(16, 16, 992, 608);

  // Header banner: 54th International Physics Olympiad
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 26px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('54th INTERNATIONAL PHYSICS OLYMPIAD', 48, 56);

  ctx.font = '600 16px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('EXPERIMENTAL COMPETITION E2 • OPTICAL LABORATORY APPARATUS', 48, 82);

  // Draw stylized IPhO 54th Emblem / Badge on top-right
  ctx.save();
  const badgeX = 920;
  const badgeY = 60;
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 32, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.arc(badgeX, badgeY, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px "Inter", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('IPhO', badgeX, badgeY + 24);
  ctx.fillText('54th', badgeX, badgeY - 18);
  ctx.restore();

  // Horizontal divider line
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(48, 104);
  ctx.lineTo(976, 104);
  ctx.stroke();

  // Primary Equipment Title: "Laser Current Controller"
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 32px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Laser Current Controller', 48, 148);

  // Section 1 (Left): Power Switch & Laser Key
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(48, 180, 260, 410);

  ctx.fillStyle = '#0369a1';
  ctx.font = '800 18px "Inter", Arial, sans-serif';
  ctx.fillText('MAIN CONTROL', 64, 210);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 15px "Inter", Arial, sans-serif';
  ctx.fillText('POWER SWITCH', 64, 248);
  ctx.font = '800 18px monospace';
  ctx.fillText('I  [ ON ]', 80, 278);
  ctx.fillText('O  [ OFF ]', 80, 308);

  // Laser Key / Interlock Warning
  ctx.fillStyle = '#b91c1c';
  ctx.font = '800 16px "Inter", Arial, sans-serif';
  ctx.fillText('LASER KEY', 64, 380);
  ctx.font = '500 13px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#475569';
  ctx.fillText('Interlock Active When', 64, 404);
  ctx.fillText('Key Inserted & Turned', 64, 424);

  // Laser Indicator LED label
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 14px "Inter", Arial, sans-serif';
  ctx.fillText('EMISSION LED', 64, 490);
  ctx.fillStyle = '#dc2626';
  ctx.font = '800 12px "Inter", Arial, sans-serif';
  ctx.fillText('● RED: ACTIVE', 64, 512);

  // Section 2 (Center): LCD Telemetry & Port Serigraphy
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(332, 180, 360, 410);

  ctx.fillStyle = '#0369a1';
  ctx.font = '800 18px "Inter", Arial, sans-serif';
  ctx.fillText('TELEMETRY DISPLAY', 348, 210);

  // LCD Bezel Outline Marking
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.strokeRect(362, 230, 300, 140);
  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DIGITAL CURRENT LCD (mA)', 512, 388);

  // 5V Power Supply serigraphy
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 20px "Inter", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('5V Power Supply', 512, 440);
  ctx.font = '600 14px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('USB-C 5.0V DC / 2.0A INPUT', 512, 464);

  // Section 3 (Right): Current Potentiometer & Green Euroblock Terminal
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(716, 180, 260, 410);

  ctx.fillStyle = '#0369a1';
  ctx.font = '800 18px "Inter", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('CURRENT ADJUST', 732, 210);

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 14px "Inter", Arial, sans-serif';
  ctx.fillText('RANGE: 0.0 - 25.0 mA', 732, 240);

  // Dial circular graduation arc around potentiometer
  const dialX = 846;
  const dialY = 320;
  const dialR = 64;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(dialX, dialY, dialR, 0.75 * Math.PI, 2.25 * Math.PI);
  ctx.stroke();

  // Tick marks around dial
  for (let i = 0; i <= 10; i++) {
    const frac = i / 10;
    const ang = 0.75 * Math.PI + frac * 1.5 * Math.PI;
    const innerR = i % 2 === 0 ? dialR - 14 : dialR - 8;
    ctx.lineWidth = i % 2 === 0 ? 3 : 1.5;
    ctx.strokeStyle = i % 2 === 0 ? '#0f172a' : '#64748b';
    ctx.beginPath();
    ctx.moveTo(dialX + Math.cos(ang) * dialR, dialY + Math.sin(ang) * dialR);
    ctx.lineTo(dialX + Math.cos(ang) * innerR, dialY + Math.sin(ang) * innerR);
    ctx.stroke();
  }

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px "Inter", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('0', dialX - 52, dialY + 54);
  ctx.fillText('12.5', dialX, dialY - 72);
  ctx.fillText('25', dialX + 52, dialY + 54);

  // Green detachable Euroblock port serigraphy
  ctx.fillStyle = '#15803d';
  ctx.font = '800 16px "Inter", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LASER TERMINAL [ +  - ]', 732, 450);
  ctx.fillStyle = '#475569';
  ctx.font = '600 13px "Inter", Arial, sans-serif';
  ctx.fillText('Green 2-Pin Euroblock', 732, 474);
  ctx.fillText('Constant Current Source', 732, 494);

  // Bottom safety warning
  ctx.fillStyle = '#dc2626';
  ctx.font = '700 13px "Inter", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('⚠️ CAUTION: CLASS 3R LASER RADIATION • EMISSION WAVELENGTH λ = 650 nm', 512, 616);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.generateMipmaps = true;
  return texture;
}

/**
 * 512x512 Procedural Normal/Bump texture for Metric Thread ridges (pitch = 2.0 mm).
 * Produces crisp periodic helical/grooved surface relief on nylon fastener rods.
 */
export function createThreadBumpTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  const numThreads = 32;
  const threadH = 512 / numThreads;

  for (let i = 0; i < numThreads; i++) {
    const y0 = i * threadH;
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + threadH);
    grad.addColorStop(0.0, '#101010'); // Root of thread (deep groove)
    grad.addColorStop(0.45, '#e0e0e0'); // Thread flank rising
    grad.addColorStop(0.55, '#ffffff'); // Thread crest
    grad.addColorStop(1.0, '#101010'); // Flank falling back to root
    ctx.fillStyle = grad;
    ctx.fillRect(0, y0, 512, threadH);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 4);
  return texture;
}

/**
 * 512x512 Procedural Diamond Knurling Bump Texture.
 * Generates intersecting 45-degree ridges for grip knobs and thumbscrews.
 */
export function createKnurlBumpTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = '#606060';
  ctx.fillRect(0, 0, 512, 512);

  const step = 8;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  for (let i = -512; i < 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 512, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, 512);
    ctx.lineTo(i + 512, 0);
    ctx.stroke();
  }

  ctx.strokeStyle = '#101010';
  ctx.lineWidth = 1.0;
  for (let i = -512 + step / 2; i < 1024; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 512, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, 512);
    ctx.lineTo(i + 512, 0);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
}

/**
 * 512x512 Procedural Directional Brushed Metal Texture for machined aluminum and steel.
 */
export function createBrushedMetalTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = '#d1d5db';
  ctx.fillRect(0, 0, 512, 512);

  // Deterministic pseudo-random streaks
  let seed = 42;
  function rand(): number {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  }

  for (let y = 0; y < 512; y += 2) {
    const val = 180 + Math.floor(rand() * 60);
    ctx.fillStyle = `rgb(${val}, ${val}, ${val})`;
    ctx.fillRect(0, y, 512, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  return texture;
}

/**
 * 512x512 High-Resolution Texture for the Protective Film on the Optical Cuvette.
 * Strictly adheres to IPhO 2024 Fig. 4-4 featuring the prominent bold label "One",
 * yellow peelable backing, and caution notes.
 */
export function createCuvettePeelTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  // Vivid safety yellow backing (#eab308 / #facc15)
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 512, 512);

  // Diagonal black safety warning border stripes (top and bottom)
  const stripeH = 34;
  ctx.save();
  ctx.fillStyle = '#0f172a';
  for (let offset = 0; offset <= 512 - stripeH; offset += 512 - stripeH) {
    for (let x = -stripeH; x < 512 + stripeH; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, offset);
      ctx.lineTo(x + 18, offset);
      ctx.lineTo(x + 18 - 20, offset + stripeH);
      ctx.lineTo(x - 20, offset + stripeH);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();

  // Prominent bold label "One" (official IPhO 2024 photograph Fig. 4-4)
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 84px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('One', 256, 150);

  // Border frame around "One"
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(96, 70, 320, 110);

  // Subtitle warning
  ctx.fillStyle = '#991b1b';
  ctx.font = '800 24px "Inter", "Segoe UI", Arial, sans-serif';
  ctx.fillText('PROTECTIVE ADHESIVE FILM', 256, 220);
  ctx.font = '700 20px "Inter", Arial, sans-serif';
  ctx.fillText('PEEL BEFORE EXPERIMENT', 256, 255);

  // Technical specifications
  ctx.fillStyle = '#334155';
  ctx.font = '600 18px "Inter", Arial, sans-serif';
  ctx.fillText('OPTICAL PMMA ACRYLIC', 256, 310);
  ctx.fillText('PATH LENGTH: 10.0 mm', 256, 345);
  ctx.fillText('REFRACTIVE INDEX: n = 1.491', 256, 380);

  // Pull Tab Arrow Indicator
  ctx.fillStyle = '#991b1b';
  ctx.font = '900 24px "Inter", Arial, sans-serif';
  ctx.fillText('▼ PULL CORNER TO REMOVE ▼', 256, 445);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}
