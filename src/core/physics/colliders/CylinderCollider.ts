import * as THREE from 'three';
import { Collider, ColliderType, CollisionContact } from './Collider';
import { OBBCollider } from './OBBCollider';

/**
 * Upright Collidable Cylinder (radius, half-height, axis) for bottle and slide holders.
 */
export class CylinderCollider implements Collider {
  public readonly type: ColliderType = 'cylinder';
  public center: THREE.Vector3;
  public radius: number;
  public halfHeight: number;
  public axis: THREE.Vector3;

  constructor(
    radius: number = 0.1,
    halfHeight: number = 0.2,
    center: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
    axis: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
  ) {
    this.radius = radius;
    this.halfHeight = halfHeight;
    this.center = center.clone();
    this.axis = axis.clone().normalize();
  }

  public getBoundingRadius(): number {
    return Math.sqrt(this.radius * this.radius + this.halfHeight * this.halfHeight);
  }

  public clone(): CylinderCollider {
    return new CylinderCollider(this.radius, this.halfHeight, this.center, this.axis);
  }

  public getWorldTransform(
    bodyPos: THREE.Vector3,
    bodyQuat: THREE.Quaternion = new THREE.Quaternion(),
  ): {
    center: THREE.Vector3;
    axis: THREE.Vector3;
    radius: number;
    halfHeight: number;
  } {
    const worldCenter = this.center.clone().applyQuaternion(bodyQuat).add(bodyPos);
    const worldAxis = this.axis.clone().applyQuaternion(bodyQuat).normalize();
    return {
      center: worldCenter,
      axis: worldAxis,
      radius: this.radius,
      halfHeight: this.halfHeight,
    };
  }

  /**
   * Evaluates collision between this cylinder and another cylinder.
   */
  public testCylinder(
    bodyPosA: THREE.Vector3,
    bodyQuatA: THREE.Quaternion,
    other: CylinderCollider,
    bodyPosB: THREE.Vector3,
    bodyQuatB: THREE.Quaternion,
  ): CollisionContact {
    const cylA = this.getWorldTransform(bodyPosA, bodyQuatA);
    const cylB = other.getWorldTransform(bodyPosB, bodyQuatB);

    // Vertical overlap along Y (for upright cylinders)
    const dy = cylB.center.y - cylA.center.y;
    const overlapY = (cylA.halfHeight + cylB.halfHeight) - Math.abs(dy);
    if (overlapY <= 0) {
      return {
        hasContact: false,
        penetration: 0,
        normal: new THREE.Vector3(),
        point: new THREE.Vector3(),
      };
    }

    // Horizontal overlap in XZ plane
    const dx = cylB.center.x - cylA.center.x;
    const dz = cylB.center.z - cylA.center.z;
    const distXZ = Math.sqrt(dx * dx + dz * dz);
    const overlapXZ = (cylA.radius + cylB.radius) - distXZ;
    if (overlapXZ <= 0) {
      return {
        hasContact: false,
        penetration: 0,
        normal: new THREE.Vector3(),
        point: new THREE.Vector3(),
      };
    }

    // Minimum Translation Vector
    if (overlapY < overlapXZ) {
      const normalY = dy >= 0 ? 1 : -1;
      const normal = new THREE.Vector3(0, normalY, 0);
      const point = cylA.center.clone().addScaledVector(normal, cylA.halfHeight);
      return {
        hasContact: true,
        penetration: overlapY,
        normal,
        point,
      };
    } else {
      const normal = distXZ > 1e-6
        ? new THREE.Vector3(dx / distXZ, 0, dz / distXZ)
        : new THREE.Vector3(1, 0, 0);
      const point = cylA.center.clone().addScaledVector(normal, cylA.radius);
      return {
        hasContact: true,
        penetration: overlapXZ,
        normal,
        point,
      };
    }
  }

  /**
   * Evaluates collision between this cylinder and an OBB.
   * Returns normal pointing from Cylinder to OBB.
   */
  public testOBB(
    bodyPosA: THREE.Vector3,
    bodyQuatA: THREE.Quaternion,
    obb: OBBCollider,
    bodyPosB: THREE.Vector3,
    bodyQuatB: THREE.Quaternion,
  ): CollisionContact {
    const cyl = this.getWorldTransform(bodyPosA, bodyQuatA);
    const obbTransform = obb.getWorldTransform(bodyPosB, bodyQuatB);

    // 1. Height overlap along Y
    const obbRadiusY = obb.getProjectedRadius(
      new THREE.Vector3(0, 1, 0),
      obbTransform.axes,
      obbTransform.halfExtents,
    );
    const dy = obbTransform.center.y - cyl.center.y;
    const overlapY = (cyl.halfHeight + obbRadiusY) - Math.abs(dy);
    if (overlapY <= 0) {
      return {
        hasContact: false,
        penetration: 0,
        normal: new THREE.Vector3(),
        point: new THREE.Vector3(),
      };
    }

    // 2. Find closest point on OBB to the cylinder's central vertical segment
    const clampedY = Math.max(
      cyl.center.y - cyl.halfHeight,
      Math.min(cyl.center.y + cyl.halfHeight, obbTransform.center.y),
    );
    const axisPoint = new THREE.Vector3(cyl.center.x, clampedY, cyl.center.z);
    const closestOBBPoint = obb.closestPointToPoint(axisPoint, bodyPosB, bodyQuatB);

    const delta = closestOBBPoint.clone().sub(axisPoint);
    const distXZ = Math.sqrt(delta.x * delta.x + delta.z * delta.z);

    // Check if the axis point is inside the OBB
    const isInsideOBB = closestOBBPoint.distanceToSquared(axisPoint) < 1e-6;

    let overlapXZ = 0;
    let normalXZ = new THREE.Vector3();

    if (!isInsideOBB) {
      overlapXZ = cyl.radius - distXZ;
      if (overlapXZ <= 0) {
        return {
          hasContact: false,
          penetration: 0,
          normal: new THREE.Vector3(),
          point: new THREE.Vector3(),
        };
      }
      normalXZ = distXZ > 1e-6
        ? new THREE.Vector3(delta.x / distXZ, 0, delta.z / distXZ)
        : new THREE.Vector3(obbTransform.center.x - cyl.center.x, 0, obbTransform.center.z - cyl.center.z).normalize();
      if (normalXZ.lengthSq() < 1e-6) normalXZ.set(1, 0, 0);
    } else {
      // Axis is inside OBB, resolve towards center-to-center direction
      const dir = obbTransform.center.clone().sub(cyl.center);
      const dirDistXZ = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
      normalXZ = dirDistXZ > 1e-6
        ? new THREE.Vector3(dir.x / dirDistXZ, 0, dir.z / dirDistXZ)
        : new THREE.Vector3(1, 0, 0);
      overlapXZ = cyl.radius + 0.05; // Deep overlap resolution
    }

    // Minimum Translation Vector between Y and XZ
    if (overlapY < overlapXZ) {
      const normalY = dy >= 0 ? 1 : -1;
      const normal = new THREE.Vector3(0, normalY, 0);
      const point = cyl.center.clone().addScaledVector(normal, cyl.halfHeight);
      return {
        hasContact: true,
        penetration: overlapY,
        normal,
        point,
      };
    } else {
      return {
        hasContact: true,
        penetration: overlapXZ,
        normal: normalXZ,
        point: closestOBBPoint,
      };
    }
  }
}
