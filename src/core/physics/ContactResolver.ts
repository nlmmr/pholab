import * as THREE from 'three';
import { CollisionContact } from './colliders/Collider';
import { RigidBody } from './RigidBody';

/**
 * Contact impulse and penetration resolution with inelastic bounce damping
 * and resting velocity cutoff (0.08 m/s).
 */
export class ContactResolver {
  public static readonly RESTING_VELOCITY_THRESHOLD = 0.08; // 0.08 m/s cutoff

  /**
   * Resolves contact between two rigid bodies.
   * normal points from bodyA to bodyB.
   */
  public resolveBodyContact(
    bodyA: RigidBody,
    bodyB: RigidBody,
    contact: CollisionContact,
  ): void {
    if (!contact.hasContact || contact.penetration <= 0) return;

    const invA = bodyA.invMass;
    const invB = bodyB.invMass;
    const totalInvMass = invA + invB;

    if (totalInvMass <= 1e-8) return; // Both static or held

    // 1. Positional Separation (Strict non-clipping)
    const normal = contact.normal.clone().normalize();
    const posCorrectionA = contact.penetration * (invA / totalInvMass);
    const posCorrectionB = contact.penetration * (invB / totalInvMass);

    if (invA > 0) {
      bodyA.position.addScaledVector(normal, -posCorrectionA);
    }
    if (invB > 0) {
      bodyB.position.addScaledVector(normal, posCorrectionB);
    }

    // 2. Velocity Impulse Resolution
    const relVel = bodyB.velocity.clone().sub(bodyA.velocity);
    const vn = relVel.dot(normal);

    // If bodies are separating, no normal impulse required
    if (vn >= 0) return;

    let e = Math.min(bodyA.restitution, bodyB.restitution);

    // Resting velocity cutoff: prevent micro-bouncing / infinite jitter
    if (Math.abs(vn) < ContactResolver.RESTING_VELOCITY_THRESHOLD) {
      e = 0.0;
      if (invA > 0) bodyA.isGrounded = true;
      if (invB > 0) bodyB.isGrounded = true;
    }

    // Compute impulse magnitude along contact normal
    const jn = -(1 + e) * vn / totalInvMass;

    if (invA > 0) {
      bodyA.velocity.addScaledVector(normal, -jn * invA);
    }
    if (invB > 0) {
      bodyB.velocity.addScaledVector(normal, jn * invB);
    }

    // 3. Tangential Friction
    const tangentVel = relVel.clone().addScaledVector(normal, -vn);
    const vtLen = tangentVel.length();
    if (vtLen > 1e-6) {
      const tangent = tangentVel.clone().normalize();
      const mu = Math.sqrt(bodyA.friction * bodyB.friction);
      let jt = mu * Math.abs(jn);

      // Clamp friction impulse to avoid reversing tangential velocity
      const maxFrictionImpulse = vtLen / totalInvMass;
      jt = Math.min(jt, maxFrictionImpulse);

      if (invA > 0) {
        bodyA.velocity.addScaledVector(tangent, jt * invA);
      }
      if (invB > 0) {
        bodyB.velocity.addScaledVector(tangent, -jt * invB);
      }
    }
  }

  /**
   * Resolves contact between a dynamic body and a static environment plane.
   * normal points from the plane into the free space.
   */
  public resolvePlaneContact(
    body: RigidBody,
    contact: CollisionContact,
  ): void {
    if (!contact.hasContact || contact.penetration <= 0 || body.invMass <= 0) return;

    const normal = contact.normal.clone().normalize();

    // 1. Positional Separation: eliminate penetration completely
    body.position.addScaledVector(normal, contact.penetration);

    // 2. Velocity Resolution
    const vn = body.velocity.dot(normal);
    if (vn >= 0) return; // Already moving away from plane

    let e = body.restitution;

    // Resting cutoff: if impact velocity is below 0.08 m/s, zero out normal velocity
    if (Math.abs(vn) < ContactResolver.RESTING_VELOCITY_THRESHOLD) {
      e = 0.0;
      // Eliminate normal velocity component
      body.velocity.addScaledVector(normal, -vn);
      body.isGrounded = true;
      return;
    }

    // Dynamic bounce
    const impulse = -(1 + e) * vn;
    body.velocity.addScaledVector(normal, impulse);

    // Tangential friction damping
    const vt = body.velocity.clone().addScaledVector(normal, -body.velocity.dot(normal));
    const frictionFactor = Math.min(1.0, body.friction * 0.6);
    body.velocity.addScaledVector(vt, -frictionFactor);
  }
}
