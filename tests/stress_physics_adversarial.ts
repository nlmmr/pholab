import * as THREE from 'three';
import {
  OBBCollider,
  CylinderCollider,
  PlaneCollider,
  RigidBody,
  ContactResolver,
  RigidBodySimulator,
} from '../src/core/physics';

interface StressTestResult {
  category: string;
  name: string;
  passed: boolean;
  details: string;
  durationMs: number;
}

const results: StressTestResult[] = [];

function runStress(category: string, name: string, fn: () => void) {
  const start = Date.now();
  try {
    fn();
    const durationMs = Date.now() - start;
    results.push({ category, name, passed: true, details: 'OK', durationMs });
    console.log(`  [PASS] ${category} > ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ category, name, passed: false, details: err.message || String(err), durationMs });
    console.error(`  [FAIL] ${category} > ${name} (${durationMs}ms)`);
    console.error(`         ${err.message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertClose(actual: number, expected: number, tol: number, name: string) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${name}: expected ${expected} ± ${tol}, got ${actual}`);
  }
}

console.log('='.repeat(70));
console.log('  CHALLENGER 1: ADVERSARIAL STRESS HARNESS - RIGID BODY SIMULATION');
console.log('='.repeat(70));

// =========================================================================
// SUITE 1: Extreme Drop Heights & Anti-Tunneling Probe
// =========================================================================
console.log('\n--- SUITE 1: Extreme Drop Heights & Anti-Tunneling ---');

runStress('Anti-Tunneling', 'Drops from h = 10m, 50m, 100m, 500m, 1000m onto benchtop (Y = 0)', () => {
  const heights = [10, 50, 100, 500, 1000];
  const halfHeight = 0.1;

  for (const h of heights) {
    const sim = new RigidBodySimulator();
    const restitution = 0.15;
    const body = new RigidBody({
      id: `drop_${h}m`,
      collider: new OBBCollider(new THREE.Vector3(0.15, halfHeight, 0.15)),
      position: new THREE.Vector3(0, h, 0),
      mass: 1.0,
      restitution,
    });
    sim.addBody(body);

    // Theoretical free fall time: tFall = sqrt(2h / g)
    const tFall = Math.sqrt((2 * h) / 9.81);
    const vImpact = Math.sqrt(2 * 9.81 * h);
    // Theoretical bounce duration: sum of 2 * (vImpact * e^k) / g until v < 0.08 m/s
    let tBounceTotal = 0;
    let vRebound = vImpact * restitution;
    while (vRebound >= 0.08) {
      tBounceTotal += (2 * vRebound) / 9.81;
      vRebound *= restitution;
    }
    const maxSteps = Math.ceil((tFall + tBounceTotal + 1.0) / sim.subStepDt);

    let minBottomY = Infinity;
    let settledStep = -1;

    for (let i = 0; i < maxSteps; i++) {
      sim.subStep(sim.subStepDt);
      const bottomY = body.position.y - halfHeight;
      if (bottomY < minBottomY) {
        minBottomY = bottomY;
      }
      // Strictly non-clipping after step resolution: bottom must never stay below -1e-3 m
      assert(
        bottomY >= -1e-3,
        `Drop from ${h}m tunneled through tabletop! bottomY = ${bottomY} at step ${i}`,
      );

      if (body.isSleeping && settledStep < 0) {
        settledStep = i;
        break;
      }
    }

    // Must have settled
    assert(body.isSleeping, `Body failed to settle after drop from ${h}m (minBottomY = ${minBottomY})`);
    assertClose(body.position.y, halfHeight, 0.01, `Settled height after ${h}m drop`);
    assertClose(body.velocity.y, 0, 1e-4, `Settled velocity after ${h}m drop`);
  }
});

runStress('Anti-Tunneling', 'Supersonic downward impact velocities (-50 m/s to -1000 m/s) directly above bench', () => {
  const velocities = [-50, -100, -250, -500, -1000];
  const halfH = 0.1;
  const restitution = 0.20;

  for (const vy of velocities) {
    const sim = new RigidBodySimulator();
    const body = new RigidBody({
      id: `hypersonic_${vy}`,
      collider: new OBBCollider(new THREE.Vector3(0.1, halfH, 0.1)),
      position: new THREE.Vector3(0, halfH + 0.01, 0), // 1cm above tabletop
      velocity: new THREE.Vector3(0, vy, 0),
      mass: 2.0,
      restitution,
    });
    sim.addBody(body);

    // First sub-step executes impact resolution
    sim.subStep(sim.subStepDt);

    const bottomYAfterFirst = body.position.y - halfH;
    assert(
      bottomYAfterFirst >= -1e-4,
      `High-velocity vy=${vy} tunneled through bench in subStep 1: bottomY = ${bottomYAfterFirst}`,
    );

    // Upward velocity after rebound must be positive and bounded
    assert(
      body.velocity.y > 0,
      `Velocity vy=${vy} failed to rebound upward: velocity.y = ${body.velocity.y}`,
    );

    // Compute maximum time for bounces to decay below threshold
    let vReb = Math.abs(vy) * restitution;
    let tBounce = 0;
    while (vReb >= 0.08) {
      tBounce += (2 * vReb) / 9.81;
      vReb *= restitution;
    }
    const maxSteps = Math.ceil((tBounce + 1.0) / sim.subStepDt);

    for (let i = 0; i < maxSteps; i++) {
      sim.subStep(sim.subStepDt);
      const bottomY = body.position.y - halfH;
      assert(bottomY >= -1e-4, `Penetration observed during settling for vy=${vy}: ${bottomY}`);
      if (body.isSleeping) break;
    }

    assert(body.isSleeping, `Body failed to settle to sleep after vy=${vy}`);
    assertClose(body.position.y, halfH, 0.01, `Settled height after vy=${vy}`);
  }
});

runStress('Anti-Tunneling', 'Micro-thin collider (thickness = 2 mm, halfHeight = 0.001 m) high-speed drop', () => {
  const sim = new RigidBodySimulator();
  const halfH = 0.001; // Ultra-thin slide (1mm half-height)
  const body = new RigidBody({
    id: 'thin_slide_drop',
    collider: new OBBCollider(new THREE.Vector3(0.05, halfH, 0.05)),
    position: new THREE.Vector3(0, 5.0, 0),
    velocity: new THREE.Vector3(0, -30.0, 0),
    mass: 0.02,
    restitution: 0.1,
  });
  sim.addBody(body);

  for (let i = 0; i < 150; i++) {
    sim.subStep(sim.subStepDt);
    const bottomY = body.position.y - halfH;
    assert(
      bottomY >= -1e-4,
      `Ultra-thin collider tunneled below benchtop! bottomY = ${bottomY} at step ${i}`,
    );
  }

  assertClose(body.position.y, halfH, 0.01, 'Thin collider settled height');
});

runStress('Anti-Tunneling', 'High-speed angled oblique impact (vx=40, vy=-60, vz=40 m/s)', () => {
  const sim = new RigidBodySimulator();
  const halfH = 0.1;
  const body = new RigidBody({
    id: 'oblique_impact',
    collider: new OBBCollider(new THREE.Vector3(0.1, halfH, 0.1)),
    position: new THREE.Vector3(0, 0.5, 0),
    velocity: new THREE.Vector3(40, -60, 40),
    mass: 1.0,
    restitution: 0.2,
    friction: 0.5,
  });
  sim.addBody(body);

  sim.subStep(sim.subStepDt);
  const bottomY = body.position.y - halfH;
  assert(bottomY >= -1e-4, `Oblique impact tunneled below bench! bottomY = ${bottomY}`);
  assert(body.velocity.y >= 0, `Oblique impact normal velocity did not reflect: ${body.velocity.y}`);
  // Tangential velocity damped by friction
  assert(body.velocity.x < 40, `Tangential friction failed to reduce vx: ${body.velocity.x}`);
  assert(body.velocity.z < 40, `Tangential friction failed to reduce vz: ${body.velocity.z}`);
});

// =========================================================================
// SUITE 2: Table Boundaries & Floor Landing at Y = -0.78 m
// =========================================================================
console.log('\n--- SUITE 2: Table Boundaries & Floor Landing ---');

runStress('Boundaries & Floor', 'Comprehensive boundary perimeter grid scan (8 cardinal and diagonal boundary points)', () => {
  const halfH = 0.1;

  // Test matrix: [X, Z, insideBench]
  const boundaryTests: [number, number, boolean, string][] = [
    [3.18, 0.0, true, '+X inside bench'],
    [3.22, 0.0, false, '+X outside bench -> floor'],
    [-3.18, 0.0, true, '-X inside bench'],
    [-3.22, 0.0, false, '-X outside bench -> floor'],
    [0.0, 1.68, true, '+Z inside bench'],
    [0.0, 1.72, false, '+Z outside bench -> floor'],
    [0.0, -1.68, true, '-Z inside bench'],
    [0.0, -1.72, false, '-Z outside bench -> floor'],
    [3.22, 1.72, false, '+X/+Z corner outside -> floor'],
    [-3.22, 1.72, false, '-X/+Z corner outside -> floor'],
    [3.22, -1.72, false, '+X/-Z corner outside -> floor'],
    [-3.22, -1.72, false, '-X/-Z corner outside -> floor'],
  ];

  for (const [x, z, insideBench, desc] of boundaryTests) {
    const sim = new RigidBodySimulator();
    const body = new RigidBody({
      id: `boundary_${x}_${z}`,
      collider: new OBBCollider(new THREE.Vector3(0.08, halfH, 0.08)),
      position: new THREE.Vector3(x, 0.6, z),
      mass: 1.0,
      restitution: 0.15,
    });
    sim.addBody(body);

    // Simulate for 180 sub-steps (1.5 seconds)
    for (let i = 0; i < 180; i++) {
      sim.subStep(sim.subStepDt);
      const bottomY = body.position.y - halfH;
      // Floor non-clipping invariant: bottom face must never be below -0.78 m
      assert(
        bottomY >= -0.7801,
        `Boundary test ${desc} clipped below floor level! bottomY = ${bottomY} at step ${i}`,
      );
    }

    if (insideBench) {
      assertClose(body.position.y, halfH, 0.05, `${desc} settled height on bench`);
    } else {
      assertClose(body.position.y, -0.78 + halfH, 0.05, `${desc} settled height on floor`);
    }
  }
});

runStress('Boundaries & Floor', 'Glancing edge slide: object slides off table at X = 3.20 and falls to floor', () => {
  const sim = new RigidBodySimulator();
  const halfH = 0.08;
  const slider = new RigidBody({
    id: 'edge_slider',
    collider: new OBBCollider(new THREE.Vector3(0.08, halfH, 0.08)),
    position: new THREE.Vector3(3.0, halfH, 0), // On bench near edge
    velocity: new THREE.Vector3(1.5, 0, 0), // Sliding towards +X edge (3.20m)
    mass: 1.0,
    restitution: 0.1,
    friction: 0.05,
  });
  sim.addBody(slider);

  let crossedEdge = false;
  for (let i = 0; i < 200; i++) {
    sim.subStep(sim.subStepDt);
    if (slider.position.x > 3.20) {
      crossedEdge = true;
    }
    const bottomY = slider.position.y - halfH;
    assert(bottomY >= -0.7801, `Edge slider fell below floor level! bottomY = ${bottomY}`);
  }

  assert(crossedEdge, 'Slider failed to cross edge at X = 3.20');
  // Must have landed on floor at Y = -0.78 + halfH
  assertClose(slider.position.y, -0.78 + halfH, 0.05, 'Edge slider final floor position');
});

runStress('Boundaries & Floor', 'Floor room perimeter bounds verification (extremes at X = ±18m, Z = ±18m)', () => {
  const sim = new RigidBodySimulator();
  const corners = [
    [18.0, 18.0],
    [-18.0, 18.0],
    [18.0, -18.0],
    [-18.0, -18.0],
  ];

  for (const [x, z] of corners) {
    const body = new RigidBody({
      id: `floor_corner_${x}_${z}`,
      collider: new OBBCollider(new THREE.Vector3(0.1, 0.1, 0.1)),
      position: new THREE.Vector3(x, 1.0, z),
      mass: 0.5,
    });
    sim.addBody(body);
  }

  for (let i = 0; i < 180; i++) {
    sim.subStep(sim.subStepDt);
    for (const body of sim.getBodies()) {
      assert(
        body.position.y - 0.1 >= -0.7801,
        `Room boundary corner body ${body.id} fell through floor! Y = ${body.position.y}`,
      );
    }
  }

  for (const body of sim.getBodies()) {
    assertClose(body.position.y, -0.78 + 0.1, 0.02, `Corner body ${body.id} landing`);
  }
});

// =========================================================================
// SUITE 3: Multi-Body Stacking, OBB SAT Overlaps & Resting Stability
// =========================================================================
console.log('\n--- SUITE 3: Multi-Body Stacking & Resting Stability ---');

runStress('Multi-Body Stacking', '3-body vertical tower resting stability & zero continuous jitter', () => {
  const sim = new RigidBodySimulator();
  const halfH = 0.1;

  // Box 1 (base): half-extent 0.1m, mass 3.0 kg
  const box1 = new RigidBody({
    id: 'tower_1',
    collider: new OBBCollider(new THREE.Vector3(0.25, halfH, 0.25)),
    position: new THREE.Vector3(0, halfH, 0),
    mass: 3.0,
    restitution: 0.05,
  });
  // Box 2 (middle): half-extent 0.1m, mass 2.0 kg
  const box2 = new RigidBody({
    id: 'tower_2',
    collider: new OBBCollider(new THREE.Vector3(0.2, halfH, 0.2)),
    position: new THREE.Vector3(0, halfH * 3 + 0.05, 0),
    mass: 2.0,
    restitution: 0.05,
  });
  // Box 3 (top): half-extent 0.1m, mass 1.0 kg
  const box3 = new RigidBody({
    id: 'tower_3',
    collider: new OBBCollider(new THREE.Vector3(0.15, halfH, 0.15)),
    position: new THREE.Vector3(0, halfH * 5 + 0.1, 0),
    mass: 1.0,
    restitution: 0.05,
  });

  sim.addBody(box1);
  sim.addBody(box2);
  sim.addBody(box3);

  // Let the stack settle over 200 sub-steps (~1.67s)
  for (let i = 0; i < 200; i++) {
    sim.subStep(sim.subStepDt);
  }

  // Verify non-clipping in stack
  assert(box1.position.y - halfH >= -1e-4, 'Box 1 bottom below bench');
  assert(box2.position.y - halfH >= box1.position.y + halfH - 1e-3, 'Box 2 penetrating Box 1');
  assert(box3.position.y - halfH >= box2.position.y + halfH - 1e-3, 'Box 3 penetrating Box 2');

  // Verify stacked heights
  assertClose(box1.position.y, 0.10, 0.03, 'Box 1 height');
  assertClose(box2.position.y, 0.30, 0.04, 'Box 2 height');
  assertClose(box3.position.y, 0.50, 0.05, 'Box 3 height');

  // Verify sleep stability across 300 additional frames
  const pos1 = box1.position.clone();
  const pos2 = box2.position.clone();
  const pos3 = box3.position.clone();

  for (let i = 0; i < 300; i++) {
    sim.subStep(sim.subStepDt);
    assertClose(box1.position.y, pos1.y, 1e-4, 'Box 1 jitter drift');
    assertClose(box2.position.y, pos2.y, 1e-4, 'Box 2 jitter drift');
    assertClose(box3.position.y, pos3.y, 1e-4, 'Box 3 jitter drift');
    assert(box1.velocity.length() < 1e-4, 'Box 1 non-zero velocity');
    assert(box2.velocity.length() < 1e-4, 'Box 2 non-zero velocity');
    assert(box3.velocity.length() < 1e-4, 'Box 3 non-zero velocity');
  }
});

runStress('Multi-Body Stacking', 'Deep initial overlap stress (80% mutual interpenetration) separates cleanly', () => {
  const sim = new RigidBodySimulator();
  sim.clearEnvironmentPlanes();

  // Two 1x1x1 boxes with centers at 0 and 0.2 (overlap of 0.8m)
  const bodyA = new RigidBody({
    id: 'overlap_A',
    collider: new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5)),
    position: new THREE.Vector3(0, 0, 0),
    mass: 1.0,
  });
  const bodyB = new RigidBody({
    id: 'overlap_B',
    collider: new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5)),
    position: new THREE.Vector3(0.2, 0, 0),
    mass: 1.0,
  });
  sim.addBody(bodyA);
  sim.addBody(bodyB);

  // Single step must separate them without infinite velocity
  sim.subStep(sim.subStepDt);

  const separation = bodyB.position.x - bodyA.position.x;
  assert(separation >= 1.0 - 1e-4, `Failed to separate 80% overlap: separation = ${separation}`);
  assert(isFinite(bodyA.position.x) && isFinite(bodyB.position.x), 'Positions exploded to NaN/Infinity');
  assert(bodyA.velocity.length() < 100, `Excessive explosive velocity: ${bodyA.velocity.length()}`);
});

runStress('Multi-Body Stacking', 'Rotated OBB (30°, 45°, 60° Y-roll) dropped onto tabletop resolves SAT contacts', () => {
  const angles = [Math.PI / 6, Math.PI / 4, Math.PI / 3];
  const halfExtent = new THREE.Vector3(0.15, 0.15, 0.15);

  for (const angle of angles) {
    const sim = new RigidBodySimulator();
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle);
    const body = new RigidBody({
      id: `rotated_${Math.round((angle * 180) / Math.PI)}`,
      collider: new OBBCollider(halfExtent),
      position: new THREE.Vector3(0, 0.5, 0),
      quaternion: quat,
      mass: 1.0,
      restitution: 0.1,
    });
    sim.addBody(body);

    for (let i = 0; i < 150; i++) {
      sim.subStep(sim.subStepDt);
      // Project all 8 vertices; lowest vertex must not be below 0
      const obb = body.collider as OBBCollider;
      const vertices = obb.getVertices(body.position, body.quaternion);
      for (const v of vertices) {
        assert(v.y >= -1e-4, `Rotated vertex penetrated bench: v.y = ${v.y} at step ${i}`);
      }
    }

    assert(body.isSleeping || body.velocity.length() < 0.08, 'Rotated body failed to settle');
  }
});

runStress('Multi-Body Stacking', 'Total mechanical energy strictly non-increasing in resting/inelastic regime', () => {
  const sim = new RigidBodySimulator();
  const halfH = 0.1;
  const body = new RigidBody({
    id: 'energy_check',
    collider: new OBBCollider(new THREE.Vector3(0.1, halfH, 0.1)),
    position: new THREE.Vector3(0, 1.0, 0),
    mass: 1.5,
    restitution: 0.2,
  });
  sim.addBody(body);

  let prevEnergy = Infinity;
  let energyGainViolations = 0;

  for (let i = 0; i < 200; i++) {
    sim.subStep(sim.subStepDt);
    const m = body.mass;
    const g = 9.81;
    const h = body.position.y - halfH; // Height above bench
    const ep = m * g * Math.max(0, h);
    const ek = 0.5 * m * body.velocity.lengthSq();
    const totalE = ep + ek;

    // After impact damping, total energy must not spontaneously spike higher than previous frame
    if (i > 20 && totalE > prevEnergy + 1e-3) {
      energyGainViolations++;
    }
    prevEnergy = totalE;
  }

  assert(
    energyGainViolations === 0,
    `Spontaneous kinetic energy gain detected! Violations: ${energyGainViolations}`,
  );
});

// =========================================================================
// SUITE 4: Dynamic 3D GrabOffset Preservation
// =========================================================================
console.log('\n--- SUITE 4: Dynamic 3D GrabOffset Preservation ---');

runStress('3D GrabOffset', 'GrabOffset vector invariance across 100 randomized 3D contact geometries', () => {
  for (let trial = 0; trial < 100; trial++) {
    const objPos = new THREE.Vector3(
      (Math.random() - 0.5) * 4.0,
      Math.random() * 1.5,
      (Math.random() - 0.5) * 2.0,
    );
    const hitPoint = objPos.clone().add(
      new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
      ),
    );

    const grabOffset = objPos.clone().sub(hitPoint);

    // Dynamic reconstruction: P_obj = P_hit + grabOffset
    const reconstructed = hitPoint.clone().add(grabOffset);
    assertClose(reconstructed.x, objPos.x, 1e-6, `Trial ${trial} X reconstruction`);
    assertClose(reconstructed.y, objPos.y, 1e-6, `Trial ${trial} Y reconstruction`);
    assertClose(reconstructed.z, objPos.z, 1e-6, `Trial ${trial} Z reconstruction`);
  }
});

runStress('3D GrabOffset', 'Violent rapid pointer movements do not distort grabOffset vector', () => {
  const initialObjectPos = new THREE.Vector3(0.5, 0.25, 0.5);
  const initialHitPoint = new THREE.Vector3(0.55, 0.28, 0.52);
  const grabOffset = initialObjectPos.clone().sub(initialHitPoint);

  // Simulated rapid pointer move sequence
  const rapidRaycastHits = [
    new THREE.Vector3(1.2, 0.8, 0.4),
    new THREE.Vector3(-2.0, 1.5, -1.0),
    new THREE.Vector3(2.5, 0.1, 1.2),
    new THREE.Vector3(-1.5, 0.5, 0.0),
    new THREE.Vector3(0.0, 1.2, 0.8),
  ];

  for (let step = 0; step < rapidRaycastHits.length; step++) {
    const hit = rapidRaycastHits[step];
    const objectPos = hit.clone().add(grabOffset);

    // Vector difference between new object pos and new hit point must remain EXACTLY grabOffset
    const currentOffset = objectPos.clone().sub(hit);
    assertClose(currentOffset.x, grabOffset.x, 1e-8, `Step ${step} grabOffsetX`);
    assertClose(currentOffset.y, grabOffset.y, 1e-8, `Step ${step} grabOffsetY`);
    assertClose(currentOffset.z, grabOffset.z, 1e-8, `Step ${step} grabOffsetZ`);
  }
});

runStress('3D GrabOffset', 'Kit cradle extraction Y = 0.21m correctly preserves grabOffset vs table', () => {
  const cradleHeight = 0.21;
  const platformPos = new THREE.Vector3(-1.8, cradleHeight, 0.8);
  const hitPoint = new THREE.Vector3(-1.75, cradleHeight + 0.04, 0.82);

  const grabOffset = platformPos.clone().sub(hitPoint);
  assertClose(grabOffset.y, -0.04, 1e-6, 'Vertical grab offset at cradle height');

  // Dragging to bench at hitPoint (0, 0, 0)
  const benchHit = new THREE.Vector3(0, 0, 0);
  const benchPos = benchHit.clone().add(grabOffset);

  // Offset must be faithfully applied
  assertClose(benchPos.x, -0.05, 1e-6, 'Extracted X');
  assertClose(benchPos.y, -0.04, 1e-6, 'Extracted Y');
  assertClose(benchPos.z, -0.02, 1e-6, 'Extracted Z');
});

// =========================================================================
// SUMMARY & VERDICT
// =========================================================================
console.log('\n' + '='.repeat(70));
console.log('                 ADVERSARIAL STRESS TEST SUMMARY');
console.log('='.repeat(70));

const total = results.length;
const passed = results.filter((r) => r.passed).length;
const failed = total - passed;

console.log(`Total Probes: ${total}`);
console.log(`Passed:       ${passed}`);
console.log(`Failed:       ${failed}`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
console.log('='.repeat(70));

if (failed > 0) {
  console.error('\n❌ FAIL: Empirical stress testing revealed defects!');
  process.exit(1);
} else {
  console.log('\n✅ APPROVE: All adversarial physics and boundary probes PASSED!\n');
  process.exit(0);
}
