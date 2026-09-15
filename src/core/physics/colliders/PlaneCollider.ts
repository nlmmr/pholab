import * as THREE from 'three';
import { Collider, ColliderType, CollisionContact } from './Collider';
import { OBBCollider } from './OBBCollider';
import { CylinderCollider } from './CylinderCollider';

export interface PlaneBounds {
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  minZ?: number;
  maxZ?: number;
}

/**
 * Bounded half-space Plane Collider for lab benchtop (Y=0), floor (Y=-0.78m), and kit box walls.
 * Points with (P · normal - distance) < 0 are penetrating.
 */
export class PlaneCollider implements Collider {
  public readonly type: ColliderType = 'plane';
  public center: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public normal: THREE.Vector3;
  public distance: number;
  public bounds?: PlaneBounds;

  constructor(
    normal: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
    distance: number = 0,
    bounds?: PlaneBounds,
  ) {
    this.normal = normal.clone().normalize();
    this.distance = distance;
    this.bounds = bounds ? { ...bounds } : undefined;
  }

  public getBoundingRadius(): number {
    return Infinity;
  }

  public clone(): PlaneCollider {
    return new PlaneCollider(this.normal, this.distance, this.bounds);
  }

  /**
   * Factory for standard PhOLab 2.0 laboratory benchtop:
   * Y = 0.0 m, X in [-3.2, 3.2], Z in [-1.7, 1.7].
   */
  public static createBench(): PlaneCollider {
    return new PlaneCollider(new THREE.Vector3(0, 1, 0), 0.0, {
      minX: -3.2,
      maxX: 3.2,
      minZ: -1.7,
      maxZ: 1.7,
    });
  }

  /**
   * Factory for standard PhOLab 2.0 laboratory floor:
   * Y = -0.78 m, wide laboratory room bounds.
   */
  public static createFloor(): PlaneCollider {
    return new PlaneCollider(new THREE.Vector3(0, 1, 0), -0.78, {
      minX: -20.0,
      maxX: 20.0,
      minZ: -20.0,
      maxZ: 20.0,
    });
  }

  /**
   * Factory for kit box perimeter containment walls.
   */
  public static createKitBoxWalls(
    kitPos: THREE.Vector3,
    halfWidth: number = 0.73,
    halfDepth: number = 0.64,
    wallHeight: number = 0.28,
    foamBaseY: number = 0.14,
  ): PlaneCollider[] {
    const minX = kitPos.x - halfWidth;
    const maxX = kitPos.x + halfWidth;
    const minZ = kitPos.z - halfDepth;
    const maxZ = kitPos.z + halfDepth;
    const minY = kitPos.y;
    const maxY = kitPos.y + wallHeight;
    const baseFloorY = kitPos.y + foamBaseY;

    return [
      // Foam base floor
      new PlaneCollider(new THREE.Vector3(0, 1, 0), baseFloorY, {
        minX, maxX, minZ, maxZ,
      }),
      // Wall -X (pushes in +X direction)
      new PlaneCollider(new THREE.Vector3(1, 0, 0), minX, {
        minY, maxY, minZ, maxZ,
      }),
      // Wall +X (pushes in -X direction)
      new PlaneCollider(new THREE.Vector3(-1, 0, 0), -maxX, {
        minY, maxY, minZ, maxZ,
      }),
      // Wall -Z (pushes in +Z direction)
      new PlaneCollider(new THREE.Vector3(0, 0, 1), minZ, {
        minX, maxX, minY, maxY,
      }),
      // Wall +Z (pushes in -Z direction)
      new PlaneCollider(new THREE.Vector3(0, 0, -1), -maxZ, {
        minX, maxX, minY, maxY,
      }),
    ];
  }

  /**
   * Evaluates if a point is within the finite boundaries of this plane.
   */
  public isPointInBounds(point: THREE.Vector3): boolean {
    if (!this.bounds) return true;
    const { minX, maxX, minY, maxY, minZ, maxZ } = this.bounds;
    if (minX !== undefined && point.x < minX) return false;
    if (maxX !== undefined && point.x > maxX) return false;
    if (minY !== undefined && point.y < minY) return false;
    if (maxY !== undefined && point.y > maxY) return false;
    if (minZ !== undefined && point.z < minZ) return false;
    if (maxZ !== undefined && point.z > maxZ) return false;
    return true;
  }

  /**
   * Tests collision between this plane and an OBB collider.
   * Returns normal pointing from Plane into the free half-space (normal of plane).
   */
  public testOBB(
    bodyPos: THREE.Vector3,
    bodyQuat: THREE.Quaternion,
    obb: OBBCollider,
  ): CollisionContact {
    const transform = obb.getWorldTransform(bodyPos, bodyQuat);
    const rEff = obb.getProjectedRadius(this.normal, transform.axes, transform.halfExtents);
    const signedDist = transform.center.dot(this.normal) - this.distance;
    const minSignedDist = signedDist - rEff;

    if (minSignedDist >= 0) {
      return {
        hasContact: false,
        penetration: 0,
        normal: new THREE.Vector3(),
        point: new THREE.Vector3(),
      };
    }

    const penetration = -minSignedDist;
    const contactPoint = transform.center.clone().addScaledVector(
      this.normal,
      -signedDist,
    );

    if (!this.isPointInBounds(contactPoint)) {
      return {
        hasContact: false,
        penetration: 0,
        normal: new THREE.Vector3(),
        point: new THREE.Vector3(),
      };
    }

    return {
      hasContact: true,
      penetration,
      normal: this.normal.clone(),
      point: contactPoint,
    };
  }

  /**
   * Tests collision between this plane and a Cylinder collider.
   */
  public testCylinder(
    bodyPos: THREE.Vector3,
    bodyQuat: THREE.Quaternion,
    cyl: CylinderCollider,
  ): CollisionContact {
    const transform = cyl.getWorldTransform(bodyPos, bodyQuat);
    const dotAxisNormal = transform.axis.dot(this.normal);
    const rEff = transform.halfHeight * Math.abs(dotAxisNormal) +
      transform.radius * Math.sqrt(Math.max(0, 1 - dotAxisNormal * dotAxisNormal));

    const signedDist = transform.center.dot(this.normal) - this.distance;
    const minSignedDist = signedDist - rEff;

    if (minSignedDist >= 0) {
      return {
        hasContact: false,
        penetration: 0,
        normal: new THREE.Vector3(),
        point: new THREE.Vector3(),
      };
    }

    const penetration = -minSignedDist;
    const contactPoint = transform.center.clone().addScaledVector(
      this.normal,
      -signedDist,
    );

    if (!this.isPointInBounds(contactPoint)) {
      return {
        hasContact: false,
        penetration: 0,
        normal: new THREE.Vector3(),
        point: new THREE.Vector3(),
      };
    }

    return {
      hasContact: true,
      penetration,
      normal: this.normal.clone(),
      point: contactPoint,
    };
  }
}
