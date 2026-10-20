import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Float, ContactShadows, useProgress, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { GreenhouseModel } from './components/GreenhouseModel';
import { sfx } from './utils/soundEffects';
import { db } from './firebase';
import { ref, onValue, set } from 'firebase/database';
import {
  Thermometer,
  Droplets,
  Wind,
  Power,
  Cpu,
  SunMedium,
  Activity,
  Radio,
  Sliders,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Wifi,
  Settings,
  Check,
  X,
  RefreshCw
} from 'lucide-react';

function CanvasLoader({ theme }) {
  const { progress } = useProgress();
  const isLight = theme === 'light';
  return (
    <div className={`absolute inset-0 z-20 flex flex-col items-center justify-center backdrop-blur-md transition-colors ${isLight ? 'bg-[#f4f7f4]/90 text-[#223825]' : 'bg-[#0a0d0c]/90 text-[#9eb29c]'
      }`}>
      <div className={`w-10 h-10 rounded-full border-2 animate-spin mb-3 ${isLight ? 'border-[#cfded1] border-t-[#2b723f]' : 'border-[#202b22] border-t-[#87ca92]'
        }`} />
      <span className="text-[11px] font-mono tracking-widest uppercase">
        CALIBRATING 3D MODEL
      </span>
      <span className={`text-[10px] font-mono mt-1 ${isLight ? 'text-[#58735c]' : 'text-[#5f7461]'}`}>
        {Math.round(progress)}% LOADED
      </span>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aura_greenhouse_theme') || 'dark';
    }
    return 'dark';
  });

  const [temperature, setTemperature] = useState(null);
  const [soilMoisture, setSoilMoisture] = useState(null);
  const [humidity, setHumidity] = useState(null);
  const [adcTanah, setAdcTanah] = useState(null);

  // ESP32 Local REST API Configuration & State
  const [espIp, setEspIp] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aura_esp32_ip') || '192.168.43.150';
    }
    return '192.168.43.150';
  });
  const [espConnected, setEspConnected] = useState(false);
  const [isIpModalOpen, setIsIpModalOpen] = useState(false);
  const [tempIpInput, setTempIpInput] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aura_esp32_ip') || '192.168.43.150';
    }
    return '192.168.43.150';
  });
  const [isTestingIp, setIsTestingIp] = useState(false);
  const [ipTestResult, setIpTestResult] = useState(null);

  const [ventOpen, setVentOpen] = useState(false);
  const [pumpActive, setPumpActive] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [feedbackSound, setFeedbackSound] = useState(true);
  const [lastAction, setLastAction] = useState('Biosphere calibrated & standby');
  const [cloudConnected, setCloudConnected] = useState(false);
  const [telemetryFromCloud, setTelemetryFromCloud] = useState(false);

  const isLight = theme === 'light';

  // Apply theme class to document body
  useEffect(() => {
    localStorage.setItem('aura_greenhouse_theme', theme);
    if (typeof document !== 'undefined') {
      document.body.className = theme === 'light' ? 'light-theme' : 'dark-theme';
    }
  }, [theme]);

  // Sync mute state with sound engine
  useEffect(() => {
    sfx.setMuted(!feedbackSound);
  }, [feedbackSound]);

  // Irrigation water SFX: automatically runs while pump is active
  useEffect(() => {
    if (pumpActive && feedbackSound) {
      sfx.startWater();
    } else {
      sfx.stopWater();
    }
    return () => {
      sfx.stopWater();
    };
  }, [pumpActive, feedbackSound]);

  // Roof ventilation wind SFX: automatically runs while roof vent is open
  useEffect(() => {
    if (ventOpen && feedbackSound) {
      sfx.startWind();
    } else {
      sfx.stopWind();
    }
    return () => {
      sfx.stopWind();
    };
  }, [ventOpen, feedbackSound]);

  // 1. Firebase RTDB Connection State
  useEffect(() => {
    try {
      const connectedRef = ref(db, '.info/connected');
      const unsub = onValue(connectedRef, (snap) => {
        setCloudConnected(snap.val() === true);
      });
      return () => unsub();
    } catch (e) {
      console.warn('Firebase connection check error:', e);
    }
  }, []);

  // 2. Firebase RTDB Actuators Listener (Incoming changes from ESP32 / Cloud)
  useEffect(() => {
    try {
      const ventRef = ref(db, 'greenhouse/actuators/ventOpen');
      const unsubVent = onValue(ventRef, (snap) => {
        const val = snap.val();
        if (typeof val === 'boolean') {
          setVentOpen(val);
        }
      });

      const pumpRef = ref(db, 'greenhouse/actuators/pumpActive');
      const unsubPump = onValue(pumpRef, (snap) => {
        const val = snap.val();
        if (typeof val === 'boolean') {
          setPumpActive(val);
        }
      });

      const autoRef = ref(db, 'greenhouse/actuators/autoMode');
      const unsubAuto = onValue(autoRef, (snap) => {
        const val = snap.val();
        if (typeof val === 'boolean') {
          setAutoMode(val);
        }
      });

      return () => {
        unsubVent();
        unsubPump();
        unsubAuto();
      };
    } catch (e) {
      console.warn('Firebase actuator listener error:', e);
    }
  }, []);

  // 3. Firebase RTDB Telemetry Listener (Sensor updates from ESP32)
  useEffect(() => {
    try {
      const telemetryRef = ref(db, 'greenhouse/telemetry');
      const unsubTelemetry = onValue(telemetryRef, (snap) => {
        const val = snap.val();
        if (val && typeof val === 'object') {
          let hasData = false;

          // Temperature (°C)
          const rawTemp = val.temperature ?? val.temp;
          if (rawTemp !== undefined && rawTemp !== null && rawTemp !== '') {
            const num = Number(rawTemp);
            if (!isNaN(num)) {
              setTemperature(num);
              hasData = true;
            } else {
              setTemperature(null);
            }
          } else {
            setTemperature(null);
          }

          // Soil Moisture (%)
          const rawSoil = val.soilMoisture ?? val.soil_moisture ?? val.moisture;
          if (rawSoil !== undefined && rawSoil !== null && rawSoil !== '') {
            const num = Number(rawSoil);
            if (!isNaN(num)) {
              setSoilMoisture(num);
              hasData = true;
            } else {
              setSoilMoisture(null);
            }
          } else {
            setSoilMoisture(null);
          }

          // Humidity (%)
          const rawHum = val.humidity ?? val.hum;
          if (rawHum !== undefined && rawHum !== null && rawHum !== '') {
            const num = Number(rawHum);
            if (!isNaN(num)) {
              setHumidity(num);
              hasData = true;
            } else {
              setHumidity(null);
            }
          } else {
            setHumidity(null);
          }

          setTelemetryFromCloud(hasData);
        } else {
          setTelemetryFromCloud(false);
          setTemperature(null);
          setSoilMoisture(null);
          setHumidity(null);
        }
      });
      return () => unsubTelemetry();
    } catch (e) {
      console.warn('Firebase telemetry listener error:', e);
    }
  }, []);

  // 4. ESP32 Local REST API Polling Engine (/api/data)
  useEffect(() => {
    if (!espIp) return;

    let isMounted = true;
    const fetchEspData = async () => {
      try {
        const cleanIp = espIp.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);

        const res = await fetch(`http://${cleanIp}/api/data`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (isMounted && data && typeof data === 'object') {
          setEspConnected(true);

          // 1. Suhu (Float °C)
          if (typeof data.suhu === 'number') {
            setTemperature(data.suhu);
          }
          // 2. Kelembapan Udara (Float %)
          if (typeof data.kelembapan_udara === 'number') {
            setHumidity(data.kelembapan_udara);
          }
          // 3. Kelembaban Tanah Persen (Int 0 - 100%)
          if (typeof data.kelembaban_tanah === 'number') {
            setSoilMoisture(data.kelembaban_tanah);
          }
          // 4. ADC Tanah Mentah (Int 0 - 4095)
          if (typeof data.adc_tanah === 'number') {
            setAdcTanah(data.adc_tanah);
          }

          // 5. Status Ventilasi ("TERBUKA" / "TERTUTUP")
          if (typeof data.ventilasi === 'string') {
            const isVentOpen = data.ventilasi === 'TERBUKA';
            setVentOpen(prev => {
              if (prev !== isVentOpen) {
                if (isVentOpen) sfx.playWind(0.5);
                else sfx.playTactile(280);
                setLastAction(isVentOpen
                  ? 'Otonom ESP32: Suhu panas (>30°C) -> Ventilasi TERBUKA'
                  : 'Otonom ESP32: Suhu normal (<=29°C) -> Ventilasi TERTUTUP');
              }
              return isVentOpen;
            });
          }

          // 6. Status Pompa ("ON" / "OFF")
          if (typeof data.pompa === 'string') {
            const isPumpOn = data.pompa === 'ON';
            setPumpActive(prev => {
              if (prev !== isPumpOn) {
                if (isPumpOn) sfx.playTactile(380, 'triangle');
                setLastAction(isPumpOn
                  ? 'Otonom ESP32: Tanah kering (ADC > 2700) -> Pompa Air MENYALA'
                  : 'Otonom ESP32: Tanah lembap / Timeout -> Pompa Air STANDBY');
              }
              return isPumpOn;
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setEspConnected(false);
          if (!telemetryFromCloud) {
            setTemperature(null);
            setHumidity(null);
            setSoilMoisture(null);
            setAdcTanah(null);
          }
        }
      }
    };

    fetchEspData();
    const timer = setInterval(fetchEspData, 2000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [espIp, telemetryFromCloud]);

  // Handler simpan IP ESP32
  const handleSaveIp = (newIp) => {
    const clean = newIp.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    setEspIp(clean);
    localStorage.setItem('aura_esp32_ip', clean);
    setIsIpModalOpen(false);
    setIpTestResult(null);
    setLastAction(`Target IP ESP32 diatur ke http://${clean}`);
  };

  // Handler uji koneksi ke ESP32
  const handleTestIp = async () => {
    setIsTestingIp(true);
    setIpTestResult(null);
    try {
      const clean = tempIpInput.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`http://${clean}/api/data`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setIpTestResult({
          success: true,
          message: `Berhasil terhubung ke ESP32! Suhu: ${data.suhu ?? '-'}°C, Udara: ${data.kelembapan_udara ?? '-'}%, Tanah: ${data.kelembaban_tanah ?? '-'}% (ADC: ${data.adc_tanah ?? '-'}), Vent: ${data.ventilasi ?? '-'}, Pompa: ${data.pompa ?? '-'}`
        });
      } else {
        setIpTestResult({ success: false, message: `Respon HTTP ${res.status} dari ${clean}` });
      }
    } catch (e) {
      setIpTestResult({
        success: false,
        message: `Gagal terhubung (${e.message}). Pastikan ESP32 & Laptop/HP sama-sama terhubung ke Hotspot.`
      });
    } finally {
      setIsTestingIp(false);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    sfx.playTactile(next === 'light' ? 520 : 380, 'triangle');
    setLastAction(`UI theme switched to ${next.toUpperCase()} mode`);
  };

  // Toggle audio
  const toggleAudio = () => {
    const next = !feedbackSound;
    setFeedbackSound(next);
    sfx.setMuted(!next);
    if (next) {
      sfx.playTactile(480);
      setLastAction('Tactile & ambient SFX enabled');
    } else {
      sfx.stopWater();
      sfx.stopWind();
      setLastAction('Tactile & ambient SFX muted');
    }
  };

  const setPumpState = (active) => {
    setPumpActive(active);
    try {
      set(ref(db, 'greenhouse/actuators/pumpActive'), active).catch(console.warn);
    } catch (err) {
      console.warn('Firebase write pump error:', err);
    }
  };

  // Pump toggle (Writes to Firebase RTDB)
  const togglePump = () => {
    sfx.playTactile(380, 'triangle');
    const next = !pumpActive;
    setPumpState(next);
    setLastAction(next ? 'Pompa Air AKTIF (5V Relay ON)' : 'Pompa Air NONAKTIF (5V Relay OFF)');
  };

  // Vent control (Writes to Firebase RTDB: Terbuka = true / Tertutup = false)
  const setVentState = (open) => {
    if (open === ventOpen) return;
    setVentOpen(open);
    if (open) {
      sfx.playWind(0.5); // Angin sepoi-sepoi lembut
      setLastAction('Ventilasi atap geser TERBUKA (Signal -> ESP32 Servo 90°)');
    } else {
      sfx.playTactile(280);
      setLastAction('Ventilasi atap geser TERTUTUP (Signal -> ESP32 Servo 0°)');
    }

    try {
      set(ref(db, 'greenhouse/actuators/ventOpen'), open).catch(console.warn);
    } catch (err) {
      console.warn('Firebase write vent error:', err);
    }
  };

  const toggleVent = () => {
    setVentState(!ventOpen);
  };

  const toggleAutoMode = () => {
    const next = !autoMode;
    setAutoMode(next);
    sfx.playTactile(400);
    setLastAction(next ? 'Mode Regulasi AUTO diaktifkan' : 'Mode Regulasi MANUAL diaktifkan');
    try {
      set(ref(db, 'greenhouse/actuators/autoMode'), next).catch(console.warn);
    } catch (err) {
      console.warn('Firebase write autoMode error:', err);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${isLight
      ? 'bg-[#f4f7f4] text-[#19261b] selection:bg-[#cde4d1] selection:text-[#184824]'
      : 'bg-[#0a0d0c] text-[#e3e8e2] selection:bg-[#344635] selection:text-[#a8e6b1]'
      }`}>
      {/* Background ambient lighting vignette */}
      <div className={`fixed inset-0 pointer-events-none transition-opacity duration-300 ${isLight
        ? 'opacity-60 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(135,188,145,0.24),rgba(244,247,244,0))]'
        : 'opacity-40 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(60,85,65,0.22),rgba(10,13,12,0))]'
        }`} />

      {/* Top Bar Header */}
      <header className={`relative z-10 border-b px-4 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md transition-colors ${isLight
        ? 'border-[#dce5dd] bg-[#ffffff]/80 text-[#1a281c]'
        : 'border-[#1a231c] bg-[#0a0d0c]/85 text-[#cad5c8]'
        }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-inner transition-colors ${isLight
            ? 'bg-[#e8f2e9] border border-[#bcd8c0] text-[#256333]'
            : 'bg-[#161d18] border border-[#263529] text-[#9ed3a5]'
            }`}>
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className={`text-xs sm:text-sm font-medium tracking-widest uppercase ${isLight ? 'text-[#182a1c]' : 'text-[#cad5c8]'
                }`}>
                AURA BIOSPHERE
              </h1>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1.5 ${espConnected
                ? (isLight ? 'bg-[#eaf4eb] text-[#226330] border-[#c0dac4]' : 'bg-[#18261b] text-[#86e297] border-[#263e2a]')
                : (isLight ? 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]' : 'bg-[#262013] text-[#fcd34d] border-[#45371c]')
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${espConnected ? 'bg-[#22c55e] animate-pulse' : 'bg-[#f59e0b]'}`} />
                {espConnected ? 'ESP32 REST: ONLINE' : 'ESP32 REST: OFFLINE'}
              </span>
            </div>
            <p className={`text-[11px] ${isLight ? 'text-[#586e5b]' : 'text-[#6d7c6e]'}`}>
              Smart Microclimate & Actuation Lab
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs">
          {/* IP ESP32 Configuration button */}
          <button
            onClick={() => { setTempIpInput(espIp); setIpTestResult(null); setIsIpModalOpen(true); }}
            className={`px-2.5 py-1.5 rounded-full border flex items-center gap-1.5 font-mono text-[11px] transition-colors cursor-pointer ${isLight
              ? 'border-[#cbd9ce] bg-[#ffffff] text-[#1e3c23] hover:border-[#95be9b] shadow-sm'
              : 'border-[#212722] bg-[#121513] text-[#a5d2ab] hover:border-[#324233]'
              }`}
            title="Konfigurasi IP ESP32 REST API"
          >
            <Wifi className="w-3.5 h-3.5 text-[#0284c7]" />
            <span className="font-medium">IP: {espIp}</span>
          </button>

          {/* Audio toggle button with sound effect feedback */}
          <button
            onClick={toggleAudio}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${isLight
              ? 'border-[#cbd9ce] bg-[#f0f5f1] text-[#264e2e] hover:border-[#9ec9a5]'
              : 'border-[#212722] bg-[#121513] text-[#86a88b] hover:border-[#324233]'
              }`}
            title={feedbackSound ? 'Mute Sound Effects' : 'Enable Sound Effects'}
          >
            {feedbackSound ? (
              <Volume2 className="w-3.5 h-3.5 text-[#2ca048]" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 opacity-50" />
            )}
          </button>

          {/* Theme Toggle Button (Light / Dark) */}
          <button
            onClick={toggleTheme}
            className={`px-2.5 py-1.5 rounded-full border flex items-center gap-1.5 font-mono text-[11px] transition-colors cursor-pointer ${isLight
              ? 'border-[#cbd9ce] bg-[#ffffff] text-[#1e3c23] hover:border-[#95be9b] shadow-sm'
              : 'border-[#212722] bg-[#121513] text-[#a5d2ab] hover:border-[#324233]'
              }`}
            title="Toggle Light / Dark Theme"
          >
            {isLight ? (
              <>
                <Sun className="w-3.5 h-3.5 text-[#d97706]" />
                <span className="hidden sm:inline font-medium">LIGHT</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-[#7dd3fc]" />
                <span className="hidden sm:inline font-medium">DARK</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full">

        {/* Left Column: 3D Twin Canvas */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className={`relative flex-1 min-h-[400px] lg:min-h-[500px] rounded-2xl border overflow-hidden transition-colors flex flex-col ${isLight
            ? 'border-[#cddcd0] bg-gradient-to-b from-[#edf5f0] to-[#dfeee3] shadow-[0_10px_35px_rgba(20,40,25,0.08)]'
            : 'border-[#1e2520] bg-gradient-to-b from-[#111512] to-[#0c0e0c] shadow-2xl'
            }`}>

            <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2 pointer-events-none">
              <span className={`text-[10px] font-mono tracking-wider uppercase px-2.5 py-1 rounded-md border backdrop-blur ${isLight
                ? 'text-[#35523a] bg-[#ffffff]/85 border-[#c8dacb]'
                : 'text-[#738474] bg-[#111512]/85 border-[#1c241e]'
                }`}>
                3D DIGITAL TWIN • ENHANCED LIGHTING & GLASS • DRAG TO ROTATE
              </span>
            </div>

            <div className="w-full h-full flex-1 cursor-grab active:cursor-grabbing relative">
              <Suspense fallback={<CanvasLoader theme={theme} />}>
                <Canvas
                  camera={{ position: [4.4, 3.2, 4.4], fov: 40 }}
                  dpr={[1, 2]}
                  gl={{
                    antialias: true,
                    powerPreference: 'high-performance',
                    toneMapping: THREE.ACESFilmicToneMapping,
                    toneMappingExposure: isLight ? 1.0 : 1.1
                  }}
                  shadows
                >
                  {/* Natural environment lighting map for soft organic reflections */}
                  <Environment preset="park" environmentIntensity={isLight ? 0.55 : 0.4} />

                  {/* 1. Primary Directional Sun Key Light with High-Resolution Soft Shadows */}
                  <directionalLight
                    position={[7, 12, 6]}
                    intensity={isLight ? 2.3 : 1.9}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                    shadow-camera-near={1}
                    shadow-camera-far={22}
                    shadow-camera-left={-4.5}
                    shadow-camera-right={4.5}
                    shadow-camera-top={4.5}
                    shadow-camera-bottom={-4.5}
                    shadow-bias={-0.0003}
                    shadow-normalBias={0.02}
                    color={isLight ? '#fffdf2' : '#fff5e0'}
                  />

                  {/* 2. Hemisphere Light: Natural sky dome and ground bounce light wrap */}
                  <hemisphereLight
                    args={[
                      isLight ? '#d9efff' : '#a8d7f7',
                      isLight ? '#d5e8d2' : '#1e2d20',
                      isLight ? 0.8 : 0.55
                    ]}
                  />

                  {/* 3. Rim / Back Kick Light: Enhances 3D edges, roof frames, and glass separation */}
                  <directionalLight
                    position={[-7, 8, -6]}
                    intensity={isLight ? 0.9 : 1.3}
                    color={isLight ? '#a5cfb8' : '#68a88f'}
                  />

                  {/* 4. Soft Fill Light: Balances deep shadows without washing out contrast */}
                  <directionalLight
                    position={[-4, 3, 5]}
                    intensity={isLight ? 0.45 : 0.3}
                    color={isLight ? '#e2f0e4' : '#5f8069'}
                  />

                  {/* 5. Subtle Ambient Foundation */}
                  <ambientLight intensity={isLight ? 0.3 : 0.2} color="#e6f5ea" />

                  <Float speed={0.8} rotationIntensity={0.07} floatIntensity={0.09}>
                    <GreenhouseModel
                      ventOpen={ventOpen}
                      pumpActive={pumpActive}
                      soilMoisture={soilMoisture}
                      theme={theme}
                    />
                  </Float>

                  {/* Ground Contact Shadow */}
                  <ContactShadows
                    position={[0, -0.65, 0]}
                    opacity={isLight ? 0.45 : 0.7}
                    scale={7.5}
                    blur={2.0}
                    far={4.0}
                    color={isLight ? '#182b1d' : '#030804'}
                  />

                  <OrbitControls
                    enableZoom={true}
                    minDistance={2.8}
                    maxDistance={8.0}
                    maxPolarAngle={Math.PI / 2.05}
                  />
                </Canvas>
              </Suspense>
            </div>

            <div className={`px-4 py-2.5 border-t backdrop-blur flex items-center justify-between text-xs transition-colors ${isLight
              ? 'border-[#d2e0d5] bg-[#ffffff]/90 text-[#3d5440]'
              : 'border-[#18201a] bg-[#0e120f]/90 text-[#8c9c8e]'
              }`}>
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <Activity className={`w-3.5 h-3.5 ${isLight ? 'text-[#2a7a3b]' : 'text-[#7aa57f]'}`} />
                <span className="truncate max-w-[200px] sm:max-w-xs">{lastAction}</span>
              </div>
              <div className={`text-[11px] font-mono ${isLight ? 'text-[#506c54]' : 'text-[#5b6e5d]'}`}>
                VENTILASI: {ventOpen ? 'TERBUKA' : 'TERTUTUP'} | IRIGASI: {pumpActive ? 'AKTIF' : 'IDLE'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry & Controls */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Temperature */}
            <div className={`p-3.5 rounded-xl border backdrop-blur relative overflow-hidden transition-all ${isLight
              ? 'border-[#d6e3d8] bg-[#ffffff]/90 hover:border-[#b0ceb5] shadow-sm'
              : 'border-[#1e2520] bg-[#101311]/90 hover:border-[#2b372d]'
              }`}>
              <div className={`flex items-center justify-between mb-1.5 ${isLight ? 'text-[#506853]' : 'text-[#7d8f7e]'}`}>
                <span className="text-[10px] font-mono uppercase tracking-wider">TEMPERATURE</span>
                <Thermometer className="w-3.5 h-3.5 text-[#d97706]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl sm:text-3xl font-light tracking-tight font-mono ${isLight ? 'text-[#16291a]' : 'text-[#eff3ed]'
                  }`}>
                  {temperature !== null && temperature !== undefined ? temperature : '-'}
                </span>
                {temperature !== null && temperature !== undefined && (
                  <span className={`text-xs ${isLight ? 'text-[#586e5b]' : 'text-[#7e8d7f]'}`}>°C</span>
                )}
              </div>
              <p className={`text-[10px] mt-1 font-mono ${isLight ? 'text-[#4e6b52]' : 'text-[#556957]'}`}>
                {temperature !== null ? (
                  <span className={temperature > 35.0 ? 'text-[#d97706] font-medium' : (isLight ? 'text-[#16a34a] font-medium' : 'text-[#72a87a]')}>
                    {temperature > 35.0 ? 'SUHU > 35.0°C (VENTILASI BUKA)' : 'SUHU <= 34.0°C (VENTILASI TUTUP)'}
                  </span>
                ) : (
                  '-'
                )}
              </p>
            </div>

            {/* Soil Moisture */}
            <div className={`p-3.5 rounded-xl border backdrop-blur relative overflow-hidden transition-all ${isLight
              ? 'border-[#d6e3d8] bg-[#ffffff]/90 hover:border-[#b0ceb5] shadow-sm'
              : 'border-[#1e2520] bg-[#101311]/90 hover:border-[#2b372d]'
              }`}>
              <div className={`flex items-center justify-between mb-1.5 ${isLight ? 'text-[#506853]' : 'text-[#7d8f7e]'}`}>
                <span className="text-[10px] font-mono uppercase tracking-wider">SOIL MOISTURE</span>
                <Droplets className="w-3.5 h-3.5 text-[#0284c7]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl sm:text-3xl font-light tracking-tight font-mono ${isLight ? 'text-[#16291a]' : 'text-[#eff3ed]'
                  }`}>
                  {soilMoisture !== null && soilMoisture !== undefined ? soilMoisture : '-'}
                </span>
                {soilMoisture !== null && soilMoisture !== undefined && (
                  <span className={`text-xs ${isLight ? 'text-[#586e5b]' : 'text-[#7e8d7f]'}`}>%</span>
                )}
              </div>
              <p className={`text-[10px] mt-1 font-mono ${isLight ? 'text-[#4e6b52]' : 'text-[#556957]'}`}>
                {adcTanah !== null ? (
                  <span className={adcTanah > 2700 ? 'text-[#dc2626] font-medium' : (isLight ? 'text-[#16a34a] font-medium' : 'text-[#72a87a]')}>
                    {adcTanah > 2700 ? `ADC: ${adcTanah} — KERING (POMPA ON)` : `ADC: ${adcTanah} — LEMBAP`}
                  </span>
                ) : (
                  <span>-</span>
                )}
              </p>
            </div>

            {/* Air Humidity */}
            <div className={`p-3.5 rounded-xl border backdrop-blur relative overflow-hidden transition-all ${isLight
              ? 'border-[#d6e3d8] bg-[#ffffff]/90 hover:border-[#b0ceb5] shadow-sm'
              : 'border-[#1e2520] bg-[#101311]/90 hover:border-[#2b372d]'
              }`}>
              <div className={`flex items-center justify-between mb-1.5 ${isLight ? 'text-[#506853]' : 'text-[#7d8f7e]'}`}>
                <span className="text-[10px] font-mono uppercase tracking-wider">AIR HUMIDITY</span>
                <Wind className={`w-3.5 h-3.5 ${isLight ? 'text-[#3b82f6]' : 'text-[#9cb094]'}`} />
              </div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl sm:text-3xl font-light tracking-tight font-mono ${isLight ? 'text-[#16291a]' : 'text-[#eff3ed]'
                  }`}>
                  {humidity !== null && humidity !== undefined ? humidity : '-'}
                </span>
                {humidity !== null && humidity !== undefined && (
                  <span className={`text-xs ${isLight ? 'text-[#586e5b]' : 'text-[#7e8d7f]'}`}>%</span>
                )}
              </div>
              <p className={`text-[10px] mt-1 font-mono ${isLight ? 'text-[#4e6b52]' : 'text-[#556957]'}`}>
                {humidity !== null && humidity !== undefined ? 'DHT22: VAPOR STABLE' : '-'}
              </p>
            </div>

            {/* Controller Status */}
            <div className={`p-3.5 rounded-xl border backdrop-blur relative overflow-hidden transition-all ${isLight
              ? 'border-[#d6e3d8] bg-[#ffffff]/90 hover:border-[#b0ceb5] shadow-sm'
              : 'border-[#1e2520] bg-[#101311]/90 hover:border-[#2b372d]'
              }`}>
              <div className={`flex items-center justify-between mb-1.5 ${isLight ? 'text-[#506853]' : 'text-[#7d8f7e]'}`}>
                <span className="text-[10px] font-mono uppercase tracking-wider">CONTROLLER</span>
                <Cpu className={`w-3.5 h-3.5 ${isLight ? 'text-[#15803d]' : 'text-[#98b390]'}`} />
              </div>
              <div className="flex items-baseline justify-between gap-1">
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg sm:text-xl font-light tracking-tight font-mono ${isLight ? 'text-[#16291a]' : 'text-[#cad6c8]'
                    }`}>
                    ESP32
                  </span>
                  <span className={`text-[10px] ml-1 ${isLight ? 'text-[#5f7461]' : 'text-[#6b7b6c]'}`}>WROOM</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setTempIpInput(espIp); setIpTestResult(null); setIsIpModalOpen(true); }}
                  className={`text-[9px] font-mono px-2 py-0.5 rounded border cursor-pointer transition-colors ${isLight
                    ? 'bg-[#edf5ee] border-[#c0dac4] text-[#285731] hover:bg-[#dcefe0]'
                    : 'bg-[#161e17] border-[#243326] text-[#8ca38f] hover:bg-[#202c22]'
                    }`}
                >
                  Ubah IP
                </button>
              </div>
              <p className={`text-[10px] mt-1 font-mono flex items-center gap-1.5 ${espConnected
                ? (isLight ? 'text-[#15803d]' : 'text-[#6a946e]')
                : (isLight ? 'text-[#b45309]' : 'text-[#d97706]')
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${espConnected ? 'bg-[#16a34a] animate-ping' : 'bg-[#f59e0b]'
                  }`}></span>
                {espConnected
                  ? 'REST API: LIVE SYNC (/api/data)'
                  : 'OFFLINE (MENUNGGU ESP32)'}
              </p>
              <div className={`text-[9px] mt-1 font-mono truncate ${isLight ? 'text-[#68826c]' : 'text-[#627564]'}`}>
                Hotspot • IP: {espIp}
              </div>
            </div>
          </div>

          {/* Actuators Control Deck */}
          <div className={`p-4 sm:p-5 rounded-2xl border backdrop-blur flex flex-col gap-4 transition-all ${isLight
            ? 'border-[#d3e2d6] bg-[#ffffff]/95 shadow-md'
            : 'border-[#212a22] bg-[#101411]/95 shadow-xl'
            }`}>
            <div className={`flex items-center justify-between border-b pb-2.5 ${isLight ? 'border-[#e0ece2]' : 'border-[#18211b]'
              }`}>
              <div>
                <h3 className={`text-xs sm:text-sm font-medium tracking-wide flex items-center gap-2 ${isLight ? 'text-[#192b1d]' : 'text-[#d9e2d7]'
                  }`}>
                  <Sliders className={`w-3.5 h-3.5 ${isLight ? 'text-[#256333]' : 'text-[#86a88b]'}`} />
                  PHYSICAL ACTUATOR STACK
                </h3>
                <p className={`text-[11px] ${isLight ? 'text-[#5e7461]' : 'text-[#6a796b]'}`}>
                  Hinged roof ventilation servos & micro-droplet irrigation
                </p>
              </div>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${isLight
                ? 'bg-[#edf5ee] border-[#c0dac4] text-[#285731]'
                : 'bg-[#161e17] border-[#243326] text-[#8ca38f]'
                }`}>
                GPIO OUTPUT
              </span>
            </div>

            {/* Servo Sliding Roof Ventilation (Logika Terbuka / Tertutup Geser ke Bawah) */}
            <div className={`p-3.5 rounded-xl border flex flex-col gap-3 transition-all ${isLight
              ? 'bg-[#f8faf8] border-[#d7e4d9]'
              : 'bg-[#131814] border-[#222c24]'
              }`}>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${ventOpen
                    ? (isLight ? 'bg-[#fef3c7] border-[#f59e0b] text-[#b45309]' : 'bg-[#292212] border-[#78541a] text-[#fcd34d]')
                    : (isLight ? 'bg-[#eef2ef] border-[#cbd8ce] text-[#556957]' : 'bg-[#181d19] border-[#252f27] text-[#69796b]')
                    }`}>
                    <Wind className="w-4 h-4" />
                  </div>
                  <div>
                    <div className={`text-xs font-medium flex items-center gap-2 ${isLight ? 'text-[#1d3321]' : 'text-[#dce5dc]'}`}>
                      <span>Ventilasi Atap Geser</span>
                    </div>
                    <div className={`text-[10px] ${isLight ? 'text-[#5d7360]' : 'text-[#6b7b6c]'}`}>
                      Status Mekanikal: <span className="font-mono font-medium">{ventOpen ? 'TERBUKA' : 'TERTUTUP RAPAT'}</span>
                    </div>
                  </div>
                </div>

                <span className={`font-mono text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${ventOpen
                  ? (isLight ? 'bg-[#eaf7ec] border-[#9ed4a6] text-[#1c662d] font-semibold' : 'bg-[#162719] border-[#2f5535] text-[#90d99a] font-semibold')
                  : (isLight ? 'bg-[#f1f4f1] border-[#d2ded4] text-[#627364]' : 'bg-[#161a17] border-[#242b25] text-[#788579]')
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${ventOpen ? 'bg-[#22c55e] animate-pulse' : 'bg-[#64748b]'}`} />
                  {ventOpen ? 'TERBUKA' : 'TERTUTUP'}
                </span>
              </div>

              {/* Selector Tombol Tutup & Buka */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setVentState(false)}
                  className={`py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${!ventOpen
                    ? (isLight
                      ? 'bg-[#ffffff] border-[#9ebda3] text-[#1b3d20] shadow-sm font-semibold'
                      : 'bg-[#1f2821] border-[#3a4d3e] text-[#d6e5d8] shadow-sm font-semibold')
                    : (isLight
                      ? 'bg-[#edf2ee] border-transparent text-[#6f8272] hover:bg-[#e4ece5]'
                      : 'bg-[#121613] border-transparent text-[#627063] hover:bg-[#181d19]')
                    }`}
                >
                  <span>TUTUP</span>
                  {!ventOpen && <span className="text-[10px] opacity-75">(Aktif)</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setVentState(true)}
                  className={`py-2 px-3 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${ventOpen
                    ? (isLight
                      ? 'bg-[#2b723f] border-[#235f34] text-white shadow-[0_2px_10px_rgba(43,114,63,0.35)] font-semibold'
                      : 'bg-[#294c30] border-[#3d6e47] text-[#c9f1ce] shadow-[0_2px_10px_rgba(35,80,45,0.4)] font-semibold')
                    : (isLight
                      ? 'bg-[#edf2ee] border-transparent text-[#6f8272] hover:bg-[#e4ece5]'
                      : 'bg-[#121613] border-transparent text-[#627063] hover:bg-[#181d19]')
                    }`}
                >
                  <span>BUKA</span>
                  {ventOpen && <span className="text-[10px] opacity-75">(Aktif)</span>}
                </button>
              </div>
            </div>

            {/* Water Pump */}
            <div className={`pt-2 border-t flex items-center justify-between ${isLight ? 'border-[#e0ece2]' : 'border-[#18211b]'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${pumpActive
                  ? (isLight ? 'bg-[#ddf6f4] border-[#38b2ac] text-[#0d7470]' : 'bg-[#182929] border-[#305757] text-[#71c9c9]')
                  : (isLight ? 'bg-[#f0f6f2] border-[#c7d9ca] text-[#4d6650]' : 'bg-[#121613] border-[#1e261f] text-[#657566]')
                  }`}>
                  <Droplets className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className={`text-xs font-medium ${isLight ? 'text-[#1a2e1e]' : 'text-[#d9e2d7]'}`}>
                    Pompa Air
                  </div>
                  <div className={`text-[10px] ${isLight ? 'text-[#5e7461]' : 'text-[#667567]'}`}>
                    5V DC Relay Actuator
                  </div>
                </div>
              </div>

              <button
                onClick={togglePump}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium tracking-wider uppercase border transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer ${pumpActive
                  ? (isLight
                    ? 'bg-[#ddf6f4] border-[#319795] text-[#0f766e] shadow-[0_0_12px_rgba(49,151,149,0.35)]'
                    : 'bg-[#1a3533] border-[#346863] text-[#7be3dc] shadow-[0_0_12px_rgba(50,110,105,0.3)]')
                  : (isLight
                    ? 'bg-[#f0f6f2] border-[#c7d9ca] text-[#2f5536] hover:border-[#9ec4a3]'
                    : 'bg-[#131714] border-[#222b23] text-[#819282] hover:border-[#2f3d31]')
                  }`}
              >
                <Power className="w-3 h-3" />
                <span>{pumpActive ? 'RUNNING' : 'ACTIVATE'}</span>
              </button>
            </div>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className={`relative z-10 border-t px-6 py-2.5 text-center text-[11px] font-mono transition-colors ${isLight ? 'border-[#dce5dd] text-[#6b826f]' : 'border-[#171c18] text-[#4c594d]'
        }`}>
        SMART GREENHOUSE IOT LAB • TELEMETRY & TWIN ACTUATION ENGINE
      </footer>

      {/* Modal Konfigurasi IP ESP32 REST API */}
      {isIpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl transition-all ${isLight ? 'bg-white border-[#d2ded4] text-[#1c2e20]' : 'bg-[#121613] border-[#253227] text-[#e1e9e2]'
            }`}>
            <div className="flex items-center justify-between pb-3 border-b mb-4">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-[#2b723f]" />
                <h3 className="font-medium text-sm">Pengaturan IP ESP32 (REST API)</h3>
              </div>
              <button
                onClick={() => { setIsIpModalOpen(false); setIpTestResult(null); }}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs mb-3 leading-relaxed ${isLight ? 'text-[#536856]' : 'text-[#879989]'}`}>
              ESP32 Anda telah terhubung ke Hotspot. Masukkan alamat IP yang tertera pada Serial Monitor Arduino IDE saat ESP32 pertama kali dinyalakan.
            </p>

            <div className="mb-4">
              <label className="block text-[11px] font-mono uppercase mb-1.5 opacity-80">
                Alamat IP / Hostname ESP32:
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={tempIpInput}
                  onChange={(e) => setTempIpInput(e.target.value)}
                  placeholder="Contoh: 192.168.43.150"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono outline-none transition-colors ${isLight
                    ? 'bg-[#f4f8f5] border-[#c4d6c7] focus:border-[#2b723f]'
                    : 'bg-[#181e19] border-[#29362c] focus:border-[#469c5c]'
                    }`}
                />
              </div>
              <span className={`text-[10px] mt-1 block font-mono ${isLight ? 'text-[#627765]' : 'text-[#6c7d6e]'}`}>
                Endpoint data: http://{tempIpInput.trim() || '...'}/api/data
              </span>
            </div>

            {ipTestResult && (
              <div className={`p-3 rounded-xl mb-4 text-xs font-mono border flex items-start gap-2 ${ipTestResult.success
                ? (isLight ? 'bg-[#eaf7ec] border-[#a5d8ad] text-[#1c642c]' : 'bg-[#162719] border-[#2c5332] text-[#93dc9d]')
                : (isLight ? 'bg-[#fef2f2] border-[#fecaca] text-[#b91c1c]' : 'bg-[#261414] border-[#4d2222] text-[#fca5a5]')
                }`}>
                {ipTestResult.success ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <X className="w-4 h-4 mt-0.5 shrink-0" />}
                <span className="leading-snug">{ipTestResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={handleTestIp}
                disabled={isTestingIp}
                className={`px-3 py-2 rounded-xl text-xs font-mono flex items-center gap-1.5 border transition-all cursor-pointer ${isLight
                  ? 'border-[#cbd9ce] hover:bg-[#edf4ee] text-[#294c30]'
                  : 'border-[#263529] hover:bg-[#1a231c] text-[#a5cca8]'
                  }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingIp ? 'animate-spin' : ''}`} />
                <span>{isTestingIp ? 'Menguji...' : 'Uji Koneksi'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveIp(tempIpInput)}
                className="px-4 py-2 rounded-xl text-xs font-mono font-medium bg-[#2b723f] hover:bg-[#235f34] text-white shadow-md transition-all cursor-pointer"
              >
                Simpan & Hubungkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
