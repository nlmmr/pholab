import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DiffractionShaderMaterial } from './shaders/DiffractionShader';
import { OpticalTrainResult } from '../../physics/OpticalBenchSystem';

interface ProjectionScreenProps {
  trainResult: OpticalTrainResult;
  isLaserOn: boolean;
}

export const ProjectionScreen: React.FC<ProjectionScreenProps> = ({
  trainResult,
  isLaserOn
}) => {
  const shaderMatRef = useRef<THREE.ShaderMaterial>(null);

  const customShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(DiffractionShaderMaterial.uniforms),
      vertexShader: DiffractionShaderMaterial.vertexShader,
      fragmentShader: DiffractionShaderMaterial.fragmentShader
    });
  }, []);

  useFrame((_, delta) => {
    if (shaderMatRef.current) {
      const u = shaderMatRef.current.uniforms;
      u.uTime.value += delta;

      if (!isLaserOn) {
        u.uPatternType.value = 5; // dark
        u.uPowerScale.value = 0.0;
      } else {
        const typeMap = {
          direct_beam: 0,
          single_slit: 1,
          double_slit: 2,
          grating: 3,
          airy_disk: 4,
          dark: 5
        };
        u.uPatternType.value = typeMap[trainResult.patternType] ?? 0;
        u.uWavelengthNm.value = trainResult.patternParams.wavelengthNm;
        u.uDistanceL_mm.value = trainResult.patternParams.distanceL_mm;
        u.uParamA_um.value = trainResult.patternParams.slitWidthUm || trainResult.patternParams.diameterUm || 80.0;
        u.uParamD_um.value = trainResult.patternParams.slitSepUm || 250.0;
        u.uLinesPerMm.value = trainResult.patternParams.linesPerMm || 300.0;
        u.uPowerScale.value = Math.min(2.0, Math.max(0.2, trainResult.patternParams.effectivePowerMw / 3.0));
      }
    }
  });

  return (
    <group>
      {/* Aluminum Backing Plate */}
      <mesh castShadow receiveShadow position={[-0.003, 0, 0]}>
        <boxGeometry args={[0.005, 0.12, 0.12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* White Matte Screen with Realtime Diffraction GLSL Shader */}
      <mesh position={[0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.1, 0.1]} />
        <primitive object={customShader} ref={shaderMatRef} attach="material" />
      </mesh>

      {/* Screen Frame Bezel */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.008, 0.122, 0.122]} />
        <meshStandardMaterial color="#334155" wireframe={false} roughness={0.5} />
      </mesh>
    </group>
  );
};
