import * as THREE from 'three';

export interface SnapTarget {
  id: string;
  name: string;
  targetPosition: THREE.Vector3;
  targetRotation?: THREE.Euler;
  toleranceRadius: number; // typically ~0.03m (3 cm)
  assembledOffset: THREE.Vector3;
  assembledRotation?: THREE.Euler;
}

export class SnapFittingEngine {
  /**
   * Check if an object is close enough to a valid snap target and return the snapped position
   */
  public static checkSnap(
    objectId: string,
    currentPos: THREE.Vector3,
    targets: SnapTarget[]
  ): { snapped: boolean; target?: SnapTarget; snappedPosition?: THREE.Vector3; snappedRotation?: THREE.Euler } {
    for (const target of targets) {
      const dist = currentPos.distanceTo(target.targetPosition);
      if (dist <= target.toleranceRadius) {
        const finalPos = new THREE.Vector3().copy(target.targetPosition).add(target.assembledOffset);
        return {
          snapped: true,
          target,
          snappedPosition: finalPos,
          snappedRotation: target.assembledRotation || target.targetRotation,
        };
      }
    }
    return { snapped: false };
  }
}
