/**
 * PhOLab 2.0 - Asset Architecture Types
 * 
 * Provides unified abstractions for procedural 3D models, external .gltf/.glb
 * asset loading, physical collision boundaries (OBB / Cylinder / Compound),
 * and hardware mount sockets.
 */

import type * as THREE from 'three';

export type AssetCategory =
  | 'optics'
  | 'electronics'
  | 'containers'
  | 'kit'
  | 'supports'
  | 'fasteners'
  | 'screen';

export type ModelSourceType = 'procedural' | 'gltf';

/**
 * Geometric collision specification for rigid body physics simulation.
 * Consumed by RigidBodySimulator (OBB SAT & Cylinder colliders).
 */
export interface AssetCollisionVolume {
  type: 'box' | 'cylinder' | 'compound';
  /** Bounding size [width, height, depth] along X, Y, Z in meters */
  size?: [number, number, number];
  /** Radius in meters for cylindrical colliders */
  radius?: number;
  /** Height in meters for cylindrical colliders */
  height?: number;
  /** Center offset [ox, oy, oz] relative to object origin in meters */
  offset?: [number, number, number];
  /** Sub-volumes for complex compound collision hierarchies */
  subVolumes?: AssetCollisionVolume[];
}

/**
 * Comprehensive asset metadata describing identity, category, physical
 * dimensions, collision boundaries, and mechanical attachment sockets.
 */
export interface AssetDescriptor {
  id: string;
  name: string;
  category: AssetCategory;
  /** Outer physical bounding dimensions [width, height, depth] in meters */
  dimensions: [number, number, number];
  /** Geometric collision volume for rigid body physics */
  collision: AssetCollisionVolume;
  /** Physical mechanical sockets [x, y, z] relative to root */
  sockets?: Record<string, [number, number, number]>;
  /** Default rest position on bench or in storage [x, y, z] */
  defaultPosition?: [number, number, number];
  /** Model generation strategy */
  modelSource: ModelSourceType;
  /** Optional URI for external GLTF/GLB models */
  gltfUri?: string;
  /** Description or historical/competition notes */
  notes?: string;
}

/**
 * Parameters passed to procedural mesh factories during instantiation.
 */
export interface MeshCreationParams {
  color?: string | number;
  roughness?: number;
  metalness?: number;
  scale?: number;
  interactiveId?: string;
  interactiveGroup?: boolean;
  userData?: Record<string, any>;
  [key: string]: any;
}

/**
 * Interface implemented by procedural mesh factories and GLTF loaders.
 */
export interface IMeshFactory {
  createMesh(
    descriptor: AssetDescriptor,
    params?: MeshCreationParams
  ): THREE.Object3D | Promise<THREE.Object3D>;
}
