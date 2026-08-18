import React, { useMemo } from 'react';
import * as THREE from 'three';

interface FlexibleCableProps {
  /** World position of the photodetector BNC output port */
  detectorPort: THREE.Vector3;
  /** World position of the benchtop meter BNC input socket */
  meterPort: THREE.Vector3;
  /** Whether the cable is physically connected at both ends */
  isConnected: boolean;
}

export const FlexibleCable: React.FC<FlexibleCableProps> = ({
  detectorPort,
  meterPort,
  isConnected,
}) => {
  const { points, tubeGeometry } = useMemo(() => {
    if (!isConnected) return { points: [], tubeGeometry: null };

    // Catenary / drape control points
    const midX = (detectorPort.x + meterPort.x) / 2;
    const midZ = (detectorPort.z + meterPort.z) / 2;
    const droopY = Math.min(detectorPort.y, meterPort.y) - 0.09; // cable droop below table edge

    const pts = [
      detectorPort.clone(),
      // Exit port tangent – goes downward from detector
      new THREE.Vector3(detectorPort.x, detectorPort.y - 0.03, detectorPort.z + 0.02),
      // Drape sag point
      new THREE.Vector3(midX, droopY, midZ + 0.05),
      // Rise to meter socket
      new THREE.Vector3(meterPort.x, meterPort.y - 0.03, meterPort.z - 0.02),
      meterPort.clone(),
    ];

    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const segments = 40;
    const tubeRadius = 0.003;
    const geom = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false);

    return { points: pts, tubeGeometry: geom };
  }, [detectorPort, meterPort, isConnected]);

  if (!isConnected || !tubeGeometry) return null;

  return (
    <group>
      {/* Coaxial Cable Body – matte black rubber jacket */}
      <mesh geometry={tubeGeometry} castShadow>
        <meshStandardMaterial color="#0a0a0a" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* BNC Connector at Detector End – gold metal barrel */}
      <group position={detectorPort.toArray() as [number, number, number]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.014, 16]} />
          <meshStandardMaterial color="#d97706" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Locking ring knurling */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
          <cylinderGeometry args={[0.0075, 0.0075, 0.005, 16]} />
          <meshStandardMaterial color="#b45309" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>

      {/* BNC Connector at Meter End */}
      <group position={meterPort.toArray() as [number, number, number]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.014, 16]} />
          <meshStandardMaterial color="#d97706" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
          <cylinderGeometry args={[0.0075, 0.0075, 0.005, 16]} />
          <meshStandardMaterial color="#b45309" metalness={0.7} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
};
