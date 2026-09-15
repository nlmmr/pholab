/**
 * PhOLab 2.0 - Extensible Asset Registry
 * 
 * Central registry managing AssetDescriptors and mesh generation factories.
 * Supports seamless procedural generation (MeshFactory) and extensible external
 * .gltf/.glb loading for Creator Studio and competition setups.
 */

import type * as THREE from 'three';
import {
  AssetDescriptor,
  IMeshFactory,
  MeshCreationParams,
} from './types';
import { MeshFactory } from './MeshFactory';

/**
 * Standard IPhO 2024 Laboratory Asset Descriptors
 */
export const STANDARD_ASSET_DESCRIPTORS: AssetDescriptor[] = [
  // 1. Kit Case & Foam Cradle
  {
    id: 'kit_case',
    name: 'Rigid Transport Case & Foam Cradle',
    category: 'kit',
    dimensions: [1.46, 0.38, 1.28],
    collision: {
      type: 'box',
      size: [1.46, 0.28, 1.28],
      offset: [0, 0.14, 0],
    },
    sockets: {
      platform_bay: [0, 0.21, -0.05],
      s1_bay: [-0.44, 0.21, 0.42],
      s2_bay: [-0.15, 0.21, 0.42],
      cuvette_bay: [0.14, 0.21, 0.42],
      bottle_bay: [0.44, 0.21, 0.42],
      screen_bay: [0.38, 0.21, -0.42],
      controller_bay: [-0.38, 0.21, -0.42],
      power_bank_bay: [0.0, 0.21, -0.42],
    },
    defaultPosition: [-1.85, 0.05, 0.15],
    modelSource: 'procedural',
    notes: 'Reinforced polymer exterior with yellow insert lid, 2 safety orange latches (#ea580c), and 1:1 concave cavities.',
  },

  // 2. Fastener Nylon Rods
  {
    id: 'fastening_rod',
    name: 'White Nylon Metric Fastening Rod',
    category: 'fasteners',
    dimensions: [0.076, 0.26, 0.076],
    collision: {
      type: 'cylinder',
      radius: 0.038,
      height: 0.26,
      offset: [0, 0.13, 0],
    },
    modelSource: 'procedural',
    notes: 'White POM/Nylon cylindrical rod with procedural metric thread bump map (p = 2mm) and knurled head.',
  },

  // Red Retention O-Rings
  {
    id: 'red_oring',
    name: 'Elastomeric Retention O-Ring',
    category: 'fasteners',
    dimensions: [0.08, 0.014, 0.08],
    collision: {
      type: 'cylinder',
      radius: 0.04,
      height: 0.014,
      offset: [0, 0.007, 0],
    },
    modelSource: 'procedural',
    notes: 'Red silicone elastomeric retention ring seated on upper foam cradle collars.',
  },

  // 3. Optical Platform
  {
    id: 'optical_platform',
    name: 'Optical Breadboard & Rotary Goniometer Stage',
    category: 'optics',
    dimensions: [1.55, 0.85, 0.90],
    collision: {
      type: 'box',
      size: [1.55, 0.08, 0.90],
      offset: [0, 0.04, 0],
    },
    sockets: {
      rotary_center: [0, 0.086, 0],
      s1_mount: [0, 0.106, 0],
      s2_mount: [0, 0.106, 0],
      cuvette_mount: [0, 0.098, 0],
      laser_emitter: [-0.64, 0.38, 0],
      lens_mount: [0.64, 0.38, 0],
      laser_cable_in: [-0.64, 0.35, 0.05],
    },
    defaultPosition: [0, 0, 0],
    modelSource: 'procedural',
    notes: 'Machined aluminum base with countersunk Allen screws, 3-ring goniometer (1° ticks, 5°/10° divisions, bilateral 0-80° markings), red needle pointer, white nylon knob, and plano-convex cylindrical lens.',
  },

  // 4. Holder S1 (Thin Slide 149 µm)
  {
    id: 'holder_s1',
    name: 'Specimen Holder S1 (Thin Slide 149 µm)',
    category: 'supports',
    dimensions: [0.50, 0.58, 0.50],
    collision: {
      type: 'cylinder',
      radius: 0.25,
      height: 0.58,
      offset: [0, 0.29, 0],
    },
    sockets: {
      base_notch_0: [0.25, 0.16, 0],
      base_notch_1: [-0.25, 0.16, 0],
      base_notch_2: [0, 0.16, 0.25],
      base_notch_3: [0, 0.16, -0.25],
      slide_center: [0, 0.35, 0],
    },
    defaultPosition: [-0.44, 0.21, 0.42],
    modelSource: 'procedural',
    notes: '4 mirror chrome columns (metalness: 0.98, roughness: 0.04), circular base ring, black clamp holding 148.9 µm thin slide with emerald edge.',
  },

  // 5. Holder S2 (Thick Slide 1.061 mm)
  {
    id: 'holder_s2',
    name: 'Specimen Holder S2 (Thick Slide 1.061 mm)',
    category: 'supports',
    dimensions: [0.50, 0.58, 0.50],
    collision: {
      type: 'cylinder',
      radius: 0.25,
      height: 0.58,
      offset: [0, 0.29, 0],
    },
    sockets: {
      base_notch_0: [0.25, 0.16, 0],
      base_notch_1: [-0.25, 0.16, 0],
      base_notch_2: [0, 0.16, 0.25],
      base_notch_3: [0, 0.16, -0.25],
      slide_center: [0, 0.35, 0],
    },
    defaultPosition: [-0.15, 0.21, 0.42],
    modelSource: 'procedural',
    notes: '4 mirror chrome columns (metalness: 0.98, roughness: 0.04) and black clamp holding 1.061 mm thick slide. Replaces incorrect brass model.',
  },

  // 6. Optical Cuvette
  {
    id: 'optical_cuvette',
    name: 'Optical Acrylic Cuvette (Path 10.0 mm)',
    category: 'containers',
    dimensions: [0.22, 0.26, 0.22],
    collision: {
      type: 'box',
      size: [0.22, 0.26, 0.22],
      offset: [0, 0.13, 0],
    },
    sockets: {
      liquid_surface: [0, 0.17, 0],
      lug_front_left: [-0.09, 0, -0.09],
      lug_front_right: [0.09, 0, -0.09],
      lug_back_left: [-0.09, 0, 0.09],
      lug_back_right: [0.09, 0, 0.09],
    },
    defaultPosition: [0.14, 0.21, 0.42],
    modelSource: 'procedural',
    notes: 'Crystalline PMMA acrylic cuvette with peelable yellow film labeled "One", 4 locking lugs, and 3D curved pink liquid meniscus.',
  },

  // Dropper Bottle
  {
    id: 'dropper_bottle',
    name: 'Translucent Dropper Bottle (Unknown Liquid)',
    category: 'containers',
    dimensions: [0.13, 0.32, 0.13],
    collision: {
      type: 'cylinder',
      radius: 0.065,
      height: 0.32,
      offset: [0, 0.16, 0],
    },
    sockets: {
      dropper_tip: [0, 0.305, 0],
    },
    defaultPosition: [0.44, 0.21, 0.42],
    modelSource: 'procedural',
    notes: 'Pink translucent LDPE body with white screw cap (not red!) and fine dropper dispensing nozzle.',
  },

  // 7. Electronic Controller
  {
    id: 'electronic_controller',
    name: 'Laser Current Controller & Telemetry Unit',
    category: 'electronics',
    dimensions: [0.64, 0.12, 0.42],
    collision: {
      type: 'box',
      size: [0.64, 0.10, 0.42],
      offset: [0, 0.05, 0],
    },
    sockets: {
      laser_terminal: [0.22, 0.09, -0.16],
      usbc_power_in: [0, 0.04, 0.21],
      power_switch: [-0.22, 0.09, -0.02],
      current_dial: [0.22, 0.09, 0.08],
      lcd_display: [0.04, 0.09, -0.06],
    },
    defaultPosition: [-0.08, 0.04, 0.75],
    modelSource: 'procedural',
    notes: 'Molded white ABS chassis with official IPhO 54th silkscreen, blue LCD, black On/Off rocker switch, turned aluminum knob, and green 2-pin Euroblock terminal.',
  },

  // Power Bank
  {
    id: 'power_bank',
    name: '5V DC Portable Power Bank',
    category: 'electronics',
    dimensions: [0.46, 0.08, 0.25],
    collision: {
      type: 'box',
      size: [0.46, 0.08, 0.25],
      offset: [0, 0.04, 0],
    },
    sockets: {
      usb_output: [-0.15, 0.045, -0.126],
    },
    defaultPosition: [0.55, 0.045, 0.82],
    modelSource: 'procedural',
    notes: 'Matte black enclosure with USB-A port and white connecting cable.',
  },

  // 8. Observation Screen
  {
    id: 'observation_screen',
    name: 'Diffraction Observation Screen on Grooved Base',
    category: 'screen',
    dimensions: [0.34, 0.70, 0.72],
    collision: {
      type: 'box',
      size: [0.34, 0.70, 0.72],
      offset: [0, 0.35, 0],
    },
    sockets: {
      screen_center: [0.028, 0.42, 0],
      clamping_screw_left: [-0.08, 0.03, 0.098],
      clamping_screw_right: [0.08, 0.03, 0.098],
    },
    defaultPosition: [1.60, 0, 0],
    modelSource: 'procedural',
    notes: 'Anodized gray aluminum frame mounted on heavy black grooved base with 2 knurled clamping screws and flat matte white projection face.',
  },
];

/**
 * Singleton Asset Registry
 */
export class AssetRegistry {
  private static instance: AssetRegistry | null = null;
  private readonly descriptors = new Map<string, AssetDescriptor>();
  private readonly factories = new Map<string, IMeshFactory>();

  private constructor() {
    // Register default procedural factory
    const proceduralFactory = new MeshFactory();
    this.registerFactory('procedural', proceduralFactory);

    // Register standard IPhO 2024 apparatus assets
    for (const desc of STANDARD_ASSET_DESCRIPTORS) {
      this.registerAsset(desc);
    }
  }

  public static getInstance(): AssetRegistry {
    if (!AssetRegistry.instance) {
      AssetRegistry.instance = new AssetRegistry();
    }
    return AssetRegistry.instance;
  }

  /**
   * Register a new asset descriptor or override an existing one.
   */
  public registerAsset(descriptor: AssetDescriptor): void {
    this.descriptors.set(descriptor.id, descriptor);
  }

  /**
   * Retrieve an asset descriptor by ID.
   */
  public getDescriptor(id: string): AssetDescriptor | undefined {
    return this.descriptors.get(id);
  }

  /**
   * Check if an asset descriptor exists.
   */
  public hasAsset(id: string): boolean {
    return this.descriptors.has(id);
  }

  /**
   * List all registered asset descriptors.
   */
  public listAssets(): AssetDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  /**
   * Register a mesh factory for a specific model source ('procedural', 'gltf', etc.).
   */
  public registerFactory(modelSource: string, factory: IMeshFactory): void {
    this.factories.set(modelSource, factory);
  }

  /**
   * Get a registered factory.
   */
  public getFactory(modelSource: string): IMeshFactory | undefined {
    return this.factories.get(modelSource);
  }

  /**
   * Instantiate a 3D mesh for the given asset ID.
   */
  public create(assetId: string, params?: MeshCreationParams): THREE.Object3D {
    const desc = this.descriptors.get(assetId);
    if (!desc) {
      throw new Error(`AssetRegistry: Asset with id '${assetId}' is not registered.`);
    }

    const factory = this.factories.get(desc.modelSource) || this.factories.get('procedural');
    if (!factory) {
      throw new Error(`AssetRegistry: No factory found for model source '${desc.modelSource}'.`);
    }

    const mesh = factory.createMesh(desc, params);
    if (mesh instanceof Promise) {
      throw new Error(
        `AssetRegistry: Asynchronous mesh generation requires calling createAsync() for '${assetId}'.`
      );
    }

    return mesh;
  }

  /**
   * Asynchronously instantiate a 3D mesh (supporting external GLTF/GLB loaders).
   */
  public async createAsync(assetId: string, params?: MeshCreationParams): Promise<THREE.Object3D> {
    const desc = this.descriptors.get(assetId);
    if (!desc) {
      throw new Error(`AssetRegistry: Asset with id '${assetId}' is not registered.`);
    }

    const factory = this.factories.get(desc.modelSource) || this.factories.get('procedural');
    if (!factory) {
      throw new Error(`AssetRegistry: No factory found for model source '${desc.modelSource}'.`);
    }

    return await factory.createMesh(desc, params);
  }

  /**
   * Extensible hook for loading external GLTF/GLB models.
   * If a GLTF loader is registered, delegates to it; otherwise throws or falls back.
   */
  public async loadGltf(assetId: string, uri: string): Promise<THREE.Object3D> {
    const gltfFactory = this.factories.get('gltf');
    if (gltfFactory) {
      const desc: AssetDescriptor = this.descriptors.get(assetId) || {
        id: assetId,
        name: assetId,
        category: 'optics',
        dimensions: [1, 1, 1],
        collision: { type: 'box', size: [1, 1, 1] },
        modelSource: 'gltf',
        gltfUri: uri,
      };
      return await gltfFactory.createMesh(desc);
    }
    throw new Error(
      `AssetRegistry: No GLTF loader registered. Register an IMeshFactory for 'gltf' to load '${uri}'.`
    );
  }
}

/**
 * Global singleton instance export for convenience.
 */
export const assetRegistry = AssetRegistry.getInstance();
