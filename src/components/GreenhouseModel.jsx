import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// Generate procedural textures for realistic surface relief & micro-imperfections
function createSurfaceTextures() {
  const size = 256;
  
  // 1. Brick / Paver Normal & Roughness map
  const brickData = new Uint8Array(size * size * 4);
  const brickRough = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Simple normal approximation
      brickData[idx] = 128 + (Math.random() - 0.5) * 30; // Tangent X
      brickData[idx + 1] = 128 + (Math.random() - 0.5) * 30; // Tangent Y
      brickData[idx + 2] = 240; // Tangent Z
      brickData[idx + 3] = 255;

      const rVal = (x % 32 < 2 || y % 16 < 2) ? 230 : 180 + (Math.random() - 0.5) * 40;
      brickRough[idx] = rVal;
      brickRough[idx + 1] = rVal;
      brickRough[idx + 2] = rVal;
      brickRough[idx + 3] = 255;
    }
  }

  const brickNormalTex = new THREE.DataTexture(brickData, size, size, THREE.RGBAFormat);
  brickNormalTex.wrapS = THREE.RepeatWrapping;
  brickNormalTex.wrapT = THREE.RepeatWrapping;
  brickNormalTex.repeat.set(6, 6);
  brickNormalTex.needsUpdate = true;

  const brickRoughTex = new THREE.DataTexture(brickRough, size, size, THREE.RGBAFormat);
  brickRoughTex.wrapS = THREE.RepeatWrapping;
  brickRoughTex.wrapT = THREE.RepeatWrapping;
  brickRoughTex.repeat.set(6, 6);
  brickRoughTex.needsUpdate = true;

  // 2. Soil Loam Bump / Normal map
  const soilData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const noise = (Math.sin(x * 0.2) + Math.cos(y * 0.2) + Math.random() * 0.8) * 40;
      soilData[idx] = 128 + THREE.MathUtils.clamp(noise, -60, 60);
      soilData[idx + 1] = 128 + THREE.MathUtils.clamp(-noise, -60, 60);
      soilData[idx + 2] = 245;
      soilData[idx + 3] = 255;
    }
  }
  const soilNormalTex = new THREE.DataTexture(soilData, size, size, THREE.RGBAFormat);
  soilNormalTex.wrapS = THREE.RepeatWrapping;
  soilNormalTex.wrapT = THREE.RepeatWrapping;
  soilNormalTex.repeat.set(8, 8);
  soilNormalTex.needsUpdate = true;

  return { brickNormalTex, brickRoughTex, soilNormalTex };
}

// Lush 3D Botanical foliage inside the planter pots
function GreenhouseFlora() {
  const floraGroup = useRef();

  // Seeded pot coordinates derived from the GLTF model layout
  const potLocations = useMemo(() => [
    // West Planter Bench
    { pos: [-0.98, 0.62, -1.33], scale: 1.25, type: 'bush' },
    { pos: [-0.97, 0.62, -0.98], scale: 1.1, type: 'fern' },
    { pos: [-0.96, 0.62, -0.44], scale: 1.25, type: 'tomato' },
    { pos: [-0.93, 0.62, -0.08], scale: 1.05, type: 'herb' },
    { pos: [-0.92, 0.62, 0.46], scale: 1.3, type: 'bush' },
    { pos: [-0.90, 0.62, 0.81], scale: 1.15, type: 'fern' },
    { pos: [-0.93, 0.62, 1.30], scale: 1.2, type: 'tomato' },
    // East Planter Bench
    { pos: [1.02, 0.62, -1.38], scale: 1.15, type: 'fern' },
    { pos: [1.00, 0.62, -0.88], scale: 1.25, type: 'tomato' },
    { pos: [1.01, 0.62, -0.51], scale: 1.1, type: 'bush' },
    { pos: [0.96, 0.62, 0.00], scale: 1.3, type: 'tomato' },
    { pos: [0.94, 0.62, 0.37], scale: 1.05, type: 'herb' },
    { pos: [0.93, 0.62, 0.88], scale: 1.25, type: 'fern' },
    { pos: [0.90, 0.62, 1.28], scale: 1.15, type: 'bush' },
  ], []);

  // Curved realistic leaf geometry
  const leafGeometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(0.14, 0.38, 4, 6);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const v = (y + 0.19) / 0.38;
      // Natural botanical curl & tip tapering
      pos.setZ(i, -Math.sin(v * Math.PI) * 0.08 - (x * x) * 2.6);
    }
    geom.computeVertexNormals();
    return geom;
  }, []);

  // Material with rich chlorophyll tone
  const leafMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#286b2b',
      roughness: 0.32,
      metalness: 0.04,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    });
  }, []);

  const tenderLeafMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#469c48',
      roughness: 0.28,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
  }, []);

  const fruitMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: '#e0281b',
      roughness: 0.2,
      metalness: 0.1,
    });
  }, []);

  useFrame((state) => {
    if (!floraGroup.current) return;
    const t = state.clock.elapsedTime;
    // Gentle vegetative breath sway
    floraGroup.current.children.forEach((plant, idx) => {
      plant.rotation.y = Math.sin(t * 0.8 + idx) * 0.04;
      plant.rotation.z = Math.cos(t * 0.9 + idx * 1.5) * 0.02;
    });
  });

  return (
    <group ref={floraGroup}>
      {potLocations.map((pot, pIdx) => {
        const leafAngles = [0, 35, 75, 115, 155, 195, 235, 275, 315, 350];
        return (
          <group key={pIdx} position={pot.pos} scale={[pot.scale, pot.scale, pot.scale]}>
            {/* Main botanical stem */}
            <mesh position={[0, 0.18, 0]} castShadow>
              <cylinderGeometry args={[0.014, 0.02, 0.36, 8]} />
              <meshStandardMaterial color="#22421f" roughness={0.65} />
            </mesh>

            {/* Dense layered foliage leaves */}
            {leafAngles.map((angle, lIdx) => {
              const rad = (angle * Math.PI) / 180;
              const pitch = 0.42 + (lIdx % 3) * 0.18;
              const yOffset = 0.08 + (lIdx % 4) * 0.07;
              const mat = lIdx % 2 === 0 ? leafMaterial : tenderLeafMaterial;

              return (
                <group key={lIdx} position={[0, yOffset, 0]} rotation={[0, rad, 0]}>
                  <mesh 
                    geometry={leafGeometry} 
                    material={mat} 
                    position={[0, 0.1, 0.12]} 
                    rotation={[pitch, 0, 0]}
                    castShadow
                    receiveShadow
                  />
                </group>
              );
            })}

            {/* Ripe hydroponic tomatoes / fruit nodes on tomato type plants */}
            {pot.type === 'tomato' && (
              <group position={[0, 0.25, 0]}>
                {[-0.08, 0.09, 0.01].map((fx, fIdx) => (
                  <mesh key={fIdx} position={[fx, -0.05, fIdx === 2 ? -0.08 : 0.07]} material={fruitMaterial} castShadow>
                    <sphereGeometry args={[0.042, 14, 14]} />
                  </mesh>
                ))}
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

// Kalibrasi geometri kaca atap:
// 1. Menutup lubang bolong di lereng barat (z: 0..0.95) dengan kaca atap standar yang menyatu
// 2. Membuka kaca atap di lereng timur (z: 0..0.95) sehingga lubang ventilasi menyatu lapang (z: -0.95..0.95)
function fixRoofGlassGeometry(glassMesh) {
  const oldPos = glassMesh.geometry?.attributes?.position;
  const oldNorm = glassMesh.geometry?.attributes?.normal;
  if (!oldPos || !oldNorm) return;
  const count = oldPos.count;

  const newPos = [];
  const newNorm = [];
  const fillPos = [];
  const fillNorm = [];

  // Kondisi atap lereng timur Bay 3: x in [0, 0.82], z in [-0.01, 0.96], y > 2.5
  // Kaca ini DIBUANG agar lubang kedua ventilasi di lereng timur menyatu lapang tanpa terhalang kaca
  const isEastBay3 = (x, y, z) => x >= -0.01 && x <= 0.82 && z >= -0.01 && z <= 0.96 && y > 2.5;

  // Kondisi atap lereng barat Bay 2: x in [-0.82, 0], z in [-0.96, 0.01], y > 2.5
  // Kaca ini DI-KLONING ke Bay 3 (z + 0.95) untuk MENUTUP LUBANG BOLONG di lereng barat seberang
  const isWestBay2 = (x, y, z) => x <= 0.01 && x >= -0.82 && z >= -0.96 && z <= 0.01 && y > 2.5;

  for (let i = 0; i < count; i += 3) {
    const x1 = oldPos.getX(i), y1 = oldPos.getY(i), z1 = oldPos.getZ(i);
    const x2 = oldPos.getX(i + 1), y2 = oldPos.getY(i + 1), z2 = oldPos.getZ(i + 1);
    const x3 = oldPos.getX(i + 2), y3 = oldPos.getY(i + 2), z3 = oldPos.getZ(i + 2);

    const nx1 = oldNorm.getX(i), ny1 = oldNorm.getY(i), nz1 = oldNorm.getZ(i);
    const nx2 = oldNorm.getX(i + 1), ny2 = oldNorm.getY(i + 1), nz2 = oldNorm.getZ(i + 1);
    const nx3 = oldNorm.getX(i + 2), ny3 = oldNorm.getY(i + 2), nz3 = oldNorm.getZ(i + 2);

    // 1. Hapus kaca di Bay 3 lereng timur (agar lubang ventilasi menyatu lapang)
    if (isEastBay3(x1, y1, z1) && isEastBay3(x2, y2, z2) && isEastBay3(x3, y3, z3)) {
      continue;
    }

    newPos.push(x1, y1, z1, x2, y2, z2, x3, y3, z3);
    newNorm.push(nx1, ny1, nz1, nx2, ny2, nz2, nx3, ny3, nz3);

    // 2. Kloning kaca Bay 2 lereng barat ke Bay 3 lereng barat (z + 0.95) agar tidak bolong lagi
    if (isWestBay2(x1, y1, z1) && isWestBay2(x2, y2, z2) && isWestBay2(x3, y3, z3)) {
      fillPos.push(
        x1, y1, z1 + 0.95,
        x2, y2, z2 + 0.95,
        x3, y3, z3 + 0.95
      );
      fillNorm.push(nx1, ny1, nz1, nx2, ny2, nz2, nx3, ny3, nz3);
    }
  }

  newPos.push(...fillPos);
  newNorm.push(...fillNorm);

  const newGeom = new THREE.BufferGeometry();
  newGeom.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
  newGeom.setAttribute('normal', new THREE.Float32BufferAttribute(newNorm, 3));
  glassMesh.geometry.dispose();
  glassMesh.geometry = newGeom;
}

export function GreenhouseModel({ 
  ventOpen = false, 
  ventOpenPercent, 
  pumpActive = false, 
  soilMoisture = null, 
  theme = 'dark' 
}) {
  const { scene } = useGLTF('/greenhouse.glb');
  
  // Clone scene so materials/transforms are completely independent
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  const unifiedHingeRef = useRef();
  const slideRef = useRef(0);
  const waterFlowRef = useRef();
  const mistGroupRef = useRef();
  const growLightBarRef = useRef();

  // Procedural normal/roughness textures for architectural realism
  const textures = useMemo(() => createSurfaceTextures(), []);

  // Material upgrade & calibration
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const name = child.name.toLowerCase();
        const matName = child.material?.name?.toLowerCase() || '';

        {/* 1. Crystal-clear Architectural Glazed Glass with High Clarity & Crisp Specular */}
        if (matName.includes('tar grey light') || name.includes('glass')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(theme === 'light' ? '#cae4f0' : '#d2e8f2'),
            transparent: true,
            opacity: 0.22,
            roughness: 0.05,
            metalness: 0.08,
            clearcoat: 0.85,
            clearcoatRoughness: 0.08,
            reflectivity: 0.55,
            depthWrite: false,
            side: THREE.DoubleSide,
          });

          // Kalibrasi lubang atap kaca utama:
          if (name === 'glass_tar_grey_light' && !child.userData.roofGlassFixed) {
            child.userData.roofGlassFixed = true;
            fixRoofGlassGeometry(child);
          }
        }

        // 2. Powder-coated White Aluminium Frame
        else if (matName.includes('warm white') || name.includes('frame')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#ece9e2'),
            roughness: 0.38,
            metalness: 0.22,
          });
        }

        // 3. Realistic Brick Masonry Foundation
        else if (matName.includes('brick red')) {
          const isDark = matName.includes('dark');
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(isDark ? '#5c221e' : '#8c352a'),
            roughness: 0.92,
            metalness: 0.02,
            normalMap: textures.brickNormalTex,
            normalScale: new THREE.Vector2(0.35, 0.35),
            roughnessMap: textures.brickRoughTex,
          });
        }

        // 4. Weathered Cedar Timber & Water Butt Wood
        else if (matName.includes('dark wood') || matName.includes('water-tower')) {
          const isDeep = matName.includes('dark wood');
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(isDeep ? '#2c1e15' : '#4a3322'),
            roughness: 0.78,
            metalness: 0.04,
          });
        }

        // 5. Galvanized Zinc Gutters & Concrete Sill
        else if (matName.includes('mid grey')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#555f68'),
            roughness: 0.42,
            metalness: 0.65,
          });
        }

        // 6. Cast Iron & Soot Black Fixtures
        else if (matName.includes('soot black') || matName.includes('tar grey dark')) {
          // Hide old swing flap actuator rods so the window slides cleanly
          if (name.includes('vent_west_soot_black') || name.includes('vent_east_soot_black')) {
            child.visible = false;
          }
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#1c1e21'),
            roughness: 0.55,
            metalness: 0.75,
          });
        }

        // 7. Terracotta Planters & Accent Trims
        else if (matName.includes('sunset orange') || name.includes('beds_sunset_orange')) {
          child.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#b8542c'), // Rich burnt terracotta clay
            roughness: 0.72,
            metalness: 0.05,
          });
        }
      }
    });

    // 1. Sembunyikan objek ventilasi terpisah lama (vent_west & vent_east)
    const vWest = clonedScene.getObjectByName('vent_west');
    const vEast = clonedScene.getObjectByName('vent_east');
    if (vWest) vWest.visible = false;
    if (vEast) vEast.visible = false;

    // Pastikan tidak ada objek bekas ventilasi di sisi atap barat (hilangkan jadi atap biasa)
    const oldWestFixed = clonedScene.getObjectByName('west_roof_fixed_glass');
    if (oldWestFixed) {
      clonedScene.remove(oldWestFixed);
    }

    // 2. Buat SATU KOTAK VENTILASI YANG MENYATU (panoramic single unified sliding sash)
    // Berada di satu sisi atap (lereng timur X > 0), dengan lubang atap yang juga menyatu (tanpa sekat tengah)
    if (!clonedScene.getObjectByName('unified_sliding_vent_hinge')) {
      const group = new THREE.Group();
      group.name = 'unified_sliding_vent_hinge';
      group.position.set(0.055, 3.0215, 0);
      group.rotation.z = -Math.PI / 6;

      const frameMat = clonedScene.getObjectByName('vent_east_warm_white')?.material || new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ece9e2'),
        roughness: 0.38,
        metalness: 0.22,
      });

      const glassMat = clonedScene.getObjectByName('vent_east_tar_grey_light')?.material || new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(theme === 'light' ? '#cae4f0' : '#d2e8f2'),
        transparent: true,
        opacity: 0.22,
        roughness: 0.05,
        metalness: 0.08,
        clearcoat: 0.85,
        clearcoatRoughness: 0.08,
        reflectivity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      // Dimensi satu panel lebar terpadu:
      // Lebar total W = 1.84m (menutupi span dari Z = -0.92 s/d Z = +0.92, centered di Z = 0)
      // Panjang L = 0.872m (dari bubungan ke bawah lereng)
      const W = 1.84;
      const L = 0.872;
      const T = 0.045; // Tebal profil kusen
      const H = 0.040; // Kedalaman kusen

      // Kusen atas (dekat nok/ridge)
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(T, H, W), frameMat);
      topRail.position.set(T / 2, H / 2, 0);
      topRail.castShadow = true;
      group.add(topRail);

      // Kusen bawah (dekat tritisan/eave)
      const btmRail = new THREE.Mesh(new THREE.BoxGeometry(T, H, W), frameMat);
      btmRail.position.set(L - T / 2, H / 2, 0);
      btmRail.castShadow = true;
      group.add(btmRail);

      // Kusen sisi kiri (Z = -W/2)
      const leftStile = new THREE.Mesh(new THREE.BoxGeometry(L - 2 * T, H, T), frameMat);
      leftStile.position.set(L / 2, H / 2, -W / 2 + T / 2);
      leftStile.castShadow = true;
      group.add(leftStile);

      // Kusen sisi kanan (Z = +W/2)
      const rightStile = new THREE.Mesh(new THREE.BoxGeometry(L - 2 * T, H, T), frameMat);
      rightStile.position.set(L / 2, H / 2, W / 2 - T / 2);
      rightStile.castShadow = true;
      group.add(rightStile);

      // Panel kaca tunggal menyatu panoramik (tanpa sekat pemisah di tengah!)
      const glassW = W - 2 * T + 0.01;
      const glassL = L - 2 * T + 0.01;
      const glassPane = new THREE.Mesh(new THREE.BoxGeometry(glassL, 0.014, glassW), glassMat);
      glassPane.position.set(L / 2, H / 2, 0);
      glassPane.castShadow = true;
      group.add(glassPane);

      clonedScene.add(group);
      unifiedHingeRef.current = group;
    } else {
      unifiedHingeRef.current = clonedScene.getObjectByName('unified_sliding_vent_hinge');
    }
  }, [clonedScene, textures, theme]);

  // Frame loop: vent aperture & irrigation water droplet dynamics
  useFrame((state, delta) => {
    // 1. Sliding Roof Vent: 1 panel menyatu di SATU SISI ATAP, buka-tutup geser ke bawah
    // Slope atap adalah -30 deg (-Math.PI / 6 rad) meluncur ke arah bawah (+X, -Y).
    const openFactor = ventOpenPercent !== undefined 
      ? Math.max(0, Math.min(1, ventOpenPercent / 100)) 
      : (ventOpen ? 1.0 : 0.0);

    // Jarak luncur geser ke bawah sepanjang lereng atap (dalam meter/unit)
    const maxSlide = 0.62; 
    const targetSlide = openFactor * maxSlide;

    slideRef.current = THREE.MathUtils.damp(
      slideRef.current,
      targetSlide,
      6.0,
      delta
    );

    // Vektor luncur lereng atap 30 derajat:
    const cos30 = Math.cos(Math.PI / 6); // ~0.866025
    const sin30 = Math.sin(Math.PI / 6); // 0.500000
    const baseX = 0.055;
    const baseY = 3.0215;

    const posX = baseX + slideRef.current * cos30;
    const posY = baseY - slideRef.current * sin30;

    // Panel tunggal terpadu meluncur ke bawah bersamaan, membuka satu lubang atap yang menyatu
    if (unifiedHingeRef.current) {
      unifiedHingeRef.current.position.set(posX, posY, 0);
      unifiedHingeRef.current.rotation.z = -Math.PI / 6;
    }

    // 2. Animated water droplet stream
    if (waterFlowRef.current) {
      const time = state.clock.elapsedTime;
      const children = waterFlowRef.current.children;
      for (let i = 0; i < children.length; i++) {
        const droplet = children[i];
        if (pumpActive) {
          droplet.visible = true;
          const cycleSpeed = 4.2;
          const progress = (time * cycleSpeed + droplet.userData.offset) % 1;
          droplet.position.y = 1.65 - progress * 1.05;
          const scale = 0.7 + Math.sin(progress * Math.PI) * 0.5;
          droplet.scale.set(scale, scale * 1.5, scale); // Elongated water drop
        } else {
          droplet.visible = false;
        }
      }
    }

    // 3. Fine mist vapor expansion & turbulence
    if (mistGroupRef.current) {
      mistGroupRef.current.visible = pumpActive;
      if (pumpActive) {
        mistGroupRef.current.rotation.y += delta * 0.3;
        const pulse = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.06;
        mistGroupRef.current.scale.set(pulse, 1, pulse);
      }
    }
  });

  const soilColor = (soilMoisture !== null && soilMoisture !== undefined)
    ? (soilMoisture < 40 ? '#7a5a3e' : soilMoisture > 70 ? '#1b140e' : '#38281d')
    : '#38281d';

  return (
    <group position={[0, -1.35, 0]} scale={[1.05, 1.05, 1.05]}>
      {/* Real-world Architectural GLB Greenhouse Model */}
      <primitive object={clonedScene} />

      {/* Lush 3D Realistic Vegetation Inside the Beds */}
      <GreenhouseFlora />

      {/* Modern High-Tech IoT Subsystem */}
      {/* 1. Overhead Micro-Irrigation Pipe & LED Grow Fixtures */}
      <group position={[0, 1.72, 0]}>
        {/* Main Irrigation Rail */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.022, 3.4, 16]} />
          <meshStandardMaterial color="#1f2421" metalness={0.85} roughness={0.25} />
        </mesh>

        {/* High-Efficacy Horticultural LED Luminaire Strip */}
        <group ref={growLightBarRef} position={[0, 0.05, 0]}>
          {/* LED Housing Bar */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.06, 0.03, 3.2]} />
            <meshStandardMaterial color="#2a332d" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Emissive Photonic Strip (Photosynthetic Active Radiation: Magenta / Warm Sun) */}
          <mesh position={[0, -0.016, 0]}>
            <boxGeometry args={[0.045, 0.005, 3.1]} />
            <meshStandardMaterial color="#ffe8d1" emissive="#ffaa66" emissiveIntensity={1.4} />
          </mesh>
          {/* Soft Downward Canopy Fill Light */}
          <pointLight position={[0, -0.18, 0]} intensity={theme === 'light' ? 1.6 : 2.4} distance={3.4} color="#ffe2b8" />
        </group>

        {/* Ambient interior greenhouse illumination for vivid 3D depth */}
        <pointLight position={[0, -0.65, 0]} intensity={theme === 'light' ? 0.9 : 1.4} distance={3.8} color="#ffdca8" />

        {/* Brass Micro-Sprinkler Nozzles with active glow */}
        {[-1.2, -0.6, 0, 0.6, 1.2].map((x, idx) => (
          <group key={idx} position={[x, -0.035, 0]}>
            <mesh>
              <cylinderGeometry args={[0.016, 0.01, 0.055, 12]} />
              <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.15} />
            </mesh>
            {pumpActive && (
              <pointLight color="#7ee8fa" intensity={2.0} distance={1.4} />
            )}
          </group>
        ))}
      </group>

      {/* 2. Realistic Micro-Droplet Cascade (64 dynamic droplets) */}
      <group ref={waterFlowRef} position={[0, 0, 0]}>
        {Array.from({ length: 64 }).map((_, idx) => {
          const x = -1.25 + (idx % 12) * 0.23 + (Math.sin(idx * 3) * 0.07);
          const z = (Math.cos(idx * 1.8) * 0.75);
          const offset = idx * 0.09;
          return (
            <mesh 
              key={idx} 
              position={[x, 1.6, z]} 
              userData={{ offset }}
            >
              <sphereGeometry args={[0.034, 10, 10]} />
              <meshStandardMaterial 
                color="#62e6ff" 
                emissive="#00b4d8"
                emissiveIntensity={0.65}
                roughness={0.1}
                metalness={0.1}
                transparent
                opacity={0.92}
              />
            </mesh>
          );
        })}
      </group>

      {/* 3. Volumetric Fine Vapor Moisture Cloud */}
      <group ref={mistGroupRef} position={[0, 0.72, 0]} visible={false}>
        {[-0.85, 0, 0.85].map((mx, idx) => (
          <mesh key={idx} position={[mx, 0, 0]}>
            <cylinderGeometry args={[0.65, 0.45, 0.35, 16]} />
            <meshStandardMaterial 
              color="#b5f0ff" 
              emissive="#7adbf0"
              emissiveIntensity={0.25}
              transparent 
              opacity={0.32} 
              roughness={0.95} 
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* 4. Rich Organic Loam Bed Floor */}
      <mesh position={[0, 0.56, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.55, 3.15]} />
        <meshStandardMaterial 
          color={soilColor} 
          roughness={pumpActive ? 0.35 : 0.88} 
          metalness={0.03}
          normalMap={textures.soilNormalTex}
          normalScale={new THREE.Vector2(0.4, 0.4)}
        />
      </mesh>

      {/* 5. Architectural Flagstone Ground Base Plinth */}
      <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.6, 5.4]} />
        <meshStandardMaterial 
          color={theme === 'light' ? '#cbd5cb' : '#161c18'} 
          roughness={0.85} 
          metalness={0.1}
          normalMap={textures.brickNormalTex}
          normalScale={new THREE.Vector2(0.2, 0.2)}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload('/greenhouse.glb');

