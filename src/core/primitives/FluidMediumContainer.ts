import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export type WallMaterialType = 'optical_acrylic' | 'borosilicate_glass' | 'custom';

export interface FluidMediumContainerConfig {
  id: string;
  name: string;

  /** Dimensões externas do recipiente (largura X, altura Y, profundidade Z) em metros */
  width?: number; // default: 0.22
  height?: number; // default: 0.26
  depth?: number; // default: 0.22
  wallThickness?: number; // default: 0.06

  /** Tipo e propriedades ópticas do material das paredes */
  wallMaterialType?: WallMaterialType;
  wallColor?: THREE.ColorRepresentation; // default: '#ffffff'
  wallIor?: number; // default: 1.491 (PMMA Acrílico Óptico)
  wallTransmission?: number; // default: 0.94
  wallRoughness?: number; // default: 0.06
  wallClearcoat?: number; // default: 1.0

  /** Película protetora destacável serigrafada */
  hasPeelFilm?: boolean;
  initiallyPeeled?: boolean;
  peelFilmTexture?: THREE.Texture;

  /** Pés inferiores para travamento em sockets */
  hasFeet?: boolean;
  footSize?: [number, number, number];
  footPositions?: [number, number, number][];
  footColor?: THREE.ColorRepresentation;

  /** Propriedades do líquido contido */
  hasLiquid?: boolean;
  initiallyPoured?: boolean;
  fillLevel?: number; // 0.0 (vazio) a 1.0 (cheio)
  liquidColor?: THREE.ColorRepresentation; // default: '#f43f5e' (rosa IPhO)
  liquidIor?: number; // default: 1.332 (gabarito oficial IPhO 2024)
  liquidTransmission?: number; // default: 0.72
  attenuationColor?: THREE.ColorRepresentation; // default: '#e11d48'
  attenuationDistance?: number; // default: 0.14
  liquidRoughness?: number; // default: 0.06

  /** Superfície 3D com menisco curvo por tensão superficial / capilaridade */
  hasMeniscus?: boolean;
  meniscusSegments?: number; // default: 32
  capillaryLength?: number; // default: 0.024
  maxMeniscusRise?: number; // default: 0.011

  /** Posição inicial no espaço 3D */
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Cria a textura procedural de papel kraft com serigrafia de segurança e avisos
 * para películas protetoras destacáveis de componentes ópticos de precisão.
 */
export function createProtectivePeelTexture(): THREE.Texture {
  if (typeof document === 'undefined') {
    return new THREE.Texture();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for peel texture');
  }

  // Fundo amarelo kraft ocre
  ctx.fillStyle = '#eab308';
  ctx.fillRect(0, 0, 512, 512);

  // Ruído e textura de fibras de papel kraft
  let seed = 98765;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  ctx.fillStyle = 'rgba(161, 98, 7, 0.08)';
  for (let i = 0; i < 4000; i += 1) {
    ctx.fillRect(rand() * 512, rand() * 512, 2, 2);
  }

  // Faixas diagonais zebradas de aviso industrial no topo e na base
  const stripeH = 36;
  const drawStripes = (offsetY: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, offsetY, 512, stripeH);
    ctx.clip();
    for (let x = -50; x < 550; x += 30) {
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(x, offsetY);
      ctx.lineTo(x + 18, offsetY);
      ctx.lineTo(x + 18 - 25, offsetY + stripeH);
      ctx.lineTo(x - 25, offsetY + stripeH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };
  drawStripes(0);
  drawStripes(512 - stripeH);

  // Serigrafia técnica
  ctx.fillStyle = '#1e293b';
  ctx.font = '800 30px "Inter", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PROTECTIVE FILM', 256, 110);

  ctx.font = '700 24px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#991b1b';
  ctx.fillText('PEEL BEFORE EXPERIMENT', 256, 160);

  ctx.fillStyle = '#334155';
  ctx.font = '600 20px "Inter", Arial, sans-serif';
  ctx.fillText('OPTICAL ACRYLIC WINDOW', 256, 220);
  ctx.fillText('DO NOT TOUCH OPTICAL SURFACE', 256, 260);
  ctx.fillText('PATH LENGTH: 10.0 mm', 256, 300);
  ctx.fillText('REFRACTIVE INDEX: 1.491', 256, 340);

  ctx.fillStyle = '#991b1b';
  ctx.font = '800 26px "Inter", Arial, sans-serif';
  ctx.fillText('▼ PULL TO REMOVE ▼', 256, 420);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

/**
 * Gera uma malha 3D de menisco curvo simulando a ação capilar
 * na interface entre a parede sólida do recipiente e o líquido livre.
 */
export function createMeniscusGeometry(
  width: number,
  depth: number,
  segments = 32,
  capillaryLength = 0.024,
  maxRise = 0.011
): THREE.BufferGeometry {
  const geom = new THREE.PlaneGeometry(width, depth, segments, segments);
  geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const lc = capillaryLength;
  const hMax = maxRise;

  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    const distWallX = halfW - Math.abs(x);
    const distWallZ = halfD - Math.abs(z);

    const riseX = hMax * Math.exp(-Math.max(0, distWallX) / lc);
    const riseZ = hMax * Math.exp(-Math.max(0, distWallZ) / lc);

    const rise = Math.max(riseX, riseZ) + 0.35 * Math.min(riseX, riseZ);
    pos.setY(i, rise);
  }

  geom.computeVertexNormals();
  return geom;
}

/**
 * FluidMediumContainer: Primitiva física universal para modelagem de cubetas ópticas,
 * frascos, béqueres e recipientes de fluidos com paredes transparentes,
 * película protetora destacável, volume de fluido com refração e menisco curvo 3D.
 */
export class FluidMediumContainer {
  public readonly id: string;
  public readonly name: string;
  public readonly group = new THREE.Group();

  public readonly wallsMesh: THREE.Mesh;
  public readonly feetMeshes: THREE.Mesh[] = [];
  public readonly peelFilmMesh: THREE.Mesh | null = null;
  public readonly liquidMesh: THREE.Mesh | null = null;
  public readonly meniscusMesh: THREE.Mesh | null = null;

  private readonly peelTexture: THREE.Texture | null = null;
  private isPeeled: boolean;
  private isPoured: boolean;
  private fillLevel: number;

  constructor(config: FluidMediumContainerConfig) {
    this.id = config.id;
    this.name = config.name;
    this.isPeeled = config.initiallyPeeled ?? false;
    this.isPoured = config.initiallyPoured ?? false;
    this.fillLevel = config.fillLevel ?? (this.isPoured ? 0.72 : 0.0);

    const w = config.width ?? 0.22;
    const h = config.height ?? 0.26;
    const d = config.depth ?? 0.22;
    const centerY = 0.21;

    if (config.position) {
      this.group.position.set(...config.position);
    }
    if (config.rotation) {
      this.group.rotation.set(...config.rotation);
    }

    // 1. Paredes sólidas do recipiente (Acrílico Óptico PMMA ou Vidro Borossilicato)
    const wallGeom = new THREE.BoxGeometry(w, h, d);
    const wallMat = new THREE.MeshPhysicalMaterial({
      color: config.wallColor ?? '#ffffff',
      transparent: true,
      opacity: 1.0,
      roughness: config.wallRoughness ?? 0.06,
      metalness: 0.0,
      ior: config.wallIor ?? 1.491,
      thickness: config.wallThickness ?? 0.06,
      transmission: config.wallTransmission ?? 0.94,
      clearcoat: config.wallClearcoat ?? 1.0,
      clearcoatRoughness: 0.04,
    });
    this.wallsMesh = new THREE.Mesh(wallGeom, wallMat);
    this.wallsMesh.position.set(0, centerY, 0);
    this.wallsMesh.castShadow = false;
    this.wallsMesh.receiveShadow = true;
    this.group.add(this.wallsMesh);

    // 2. Pés inferiores de ancoragem para acoplamento em sockets
    if (config.hasFeet ?? true) {
      const fSize = config.footSize ?? [0.018, 0.018, 0.018];
      const footGeom = new THREE.BoxGeometry(...fSize);
      const footMat = new THREE.MeshStandardMaterial({
        color: config.footColor ?? '#e2e8f0',
        roughness: 0.2,
        metalness: 0.85,
      });
      const defaultPositions: [number, number, number][] = [
        [-0.09, 0.071, -0.09],
        [0.09, 0.071, -0.09],
        [-0.09, 0.071, 0.09],
        [0.09, 0.071, 0.09],
      ];
      const positions = config.footPositions ?? defaultPositions;
      positions.forEach((pos) => {
        const foot = new THREE.Mesh(footGeom, footMat);
        foot.position.set(...pos);
        foot.castShadow = false;
        foot.receiveShadow = true;
        this.feetMeshes.push(foot);
        this.group.add(foot);
      });
    }

    // 3. Película protetora destacável
    if (config.hasPeelFilm ?? false) {
      this.peelTexture = config.peelFilmTexture ?? createProtectivePeelTexture();
      const filmGeom = new THREE.BoxGeometry(w + 0.004, h + 0.004, d + 0.004);
      const filmMat = new THREE.MeshStandardMaterial({
        map: this.peelTexture,
        transparent: true,
        opacity: 0.9,
        roughness: 0.72,
        metalness: 0.05,
      });
      this.peelFilmMesh = new THREE.Mesh(filmGeom, filmMat);
      this.peelFilmMesh.position.set(0, centerY, 0);
      this.peelFilmMesh.castShadow = false;
      this.peelFilmMesh.receiveShadow = true;
      this.peelFilmMesh.visible = !this.isPeeled;
      this.group.add(this.peelFilmMesh);
    }

    // 4. Volume de líquido interno
    if (config.hasLiquid ?? true) {
      const liquidW = w - 0.03;
      const liquidH = h * 0.69;
      const liquidD = d - 0.03;

      const liquidMaterial = new THREE.MeshPhysicalMaterial({
        color: config.liquidColor ?? '#f43f5e',
        transparent: true,
        opacity: 1.0,
        roughness: config.liquidRoughness ?? 0.06,
        metalness: 0.0,
        ior: config.liquidIor ?? 1.332,
        transmission: config.liquidTransmission ?? 0.72,
        attenuationColor: new THREE.Color(config.attenuationColor ?? '#e11d48'),
        attenuationDistance: config.attenuationDistance ?? 0.14,
      });

      const liquidGeom = new THREE.BoxGeometry(liquidW, liquidH, liquidD);
      this.liquidMesh = new THREE.Mesh(liquidGeom, liquidMaterial);
      this.liquidMesh.position.set(0, 0.18, 0);
      this.liquidMesh.castShadow = false;
      this.liquidMesh.receiveShadow = true;
      this.liquidMesh.visible = this.isPoured;
      this.group.add(this.liquidMesh);

      // 5. Superfície 3D com menisco curvo
      if (config.hasMeniscus ?? true) {
        const meniscusGeom = createMeniscusGeometry(
          liquidW,
          liquidD,
          config.meniscusSegments ?? 32,
          config.capillaryLength ?? 0.024,
          config.maxMeniscusRise ?? 0.011
        );
        this.meniscusMesh = new THREE.Mesh(meniscusGeom, liquidMaterial);
        this.meniscusMesh.position.set(0, 0.27, 0);
        this.meniscusMesh.castShadow = false;
        this.meniscusMesh.receiveShadow = true;
        this.meniscusMesh.visible = this.isPoured;
        this.group.add(this.meniscusMesh);
      }
    }
  }

  public getIsPeeled(): boolean {
    return this.isPeeled;
  }

  public getIsPoured(): boolean {
    return this.isPoured;
  }

  public getFillLevel(): number {
    return this.fillLevel;
  }

  /**
   * Destaca a película protetora do recipiente
   */
  public peel(silent = false): void {
    if (!this.isPeeled) {
      this.isPeeled = true;
      if (this.peelFilmMesh) {
        this.peelFilmMesh.visible = false;
      }
      if (!silent) {
        AudioManager.playSnap();
      }
    }
  }

  public setFilmPeeled(peeled: boolean, silent = false): void {
    if (this.isPeeled !== peeled) {
      this.isPeeled = peeled;
      if (this.peelFilmMesh) {
        this.peelFilmMesh.visible = !peeled;
      }
      if (!silent && peeled) {
        AudioManager.playSnap();
      }
    }
  }

  public setFilmVisible(visible: boolean): void {
    this.isPeeled = !visible;
    if (this.peelFilmMesh) {
      this.peelFilmMesh.visible = visible;
    }
  }

  /**
   * Despeja líquido no interior do recipiente
   */
  public pour(volumeFraction = 0.72, silent = false): void {
    this.isPoured = true;
    this.fillLevel = Math.max(0, Math.min(1.0, volumeFraction));
    if (this.liquidMesh) {
      this.liquidMesh.visible = true;
    }
    if (this.meniscusMesh) {
      this.meniscusMesh.visible = true;
    }
    if (!silent) {
      AudioManager.playPour(this.fillLevel);
    }
  }

  public empty(silent = false): void {
    this.isPoured = false;
    this.fillLevel = 0;
    if (this.liquidMesh) {
      this.liquidMesh.visible = false;
    }
    if (this.meniscusMesh) {
      this.meniscusMesh.visible = false;
    }
    if (!silent) {
      AudioManager.playPour(0.5);
    }
  }

  public setLiquidPoured(poured: boolean, silent = false): void {
    if (this.isPoured !== poured) {
      this.isPoured = poured;
      if (this.liquidMesh) {
        this.liquidMesh.visible = poured;
      }
      if (this.meniscusMesh) {
        this.meniscusMesh.visible = poured;
      }
      if (!silent && poured) {
        AudioManager.playPour();
      }
    }
  }

  /**
   * Libera texturas, geometrias e materiais da memória gráfica
   */
  public dispose(): void {
    this.wallsMesh.geometry.dispose();
    const wallMat = this.wallsMesh.material;
    if (Array.isArray(wallMat)) {
      wallMat.forEach((m) => m.dispose());
    } else {
      wallMat.dispose();
    }

    this.feetMeshes.forEach((f) => {
      f.geometry.dispose();
      const m = f.material;
      if (Array.isArray(m)) m.forEach((mat) => mat.dispose());
      else m.dispose();
    });

    if (this.peelFilmMesh) {
      this.peelFilmMesh.geometry.dispose();
      const filmMat = this.peelFilmMesh.material;
      if (Array.isArray(filmMat)) filmMat.forEach((m) => m.dispose());
      else filmMat.dispose();
    }
    if (this.peelTexture) {
      this.peelTexture.dispose();
    }

    if (this.liquidMesh) {
      this.liquidMesh.geometry.dispose();
      const liqMat = this.liquidMesh.material;
      if (Array.isArray(liqMat)) liqMat.forEach((m) => m.dispose());
      else liqMat.dispose();
    }

    if (this.meniscusMesh) {
      this.meniscusMesh.geometry.dispose();
      // Compartilha material com liquidMesh, mas se for diferente, descarta
      if (this.meniscusMesh.material !== this.liquidMesh?.material) {
        const menMat = this.meniscusMesh.material;
        if (Array.isArray(menMat)) menMat.forEach((m) => m.dispose());
        else menMat.dispose();
      }
    }
  }
}
