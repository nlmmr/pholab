import React from 'react';
import { OpticalElementType, SlitParameters } from '../../physics/types';
import { TextSprite } from './TextSprite';

interface DiffractionAperturesProps {
  type: OpticalElementType;
  params?: SlitParameters;
  isLaserIlluminated?: boolean;
}

export const DiffractionApertures: React.FC<DiffractionAperturesProps> = ({
  type,
  params,
  isLaserIlluminated = false
}) => {
  const label =
    type === 'single_slit'
      ? `FENDA SIMPLES\na = ${params?.slitWidthUm || 80} µm`
      : type === 'double_slit'
      ? `FENDA DUPLA\na=${params?.slitWidthUm || 50}µm d=${params?.slitSeparationUm || 250}µm`
      : type === 'diffraction_grating'
      ? `REDE DE DIFRAÇÃO\n${params?.linesPerMm || 300} linhas/mm`
      : `ABERTURA CIRCULAR\nØ = ${params?.circularDiameterUm || 150} µm`;

  return (
    <group>
      {/* Outer Anodized Aluminum Mount Ring */}
      <mesh castShadow rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.026, 0.005, 16, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Internal Slide Plate / Glass Window */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.002, 32]} />
        <meshStandardMaterial
          color={type === 'diffraction_grating' ? '#38bdf8' : '#0f172a'}
          metalness={type === 'diffraction_grating' ? 0.3 : 0.8}
          roughness={0.2}
          transparent={type === 'diffraction_grating'}
          opacity={type === 'diffraction_grating' ? 0.6 : 1.0}
        />
      </mesh>

      {/* Physical Micro-Slit Feature */}
      <mesh position={[0.0015, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.002, 0.012]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Laser Impact Scatter Spot */}
      {isLaserIlluminated && (
        <mesh position={[0.002, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.0025, 16]} />
          <meshBasicMaterial color="#34d399" transparent opacity={0.9} />
        </mesh>
      )}

      {/* Engraved Specification Label on Mount Ring */}
      <TextSprite
        text={label}
        position={[0, -0.045, 0]}
        color="#fbbf24"
        fontSize={14}
        scale={0.012}
      />
    </group>
  );
};
