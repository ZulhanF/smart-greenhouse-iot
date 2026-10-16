import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Float, ContactShadows } from '@react-three/drei';
import { GreenhouseModel } from './components/GreenhouseModel';
import { 
  Thermometer, 
  Droplets, 
  Wind, 
  Power, 
  RotateCw, 
  Sparkles, 
  Cpu, 
  SunMedium, 
  Activity, 
  ShieldCheck, 
  Radio, 
  Sliders 
} from 'lucide-react';

export default function App() {
  const [temperature, setTemperature] = useState(24.8);
  const [soilMoisture, setSoilMoisture] = useState(62);
  const [humidity, setHumidity] = useState(74);

  const [ventAngle, setVentAngle] = useState(25);
  const [pumpActive, setPumpActive] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [feedbackSound, setFeedbackSound] = useState(true);
  const [lastAction, setLastAction] = useState('All systems nominal');

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

  // Audio feedback synthesizer
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
      // Audio autoplay policy fallback
    }
  };

  const togglePump = () => {
    playTactileFeedback(380, 'triangle');
    setPumpActive(prev => {
      const next = !prev;
      setLastAction(next ? 'Sub-irrigation pump initiated' : 'Pump flow terminated');
      return next;
    });
  };

  const handleVentChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVentAngle(val);
    playTactileFeedback(val > ventAngle ? 480 : 320, 'sine');
    setLastAction(`Servo vent position set to ${val}°`);
  };

  return (
    <div className="min-h-screen bg-[#0d0f0d] text-[#e5eae3] flex flex-col font-sans selection:bg-[#344635] selection:text-[#a8e6b1]">
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(60,85,65,0.25),rgba(13,15,13,0))]" />

      {/* Top Bar: Editorial Header */}
      <header className="relative z-10 border-b border-[#202721] px-6 py-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md bg-[#0d0f0d]/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#1b231d] border border-[#2e3d31] flex items-center justify-center text-[#9ed3a5] shadow-inner">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold tracking-widest uppercase text-[#cad5c8]">
                AURA BIOSPHERE
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#1e261f] text-[#86a88b] border border-[#2b392d]">
                NODE-01 / LIVE
              </span>
            </div>
            <p className="text-xs text-[#7b897b]">Smart Microclimate & Actuator Lab</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button 
            onClick={() => setAutoMode(!autoMode)}
            className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 font-mono text-[11px] ${
              autoMode 
                ? 'bg-[#1b2b1e] border-[#38563c] text-[#a5e0ad]' 
                : 'bg-[#161916] border-[#262c26] text-[#7d8b7e]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AUTO REGULATION: {autoMode ? 'ON' : 'MANUAL'}</span>
          </button>

          <button 
            onClick={() => setFeedbackSound(!feedbackSound)}
            className="w-8 h-8 rounded-full border border-[#252c25] bg-[#141714] flex items-center justify-center text-[#86a88b] hover:border-[#384a3a] transition-colors"
            title="Toggle Tactile Audio"
          >
            <Sparkles className={`w-3.5 h-3.5 ${feedbackSound ? 'text-[#a5e0ad]' : 'opacity-40'}`} />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-w-7xl mx-auto w-full">
        
        {/* Left Column: 3D Twin Canvas */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative flex-1 min-h-[420px] lg:min-h-[500px] rounded-2xl border border-[#212922] bg-gradient-to-b from-[#131714] to-[#0e110e] overflow-hidden shadow-2xl flex flex-col">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
              <span className="text-[10px] font-mono tracking-wider uppercase text-[#738474] bg-[#121612]/80 backdrop-blur px-2.5 py-1 rounded-md border border-[#202721]">
                3D ACTUATOR TWIN • DRAG TO ROTATE
              </span>
            </div>

            <div className="w-full h-full flex-1 cursor-grab active:cursor-grabbing">
              <Canvas camera={{ position: [4.2, 3.2, 4.2], fov: 42 }}>
                <ambientLight intensity={0.9} />
                <directionalLight position={[6, 8, 4]} intensity={1.4} castShadow />
                <directionalLight position={[-6, 4, -4]} intensity={0.5} color="#85a38b" />
                <Environment preset="forest" />
                
                <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.2}>
                  <GreenhouseModel 
                    ventAngle={ventAngle} 
                    pumpActive={pumpActive} 
                    soilMoisture={soilMoisture} 
                  />
                </Float>

                <ContactShadows position={[0, -0.65, 0]} opacity={0.6} scale={7} blur={2.2} far={4} color="#050805" />
                <OrbitControls 
                  enableZoom={true} 
                  minDistance={3.5} 
                  maxDistance={8} 
                  maxPolarAngle={Math.PI / 2.05} 
                />
              </Canvas>
            </div>

            <div className="px-5 py-3 border-t border-[#1d241e] bg-[#111512]/90 backdrop-blur flex items-center justify-between text-xs text-[#8c9c8e]">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <Activity className="w-3.5 h-3.5 text-[#86a88b]" />
                <span>STATE: {lastAction}</span>
              </div>
              <div className="text-[11px] font-mono text-[#5f6f60]">
                SERVO: {ventAngle}° | PUMP: {pumpActive ? '100% FLOW' : 'OFF'}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Telemetry & Controls */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3.5">
            {/* Temp */}
            <div className="p-4 rounded-xl border border-[#212822] bg-[#121613]/90 backdrop-blur relative overflow-hidden group hover:border-[#2f3d31] transition-all">
              <div className="flex items-center justify-between text-[#7d8f7e] mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider">TEMPERATURE</span>
                <Thermometer className="w-4 h-4 text-[#e0a877]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-light tracking-tight text-[#f0f4ee] font-mono">
                  {temperature}
                </span>
                <span className="text-sm text-[#7e8d7f]">°C</span>
              </div>
              <p className="text-[10px] text-[#5e7060] mt-1.5 flex items-center gap-1 font-mono">
                <span>IDEAL: 22 - 27°C</span>
              </p>
            </div>

            {/* Moisture */}
            <div className="p-4 rounded-xl border border-[#212822] bg-[#121613]/90 backdrop-blur relative overflow-hidden group hover:border-[#2f3d31] transition-all">
              <div className="flex items-center justify-between text-[#7d8f7e] mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider">SOIL MOISTURE</span>
                <Droplets className="w-4 h-4 text-[#77c1e0]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-light tracking-tight text-[#f0f4ee] font-mono">
                  {soilMoisture}
                </span>
                <span className="text-sm text-[#7e8d7f]">%</span>
              </div>
              <p className="text-[10px] text-[#5e7060] mt-1.5 flex items-center gap-1 font-mono">
                <span className={soilMoisture < 40 ? 'text-[#d48b79]' : 'text-[#7bb083]'}>
                  {soilMoisture < 40 ? 'LOW — NEEDS WATER' : 'OPTIMAL LOAM'}
                </span>
              </p>
            </div>

            {/* Humidity */}
            <div className="p-4 rounded-xl border border-[#212822] bg-[#121613]/90 backdrop-blur relative overflow-hidden group hover:border-[#2f3d31] transition-all">
              <div className="flex items-center justify-between text-[#7d8f7e] mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider">AIR HUMIDITY</span>
                <Wind className="w-4 h-4 text-[#a3b899]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-light tracking-tight text-[#f0f4ee] font-mono">
                  {humidity}
                </span>
                <span className="text-sm text-[#7e8d7f]">%</span>
              </div>
              <p className="text-[10px] text-[#5e7060] mt-1.5 font-mono">VAPOR: BALANCED</p>
            </div>

            {/* Controller */}
            <div className="p-4 rounded-xl border border-[#212822] bg-[#121613]/90 backdrop-blur relative overflow-hidden group hover:border-[#2f3d31] transition-all">
              <div className="flex items-center justify-between text-[#7d8f7e] mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider">CONTROLLER</span>
                <Cpu className="w-4 h-4 text-[#9fb896]" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-light tracking-tight text-[#cad6c8] font-mono">
                  ESP32
                </span>
                <span className="text-[10px] text-[#6b7b6c] ml-1">v4.4</span>
              </div>
              <p className="text-[10px] text-[#719975] mt-1.5 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#719975] inline-block animate-ping"></span>
                LATENCY: 12ms
              </p>
            </div>
          </div>

          {/* Actuators Control Deck */}
          <div className="p-5 rounded-2xl border border-[#242d25] bg-[#121613]/95 backdrop-blur flex flex-col gap-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1c241e] pb-3">
              <div>
                <h3 className="text-sm font-medium text-[#d9e2d7] tracking-wide flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#86a88b]" />
                  PHYSICAL ACTUATOR STACK
                </h3>
                <p className="text-xs text-[#6e7d6f]">Direct override for MG996R servo & diaphragm pump</p>
              </div>
              <span className="text-[10px] font-mono text-[#8ca38f] bg-[#1a221b] border border-[#28362a] px-2 py-0.5 rounded">
                GPIO READY
              </span>
            </div>

            {/* Servo Ventilation */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#a4b5a3] font-medium flex items-center gap-2">
                  <SunMedium className="w-4 h-4 text-[#c29e64]" />
                  Ventilation Servo Roof Angle
                </span>
                <span className="font-mono text-[#e5eae3] bg-[#18201a] px-2 py-0.5 rounded border border-[#2b382d]">
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
                className="w-full h-2 bg-[#1b221c] rounded-lg appearance-none cursor-pointer accent-[#7ca380] hover:accent-[#9dc7a1] transition-all"
              />

              <div className="flex justify-between text-[10px] font-mono text-[#5c6e5e]">
                <span>0° (Hermetic Seal)</span>
                <span>45° (Breeze)</span>
                <span>90° (Full Purge)</span>
              </div>
            </div>

            {/* Water Pump */}
            <div className="pt-2 border-t border-[#1c241e] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                  pumpActive 
                    ? 'bg-[#1b2b2b] border-[#376363] text-[#78d0d0]' 
                    : 'bg-[#151a16] border-[#252f26] text-[#6b7b6c]'
                }`}>
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-medium text-[#d9e2d7]">Sub-irrigation Pump</div>
                  <div className="text-[11px] text-[#6e7d6f]">12V DC Relay Actuator</div>
                </div>
              </div>

              <button
                onClick={togglePump}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-medium tracking-wider uppercase border transition-all flex items-center gap-2 shadow-md active:scale-95 ${
                  pumpActive
                    ? 'bg-[#1e3b38] border-[#3c7872] text-[#86e4dc] shadow-[0_0_15px_rgba(60,120,114,0.3)]'
                    : 'bg-[#171c18] border-[#29342a] text-[#869787] hover:border-[#38493a]'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{pumpActive ? 'RUNNING' : 'ACTIVATE'}</span>
              </button>
            </div>
          </div>

          {/* Quick Actuator Presets */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#1e261f] bg-[#101411]/80 text-xs">
            <span className="text-[#7d8f7e] font-mono text-[11px]">PRESET ROUTINES:</span>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setVentAngle(65);
                  setPumpActive(true);
                  playTactileFeedback(440);
                  setLastAction('Morning Dew Cycle initiated');
                }}
                className="px-2.5 py-1 rounded bg-[#18201a] border border-[#2b392d] hover:border-[#425945] text-[#9db59f] text-[11px] transition-colors"
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
                className="px-2.5 py-1 rounded bg-[#18201a] border border-[#2b392d] hover:border-[#425945] text-[#9db59f] text-[11px] transition-colors"
              >
                Nocturnal Rest
              </button>
            </div>
          </div>
        </div>

      </main>

      <footer className="relative z-10 border-t border-[#1a201b] px-6 py-3 text-center text-xs text-[#526053] font-mono">
        SMART GREENHOUSE IOT LAB • TELEMETRY & TWIN ACTUATION ENGINE
      </footer>
    </div>
  );
}
