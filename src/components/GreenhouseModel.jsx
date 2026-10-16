import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function GreenhouseModel({ ventAngle = 0, pumpActive = false, soilMoisture = 65 }) {
  const roofHatchRef = useRef();
  const waterFlowRef = useRef();

  // Optimized lightweight materials shared across meshes
  const materials = useMemo(() => {
    return {
      woodBase: new THREE.MeshStandardMaterial({
        color: '#c29d6b',
        roughness: 0.65,
        metalness: 0.05,
      }),
      darkFrame: new THREE.MeshStandardMaterial({
        color: '#1a1d1b',
        roughness: 0.4,
        metalness: 0.6,
      }),
      frostedGlass: new THREE.MeshStandardMaterial({
        color: '#d4e8de',
        transparent: true,
        opacity: 0.38,
        roughness: 0.25,
        metalness: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      brassServo: new THREE.MeshStandardMaterial({
        color: '#d4af37',
        roughness: 0.35,
        metalness: 0.85,
      }),
      stemMat: new THREE.MeshStandardMaterial({
        color: '#345233',
        roughness: 0.7,
      }),
      leafMat: new THREE.MeshStandardMaterial({
        color: '#527c52',
        roughness: 0.5,
        side: THREE.DoubleSide,
      }),
      irrigationPipe: new THREE.MeshStandardMaterial({
        color: '#2d3330',
        roughness: 0.3,
        metalness: 0.8,
      }),
      waterDrop: new THREE.MeshBasicMaterial({
        color: '#7be3ff',
        transparent: true,
        opacity: 0.8,
      }),
    };
  }, []);

  // Frame animation loop
  useFrame((state, delta) => {
    // Precise hinge rotation for the ventilation hatch
    // Convert 0°-90° to negative radian tilt
    const targetRad = -(ventAngle * Math.PI) / 180 * 0.75;
    if (roofHatchRef.current) {
      roofHatchRef.current.rotation.x = THREE.MathUtils.damp(
        roofHatchRef.current.rotation.x,
        targetRad,
        7,
        delta
      );
    }

    // Dynamic water droplets pulse when irrigation is running
    if (waterFlowRef.current && pumpActive) {
      waterFlowRef.current.position.y = 0.52 + Math.sin(state.clock.elapsedTime * 8) * 0.03;
    }
  });

  // Dynamic soil color
  const soilColor = soilMoisture < 40 ? '#7a604c' : soilMoisture > 70 ? '#211710' : '#3d2e23';

  // Greenhouse dimensions
  const W = 3.0; // width (X)
  const D = 2.0; // depth (Z)
  const wallH = 1.3; // wall height
  const baseH = 0.4; // planter base height
  const ridgeH = 2.3; // roof peak

  return (
    <group position={[0, -0.6, 0]}>
      {/* 1. Oak Planter Bed (Base) */}
      <mesh position={[0, baseH / 2, 0]} material={materials.woodBase}>
        <boxGeometry args={[W + 0.2, baseH, D + 0.2]} />
      </mesh>

      {/* Planter Rim Accent */}
      <mesh position={[0, baseH + 0.02, 0]} material={materials.darkFrame}>
        <boxGeometry args={[W + 0.24, 0.04, D + 0.24]} />
      </mesh>

      {/* 2. Soil Bed */}
      <mesh position={[0, baseH + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W - 0.1, D - 0.1]} />
        <meshStandardMaterial color={soilColor} roughness={0.9} />
      </mesh>

      {/* 3. Flora & Seedlings */}
      {[-0.8, 0, 0.8].map((xOffset, i) => (
        <group key={i} position={[xOffset, baseH + 0.04, 0]}>
          {/* Main Stem */}
          <mesh position={[0, 0.22, 0]} material={materials.stemMat}>
            <cylinderGeometry args={[0.02, 0.025, 0.44, 6]} />
          </mesh>
          {/* Foliage billow */}
          <mesh position={[0.08, 0.36, 0.05]} rotation={[0.3, 0.4, 0.2]} material={materials.leafMat}>
            <coneGeometry args={[0.18, 0.35, 5]} />
          </mesh>
          <mesh position={[-0.08, 0.32, -0.05]} rotation={[-0.3, -0.4, -0.2]} material={materials.leafMat}>
            <coneGeometry args={[0.16, 0.3, 5]} />
          </mesh>
        </group>
      ))}

      {/* 4. Irrigation Pipe & Droplets */}
      <mesh position={[0, baseH + 0.22, 0]} rotation={[0, 0, Math.PI / 2]} material={materials.irrigationPipe}>
        <cylinderGeometry args={[0.018, 0.018, W - 0.3, 8]} />
      </mesh>
      {pumpActive && (
        <group ref={waterFlowRef} position={[0, baseH + 0.15, 0]}>
          {[-0.7, -0.2, 0.3, 0.8].map((px, idx) => (
            <mesh key={idx} position={[px, 0, (idx % 2 === 0 ? 0.25 : -0.25)]} material={materials.waterDrop}>
              <sphereGeometry args={[0.03, 6, 6]} />
            </mesh>
          ))}
        </group>
      )}

      {/* 5. Minimalist Structural Frame (Matte Black Aluminum) */}
      {/* 4 Corner Posts */}
      {[
        [-W / 2, baseH + wallH / 2, -D / 2],
        [W / 2, baseH + wallH / 2, -D / 2],
        [-W / 2, baseH + wallH / 2, D / 2],
        [W / 2, baseH + wallH / 2, D / 2],
      ].map((pos, idx) => (
        <mesh key={idx} position={pos} material={materials.darkFrame}>
          <boxGeometry args={[0.05, wallH, 0.05]} />
        </mesh>
      ))}

      {/* Perimeter Wall Top Ring */}
      <mesh position={[0, baseH + wallH, -D / 2]} material={materials.darkFrame}>
        <boxGeometry args={[W + 0.05, 0.05, 0.05]} />
      </mesh>
      <mesh position={[0, baseH + wallH, D / 2]} material={materials.darkFrame}>
        <boxGeometry args={[W + 0.05, 0.05, 0.05]} />
      </mesh>
      <mesh position={[-W / 2, baseH + wallH, 0]} material={materials.darkFrame}>
        <boxGeometry args={[0.05, 0.05, D + 0.05]} />
      </mesh>
      <mesh position={[W / 2, baseH + wallH, 0]} material={materials.darkFrame}>
        <boxGeometry args={[0.05, 0.05, D + 0.05]} />
      </mesh>

      {/* Gable End Triangle Peaks (Left & Right) */}
      {[-W / 2, W / 2].map((gx, idx) => (
        <group key={idx} position={[gx, baseH + wallH, 0]}>
          {/* Gable peak post */}
          <mesh position={[0, (ridgeH - (baseH + wallH)) / 2, 0]} material={materials.darkFrame}>
            <boxGeometry args={[0.04, ridgeH - (baseH + wallH), 0.04]} />
          </mesh>
        </group>
      ))}

      {/* Ridge Beam at top */}
      <mesh position={[0, ridgeH, 0]} material={materials.darkFrame}>
        <boxGeometry args={[W + 0.05, 0.05, 0.05]} />
      </mesh>

      {/* 6. Vertical Wall Glass Panels */}
      {/* North / South Long Panes */}
      <mesh position={[0, baseH + wallH / 2, -D / 2]} material={materials.frostedGlass}>
        <planeGeometry args={[W - 0.05, wallH - 0.05]} />
      </mesh>
      <mesh position={[0, baseH + wallH / 2, D / 2]} material={materials.frostedGlass}>
        <planeGeometry args={[W - 0.05, wallH - 0.05]} />
      </mesh>
      {/* East / West Short Panes */}
      <mesh position={[-W / 2, baseH + wallH / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={materials.frostedGlass}>
        <planeGeometry args={[D - 0.05, wallH - 0.05]} />
      </mesh>
      <mesh position={[W / 2, baseH + wallH / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={materials.frostedGlass}>
        <planeGeometry args={[D - 0.05, wallH - 0.05]} />
      </mesh>

      {/* 7. Pitched Roof Glazing */}
      {/* Fixed Pitch Roof (South side: +Z) */}
      <group position={[0, ridgeH, 0]}>
        <mesh 
          position={[0, -0.3, D / 4]} 
          rotation={[-Math.atan2(ridgeH - (baseH + wallH), D / 2), 0, 0]} 
          material={materials.frostedGlass}
        >
          <planeGeometry args={[W - 0.05, Math.hypot(ridgeH - (baseH + wallH), D / 2)]} />
        </mesh>
      </group>

      {/* 8. SERVO-ACTUATED ROOF VENTILATION HATCH (North side: -Z) */}
      {/* Pivot Hinge mounted perfectly on the Ridge Beam */}
      <group position={[0, ridgeH, 0]} ref={roofHatchRef}>
        {/* The Glass Hatch Pane */}
        <mesh 
          position={[0, -0.3, -D / 4]} 
          rotation={[Math.atan2(ridgeH - (baseH + wallH), D / 2), 0, 0]} 
          material={materials.frostedGlass}
        >
          <planeGeometry args={[W - 0.08, Math.hypot(ridgeH - (baseH + wallH), D / 2)]} />
        </mesh>

        {/* Lightweight Hatch Metal Framing */}
        <mesh 
          position={[0, -0.3, -D / 4]} 
          rotation={[Math.atan2(ridgeH - (baseH + wallH), D / 2), 0, 0]} 
          material={materials.darkFrame}
        >
          <boxGeometry args={[W - 0.04, Math.hypot(ridgeH - (baseH + wallH), D / 2), 0.02]} />
        </mesh>
      </group>

      {/* 9. Brass Mechanical Actuator / Servo Assembly (Visualizing Real IoT Hardware) */}
      <group position={[W / 2 - 0.25, ridgeH, 0]}>
        {/* Servo Motor Casing */}
        <mesh position={[0, -0.05, 0.08]} material={materials.darkFrame}>
          <boxGeometry args={[0.12, 0.08, 0.12]} />
        </mesh>
        {/* Servo Horn & Brass Arm */}
        <mesh position={[0, -0.05, 0]} material={materials.brassServo}>
          <cylinderGeometry args={[0.02, 0.02, 0.15, 8]} />
        </mesh>
      </group>
    </group>
  );
}
