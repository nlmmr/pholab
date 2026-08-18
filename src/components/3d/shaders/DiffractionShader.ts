import * as THREE from 'three';

/**
 * Real-time Wave Optics & Diffraction Shader for the 3D Projection Screen
 */
export const DiffractionShaderMaterial = {
  uniforms: {
    uPatternType: { value: 0 }, // 0: direct, 1: single slit, 2: double slit, 3: grating, 4: airy disk, 5: dark
    uWavelengthNm: { value: 532.0 },
    uDistanceL_mm: { value: 500.0 },
    uParamA_um: { value: 80.0 },
    uParamD_um: { value: 250.0 },
    uLinesPerMm: { value: 300.0 },
    uPowerScale: { value: 1.0 },
    uTime: { value: 0.0 }
  },

  vertexShader: `
    varying vec2 vUv;
    varying vec3 vPosition;

    void main() {
      vUv = uv;
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform int uPatternType;
    uniform float uWavelengthNm;
    uniform float uDistanceL_mm;
    uniform float uParamA_um;
    uniform float uParamD_um;
    uniform float uLinesPerMm;
    uniform float uPowerScale;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vPosition;

    // Convert wavelength (nm) to approximate laser RGB
    vec3 wavelengthToRGB(float lambda) {
      if (lambda < 450.0) return vec3(0.5, 0.0, 1.0); // Violet
      if (lambda < 495.0) return vec3(0.0, 0.4, 1.0); // Blue
      if (lambda < 570.0) return vec3(0.1, 1.0, 0.2); // Green (532 nm)
      if (lambda < 590.0) return vec3(1.0, 0.9, 0.0); // Yellow
      if (lambda < 620.0) return vec3(1.0, 0.5, 0.0); // Orange
      return vec3(1.0, 0.05, 0.05);                   // Red (632.8 nm)
    }

    float sinc(float x) {
      if (abs(x) < 0.001) return 1.0 - (x * x) / 6.0;
      return sin(x) / x;
    }

    void main() {
      // Screen coordinates mapped to physical millimeters (-50mm to +50mm)
      vec2 posMm = (vUv - 0.5) * 100.0;
      float xMm = posMm.x;
      float yMm = posMm.y;
      float rMm = length(posMm);

      float intensity = 0.0;
      float lambdaMm = uWavelengthNm * 1e-6;
      float L = max(10.0, uDistanceL_mm);

      // Subtle atmospheric noise speckle
      float speckle = sin(xMm * 80.0 + uTime * 2.0) * cos(yMm * 80.0) * 0.04;

      if (uPatternType == 0) {
        // Direct Gaussian Laser Spot
        float w0 = 0.8; // mm
        intensity = exp(-2.0 * (rMm * rMm) / (w0 * w0));
      } 
      else if (uPatternType == 1) {
        // Single Slit Fraunhofer Diffraction (diffracts along X)
        float aMm = uParamA_um * 1e-3;
        float sinTheta = xMm / sqrt(xMm * xMm + L * L);
        float beta = (3.14159265 * aMm * sinTheta) / lambdaMm;
        float diffX = sinc(beta);
        float verticalEnvelope = exp(-2.0 * (yMm * yMm) / (1.5 * 1.5));
        intensity = (diffX * diffX) * verticalEnvelope;
      }
      else if (uPatternType == 2) {
        // Double Slit Interference (Young's Experiment)
        float aMm = uParamA_um * 1e-3;
        float dMm = uParamD_um * 1e-3;
        float sinTheta = xMm / sqrt(xMm * xMm + L * L);
        float beta = (3.14159265 * aMm * sinTheta) / lambdaMm;
        float alpha = (3.14159265 * dMm * sinTheta) / lambdaMm;

        float diffEnvelope = sinc(beta);
        float interf = cos(alpha);
        float verticalEnvelope = exp(-2.0 * (yMm * yMm) / (1.5 * 1.5));
        intensity = (diffEnvelope * diffEnvelope) * (interf * interf) * verticalEnvelope;
      }
      else if (uPatternType == 3) {
        // Diffraction Grating (Sharp discrete orders)
        float dMm = 1.0 / max(1.0, uLinesPerMm);
        float verticalEnvelope = exp(-2.0 * (yMm * yMm) / (1.0 * 1.0));
        intensity = 0.005; // Faint background haze

        // Sum orders m = -4 ... +4
        for (int m = -4; m <= 4; m++) {
          float mf = float(m);
          float sinThetaM = (mf * lambdaMm) / dMm;
          if (abs(sinThetaM) < 0.95) {
            float tanThetaM = sinThetaM / sqrt(1.0 - sinThetaM * sinThetaM);
            float xPeakMm = L * tanThetaM;
            float dx = xMm - xPeakMm;
            float spotIntensity = exp(-(dx * dx) / (2.0 * 0.15 * 0.15));
            float orderDecay = (m == 0) ? 1.0 : (0.6 / (abs(mf) * 0.7 + 0.3));
            intensity += spotIntensity * orderDecay * verticalEnvelope;
          }
        }
      }
      else if (uPatternType == 4) {
        // Circular Aperture (Airy Disk)
        float diaMm = uParamA_um * 1e-3;
        float sinTheta = rMm / sqrt(rMm * rMm + L * L);
        float v = (3.14159265 * diaMm * sinTheta) / lambdaMm;
        if (v < 0.01) {
          intensity = 1.0;
        } else {
          // J1 approximation: J1(v) ~ sin(v) / sqrt(pi*v) for outer rings
          float j1 = sin(v - 0.785) / sqrt(3.14159265 * v);
          float factor = (2.0 * j1) / v;
          intensity = factor * factor;
        }
      }

      intensity = clamp(intensity * uPowerScale + speckle * intensity, 0.0, 1.0);

      // Base screen color (light cream matte)
      vec3 screenBase = vec3(0.96, 0.97, 0.98);
      vec3 laserColor = wavelengthToRGB(uWavelengthNm);

      // Additive laser glow on screen surface
      vec3 finalColor = mix(screenBase, laserColor, intensity * 0.85);
      if (intensity > 0.75) {
        // Hotspot saturation towards white core
        finalColor = mix(finalColor, vec3(1.0, 1.0, 1.0), (intensity - 0.75) * 4.0);
      }

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `
};
