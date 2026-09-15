import * as THREE from 'three';
import { Collider } from './colliders/Collider';

export interface RigidBodyOptions {
  id: string;
  collider: Collider;
  position?: THREE.Vector3;
  velocity?: THREE.Vector3;
  quaternion?: THREE.Quaternion;
  mass?: number;
  restitution?: number;
  friction?: number;
  isStatic?: boolean;
  isHeld?: boolean;
}

/**
 * Rigid body state representation for the 120-Hz physics simulation.
 */
export class RigidBody {
  public id: string;
  public collider: Collider;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public quaternion: THREE.Quaternion;
  public mass: number;
  public restitution: number;
  public friction: number;
  public isStatic: boolean;
  public isHeld: boolean;
  public isGrounded: boolean = false;
  public isSleeping: boolean = false;

  /** Consecutive frames at near-zero velocity before sleep transition */
  public sleepCounter: number = 0;

  constructor(options: RigidBodyOptions) {
    this.id = options.id;
    this.collider = options.collider;
    this.position = options.position ? options.position.clone() : new THREE.Vector3();
    this.velocity = options.velocity ? options.velocity.clone() : new THREE.Vector3();
    this.quaternion = options.quaternion ? options.quaternion.clone() : new THREE.Quaternion();
    this.mass = options.isStatic ? 0 : (options.mass ?? 1.0);
    // Enforce realistic inelastic damping e <= 0.25
    this.restitution = Math.min(0.25, Math.max(0, options.restitution ?? 0.18));
    this.friction = options.friction ?? 0.4;
    this.isStatic = options.isStatic ?? false;
    this.isHeld = options.isHeld ?? false;
  }

  /**
   * Inverse mass for impulse mechanics (0 for static or held bodies).
   */
  public get invMass(): number {
    if (this.isStatic || this.isHeld || this.mass <= 0) return 0;
    return 1.0 / this.mass;
  }

  public wake(): void {
    this.isSleeping = false;
    this.sleepCounter = 0;
  }

  public sleep(): void {
    this.isSleeping = true;
    this.velocity.set(0, 0, 0);
    this.sleepCounter = 0;
  }

  public applyImpulse(impulse: THREE.Vector3): void {
    if (this.isStatic || this.isHeld) return;
    this.velocity.addScaledVector(impulse, this.invMass);
    this.wake();
  }

  public applyForce(force: THREE.Vector3, dt: number): void {
    if (this.isStatic || this.isHeld) return;
    this.velocity.addScaledVector(force, this.invMass * dt);
  }
}
