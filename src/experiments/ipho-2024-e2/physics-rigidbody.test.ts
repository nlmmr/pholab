import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  OBBCollider,
  CylinderCollider,
  PlaneCollider,
  RigidBody,
  ContactResolver,
  RigidBodySimulator,
} from '../../core/physics';

describe('R2 Feature 1: Symplectic Euler Kinematics & Free Fall under g = 9.81 m/s²', () => {
  it('free fall acceleration matches analytical velocity and displacement', () => {
    const sim = new RigidBodySimulator();
    sim.clearEnvironmentPlanes(); // Pure free fall in empty space

    const body = new RigidBody({
      id: 'drop_test',
      collider: new OBBCollider(new THREE.Vector3(0.1, 0.1, 0.1)),
      position: new THREE.Vector3(0, 5.0, 0),
      mass: 1.0,
    });
    sim.addBody(body);

    const totalTime = 0.3; // 300 ms
    const steps = Math.round(totalTime / sim.subStepDt);

    for (let i = 0; i < steps; i++) {
      sim.subStep(sim.subStepDt);
    }

    const expectedTime = steps * sim.subStepDt;
    const expectedVelocity = -9.81 * expectedTime;
    // For Symplectic Euler: v_{k} = -k*g*dt, y_k = y_0 - g*dt^2 * k(k+1)/2
    const expectedPos = 5.0 - 9.81 * sim.subStepDt * sim.subStepDt * (steps * (steps + 1)) / 2;

    expect(body.velocity.y).toBeCloseTo(expectedVelocity, 2);
    expect(body.position.y).toBeCloseTo(expectedPos, 2);
  });

  it('verifies mass independence (Galileo equivalence principle)', () => {
    const sim = new RigidBodySimulator();
    sim.clearEnvironmentPlanes();

    const lightBody = new RigidBody({
      id: 'light',
      collider: new OBBCollider(new THREE.Vector3(0.05, 0.05, 0.05)),
      position: new THREE.Vector3(-1, 3.0, 0),
      mass: 0.1,
    });
    const heavyBody = new RigidBody({
      id: 'heavy',
      collider: new OBBCollider(new THREE.Vector3(0.05, 0.05, 0.05)),
      position: new THREE.Vector3(1, 3.0, 0),
      mass: 10.0,
    });
    sim.addBody(lightBody);
    sim.addBody(heavyBody);

    for (let i = 0; i < 25; i++) {
      sim.subStep(sim.subStepDt);
    }

    expect(lightBody.position.y).toBeCloseTo(heavyBody.position.y, 4);
    expect(lightBody.velocity.y).toBeCloseTo(heavyBody.velocity.y, 4);
  });

  it('static bodies remain immobilized under gravity', () => {
    const sim = new RigidBodySimulator();
    sim.clearEnvironmentPlanes();

    const staticBody = new RigidBody({
      id: 'static_block',
      collider: new OBBCollider(new THREE.Vector3(0.2, 0.2, 0.2)),
      position: new THREE.Vector3(0, 2.0, 0),
      isStatic: true,
    });
    sim.addBody(staticBody);

    for (let i = 0; i < 30; i++) {
      sim.subStep(sim.subStepDt);
    }

    expect(staticBody.position.y).toBe(2.0);
    expect(staticBody.velocity.y).toBe(0);
  });

  it('held bodies (Alt+LMB) do not fall under gravity while held', () => {
    const sim = new RigidBodySimulator();
    sim.clearEnvironmentPlanes();

    const body = new RigidBody({
      id: 'held_tool',
      collider: new OBBCollider(new THREE.Vector3(0.1, 0.1, 0.1)),
      position: new THREE.Vector3(0, 1.5, 0),
      isHeld: true,
    });
    sim.addBody(body);

    for (let i = 0; i < 20; i++) {
      sim.subStep(sim.subStepDt);
    }

    expect(body.position.y).toBe(1.5);
    expect(body.velocity.y).toBe(0);

    // Releasing held state immediately activates gravity
    sim.setBodyHeld('held_tool', false);
    sim.subStep(sim.subStepDt);
    expect(body.velocity.y).toBeLessThan(0);
  });
});

describe('R2 Feature 2: Solid Tabletop Non-Clipping at Y = 0.0 m', () => {
  it('falling OBB lands on tabletop with zero penetration below Y = 0', () => {
    const sim = new RigidBodySimulator(); // Preconfigured with bench at Y=0 and floor at Y=-0.78
    const halfHeight = 0.15;

    const body = new RigidBody({
      id: 'cuvette_drop',
      collider: new OBBCollider(new THREE.Vector3(0.11, halfHeight, 0.11)),
      position: new THREE.Vector3(0, 1.0, 0),
      mass: 0.5,
      restitution: 0.15,
    });
    sim.addBody(body);

    // Simulate for 1.2 seconds (144 sub-steps)
    for (let i = 0; i < 144; i++) {
      sim.subStep(sim.subStepDt);
      // Bottom face of OBB must never penetrate below table surface (Y=0)
      const bottomY = body.position.y - halfHeight;
      expect(bottomY).toBeGreaterThanOrEqual(-1e-4);
    }

    // Settled resting position: center at Y = halfHeight
    expect(body.position.y).toBeCloseTo(halfHeight, 3);
    expect(body.velocity.y).toBeCloseTo(0, 2);
  });

  it('falling cylinder lands on tabletop with base at Y = 0.0 m', () => {
    const sim = new RigidBodySimulator();
    const halfHeight = 0.155; // Pink bottle half height

    const bottle = new RigidBody({
      id: 'bottle_drop',
      collider: new CylinderCollider(0.065, halfHeight),
      position: new THREE.Vector3(0.5, 0.8, 0.2),
      mass: 0.2,
      restitution: 0.2,
    });
    sim.addBody(bottle);

    for (let i = 0; i < 120; i++) {
      sim.subStep(sim.subStepDt);
      const bottomY = bottle.position.y - halfHeight;
      expect(bottomY).toBeGreaterThanOrEqual(-1e-4);
    }

    expect(bottle.position.y).toBeCloseTo(halfHeight, 3);
  });

  it('tabletop boundaries: object inside bench stops at Y=0, outside falls past Y=0', () => {
    const sim = new RigidBodySimulator();
    const halfHeight = 0.1;

    // Body A: within bench bounds (X = 2.0, bench limit is 3.2)
    const onBench = new RigidBody({
      id: 'on_bench',
      collider: new OBBCollider(new THREE.Vector3(0.1, halfHeight, 0.1)),
      position: new THREE.Vector3(2.0, 0.5, 0),
      mass: 1.0,
      restitution: 0.1,
    });
    // Body B: beyond bench bounds (X = 4.0, outside [-3.2, 3.2])
    const offBench = new RigidBody({
      id: 'off_bench',
      collider: new OBBCollider(new THREE.Vector3(0.1, halfHeight, 0.1)),
      position: new THREE.Vector3(4.0, 0.5, 0),
      mass: 1.0,
      restitution: 0.1,
    });

    sim.addBody(onBench);
    sim.addBody(offBench);

    for (let i = 0; i < 100; i++) {
      sim.subStep(sim.subStepDt);
    }

    // onBench stops on tabletop (bottom at Y=0)
    expect(onBench.position.y).toBeCloseTo(halfHeight, 2);

    // offBench falls below tabletop Y=0
    expect(offBench.position.y).toBeLessThan(0);
  });
});

describe('R2 Feature 3: Solid Floor Non-Clipping at Y = -0.78 m', () => {
  it('object dropped over the bench edge falls cleanly and stops at floor Y = -0.78 m', () => {
    const sim = new RigidBodySimulator();
    const halfHeight = 0.1;

    const droppedOff = new RigidBody({
      id: 'fall_to_floor',
      collider: new OBBCollider(new THREE.Vector3(0.1, halfHeight, 0.1)),
      position: new THREE.Vector3(3.5, 0.2, 0), // Beyond bench limit
      mass: 1.0,
      restitution: 0.18,
    });
    sim.addBody(droppedOff);

    // Run for 180 sub-steps (1.5 seconds)
    for (let i = 0; i < 180; i++) {
      sim.subStep(sim.subStepDt);
      const bottomY = droppedOff.position.y - halfHeight;
      // Bottom face must never penetrate below floor (Y=-0.78)
      expect(bottomY).toBeGreaterThanOrEqual(-0.7801);
    }

    // Settled center position: -0.78 + 0.1 = -0.68
    expect(droppedOff.position.y).toBeCloseTo(-0.78 + halfHeight, 3);
    expect(droppedOff.velocity.y).toBeCloseTo(0, 2);
  });

  it('cylinder dropped to floor lands at floor level without clipping', () => {
    const sim = new RigidBodySimulator();
    const halfHeight = 0.275; // S1 holder

    const holder = new RigidBody({
      id: 'holder_floor_fall',
      collider: new CylinderCollider(0.26, halfHeight),
      position: new THREE.Vector3(0, 0.5, 2.5), // Z=2.5 is outside table Z in [-1.7, 1.7]
      mass: 0.8,
      restitution: 0.15,
    });
    sim.addBody(holder);

    for (let i = 0; i < 200; i++) {
      sim.subStep(sim.subStepDt);
      const bottomY = holder.position.y - halfHeight;
      expect(bottomY).toBeGreaterThanOrEqual(-0.7801);
    }

    expect(holder.position.y).toBeCloseTo(-0.78 + halfHeight, 3);
  });
});

describe('R2 Feature 4: OBB-OBB Separating Axis Theorem (SAT) & MTV Resolution', () => {
  it('disjoint OBBs report no contact', () => {
    const obbA = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5));
    const obbB = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5));

    const contact = obbA.testOBB(
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion(),
      obbB,
      new THREE.Vector3(2.0, 0, 0), // Gap of 1.0 m along X
      new THREE.Quaternion(),
    );

    expect(contact.hasContact).toBe(false);
    expect(contact.penetration).toBe(0);
  });

  it('overlapping OBBs detect contact and calculate MTV penetration', () => {
    const obbA = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5));
    const obbB = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5));

    // A at (0, 0, 0), B at (0.8, 0, 0): Overlap along X is 0.5 + 0.5 - 0.8 = 0.2 m
    const contact = obbA.testOBB(
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion(),
      obbB,
      new THREE.Vector3(0.8, 0, 0),
      new THREE.Quaternion(),
    );

    expect(contact.hasContact).toBe(true);
    expect(contact.penetration).toBeCloseTo(0.2, 4);
    expect(contact.normal.x).toBeCloseTo(1, 4); // Points from A to B
    expect(contact.normal.y).toBeCloseTo(0, 4);
    expect(contact.normal.z).toBeCloseTo(0, 4);
  });

  it('contact resolver separates overlapping dynamic bodies so they become disjoint', () => {
    const resolver = new ContactResolver();
    const obbA = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5));
    const obbB = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5));

    const bodyA = new RigidBody({
      id: 'box_a',
      collider: obbA,
      position: new THREE.Vector3(0, 0, 0),
      mass: 1.0,
    });
    const bodyB = new RigidBody({
      id: 'box_b',
      collider: obbB,
      position: new THREE.Vector3(0.8, 0, 0),
      mass: 1.0,
    });

    const contactBefore = obbA.testOBB(
      bodyA.position,
      bodyA.quaternion,
      obbB,
      bodyB.position,
      bodyB.quaternion,
    );
    expect(contactBefore.hasContact).toBe(true);

    resolver.resolveBodyContact(bodyA, bodyB, contactBefore);

    // Each body moves by 0.1 m apart (equal masses)
    expect(bodyA.position.x).toBeCloseTo(-0.1, 4);
    expect(bodyB.position.x).toBeCloseTo(0.9, 4);

    const contactAfter = obbA.testOBB(
      bodyA.position,
      bodyA.quaternion,
      obbB,
      bodyB.position,
      bodyB.quaternion,
    );
    expect(contactAfter.hasContact).toBe(false);
  });

  it('rotated OBB (45 deg) correctly calculates 15-axis SAT contact and MTV', () => {
    const obbA = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5));
    const obbB = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5));

    // Rotate B by 45 degrees around Y
    const quatB = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);

    // B is placed along X at distance 1.1 m
    // Projected radius of B along X at 45 deg = 0.5 * cos(45) + 0.5 * sin(45) = 0.5 * sqrt(2) ≈ 0.7071
    // Total sum of radii = 0.5 + 0.7071 = 1.2071 m
    // Overlap = 1.2071 - 1.1 = 0.1071 m
    const contact = obbA.testOBB(
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion(),
      obbB,
      new THREE.Vector3(1.1, 0, 0),
      quatB,
    );

    expect(contact.hasContact).toBe(true);
    expect(contact.penetration).toBeCloseTo(1.2071 - 1.1, 2);
  });
});

describe('R2 Feature 5: Cylinder-OBB Collision & Separation', () => {
  it('disjoint Cylinder and OBB report no contact', () => {
    const cyl = new CylinderCollider(0.2, 0.4);
    const obb = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5));

    const contact = cyl.testOBB(
      new THREE.Vector3(-2.0, 0, 0),
      new THREE.Quaternion(),
      obb,
      new THREE.Vector3(2.0, 0, 0),
      new THREE.Quaternion(),
    );

    expect(contact.hasContact).toBe(false);
  });

  it('cylinder horizontally colliding with OBB detects contact with MTV', () => {
    const cyl = new CylinderCollider(0.2, 0.5); // radius 0.2
    const obb = new OBBCollider(new THREE.Vector3(0.5, 0.5, 0.5)); // half-width 0.5

    // Cylinder at (0, 0, 0), OBB at (0.6, 0, 0)
    // Distance between centers = 0.6. Sum of extents = 0.2 + 0.5 = 0.7. Overlap = 0.1.
    const contact = cyl.testOBB(
      new THREE.Vector3(0, 0, 0),
      new THREE.Quaternion(),
      obb,
      new THREE.Vector3(0.6, 0, 0),
      new THREE.Quaternion(),
    );

    expect(contact.hasContact).toBe(true);
    expect(contact.penetration).toBeCloseTo(0.1, 2);
    expect(contact.normal.x).toBeGreaterThan(0.9); // Normal points from Cyl to OBB (+X)
  });

  it('contact resolver separates overlapping Cylinder and OBB cleanly', () => {
    const sim = new RigidBodySimulator();
    sim.clearEnvironmentPlanes();

    const cylBody = new RigidBody({
      id: 'bottle',
      collider: new CylinderCollider(0.1, 0.2),
      position: new THREE.Vector3(0, 0, 0),
      mass: 0.5,
    });
    const obbBody = new RigidBody({
      id: 'cuvette',
      collider: new OBBCollider(new THREE.Vector3(0.2, 0.2, 0.2)),
      position: new THREE.Vector3(0.25, 0, 0), // Overlap of 0.1 + 0.2 - 0.25 = 0.05
      mass: 0.5,
    });

    sim.addBody(cylBody);
    sim.addBody(obbBody);

    sim.subStep(sim.subStepDt);

    // After resolution, distance between centers must be >= sum of radii (0.3)
    const dist = cylBody.position.distanceTo(obbBody.position);
    expect(dist).toBeGreaterThanOrEqual(0.3 - 1e-4);
  });
});

describe('R2 Feature 6: Kit Box Wall Containment', () => {
  it('box containment walls prevent interior components from escaping', () => {
    const sim = new RigidBodySimulator();
    sim.clearEnvironmentPlanes();

    const kitPos = new THREE.Vector3(0, 0.1, 0);
    const boxWalls = PlaneCollider.createKitBoxWalls(kitPos, 0.73, 0.64, 0.28, 0.14);
    for (const wall of boxWalls) {
      sim.addEnvironmentPlane(wall);
    }

    const halfWidth = 0.1;
    const body = new RigidBody({
      id: 'tool_in_box',
      collider: new OBBCollider(new THREE.Vector3(halfWidth, 0.05, 0.1)),
      position: new THREE.Vector3(0.5, 0.2, 0),
      velocity: new THREE.Vector3(3.0, 0, 0), // Fast movement towards +X wall (at X = 0.73)
      mass: 1.0,
      restitution: 0.2,
    });
    sim.addBody(body);

    // Simulate for 60 sub-steps (0.5s)
    for (let i = 0; i < 60; i++) {
      sim.subStep(sim.subStepDt);
      // X + halfWidth must never exceed wall position (0.73)
      expect(body.position.x + halfWidth).toBeLessThanOrEqual(0.7301);
    }

    // Velocity must be reflected or arrested
    expect(body.velocity.x).toBeLessThanOrEqual(0);
  });

  it('multi-wall perimeter keeps body strictly within box volume', () => {
    const sim = new RigidBodySimulator();
    sim.clearEnvironmentPlanes();

    const kitPos = new THREE.Vector3(0, 0, 0);
    const boxWalls = PlaneCollider.createKitBoxWalls(kitPos, 0.73, 0.64, 0.28, 0.14);
    for (const wall of boxWalls) {
      sim.addEnvironmentPlane(wall);
    }

    // Body launched towards corner (+X, +Z)
    const body = new RigidBody({
      id: 'corner_bounce',
      collider: new OBBCollider(new THREE.Vector3(0.08, 0.05, 0.08)),
      position: new THREE.Vector3(0, 0.2, 0),
      velocity: new THREE.Vector3(2.5, 0, 2.5),
      mass: 1.0,
      restitution: 0.1,
    });
    sim.addBody(body);

    for (let i = 0; i < 80; i++) {
      sim.subStep(sim.subStepDt);
      expect(body.position.x).toBeLessThanOrEqual(0.73 - 0.08 + 1e-4);
      expect(body.position.z).toBeLessThanOrEqual(0.64 - 0.08 + 1e-4);
    }
  });
});

describe('R2 Feature 7: Inelastic Restitution Settling without Jitter', () => {
  it('impact velocity is damped with e <= 0.25 on each bounce', () => {
    const sim = new RigidBodySimulator();
    const halfHeight = 0.1;
    const body = new RigidBody({
      id: 'damping_test',
      collider: new OBBCollider(new THREE.Vector3(0.1, halfHeight, 0.1)),
      position: new THREE.Vector3(0, 0.5, 0),
      mass: 1.0,
      restitution: 0.20,
    });
    sim.addBody(body);

    let maxBounceSpeed = 0;
    let hitCount = 0;

    for (let i = 0; i < 100; i++) {
      const vPrev = body.velocity.y;
      sim.subStep(sim.subStepDt);
      const vCurr = body.velocity.y;

      // Detect bounce upward from table
      if (vPrev < -0.5 && vCurr > 0) {
        hitCount++;
        maxBounceSpeed = Math.max(maxBounceSpeed, vCurr);
        // Bounce speed must be <= e * impact speed
        expect(vCurr).toBeLessThanOrEqual(Math.abs(vPrev) * 0.25 + 0.05);
      }
    }

    expect(hitCount).toBeGreaterThan(0);
  });

  it('resting cutoff stops jitter and puts settled body to sleep', () => {
    const sim = new RigidBodySimulator();
    const halfHeight = 0.1;
    const body = new RigidBody({
      id: 'sleep_test',
      collider: new OBBCollider(new THREE.Vector3(0.1, halfHeight, 0.1)),
      position: new THREE.Vector3(0, 0.3, 0),
      mass: 1.0,
      restitution: 0.18,
    });
    sim.addBody(body);

    // Run for 200 sub-steps (~1.67 seconds)
    for (let i = 0; i < 200; i++) {
      sim.subStep(sim.subStepDt);
    }

    // Body should be sleeping with exactly 0 velocity
    expect(body.isSleeping).toBe(true);
    expect(body.velocity.x).toBe(0);
    expect(body.velocity.y).toBe(0);
    expect(body.velocity.z).toBe(0);
    expect(body.position.y).toBeCloseTo(halfHeight, 3);
  });

  it('long-duration simulation maintains zero jitter over 300 additional frames', () => {
    const sim = new RigidBodySimulator();
    const halfHeight = 0.08;
    const body = new RigidBody({
      id: 'long_run',
      collider: new OBBCollider(new THREE.Vector3(0.1, halfHeight, 0.1)),
      position: new THREE.Vector3(0.5, 0.25, -0.3),
      mass: 0.5,
      restitution: 0.15,
    });
    sim.addBody(body);

    // Let it settle
    for (let i = 0; i < 150; i++) {
      sim.subStep(sim.subStepDt);
    }
    const settledY = body.position.y;

    // Run 300 more frames (~2.5s)
    for (let i = 0; i < 300; i++) {
      sim.subStep(sim.subStepDt);
      expect(body.position.y).toBe(settledY); // Completely invariant
      expect(body.velocity.length()).toBe(0);
    }
  });
});

describe('R2 Adversarial Stress Probes: Stacking, Anti-Tunneling & Dynamic Stability', () => {
  it('probe 1: vertical stacking - OBB dropped onto resting OBB stacks cleanly without clipping', () => {
    const sim = new RigidBodySimulator();
    const halfH = 0.1;

    // Bottom box resting on bench (bottom at 0, center at 0.1)
    const bottomBox = new RigidBody({
      id: 'stack_bottom',
      collider: new OBBCollider(new THREE.Vector3(0.3, halfH, 0.3)),
      position: new THREE.Vector3(0, halfH, 0),
      mass: 2.0,
      restitution: 0.1,
    });
    // Top box dropped from Y = 0.65
    const topBox = new RigidBody({
      id: 'stack_top',
      collider: new OBBCollider(new THREE.Vector3(0.2, halfH, 0.2)),
      position: new THREE.Vector3(0, 0.65, 0),
      mass: 1.0,
      restitution: 0.1,
    });

    sim.addBody(bottomBox);
    sim.addBody(topBox);

    // Simulate for 150 sub-steps (~1.25s)
    for (let i = 0; i < 150; i++) {
      sim.subStep(sim.subStepDt);
      // Top box bottom face must not penetrate below top face of bottom box (Y = 0.2)
      expect(topBox.position.y - halfH).toBeGreaterThanOrEqual(bottomBox.position.y + halfH - 1e-3);
    }

    // Settled height of top box: bottom at 0.2, center at 0.3
    expect(topBox.position.y).toBeCloseTo(0.3, 2);
    expect(bottomBox.position.y).toBeCloseTo(0.1, 2);
  });

  it('probe 2: cylinder dropped onto flat top of OBB settles on top surface', () => {
    const sim = new RigidBodySimulator();
    const obbHalfH = 0.1;
    const cylHalfH = 0.15;

    const baseBox = new RigidBody({
      id: 'base_box',
      collider: new OBBCollider(new THREE.Vector3(0.4, obbHalfH, 0.4)),
      position: new THREE.Vector3(0, obbHalfH, 0),
      isStatic: true,
    });
    const bottle = new RigidBody({
      id: 'bottle_on_box',
      collider: new CylinderCollider(0.08, cylHalfH),
      position: new THREE.Vector3(0, 0.8, 0),
      mass: 0.3,
      restitution: 0.15,
    });

    sim.addBody(baseBox);
    sim.addBody(bottle);

    for (let i = 0; i < 150; i++) {
      sim.subStep(sim.subStepDt);
    }

    // Box top is at Y = 0.2. Bottle bottom is at Y = bottle.position.y - cylHalfH
    const bottleBottom = bottle.position.y - cylHalfH;
    expect(bottleBottom).toBeCloseTo(0.2, 2);
    expect(bottle.velocity.length()).toBe(0);
  });

  it('probe 3: high-speed downward impact (-10 m/s) does not tunnel through tabletop', () => {
    const sim = new RigidBodySimulator();
    const halfH = 0.1;

    const fastProjectile = new RigidBody({
      id: 'fast_fall',
      collider: new OBBCollider(new THREE.Vector3(0.1, halfH, 0.1)),
      position: new THREE.Vector3(0, 0.3, 0), // Close to bench
      velocity: new THREE.Vector3(0, -10.0, 0), // High downward velocity (-10 m/s)
      mass: 1.0,
      restitution: 0.2,
    });
    sim.addBody(fastProjectile);

    for (let i = 0; i < 100; i++) {
      sim.subStep(sim.subStepDt);
      // Even under -10 m/s impact, penetration must be resolved immediately
      const bottomY = fastProjectile.position.y - halfH;
      expect(bottomY).toBeGreaterThanOrEqual(-1e-4);
    }

    expect(fastProjectile.position.y).toBeCloseTo(halfH, 2);
  });

  it('probe 4: variable delta time step() correctly accumulates and executes 120-Hz sub-steps', () => {
    const sim = new RigidBodySimulator();
    sim.clearEnvironmentPlanes();

    const body = new RigidBody({
      id: 'accumulator_test',
      collider: new OBBCollider(new THREE.Vector3(0.1, 0.1, 0.1)),
      position: new THREE.Vector3(0, 5.0, 0),
      mass: 1.0,
    });
    sim.addBody(body);

    // Call step() with variable frame deltas (e.g. 16.6ms, 33.3ms) simulating 60fps / 30fps render loop
    sim.step(0.016667);
    sim.step(0.033333);
    sim.step(0.016667);

    // Total time ≈ 0.066667s => exactly 8 sub-steps of 1/120s
    expect(body.velocity.y).toBeLessThan(-0.6);
    expect(body.position.y).toBeLessThan(5.0);
  });
});

