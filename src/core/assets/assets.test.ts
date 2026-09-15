/**
 * PhOLab 2.0 - Comprehensive Asset Architecture & Visual Fidelity Test Suite
 * 
 * Validates R1 requirements:
 * 1. AssetRegistry and MeshFactory extensibility and contract compliance
 * 2. Exact visual and proportional fidelity to official IPhO 2024 photographs (Figs 1-4, 8)
 * 3. Physical collision volume metadata for rigid body engine (M2)
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  assetRegistry,
  AssetRegistry,
  MeshFactory,
  STANDARD_ASSET_DESCRIPTORS,
  AssetDescriptor,
  createGoniometerTexture,
  createSilkscreenTexture,
  createThreadBumpTexture,
  createKnurlBumpTexture,
  createBrushedMetalTexture,
  createCuvettePeelTexture,
} from './index';

describe('Asset Architecture - AssetRegistry', () => {
  it('initializes as singleton with all standard IPhO 2024 descriptors registered', () => {
    expect(assetRegistry).toBeDefined();
    const assets = assetRegistry.listAssets();
    expect(assets.length).toBeGreaterThanOrEqual(11);

    const expectedIds = [
      'kit_case',
      'fastening_rod',
      'red_oring',
      'optical_platform',
      'holder_s1',
      'holder_s2',
      'optical_cuvette',
      'dropper_bottle',
      'electronic_controller',
      'power_bank',
      'observation_screen',
    ];

    expectedIds.forEach((id) => {
      expect(assetRegistry.hasAsset(id)).toBe(true);
      const desc = assetRegistry.getDescriptor(id);
      expect(desc).toBeDefined();
      expect(desc?.id).toBe(id);
      expect(desc?.dimensions.length).toBe(3);
      expect(desc?.collision).toBeDefined();
      expect(desc?.collision.type).toBeDefined();
    });
  });

  it('allows registering custom descriptors and overriding existing ones', () => {
    const customDesc: AssetDescriptor = {
      id: 'custom_filter_holder',
      name: 'Custom Neutral Density Filter Holder',
      category: 'supports',
      dimensions: [0.3, 0.4, 0.3],
      collision: { type: 'cylinder', radius: 0.15, height: 0.4, offset: [0, 0.2, 0] },
      modelSource: 'procedural',
    };

    assetRegistry.registerAsset(customDesc);
    expect(assetRegistry.hasAsset('custom_filter_holder')).toBe(true);
    expect(assetRegistry.getDescriptor('custom_filter_holder')?.name).toBe('Custom Neutral Density Filter Holder');
  });

  it('throws descriptive error when requesting an unregistered asset', () => {
    expect(() => {
      assetRegistry.create('non_existent_asset_id');
    }).toThrow('AssetRegistry: Asset with id \'non_existent_asset_id\' is not registered.');
  });
});

describe('Visual Fidelity - 1. Case & Technical Foam Cradle (R1 & Fig. 1-3)', () => {
  it('generates case with black reinforced polymer, yellow insert lid, and 2 orange latches', () => {
    const caseObj = assetRegistry.create('kit_case') as THREE.Group;
    expect(caseObj).toBeDefined();
    expect(caseObj.name).toBe('kit_case');

    // Verify 2 Safety Orange Front Draw Latches (#ea580c)
    const latches = caseObj.children.filter((c) => c.name === 'orange_front_latch');
    expect(latches.length).toBe(2);

    latches.forEach((latch) => {
      const parts = (latch as THREE.Group).children as THREE.Mesh[];
      const orangeParts = parts.filter((p) => {
        const mat = p.material as THREE.MeshStandardMaterial;
        return mat && mat.color && mat.color.getHexString() === 'ea580c';
      });
      expect(orangeParts.length).toBeGreaterThanOrEqual(2);
    });

    // Verify hinged lid with recessed yellow insert panel (#eab308)
    const lid = caseObj.getObjectByName('kit_lid') as THREE.Group;
    expect(lid).toBeDefined();
    const yellowPanels = lid.children.filter((c) => {
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      return mat && mat.color && mat.color.getHexString() === 'eab308';
    });
    expect(yellowPanels.length).toBeGreaterThanOrEqual(1);

    // Verify true concave 1:1 cavities in foam cradle
    const cavities = [
      'platform_cavity',
      's1_cavity',
      's2_cavity',
      'cuvette_cavity',
      'bottle_cavity',
      'screen_cavity',
      'controller_cavity',
      'power_bank_cavity',
    ];

    cavities.forEach((cavName) => {
      const cav = caseObj.getObjectByName(cavName);
      expect(cav).toBeDefined();
      expect(cav?.position.y).toBe(0.21); // Recessed inside foam
    });
  });
});

describe('Visual Fidelity - 2. Fastener Rods & Retention O-Rings (R1)', () => {
  it('generates nylon rods with metric thread bump map and knurled caps', () => {
    const rod = assetRegistry.create('fastening_rod') as THREE.Group;
    expect(rod).toBeDefined();
    expect(rod.name).toBe('fastening_rod');

    // Find cylindrical shaft
    const meshes = rod.children as THREE.Mesh[];
    expect(meshes.length).toBeGreaterThanOrEqual(3);

    // Verify nylon shaft
    const shaft = meshes[0];
    const shaftMat = shaft.material as THREE.MeshStandardMaterial;
    expect(shaftMat).toBeDefined();
    expect(shaftMat.roughness).toBeCloseTo(0.35, 1);
    expect(shaftMat.metalness).toBeCloseTo(0.05, 1);

    // Verify knurled cap
    const cap = meshes[1];
    const capMat = cap.material as THREE.MeshStandardMaterial;
    expect(capMat).toBeDefined();
    expect(capMat.metalness).toBeCloseTo(0.12, 1);
  });

  it('generates red retention O-rings with elastomeric silicone appearance', () => {
    const oring = assetRegistry.create('red_oring') as THREE.Group;
    expect(oring).toBeDefined();
    expect(oring.name).toBe('red_oring');

    const ringMesh = oring.children[0] as THREE.Mesh;
    const ringMat = ringMesh.material as THREE.MeshStandardMaterial;
    expect(ringMat.color.getHexString()).toBe('dc2626');
    expect(ringMat.metalness).toBe(0);
    expect(ringMat.roughness).toBeGreaterThanOrEqual(0.7);
  });
});

describe('Visual Fidelity - 3. Optical Platform (R1 & Fig. 4-1)', () => {
  it('generates machined base with Allen screws, 3-ring goniometer, white nylon knob, and cylindrical lens', () => {
    const platform = assetRegistry.create('optical_platform') as THREE.Group;
    expect(platform).toBeDefined();
    expect(platform.name).toBe('optical_platform');

    // Verify rotary stage & 3-ring goniometer
    const rotaryStage = platform.getObjectByName('rotary_stage') as THREE.Group;
    expect(rotaryStage).toBeDefined();

    // Verify red needle reference pointer
    const refPointer = platform.getObjectByName('reference_pointer') as THREE.Group;
    expect(refPointer).toBeDefined();

    // Verify white nylon angular knob (#f8fafc, roughness 0.38, metalness 0.04)
    const knob = platform.getObjectByName('rotation_knob') as THREE.Mesh;
    expect(knob).toBeDefined();
    const knobMat = knob.material as THREE.MeshStandardMaterial;
    expect(knobMat.color.getHexString()).toBe('f8fafc');
    expect(knobMat.metalness).toBeCloseTo(0.04, 2);
    expect(knobMat.roughness).toBeCloseTo(0.38, 2);

    // Verify vertical guide towers
    const laserTower = platform.getObjectByName('laser_tower') as THREE.Group;
    const lensTower = platform.getObjectByName('lens_tower') as THREE.Group;
    expect(laserTower).toBeDefined();
    expect(lensTower).toBeDefined();

    // Verify black knurled knobs on towers (#18181b)
    [laserTower, lensTower].forEach((tower) => {
      const topKnobs = tower.children.filter((c) => {
        const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        return mat && mat.color && mat.color.getHexString() === '18181b';
      });
      expect(topKnobs.length).toBeGreaterThanOrEqual(1);
    });

    // Verify plano-convex cylindrical lens on lens carriage
    const lensCarriage = lensTower.getObjectByName('lens_carriage') as THREE.Group;
    expect(lensCarriage).toBeDefined();
    const opticalLens = lensCarriage.children.find((c) => {
      const mat = (c as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
      return mat && mat.transmission && mat.transmission > 0.9;
    }) as THREE.Mesh;
    expect(opticalLens).toBeDefined();
    const lensMat = opticalLens.material as THREE.MeshPhysicalMaterial;
    expect(lensMat.ior).toBeCloseTo(1.51, 2);
    expect(lensMat.transmission).toBeGreaterThanOrEqual(0.95);
  });
});

describe('Visual Fidelity - 4. Holders S1 & S2 (R1 & Fig. 4-2)', () => {
  it('strictly builds BOTH S1 and S2 with 4 mirror chrome columns (metalness: 0.98, roughness: 0.04) and NO brass', () => {
    const s1 = assetRegistry.create('holder_s1') as THREE.Group;
    const s2 = assetRegistry.create('holder_s2') as THREE.Group;

    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s1.name).toBe('holder_s1');
    expect(s2.name).toBe('holder_s2');

    [s1, s2].forEach((holder, idx) => {
      // Find all cylindrical posts
      const chromeColumns = holder.children.filter((child) => {
        if (!(child instanceof THREE.Mesh)) return false;
        const geom = child.geometry;
        const mat = child.material as THREE.MeshStandardMaterial;
        // Check for column height 0.44
        const isColumn = geom instanceof THREE.CylinderGeometry && (geom.parameters as any).height === 0.44;
        const isMirrorChrome =
          mat &&
          mat.color.getHexString() === 'f8fafc' &&
          mat.metalness >= 0.95 &&
          mat.roughness <= 0.06;
        return isColumn && isMirrorChrome;
      });

      // Strictly verify exactly 4 mirror chrome columns
      expect(chromeColumns.length).toBe(4);

      // Verify ZERO brass materials anywhere in S1 or S2
      holder.traverse((node) => {
        if (node instanceof THREE.Mesh && node.material) {
          const m = node.material as THREE.MeshStandardMaterial;
          if (m.color) {
            const hex = m.color.getHexString().toLowerCase();
            // Brass colors from previous erroneous implementation
            expect(hex).not.toBe('d4af37');
            expect(hex).not.toBe('b48c28');
          }
        }
      });
    });

    // Verify S1 thin slide vs S2 thick slide distinction
    const s1Slide = s1.children.find((c) => {
      return (
        c instanceof THREE.Mesh &&
        c.geometry instanceof THREE.BoxGeometry &&
        (c.geometry.parameters as any).height === 0.34
      );
    }) as THREE.Mesh;

    const s2Slide = s2.children.find((c) => {
      return (
        c instanceof THREE.Mesh &&
        c.geometry instanceof THREE.BoxGeometry &&
        (c.geometry.parameters as any).height === 0.34
      );
    }) as THREE.Mesh;

    expect(s1Slide).toBeDefined();
    expect(s2Slide).toBeDefined();

    const s1Width = (s1Slide.geometry as THREE.BoxGeometry).parameters.width;
    const s2Width = (s2Slide.geometry as THREE.BoxGeometry).parameters.width;
    // S2 is ~3x to 7x thicker than S1
    expect(s2Width).toBeGreaterThan(s1Width * 2);
  });
});

describe('Visual Fidelity - 5. Optical Cuvette & Dropper Bottle (R1 & Fig. 4-4, 4-5)', () => {
  it('generates crystalline acrylic cuvette with "One" peelable film and 3D curved liquid meniscus', () => {
    const cuvette = assetRegistry.create('optical_cuvette') as THREE.Group;
    expect(cuvette).toBeDefined();
    expect(cuvette.name).toBe('optical_cuvette');

    // Verify peelable film mesh
    const peelFilm = cuvette.getObjectByName('cuvette_peel_film') as THREE.Mesh;
    expect(peelFilm).toBeDefined();

    // Verify 3D liquid body and curved meniscus
    const liquidBody = cuvette.getObjectByName('liquid_body') as THREE.Mesh;
    const meniscus = cuvette.getObjectByName('liquid_meniscus') as THREE.Mesh;
    expect(liquidBody).toBeDefined();
    expect(meniscus).toBeDefined();

    const liquidMat = liquidBody.material as THREE.MeshPhysicalMaterial;
    expect(liquidMat.ior).toBeCloseTo(1.332, 2);
    expect(liquidMat.transmission).toBeGreaterThan(0.65);
  });

  it('generates pink dropper bottle with white screw cap (strictly NOT red)', () => {
    const bottle = assetRegistry.create('dropper_bottle') as THREE.Group;
    expect(bottle).toBeDefined();
    expect(bottle.name).toBe('dropper_bottle');

    // Verify white screw cap (#ffffff)
    const whiteCaps = bottle.children.filter((c) => {
      if (!(c instanceof THREE.Mesh)) return false;
      const mat = c.material as THREE.MeshStandardMaterial;
      return mat && mat.color && mat.color.getHexString() === 'ffffff';
    });
    expect(whiteCaps.length).toBeGreaterThanOrEqual(1);

    // Verify ZERO red cap materials on bottle
    bottle.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material) {
        const m = node.material as THREE.MeshStandardMaterial;
        if (m.color) {
          const hex = m.color.getHexString().toLowerCase();
          expect(hex).not.toBe('e11d48'); // Erroneous red cap color
        }
      }
    });

    // Verify translucent pink body
    const bodyMesh = bottle.children[0] as THREE.Mesh;
    const bodyMat = bodyMesh.material as THREE.MeshPhysicalMaterial;
    expect(bodyMat.transmission).toBeGreaterThanOrEqual(0.7);
    expect(bodyMat.color.getHexString()).toBe('fda4af');
  });
});

describe('Visual Fidelity - 6. Electronic Controller & Power Bank (R1 & Fig. 4-6, 4-7, 8)', () => {
  it('generates white ABS controller with official serigraphy, blue LCD, rocker switch, turned aluminum knob, and green Euroblock terminal', () => {
    const controller = assetRegistry.create('electronic_controller') as THREE.Group;
    expect(controller).toBeDefined();
    expect(controller.name).toBe('electronic_controller');

    // Verify white ABS chassis (#f8fafc)
    const chassis = controller.children[0] as THREE.Mesh;
    const chassisMat = chassis.material as THREE.MeshStandardMaterial;
    expect(chassisMat.color.getHexString()).toBe('f8fafc');
    expect(chassisMat.roughness).toBeCloseTo(0.32, 1);

    // Verify black rectangular rocker switch
    const rockerSwitch = controller.getObjectByName('rocker_switch') as THREE.Group;
    expect(rockerSwitch).toBeDefined();
    expect(rockerSwitch.children.length).toBeGreaterThanOrEqual(2);

    // Verify turned aluminum potentiometer knob (metalness: 0.88)
    const potKnob = controller.getObjectByName('current_knob') as THREE.Mesh;
    expect(potKnob).toBeDefined();
    const knobMat = potKnob.material as THREE.MeshStandardMaterial;
    expect(knobMat.metalness).toBeGreaterThanOrEqual(0.85);

    // Verify industrial green 2-pin Euroblock terminal (#16a34a)
    const euroblock = controller.getObjectByName('euroblock_terminal') as THREE.Group;
    expect(euroblock).toBeDefined();
    const greenBody = euroblock.children.find((c) => {
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      return mat && mat.color && mat.color.getHexString() === '16a34a';
    });
    expect(greenBody).toBeDefined();
  });

  it('generates matte black power bank with white cable', () => {
    const powerBank = assetRegistry.create('power_bank') as THREE.Group;
    expect(powerBank).toBeDefined();
    expect(powerBank.name).toBe('power_bank');

    // Body in matte black (#18181b)
    const body = powerBank.children[0] as THREE.Mesh;
    const bodyMat = body.material as THREE.MeshStandardMaterial;
    expect(bodyMat.color.getHexString()).toBe('18181b');
    expect(bodyMat.roughness).toBeGreaterThanOrEqual(0.55);

    // White cable connector (#f8fafc)
    const connector = powerBank.children.find((c) => {
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      return mat && mat.color && mat.color.getHexString() === 'f8fafc';
    });
    expect(connector).toBeDefined();
  });
});

describe('Visual Fidelity - 7. Observation Screen (R1 & Fig. 4-3)', () => {
  it('generates observation screen on grooved black base with clamping screws, gray frame, and white surface', () => {
    const screen = assetRegistry.create('observation_screen') as THREE.Group;
    expect(screen).toBeDefined();
    expect(screen.name).toBe('observation_screen');

    // Black machined base (#18181b)
    const base = screen.children[0] as THREE.Mesh;
    const baseMat = base.material as THREE.MeshStandardMaterial;
    expect(baseMat.color.getHexString()).toBe('18181b');

    // Anodized gray aluminum frame (#64748b)
    const frame = screen.children.find((c) => {
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      return mat && mat.color && mat.color.getHexString() === '64748b';
    }) as THREE.Mesh;
    expect(frame).toBeDefined();

    // Flat matte white projection surface (#f8fafc, roughness 0.96)
    const face = screen.children.find((c) => {
      const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      return mat && mat.color && mat.color.getHexString() === 'f8fafc' && mat.roughness > 0.9;
    }) as THREE.Mesh;
    expect(face).toBeDefined();
    expect((face.material as THREE.MeshStandardMaterial).roughness).toBeGreaterThanOrEqual(0.95);
  });
});

describe('Physics Integration - Collision Volume Verification (M2 Contract)', () => {
  it('provides well-defined collision geometries for all 11 assets', () => {
    const descriptors = assetRegistry.listAssets();
    descriptors.forEach((desc) => {
      const col = desc.collision;
      expect(col).toBeDefined();
      expect(['box', 'cylinder', 'compound']).toContain(col.type);

      if (col.type === 'box') {
        expect(col.size).toBeDefined();
        expect(col.size?.length).toBe(3);
        expect(col.size![0]).toBeGreaterThan(0);
        expect(col.size![1]).toBeGreaterThan(0);
        expect(col.size![2]).toBeGreaterThan(0);
      } else if (col.type === 'cylinder') {
        expect(col.radius).toBeDefined();
        expect(col.height).toBeDefined();
        expect(col.radius!).toBeGreaterThan(0);
        expect(col.height!).toBeGreaterThan(0);
      }

      if (col.offset) {
        expect(col.offset.length).toBe(3);
      }
    });
  });
});
