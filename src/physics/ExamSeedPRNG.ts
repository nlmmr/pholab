/**
 * Mulberry32 Deterministic PRNG
 * Produces reproducible pseudo-random numbers based on an alphanumeric exam seed.
 */

export class ExamSeedPRNG {
  private state: number;

  constructor(seedStr: string) {
    this.state = this.hashString(seedStr);
  }

  private hashString(str: string): number {
    let hash = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    return hash >>> 0;
  }

  /**
   * Returns a float in [0, 1)
   */
  public next(): number {
    let z = (this.state += 0x6d2b79f5);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a random float uniformly distributed in [min, max]
   */
  public range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /**
   * Box-Muller transform for standard Gaussian distributed random numbers N(mean, sigma^2)
   */
  public gaussian(mean = 0, sigma = 1): number {
    let u1 = this.next();
    let u2 = this.next();
    while (u1 <= 1e-15) u1 = this.next(); // Avoid log(0)
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * sigma;
  }
}

/**
 * Generate a random 6-character alphanumeric exam seed (e.g. "IPHO-7X9")
 */
export function generateRandomSeed(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let seed = 'IPHO-';
  for (let i = 0; i < 4; i++) {
    seed += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return seed;
}
