import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export type FastenerType = 'threaded' | 'elastic_oring' | 'clamping_screw';

export interface FastenerConfig {
  id: string;
  name: string;
  type: FastenerType;
  position: [number, number, number];
  rotation?: [number, number, number];
  pitchMm?: number;
  totalTurns?: number;
  color?: string;
}

export class FastenerEntity {
  public readonly id: string;
  public readonly name: string;
  public readonly type: FastenerType;
  public readonly group = new THREE.Group();

  private tightness = 1.0; // 1.0 = fully tight, 0.0 = completely free
  private currentTurn = 0;
  private totalTurns: number;
  private pitchMm: number;
  private basePosition: THREE.Vector3;
  private headMesh: THREE.Mesh;

  constructor(config: FastenerConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.totalTurns = config.totalTurns ?? 3.0;
    this.pitchMm = config.pitchMm ?? 1.5;

    this.group.position.set(...config.position);
    if (config.rotation) {
      this.group.rotation.set(...config.rotation);
    }
    this.basePosition = this.group.position.clone();

    // Procedural Mesh based on type
    if (this.type === 'elastic_oring') {
      const ringGeom = new THREE.TorusGeometry(0.04, 0.007, 8, 24);
      const ringMat = new THREE.MeshStandardMaterial({
        color: config.color || '#dc2626',
        roughness: 0.8,
        metalness: 0.1,
      });
      this.headMesh = new THREE.Mesh(ringGeom, ringMat);
      this.headMesh.rotation.x = Math.PI / 2;
    } else {
      // Threaded rod with grip top
      const rodGeom = new THREE.CylinderGeometry(0.024, 0.024, 0.22, 16);
      const rodMat = new THREE.MeshStandardMaterial({
        color: config.color || '#f1f5f9',
        roughness: 0.45,
        metalness: 0.15,
      });
      this.headMesh = new THREE.Mesh(rodGeom, rodMat);

      // Knurled cap on top
      const capGeom = new THREE.CylinderGeometry(0.038, 0.038, 0.04, 20);
      const capMat = new THREE.MeshStandardMaterial({
        color: '#e2e8f0',
        roughness: 0.6,
        metalness: 0.25,
      });
      const capMesh = new THREE.Mesh(capGeom, capMat);
      capMesh.position.y = 0.11;
      this.headMesh.add(capMesh);
    }

    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headMesh.userData.fastenerId = this.id;
    this.group.add(this.headMesh);
  }

  public getTightness(): number {
    return this.tightness;
  }

  public isTight(): boolean {
    return this.tightness >= 0.99;
  }

  public isFree(): boolean {
    return this.tightness <= 0.01;
  }

  /**
   * Giro físico para afrouxar o parafuso (rotação anti-horária)
   * @param deltaTurns Fração de voltas giradas
   */
  public loosen(deltaTurns = 0.25): boolean {
    if (this.tightness <= 0) return true;

    this.currentTurn = Math.min(this.totalTurns, this.currentTurn + deltaTurns);
    this.tightness = Math.max(0, 1.0 - this.currentTurn / this.totalTurns);

    // Deslocamento físico axial à medida que sobe a rosca
    const axialRiseM = (this.currentTurn * this.pitchMm) / 1000 * 40;
    this.headMesh.position.y = axialRiseM;
    this.headMesh.rotation.y += deltaTurns * Math.PI * 2;

    AudioManager.playScrewTurn();

    if (this.isFree()) {
      AudioManager.playSnap();
    }
    return this.isFree();
  }

  /**
   * Giro físico para apertar o parafuso (rotação horária)
   */
  public tighten(deltaTurns = 0.25): boolean {
    if (this.tightness >= 1.0) return true;

    this.currentTurn = Math.max(0, this.currentTurn - deltaTurns);
    this.tightness = Math.min(1.0, 1.0 - this.currentTurn / this.totalTurns);

    const axialRiseM = (this.currentTurn * this.pitchMm) / 1000 * 40;
    this.headMesh.position.y = axialRiseM;
    this.headMesh.rotation.y -= deltaTurns * Math.PI * 2;

    AudioManager.playScrewTurn();
    return this.tightness >= 1.0;
  }

  /**
   * Remover / destacar o componente do suporte (ex: puxar O-ring ou sacar haste frouxa)
   */
  public remove(): boolean {
    if (!this.isFree() && this.type !== 'elastic_oring') return false;
    this.group.visible = false;
    AudioManager.playSnap();
    return true;
  }

  public reset(): void {
    this.tightness = 1.0;
    this.currentTurn = 0;
    this.headMesh.position.set(0, 0, 0);
    this.headMesh.rotation.set(0, 0, 0);
    this.group.visible = true;
  }
}
