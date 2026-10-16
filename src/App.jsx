import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Float, ContactShadows, useProgress } from '@react-three/drei';
import { GreenhouseModel } from './components/GreenhouseModel';
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Power, 
  Sparkles, 
  Cpu, 
  SunMedium, 
  Activity, 
  ShieldCheck, 
  Radio, 
  Sliders
} from 'lucide-react';

function CanvasLoader() {
  const { progress } = useProgress();
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0d0f0d]/90 backdrop-blur-md">
      <div className="w-10 h-10 rounded-full border-2 border-[#202b22] border-t-[#87ca92] animate-spin mb-3" />
      <span className="text-[11px] font-mono tracking-widest uppercase text-[#9eb29c]">
        CALIBRATING 3D MODEL
      </span>
      <span className="text-[10px] font-mono text-[#5f7461] mt-1">
        {Math.round(progress)}% LOADED
      </span>
    </div>
  );
}

export default function App() {
  const [temperature, setTemperature] = useState(24.8);
  const [soilMoisture, setSoilMoisture] = useState(62);
  const [humidity, setHumidity] = useState(74);

  const [ventAngle, setVentAngle] = useState(25);
  const [pumpActive, setPumpActive] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [feedbackSound, setFeedbackSound] = useState(true);
  const [lastAction, setLastAction] = useState('Biosphere calibrated & nominal');

  // Ambient sensor drift simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setTemperature(prev => {
        const cooling = (ventAngle / 90) * 0.15;
        const drift = (Math.random() - 0.48) * 0.1;
        const next = Math.max(18, Math.min(38, prev - cooling + drift));
        return parseFloat(next.toFixed(1));
      });

      setSoilMoisture(prev => {
        if (pumpActive) {
          return Math.min(95, prev + 2);
        }
        const dryRate = 0.05;
        return Math.max(20, parseFloat((prev - dryRate).toFixed(1)));
      });

      setHumidity(prev => {
        const drift = (Math.random() - 0.5) * 0.4;
        return Math.round(Math.max(40, Math.min(90, prev + drift)));
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [ventAngle, pumpActive]);

  // Tactile audio feedback
  const playTactileFeedback = (freq = 420, type = 'sine') => {
    if (!feedbackSound) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch (e) {
      // Audio fallback
    }
  };

  const togglePump = () => {
    playTactileFeedback(380, 'triangle');
    setPumpActive(prev => {
      const next = !prev;
      setLastAction(next ? 'Sub-irrigation pump activated (12V Relay ON)' : 'Pump cycle closed');
      return next;
    });
  };

  const handleVentChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVentAngle(val);
    playTactileFeedback(val > ventAngle ? 480 : 320, 'sine');
    setLastAction(`Servo vent position adjusted to ${val}°`);
  };

  return (
    <div className="min-h-screen bg-[#0b0d0c] text-[#e3e8e2] flex flex-col font-sans selection:bg-[#344635] selection:text-[#a8e6b1]">
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(60,85,65,0.22),rgba(11,13,12,0))]" />

      {/* Top Bar */}
      <header className="relative z-10 border-b border-[#1c221e] px-4 sm:px-7 py-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md bg-[#0b0d0c]/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#161d18] border border-[#263529] flex items-center justify-center text-[#9ed3a5] shadow-inner">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-medium tracking-widest uppercase text-[#cad5c8]">
                AURA BIOSPHERE
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#18201a] text-[#86a88b] border border-[#263628]">
                NODE-01 / LIVE
              </span>
            </div>
            <p className="text-[11px] text-[#6d7c6e]">Smart Microclimate & Actuation Lab</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 text-xs">
          <button 
            onClick={() => setAutoMode(!autoMode)}
            className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 font-mono text-[11px] ${
              autoMode 
                ? 'bg-[#18261b] border-[#304d34] text-[#a0dcab]' 
                : 'bg-[#141715] border-[#222723] text-[#758276]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>REGULATION: {autoMode ? 'AUTO' : 'MANUAL'}</span>
          </button>

          <button 
            onClick={() => setFeedbackSound(!feedbackSound)}
            className="w-8 h-8 rounded-full border border-[#212722] bg-[#121513] flex items-center justify-center text-[#86a88b] hover:border-[#324233] transition-colors"
            title="Toggle Tactile Audio"
          >
            <Sparkles className={`w-3.5 h-3.5 ${feedbackSound ? 'text-[#a5e0ad]' : 'opacity-40'}`} />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        
        {/* Left Column: 3D Twin Canvas */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative flex-1 min-h-[380px] lg:min-h-[480px] rounded-2xl border border-[#1e2520] bg-gradient-to-b from-[#111512] to-[#0c0e0c] overflow-hidden shadow-2xl flex flex-col">
            
            <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2 pointer-events-none">
              <span className="text-[10px] font-mono tracking-wider uppercase text-[#738474] bg-[#111512]/85 backdrop-blur px-2.5 py-1 rounded-md border border-[#1c241e]">
                3D DIGITAL TWIN • TOUCH & DRAG TO INSPECT
              </span>
            </div>

            <div className="w-full h-full flex-1 cursor-grab active:cursor-grabbing relative">
              <Suspense fallback={<CanvasLoader />}>
                <Canvas 
                  camera={{ position: [3.8, 2.8, 3.8], fov: 42 }}
                  dpr={[1, 1.5]}
                  gl={{ antialias: true, powerPreference: 'high-performance' }}
                >
                  <ambientLight intensity={0.95} />
                  <directionalLight position={[5, 7, 4]} intensity={1.3} />
                  <directionalLight position={[-5, 3, -4]} intensity={0.4} color="#75937a" />
                  
                  <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.15}>
                    <GreenhouseModel 
                      ventAngle={ventAngle} 
                      pumpActive={pumpActive} 
                      soilMoisture={soilMoisture} 
                    />
                  </Float>

                  <ContactShadows position={[0, -0.65, 0]} opacity={0.5} scale={6.5} blur={2.0} far={3.5} color="#040604" />
                  <OrbitControls 
                    enableZoom={true} 
                    minDistance={3.0} 
                    maxDistance={7.5} 
                    maxPolarAngle={Math.PI / 2.05} 
                  />
                </Canvas>
              </Suspense>
            </div>

            <div className="px-4 py-2.5 border-t border-[#18201a] bg-[#0e120f]/90 backdrop-blur flex items-center justify-between text-xs text-[#8c9c8e]">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <Activity className="w-3.5 h-3.5 text-[#7aa57f]" />
                <span className="truncate max-w-[200px] sm:max-w-xs">{lastAction}</span>
              </div>
              <div className="text-[11px] font-mono text-[#5b6e5d]">
                VENT: {ventAngle}° | FLOW: {pumpActive ? 'ACTIVE' : 'IDLE'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry & Controls */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Temp */}
            <div className="p-3.5 rounded-xl border border-[#1e2520] bg-[#101311]/90 backdrop-blur relative overflow-hidden group hover:border-[#2b372d] transition-all">
              <div className="flex items-center justify-between text-[#7d8f7e] mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider">TEMPERATURE</span>
                <Thermometer className="w-3.5 h-3.5 text-[#deb087]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-light tracking-tight text-[#eff3ed] font-mono">
                  {temperature}
                </span>
                <span className="text-xs text-[#7e8d7f]">°C</span>
              </div>
              <p className="text-[10px] text-[#556957] mt-1 font-mono">OPTIMAL: 22.0 - 26.5°C</p>
            </div>

            {/* Moisture */}
            <div className="p-3.5 rounded-xl border border-[#1e2520] bg-[#101311]/90 backdrop-blur relative overflow-hidden group hover:border-[#2b372d] transition-all">
              <div className="flex items-center justify-between text-[#7d8f7e] mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider">SOIL MOISTURE</span>
                <Droplets className="w-3.5 h-3.5 text-[#7bc9eb]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-light tracking-tight text-[#eff3ed] font-mono">
                  {soilMoisture}
                </span>
                <span className="text-xs text-[#7e8d7f]">%</span>
              </div>
              <p className="text-[10px] text-[#556957] mt-1 font-mono">
                <span className={soilMoisture < 40 ? 'text-[#d48b79]' : 'text-[#72a87a]'}>
                  {soilMoisture < 40 ? 'DRY — TRIGGER WATER' : 'OPTIMAL LOAM'}
                </span>
              </p>
            </div>

            {/* Humidity */}
            <div className="p-3.5 rounded-xl border border-[#1e2520] bg-[#101311]/90 backdrop-blur relative overflow-hidden group hover:border-[#2b372d] transition-all">
              <div className="flex items-center justify-between text-[#7d8f7e] mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider">AIR HUMIDITY</span>
                <Wind className="w-3.5 h-3.5 text-[#9cb094]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl sm:text-3xl font-light tracking-tight text-[#eff3ed] font-mono">
                  {humidity}
                </span>
                <span className="text-xs text-[#7e8d7f]">%</span>
              </div>
              <p className="text-[10px] text-[#556957] mt-1 font-mono">VAPOR DENSITY: BALANCED</p>
            </div>

            {/* Controller */}
            <div className="p-3.5 rounded-xl border border-[#1e2520] bg-[#101311]/90 backdrop-blur relative overflow-hidden group hover:border-[#2b372d] transition-all">
              <div className="flex items-center justify-between text-[#7d8f7e] mb-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider">CONTROLLER</span>
                <Cpu className="w-3.5 h-3.5 text-[#98b390]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg sm:text-xl font-light tracking-tight text-[#cad6c8] font-mono">
                  ESP32
                </span>
                <span className="text-[10px] text-[#6b7b6c] ml-1">WROOM</span>
              </div>
              <p className="text-[10px] text-[#6a946e] mt-1 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#6a946e] inline-block animate-ping"></span>
                LINK: 11ms
              </p>
            </div>
          </div>

          {/* Actuators Control Deck */}
          <div className="p-4 sm:p-5 rounded-2xl border border-[#212a22] bg-[#101411]/95 backdrop-blur flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#18211b] pb-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-[#d9e2d7] tracking-wide flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#86a88b]" />
                  PHYSICAL ACTUATOR STACK
                </h3>
                <p className="text-[11px] text-[#6a796b]">Precise servo ventilation & diaphragm pump</p>
              </div>
              <span className="text-[9px] font-mono text-[#8ca38f] bg-[#161e17] border border-[#243326] px-2 py-0.5 rounded">
                GPIO OUTPUT
              </span>
            </div>

            {/* Servo Ventilation */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a4b5a3] font-medium flex items-center gap-2 text-xs">
                  <SunMedium className="w-3.5 h-3.5 text-[#c29e64]" />
                  Servo Roof Ventilation Angle
                </span>
                <span className="font-mono text-[#e5eae3] bg-[#151c16] px-2 py-0.5 rounded border border-[#263328] text-xs">
                  {ventAngle}° / 90°
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={ventAngle}
                onChange={handleVentChange}
                className="w-full h-2 bg-[#171f18] rounded-lg appearance-none cursor-pointer accent-[#769e7a] hover:accent-[#94be98] transition-all"
              />

              <div className="flex justify-between text-[10px] font-mono text-[#526354]">
                <span>0° (Sealed)</span>
                <span>45° (Mid-Flow)</span>
                <span>90° (Full Purge)</span>
              </div>
            </div>

            {/* Water Pump */}
            <div className="pt-2 border-t border-[#18211b] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                  pumpActive 
                    ? 'bg-[#182929] border-[#305757] text-[#71c9c9]' 
                    : 'bg-[#121613] border-[#1e261f] text-[#657566]'
                }`}>
                  <Droplets className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-medium text-[#d9e2d7]">Sub-irrigation Pump</div>
                  <div className="text-[10px] text-[#667567]">12V DC Relay Actuator</div>
                </div>
              </div>

              <button
                onClick={togglePump}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium tracking-wider uppercase border transition-all flex items-center gap-1.5 shadow-md active:scale-95 ${
                  pumpActive
                    ? 'bg-[#1a3533] border-[#346863] text-[#7be3dc] shadow-[0_0_12px_rgba(50,110,105,0.3)]'
                    : 'bg-[#131714] border-[#222b23] text-[#819282] hover:border-[#2f3d31]'
                }`}
              >
                <Power className="w-3 h-3" />
                <span>{pumpActive ? 'RUNNING' : 'ACTIVATE'}</span>
              </button>
            </div>
          </div>

          {/* Quick Actuator Presets */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[#1b221d] bg-[#0e120f]/80 text-xs">
            <span className="text-[#728373] font-mono text-[10px]">PRESETS:</span>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setVentAngle(65);
                  setPumpActive(true);
                  playTactileFeedback(440);
                  setLastAction('Morning Dew Cycle initiated');
                }}
                className="px-2.5 py-1 rounded bg-[#141b15] border border-[#243026] hover:border-[#384b3b] text-[#93ab95] text-[11px] transition-colors"
              >
                Morning Dew
              </button>
              <button 
                onClick={() => {
                  setVentAngle(10);
                  setPumpActive(false);
                  playTactileFeedback(300);
                  setLastAction('Nocturnal Conservation set');
                }}
                className="px-2.5 py-1 rounded bg-[#141b15] border border-[#243026] hover:border-[#384b3b] text-[#93ab95] text-[11px] transition-colors"
              >
                Nocturnal Rest
              </button>
            </div>
          </div>
        </div>

      </main>

      <footer className="relative z-10 border-t border-[#171c18] px-6 py-2.5 text-center text-[11px] text-[#4c594d] font-mono">
        SMART GREENHOUSE IOT LAB • TELEMETRY & TWIN ACTUATION ENGINE
      </footer>
    </div>
  );
}
