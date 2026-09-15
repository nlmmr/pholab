import * as THREE from 'three';
import { CollisionContact } from './colliders/Collider';
import { OBBCollider } from './OBBCollider';
import { CylinderCollider } from './CylinderCollider';
import { PlaneCollider } from './colliders/PlaneCollider';
import { RigidBody } from './RigidBody';
import { ContactResolver } from './ContactResolver';

/**
 * RigidBodySimulator: A deterministic, zero-dependency 120-Hz Symplectic Euler
 * physics engine with uniform gravity (g = 9.81 m/s^2), solid colliders,
 * and non-clipping contact resolution.
 */
export class RigidBodySimulator {
  public gravity: THREE.Vector3 = new THREE.Vector3(0, -9.81, 0);
  public readonly subStepDt: number = 1 / 120; // 120 Hz (~0.008333s)
  public contactResolver: ContactResolver = new ContactResolver();
  public environmentPlanes: PlaneCollider[] = [];

  private bodies: Map<string, RigidBody> = new Map();
  private accumulator: number = 0;

  constructor() {
    // Add default laboratory benchtop and floor
    this.addEnvironmentPlane(PlaneCollider.createBench());
    this.addEnvironmentPlane(PlaneCollider.createFloor());
  }

  public addBody(body: RigidBody): void {
    this.bodies.set(body.id, body);
  }

  public removeBody(id: string): boolean {
    return this.bodies.delete(id);
  }

  public getBody(id: string): RigidBody | undefined {
    return this.bodies.get(id);
  }

  public getBodies(): RigidBody[] {
    return Array.from(this.bodies.values());
  }

  public setBodyPosition(id: string, pos: THREE.Vector3): void {
    const body = this.bodies.get(id);
    if (body) {
      body.position.copy(pos);
      body.wake();
    }
  }

  public setBodyHeld(id: string, isHeld: boolean): void {
    const body = this.bodies.get(id);
    if (body) {
      body.isHeld = isHeld;
      if (isHeld) {
        body.velocity.set(0, 0, 0);
        body.wake();
      }
    }
  }

  public addEnvironmentPlane(plane: PlaneCollider): void {
    this.environmentPlanes.push(plane);
  }

  public clearEnvironmentPlanes(): void {
    this.environmentPlanes = [];
  }

  public reset(): void {
    this.bodies.clear();
    this.accumulator = 0;
    this.clearEnvironmentPlanes();
    this.addEnvironmentPlane(PlaneCollider.createBench());
    this.addEnvironmentPlane(PlaneCollider.createFloor());
  }

  /**
   * Advance simulation by dt seconds using fixed 120-Hz sub-stepping.
   */
  public step(dt: number): void {
    // Clamp maximum delta to avoid spiral of death on tab freeze
    const clampedDt = Math.min(dt, 0.1);
    this.accumulator += clampedDt;

    while (this.accumulator >= this.subStepDt) {
      this.subStep(this.subStepDt);
      this.accumulator -= this.subStepDt;
    }
  }

  /**
   * Single sub-step at fixed delta time (120 Hz = 0.008333s).
   */
  public subStep(dt: number): void {
    const bodyList = this.getBodies();

    // 1. Integration (Symplectic Euler: velocity first, then position)
    for (const body of bodyList) {
      if (body.isStatic || body.isHeld || body.isSleeping) continue;

      // v_{n+1} = v_n + g * dt
      body.velocity.addScaledVector(this.gravity, dt);
      // x_{n+1} = x_n + v_{n+1} * dt
      body.position.addScaledVector(body.velocity, dt);
    }

    // 2. Multi-iteration contact resolution (2 iterations for rock-solid stability)
    const solverIterations = 2;
    for (let iter = 0; iter < solverIterations; iter++) {
      // 2a. Environment Plane Collisions (Benchtop, Floor, Box walls)
      for (const body of bodyList) {
        if (body.isHeld || body.isStatic) continue;

        for (const plane of this.environmentPlanes) {
          let contact: CollisionContact | null = null;
          if (body.collider.type === 'obb') {
            contact = plane.testOBB(body.position, body.quaternion, body.collider as OBBCollider);
          } else if (body.collider.type === 'cylinder') {
            contact = plane.testCylinder(body.position, body.quaternion, body.collider as CylinderCollider);
          }

          if (contact && contact.hasContact && contact.penetration > 0) {
            this.contactResolver.resolvePlaneContact(body, contact);
          }
        }
      }

      // 2b. Pairwise Inter-Object Collisions
      for (let i = 0; i < bodyList.length; i++) {
        for (let j = i + 1; j < bodyList.length; j++) {
          const bodyA = bodyList[i];
          const bodyB = bodyList[j];

          if ((bodyA.isStatic || bodyA.isHeld) && (bodyB.isStatic || bodyB.isHeld)) {
            continue;
          }
          if (bodyA.isSleeping && bodyB.isSleeping) {
            continue;
          }

          // Broadphase bounding sphere test
          const rA = bodyA.collider.getBoundingRadius();
          const rB = bodyB.collider.getBoundingRadius();
          if (isFinite(rA) && isFinite(rB)) {
            const distSq = bodyA.position.distanceToSquared(bodyB.position);
            const maxDist = rA + rB;
            if (distSq > maxDist * maxDist) {
              continue;
            }
          }

          // Narrowphase contact evaluation
          const contact = this.evaluatePairContact(bodyA, bodyB);
          if (contact && contact.hasContact && contact.penetration > 0) {
            this.contactResolver.resolveBodyContact(bodyA, bodyB, contact);
            // Wake sleeping bodies upon collision impact
            if (bodyA.isSleeping) bodyA.wake();
            if (bodyB.isSleeping) bodyB.wake();
          }
        }
      }
    }

    // 3. Sleeping & Grounded Evaluation
    for (const body of bodyList) {
      if (body.isStatic || body.isHeld) continue;

      const speed = body.velocity.length();
      if (body.isGrounded && speed < ContactResolver.RESTING_VELOCITY_THRESHOLD) {
        body.velocity.set(0, 0, 0);
        body.sleepCounter++;
        // Sleep after ~6 resting frames (~50 ms)
        if (body.sleepCounter >= 6) {
          body.sleep();
        }
      } else {
        body.sleepCounter = 0;
        // If speed is notable, clear grounded unless supported next frame
        if (speed >= ContactResolver.RESTING_VELOCITY_THRESHOLD * 1.5) {
          body.isGrounded = false;
        }
      }
    }
  }

  /**
   * Computes contact between two colliders of arbitrary supported types.
   */
  private evaluatePairContact(bodyA: RigidBody, bodyB: RigidBody): CollisionContact | null {
    const colA = bodyA.collider;
    const colB = bodyB.collider;

    if (colA.type === 'obb' && colB.type === 'obb') {
      return (colA as OBBCollider).testOBB(
        bodyA.position,
        bodyA.quaternion,
        colB as OBBCollider,
        bodyB.position,
        bodyB.quaternion,
      );
    }

    if (colA.type === 'cylinder' && colB.type === 'cylinder') {
      return (colA as CylinderCollider).testCylinder(
        bodyA.position,
        bodyA.quaternion,
        colB as CylinderCollider,
        bodyB.position,
        bodyB.quaternion,
      );
    }

    if (colA.type === 'cylinder' && colB.type === 'obb') {
      return (colA as CylinderCollider).testOBB(
        bodyA.position,
        bodyA.quaternion,
        colB as OBBCollider,
        bodyB.position,
        bodyB.quaternion,
      );
    }

    if (colA.type === 'obb' && colB.type === 'cylinder') {
      // Test cylinder vs OBB and invert normal to point from A (OBB) to B (Cylinder)
      const contact = (colB as CylinderCollider).testOBB(
        bodyB.position,
        bodyB.quaternion,
        colA as OBBCollider,
        bodyA.position,
        bodyA.quaternion,
      );
      if (contact && contact.hasContact) {
        return {
          hasContact: true,
          penetration: contact.penetration,
          normal: contact.normal.clone().negate(),
          point: contact.point,
        };
      }
      return contact;
    }

    return null;
  }
}
