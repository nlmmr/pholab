export interface RollingResult {
  travelTimeS: number;
  terminalVelocityMps: number;
  stoppingDistanceCm: number;
}

export class RailRollingSolver {
  private g = 9.81; // m/s^2
  private muSand = 0.82; // Effective Coulomb friction coefficient in granular sand track

  /**
   * Part B: Pure rolling down 5 deg aluminum rail followed by sand track deceleration
   * a_rail = (5/7) * g * sin(theta)
   * v_bottom = sqrt(2 * a_rail * L_rail)
   * a_sand = -mu * g
   * L_stop = v_bottom^2 / (2 * mu * g)
   */
  public computeRolling(releaseDistanceCm: number, railAngleDeg = 5.0, isSandLeveled = true): RollingResult {
    const lM = Math.max(0.05, releaseDistanceCm / 100);
    const thetaRad = (railAngleDeg * Math.PI) / 180;

    // Rolling without slipping acceleration
    const aRoll = (5 / 7) * this.g * Math.sin(thetaRad); // ~0.611 m/s^2
    const travelTimeS = Math.sqrt((2 * lM) / aRoll);
    const terminalVelocityMps = aRoll * travelTimeS;

    // Braking in sand
    const effMu = isSandLeveled ? this.muSand : this.muSand * 1.15;
    const aBrake = effMu * this.g;
    const stoppingDistanceM = (terminalVelocityMps * terminalVelocityMps) / (2 * aBrake);

    return {
      travelTimeS: Number(travelTimeS.toFixed(3)),
      terminalVelocityMps: Number(terminalVelocityMps.toFixed(3)),
      stoppingDistanceCm: Number((stoppingDistanceM * 100).toFixed(1)),
    };
  }
}
