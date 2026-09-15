import * as THREE from 'three';
import { Collider, ColliderType, CollisionContact } from './Collider';

/**
 * Oriented Bounding Box (OBB) Collider with 15-axis Separating Axis Theorem (SAT)
 * and Minimum Translation Vector (MTV) penetration resolution.
 */
export class OBBCollider implements Collider {
  public readonly type: ColliderType = 'obb';
  public center: THREE.Vector3;
  public halfExtents: THREE.Vector3;
  public quaternion: THREE.Quaternion;

  constructor(
    halfExtents: THREE.Vector3 = new THREE.Vector3(0.5, 0.5, 0.5),
    center: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
    quaternion: THREE.Quaternion = new THREE.Quaternion(),
  ) {
    this.halfExtents = halfExtents.clone();
    this.center = center.clone();
    this.quaternion = quaternion.clone();
  }

  public getBoundingRadius(): number {
    return this.halfExtents.length();
  }

  public clone(): OBBCollider {
    return new OBBCollider(this.halfExtents, this.center, this.quaternion);
  }

  /**
   * Computes world-space center, half-extents, and the three orthonormal axes.
   */
  public getWorldTransform(
    bodyPos: THREE.Vector3,
    bodyQuat: THREE.Quaternion = new THREE.Quaternion(),
  ): {
    center: THREE.Vector3;
    axes: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
    halfExtents: THREE.Vector3;
  } {
    const worldCenter = this.center.clone().applyQuaternion(bodyQuat).add(bodyPos);
    const combinedQuat = bodyQuat.clone().multiply(this.quaternion);

    const axes: [THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
      new THREE.Vector3(1, 0, 0).applyQuaternion(combinedQuat).normalize(),
      new THREE.Vector3(0, 1, 0).applyQuaternion(combinedQuat).normalize(),
      new THREE.Vector3(0, 0, 1).applyQuaternion(combinedQuat).normalize(),
    ];

    return {
      center: worldCenter,
      axes,
      halfExtents: this.halfExtents.clone(),
    };
  }

  /**
   * Projects this OBB onto an arbitrary axis and returns its radius along that axis.
   */
  public getProjectedRadius(
    axis: THREE.Vector3,
    axes: [THREE.Vector3, THREE.Vector3, THREE.Vector3],
    halfExtents: THREE.Vector3,
  ): number {
    return (
      halfExtents.x * Math.abs(axes[0].dot(axis)) +
      halfExtents.y * Math.abs(axes[1].dot(axis)) +
      halfExtents.z * Math.abs(axes[2].dot(axis))
    );
  }

  /**
   * Returns all 8 corner vertices in world coordinates.
   */
  public getVertices(
    bodyPos: THREE.Vector3,
    bodyQuat: THREE.Quaternion = new THREE.Quaternion(),
  ): THREE.Vector3[] {
    const { center, axes, halfExtents } = this.getWorldTransform(bodyPos, bodyQuat);
    const vertices: THREE.Vector3[] = [];

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const v = center.clone()
            .addScaledVector(axes[0], sx * halfExtents.x)
            .addScaledVector(axes[1], sy * halfExtents.y)
            .addScaledVector(axes[2], sz * halfExtents.z);
          vertices.push(v);
        }
      }
    }
    return vertices;
  }

  /**
   * Calculates the closest point on the OBB to an arbitrary target point in world coordinates.
   */
  public closestPointToPoint(
    point: THREE.Vector3,
    bodyPos: THREE.Vector3,
    bodyQuat: THREE.Quaternion = new THREE.Quaternion(),
  ): THREE.Vector3 {
    const { center, axes, halfExtents } = this.getWorldTransform(bodyPos, bodyQuat);
    const delta = point.clone().sub(center);

    const closest = center.clone();
    const exts = [halfExtents.x, halfExtents.y, halfExtents.z];

    for (let i = 0; i < 3; i++) {
      const dist = delta.dot(axes[i]);
      const clamped = Math.max(-exts[i], Math.min(exts[i], dist));
      closest.addScaledVector(axes[i], clamped);
    }

    return closest;
  }

  /**
   * Evaluates collision between this OBB and another OBB using 15-axis SAT.
   * Computes penetration depth, normal (pointing from A to B), and contact point.
   */
  public testOBB(
    bodyPosA: THREE.Vector3,
    bodyQuatA: THREE.Quaternion,
    other: OBBCollider,
    bodyPosB: THREE.Vector3,
    bodyQuatB: THREE.Quaternion,
  ): CollisionContact {
    const transformA = this.getWorldTransform(bodyPosA, bodyQuatA);
    const transformB = other.getWorldTransform(bodyPosB, bodyQuatB);

    const centerA = transformA.center;
    const centerB = transformB.center;
    const axesA = transformA.axes;
    const axesB = transformB.axes;
    const extA = transformA.halfExtents;
    const extB = transformB.halfExtents;

    const deltaCenter = centerB.clone().sub(centerA);

    // 15 Candidate axes:
    // 3 axes of A, 3 axes of B, and 9 cross products (A_i x B_j)
    const testAxes: THREE.Vector3[] = [
      axesA[0], axesA[1], axesA[2],
      axesB[0], axesB[1], axesB[2],
    ];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const cross = new THREE.Vector3().crossVectors(axesA[i], axesB[j]);
        if (cross.lengthSq() > 1e-6) {
          testAxes.push(cross.normalize());
        }
      }
    }

    let minOverlap = Infinity;
    let mtvAxis: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

    for (const axis of testAxes) {
      const rA = this.getProjectedRadius(axis, axesA, extA);
      const rB = this.getProjectedRadius(axis, axesB, extB);
      const projDistance = Math.abs(deltaCenter.dot(axis));
      const overlap = (rA + rB) - projDistance;

      if (overlap <= 0) {
        // Separating axis found: disjoint
        return {
          hasContact: false,
          penetration: 0,
          normal: new THREE.Vector3(),
          point: new THREE.Vector3(),
        };
      }

      if (overlap < minOverlap) {
        minOverlap = overlap;
        mtvAxis = axis.clone();
      }
    }

    // Ensure normal points from A to B
    if (deltaCenter.dot(mtvAxis) < 0) {
      mtvAxis.negate();
    }

    // Contact point estimation: midway between surfaces along normal
    const rAOnMtv = this.getProjectedRadius(mtvAxis, axesA, extA);
    const contactPoint = centerA.clone().addScaledVector(mtvAxis, rAOnMtv - minOverlap * 0.5);

    return {
      hasContact: true,
      penetration: minOverlap,
      normal: mtvAxis,
      point: contactPoint,
    };
  }
}
