import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export function GreenhouseModel({ ventOpenPercent = 40, pumpActive = false, soilMoisture = 65 }) {
  const { scene } = useGLTF('/greenhouse.glb');
  
  // Clone scene so materials/transforms are completely independent
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  const ventWestRef = useRef();
  const ventEastRef = useRef();
  const waterFlowRef = useRef();
  const mistGroupRef = useRef();

  // Find and setup nodes once
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Upgrade glass material to look like premium architectural frosted glass
        if (child.material && (child.material.name.includes('tar grey light') || child.name.includes('glass'))) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#d4eae0'),
            transmission: 0.9,
            opacity: 0.42,
            transparent: true,
            roughness: 0.16,
            ior: 1.48,
            thickness: 0.4,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
        }
      }
    });

    const vWest = clonedScene.getObjectByName('vent_west');
    const vEast = clonedScene.getObjectByName('vent_east');
    const vWestHinge = clonedScene.getObjectByName('vent_west_hinge');
    const vEastHinge = clonedScene.getObjectByName('vent_east_hinge');

    if (vWest) ventWestRef.current = vWest;
    if (vEast) ventEastRef.current = vEast;

    // Calibrate vents angle to perfectly match roof slope:
    // The rafter slope is -35.41 deg (-0.618 rad).
    // The GLB asset had the hinge rested at only -6 deg, leaving a visible gap.
    // Setting rotation.z = -0.618 rad seats both vents flush on the rafters!
    const roofPitchRad = -0.618;
    if (vWestHinge) {
      vWestHinge.rotation.z = roofPitchRad;
      vWestHinge.position.y = 3.20;
    }
    if (vEastHinge) {
      vEastHinge.rotation.z = roofPitchRad;
      vEastHinge.position.y = 3.20;
    }
  }, [clonedScene]);

  // Frame loop: smooth sliding animation & water irrigation spray
  useFrame((state, delta) => {
    // 1. Sliding Ventilation Hatch (geser sesuai seberapa kebukanya 0% - 100%)
    const slideOffset = (ventOpenPercent / 100) * 0.72; // Geser horizontal di rel atap
    if (ventWestRef.current) {
      ventWestRef.current.position.z = THREE.MathUtils.damp(
        ventWestRef.current.position.z,
        0.475 + slideOffset,
        6,
        delta
      );
    }
    if (ventEastRef.current) {
      ventEastRef.current.position.z = THREE.MathUtils.damp(
        ventEastRef.current.position.z,
        -0.475 - slideOffset,
        6,
        delta
      );
    }

    // 2. High-visibility animated water irrigation droplets & spray
    if (waterFlowRef.current) {
      const time = state.clock.elapsedTime;
      const children = waterFlowRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const droplet = children[i];
        if (pumpActive) {
          droplet.visible = true;
          const cycleSpeed = 3.8;
          const progress = (time * cycleSpeed + droplet.userData.offset) % 1;
          droplet.position.y = 1.6 - progress * 1.1; // falls from overhead pipe to soil
          droplet.scale.setScalar(0.9 + Math.sin(progress * Math.PI) * 0.4);
        } else {
          droplet.visible = false;
        }
      }
    }

    // Mist spray rotation & pulsing
    if (mistGroupRef.current) {
      mistGroupRef.current.visible = pumpActive;
      if (pumpActive) {
        mistGroupRef.current.rotation.y += delta * 0.4;
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.08;
        mistGroupRef.current.scale.set(pulse, 1, pulse);
      }
    }
  });

  const soilColor = soilMoisture < 40 ? '#8c6b4e' : soilMoisture > 70 ? '#1f1610' : '#453225';

  return (
    <group position={[0, -1.2, 0]} scale={[1.15, 1.15, 1.15]}>
      {/* Real-world Architectural GLB Greenhouse Model */}
      <primitive object={clonedScene} />

      {/* Modern High-Tech IoT Subsystem inside greenhouse */}
      {/* 1. Overhead Micro-Irrigation Pipe Rack */}
      <group position={[0, 1.7, 0]}>
        {/* Main Delivery Pipe */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 3.4, 12]} />
          <meshStandardMaterial color="#222824" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Irrigation Spray Nozzles (brass micro-sprinklers) */}
        {[-1.2, -0.6, 0, 0.6, 1.2].map((x, idx) => (
          <group key={idx} position={[x, -0.04, 0]}>
            <mesh>
              <cylinderGeometry args={[0.018, 0.012, 0.06, 8]} />
              <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Glowing active indicator light on each nozzle */}
            {pumpActive && (
              <pointLight color="#6be5ff" intensity={1.5} distance={1.2} />
            )}
          </group>
        ))}
      </group>

      {/* 2. HIGHLY VISIBLE Dynamic Water Spray & Droplets (32 animated droplets) */}
      <group ref={waterFlowRef} position={[0, 0, 0]}>
        {Array.from({ length: 32 }).map((_, idx) => {
          const x = -1.2 + (idx % 8) * 0.35 + (Math.sin(idx) * 0.08);
          const z = (Math.cos(idx * 2) * 0.6);
          const offset = idx * 0.13;
          return (
            <mesh 
              key={idx} 
              position={[x, 1.5, z]} 
              userData={{ offset }}
            >
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial 
                color="#62e3ff" 
                emissive="#00b4d8" 
                emissiveIntensity={0.8} 
                roughness={0.1}
                transparent 
                opacity={0.95} 
              />
            </mesh>
          );
        })}
      </group>

      {/* 3. Glowing Moisture Vapor / Fine Mist Layer when pump runs */}
      <group ref={mistGroupRef} position={[0, 0.7, 0]} visible={false}>
        {[-0.8, 0, 0.8].map((mx, idx) => (
          <mesh key={idx} position={[mx, 0, 0]}>
            <cylinderGeometry args={[0.7, 0.5, 0.35, 16]} />
            <meshStandardMaterial 
              color="#b5f0ff" 
              transparent 
              opacity={0.2} 
              roughness={0.9} 
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* 4. Wet Soil / Loam Bed Accent */}
      <mesh position={[0, 0.56, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, 3.1]} />
        <meshStandardMaterial 
          color={soilColor} 
          roughness={pumpActive ? 0.25 : 0.85} 
          metalness={0.05} 
        />
      </mesh>
    </group>
  );
}

useGLTF.preload('/greenhouse.glb');
