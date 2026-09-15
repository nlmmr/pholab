import * as THREE from 'three';

export type ColliderType = 'obb' | 'cylinder' | 'plane';

/**
 * Result of a collision query between two colliders.
 */
export interface CollisionContact {
  /** True if penetrating or touching */
  hasContact: boolean;
  /** Penetration depth (>= 0) along normal */
  penetration: number;
  /** Contact normal pointing from collider A to collider B */
  normal: THREE.Vector3;
  /** World position of the contact point */
  point: THREE.Vector3;
}

/**
 * Base Collider interface implemented by OBB, Cylinder, and Plane colliders.
 */
export interface Collider {
  readonly type: ColliderType;
  /** Local center offset relative to the parent rigid body origin */
  center: THREE.Vector3;
  /** Maximum radius from local center to any point on the collider */
  getBoundingRadius(): number;
  /** Clone the collider instance */
  clone(): Collider;
}
