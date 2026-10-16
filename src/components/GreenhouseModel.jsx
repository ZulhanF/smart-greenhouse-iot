import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

export function GreenhouseModel({ ventAngle = 0, pumpActive = false, soilMoisture = 65 }) {
  const leftRoofRef = useRef();
  const rightRoofRef = useRef();
  const waterParticlesRef = useRef();

  // Smooth roof opening animation based on servo angle (0 - 90 deg)
  useFrame(() => {
    const targetAngle = (ventAngle * Math.PI) / 180;
    if (leftRoofRef.current) {
      leftRoofRef.current.rotation.z = THREE.MathUtils.lerp(
        leftRoofRef.current.rotation.z,
        -targetAngle * 0.45,
        0.08
      );
    }
    if (rightRoofRef.current) {
      rightRoofRef.current.rotation.z = THREE.MathUtils.lerp(
        rightRoofRef.current.rotation.z,
        targetAngle * 0.45,
        0.08
      );
    }

    // Water particles vibration/pulsing when pump is on
    if (waterParticlesRef.current && pumpActive) {
      waterParticlesRef.current.position.y = 0.4 + Math.sin(Date.now() * 0.015) * 0.04;
    }
  });

  // Moisture alters soil color: dry = light warm terracotta/sand, wet = rich deep earthy loam
  const soilColor = soilMoisture < 40 ? '#8c7059' : soilMoisture > 70 ? '#261b14' : '#4a382c';

  return (
    <group position={[0, -0.6, 0]}>
      {/* Wooden planter base (Japandi Oak / Teak) */}
      <RoundedBox args={[3.2, 0.5, 2.2]} radius={0.06} smoothness={4} position={[0, 0.25, 0]}>
        <meshStandardMaterial color="#c4a57b" roughness={0.7} metalness={0.1} />
      </RoundedBox>

      {/* Soil bed */}
      <mesh position={[0, 0.48, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.95, 1.95]} />
        <meshStandardMaterial color={soilColor} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Plants / Saplings inside */}
      {[-0.8, 0, 0.8].map((x, i) => (
        <group key={i} position={[x, 0.5, 0]}>
          {/* Stem */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.4]} />
            <meshStandardMaterial color="#3b5e3d" roughness={0.6} />
          </mesh>
          {/* Leaves */}
          <mesh position={[0.07, 0.35, 0]} rotation={[0.2, 0, 0.4]}>
            <sphereGeometry args={[0.12, 12, 8]} scale={[1.4, 0.3, 0.8]} />
            <meshStandardMaterial color="#557c55" roughness={0.4} />
          </mesh>
          <mesh position={[-0.07, 0.3, 0]} rotation={[-0.2, 0, -0.4]}>
            <sphereGeometry args={[0.1, 12, 8]} scale={[1.4, 0.3, 0.8]} />
            <meshStandardMaterial color="#6a946a" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.42, 0.06]} rotation={[0.4, 0.5, 0]}>
            <sphereGeometry args={[0.13, 12, 8]} scale={[1.2, 0.3, 0.9]} />
            <meshStandardMaterial color="#446a44" roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Water Droplets when pump is active */}
      {pumpActive && (
        <group ref={waterParticlesRef} position={[0, 0.5, 0]}>
          {[-0.7, -0.1, 0.2, 0.7].map((x, idx) => (
            <mesh key={idx} position={[x, 0.15, (idx % 2 === 0 ? 0.3 : -0.3)]}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshStandardMaterial color="#88d8f7" transparent opacity={0.85} roughness={0.1} />
            </mesh>
          ))}
        </group>
      )}

      {/* Minimal Matte Black Steel Framework */}
      {/* Corner Pillars */}
      {[
        [-1.4, 1.25, -0.95],
        [1.4, 1.25, -0.95],
        [-1.4, 1.25, 0.95],
        [1.4, 1.25, 0.95],
      ].map((pos, idx) => (
        <mesh key={idx} position={pos}>
          <boxGeometry args={[0.06, 1.5, 0.06]} />
          <meshStandardMaterial color="#222524" roughness={0.4} metalness={0.8} />
        </mesh>
      ))}

      {/* Horizontal Upper Beams */}
      <mesh position={[0, 2.0, -0.95]}>
        <boxGeometry args={[2.86, 0.05, 0.05]} />
        <meshStandardMaterial color="#222524" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[0, 2.0, 0.95]}>
        <boxGeometry args={[2.86, 0.05, 0.05]} />
        <meshStandardMaterial color="#222524" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[-1.4, 2.0, 0]}>
        <boxGeometry args={[0.05, 0.05, 1.95]} />
        <meshStandardMaterial color="#222524" roughness={0.4} metalness={0.8} />
      </mesh>
      <mesh position={[1.4, 2.0, 0]}>
        <boxGeometry args={[0.05, 0.05, 1.95]} />
        <meshStandardMaterial color="#222524" roughness={0.4} metalness={0.8} />
      </mesh>

      {/* Glass Walls (Frosted, Nord-Japandi luxury) */}
      {/* Back & Front Glass */}
      <mesh position={[0, 1.25, -0.95]}>
        <planeGeometry args={[2.76, 1.45]} />
        <meshPhysicalMaterial
          color="#d2e8dd"
          transparent
          opacity={0.35}
          roughness={0.2}
          transmission={0.85}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 1.25, 0.95]}>
        <planeGeometry args={[2.76, 1.45]} />
        <meshPhysicalMaterial
          color="#d2e8dd"
          transparent
          opacity={0.35}
          roughness={0.2}
          transmission={0.85}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Left & Right Glass */}
      <mesh position={[-1.4, 1.25, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.86, 1.45]} />
        <meshPhysicalMaterial
          color="#d2e8dd"
          transparent
          opacity={0.35}
          roughness={0.2}
          transmission={0.85}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[1.4, 1.25, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.86, 1.45]} />
        <meshPhysicalMaterial
          color="#d2e8dd"
          transparent
          opacity={0.35}
          roughness={0.2}
          transmission={0.85}
          thickness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Servo Controlled Roof Hatches (Pitch Roof) */}
      {/* Central Ridge Beam */}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[2.86, 0.06, 0.06]} />
        <meshStandardMaterial color="#1a1c1b" metalness={0.9} roughness={0.3} />
      </mesh>

      {/* Left Hatch Pivot Group */}
      <group position={[0, 2.5, -0.95]} ref={leftRoofRef}>
        <mesh position={[0, -0.25, 0.48]} rotation={[Math.PI / 6, 0, 0]}>
          <boxGeometry args={[2.74, 0.04, 1.1]} />
          <meshPhysicalMaterial
            color="#d2e8dd"
            transparent
            opacity={0.4}
            roughness={0.15}
            transmission={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Right Hatch Pivot Group */}
      <group position={[0, 2.5, 0.95]} ref={rightRoofRef}>
        <mesh position={[0, -0.25, -0.48]} rotation={[-Math.PI / 6, 0, 0]}>
          <boxGeometry args={[2.74, 0.04, 1.1]} />
          <meshPhysicalMaterial
            color="#d2e8dd"
            transparent
            opacity={0.4}
            roughness={0.15}
            transmission={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Decorative Brass Actuator Joints (Servo mount aesthetic) */}
      <mesh position={[1.35, 2.48, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.2]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[-1.35, 2.48, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.2]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.3} />
      </mesh>

      {/* Water Irrigation Pipe */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 2.6]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#333835" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  );
}
