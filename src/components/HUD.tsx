import { Gauge, MapPin, Sparkles, Building2, Shield, Mountain, Tag, Camera, CloudSun, Volume2, VolumeX } from 'lucide-react';
import type { CarState, WeatherMode } from '@/types/game';

export type CameraMode = 'chase' | 'topdown' | 'sky' | 'bonnet';

export const CAMERA_CONFIG: Record<
  CameraMode,
  { pitch: number; zoom: number; label: string }
> = {
  chase: { pitch: 70, zoom: 16.8, label: '3인칭 드라이빙' },
  topdown: { pitch: 58, zoom: 16.2, label: '탑다운 조감도' },
  sky: { pitch: 35, zoom: 15.2, label: '스카이뷰' },
  bonnet: { pitch: 73, zoom: 17.5, label: '1인칭 보닛' },
};

export const CAMERA_MODES: CameraMode[] = ['chase', 'topdown', 'sky', 'bonnet'];

export const TERRAIN_LEVELS = [
  { value: 0, label: '0x (평지)' },
  { value: 1.0, label: '1x (실제)' },
  { value: 1.9, label: '1.9x (표준)' },
  { value: 3.5, label: '3.5x (높음)' },
  { value: 5.0, label: '5x (극대)' },
];

interface Props {
  car: CarState;
  locationLabel: string;
  weather: WeatherMode;
  showBuildings: boolean;
  enableCollision: boolean;
  showLabels: boolean;
  terrainScale: number;
  cameraMode: CameraMode;
  isLiveWeather: boolean;
  isMuted: boolean;
  liveWeatherDesc?: string;
  onWeatherChange: (w: WeatherMode) => void;
  onToggleBuildings: (show: boolean) => void;
  onToggleCollision: (enable: boolean) => void;
  onToggleLabels: (show: boolean) => void;
  onTerrainScaleChange: (scale: number) => void;
  onToggleCameraMode: (mode: CameraMode) => void;
  onToggleLiveWeather: () => void;
  onToggleMute: () => void;
  onReset: () => void;
}

const WEATHERS: { id: WeatherMode; label: string; icon: string }[] = [
  { id: 'day', label: '맑음', icon: '☀' },
  { id: 'night', label: '밤', icon: '☾' },
  { id: 'rain', label: '비', icon: '☂' },
  { id: 'snow', label: '눈', icon: '❄' },
];

export default function HUD({
  car,
  locationLabel,
  weather,
  showBuildings,
  enableCollision,
  showLabels,
  terrainScale,
  cameraMode,
  isLiveWeather,
  isMuted,
  liveWeatherDesc,
  onWeatherChange,
  onToggleBuildings,
  onToggleCollision,
  onToggleLabels,
  onTerrainScaleChange,
  onToggleCameraMode,
  onToggleLiveWeather,
  onToggleMute,
  onReset,
}: Props) {
  const speed = Math.abs(Math.round(car.speed));
  const gear = car.speed >= 0 ? 'D' : 'R';

  return (
    <>
      {/* Speedometer */}
      <div className="absolute bottom-4 left-4 z-50">
        <div className="rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl px-5 py-3 flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black text-white tracking-tight drop-shadow">
                {speed}
              </span>
              <span className="text-xs font-semibold text-slate-400">km/h</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                {gear}
              </span>
              <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-75"
                  style={{ width: `${Math.min(100, (speed / 420) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          {/* Turbo indicator */}
          <div
            className={`flex flex-col items-center justify-center px-2 py-1 rounded-lg transition-all duration-200 ${
              car.turbo
                ? 'bg-orange-500/30 border border-orange-400/50 scale-105'
                : 'bg-slate-800/50 border border-slate-700/50'
            }`}
          >
            <span
              className={`text-lg font-black tracking-tight ${
                car.turbo ? 'text-orange-400' : 'text-slate-600'
              }`}
            >
              TURBO
            </span>
            <span
              className={`text-[9px] ${
                car.turbo ? 'text-orange-300/80' : 'text-slate-600'
              }`}
            >
              Shift
            </span>
          </div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 z-50">
        <div className="rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl px-4 py-3">
          <div className="grid grid-cols-3 gap-1 text-center mb-2">
            <div></div>
            <kbd className="text-[10px] text-slate-300 bg-white/10 rounded px-1.5 py-1">
              W / ↑
            </kbd>
            <div></div>
            <kbd className="text-[10px] text-slate-300 bg-white/10 rounded px-1.5 py-1">
              A / ←
            </kbd>
            <kbd className="text-[10px] text-slate-300 bg-white/10 rounded px-1.5 py-1">
              S / ↓
            </kbd>
            <kbd className="text-[10px] text-slate-300 bg-white/10 rounded px-1.5 py-1">
              D / →
            </kbd>
          </div>
          <p className="text-[10px] text-slate-400 text-center font-medium">
            가속/감속/좌/우 · Shift 터보 · <kbd className="bg-white/10 px-1 rounded text-cyan-300">V</kbd> 시점변경
          </p>
        </div>
      </div>

      {/* Weather + reset */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 items-end">
        <div className="rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl p-1.5 flex gap-1 items-center">
          <button
            onClick={onToggleLiveWeather}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
              isLiveWeather
                ? 'bg-amber-500/25 border-amber-400/50 text-amber-300 shadow-md shadow-amber-500/20 animate-pulse'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="실시간 날씨 API 연동 (온도 및 시간대 자동 연동)"
          >
            <CloudSun className="h-3.5 w-3.5" />
            {isLiveWeather ? `실시간 ON ${liveWeatherDesc ? `(${liveWeatherDesc})` : ''}` : '실시간 날씨'}
          </button>
          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
          {WEATHERS.map((w) => (
            <button
              key={w.id}
              onClick={() => onWeatherChange(w.id)}
              title={w.label}
              className={`px-2.5 py-1.5 rounded-lg text-sm transition-all ${
                weather === w.id
                  ? 'bg-cyan-500/30 text-cyan-300 scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {w.icon}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const idx = CAMERA_MODES.indexOf(cameraMode);
              onToggleCameraMode(CAMERA_MODES[(idx + 1) % CAMERA_MODES.length]);
            }}
            className="rounded-xl bg-cyan-500/20 border border-cyan-400/40 shadow-xl px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-500/30 transition-all flex items-center gap-1.5 font-semibold select-none"
            title="V키 또는 클릭 시 카메라 뷰 시점 4단계 변경 (3인칭 Slow Roads, 탑다운, 스카이, 1인칭)"
          >
            <Camera className="h-3.5 w-3.5 text-cyan-300" />
            {CAMERA_CONFIG[cameraMode].label}
            <kbd className="text-[9px] bg-white/15 px-1 rounded text-cyan-200 ml-0.5">V</kbd>
          </button>
          <button
            onClick={() => {
              const currIdx = TERRAIN_LEVELS.findIndex(
                (l) => Math.abs(l.value - terrainScale) < 0.1,
              );
              const nextIdx =
                currIdx === -1 ? 2 : (currIdx + 1) % TERRAIN_LEVELS.length;
              onTerrainScaleChange(TERRAIN_LEVELS[nextIdx].value);
            }}
            className="rounded-xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-xl px-3 py-2 text-xs text-cyan-200 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 font-medium select-none"
            title="클릭 시 3D 지형 고도 배율 5단계 변경 (0x ~ 5x)"
          >
            <Mountain className="h-3.5 w-3.5 text-cyan-400" />
            지형 {TERRAIN_LEVELS.find((l) => Math.abs(l.value - terrainScale) < 0.1)?.label || `${terrainScale}x`}
          </button>
          <button
            onClick={onToggleMute}
            className={`rounded-xl backdrop-blur-xl border shadow-xl px-3 py-2 text-xs transition-all flex items-center gap-1.5 font-medium ${
              !isMuted
                ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/35'
                : 'bg-slate-900/85 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="엔진 및 환경 사운드 효과 ON/OFF"
          >
            {!isMuted ? <Volume2 className="h-3.5 w-3.5 text-emerald-300" /> : <VolumeX className="h-3.5 w-3.5" />}
            사운드 {!isMuted ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => onToggleLabels(!showLabels)}
            className={`rounded-xl backdrop-blur-xl border shadow-xl px-3 py-2 text-xs transition-all flex items-center gap-1.5 font-medium ${
              showLabels
                ? 'bg-cyan-500/25 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/35'
                : 'bg-slate-900/85 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            지명 {showLabels ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => onToggleBuildings(!showBuildings)}
            className={`rounded-xl backdrop-blur-xl border shadow-xl px-3 py-2 text-xs transition-all flex items-center gap-1.5 font-medium ${
              showBuildings
                ? 'bg-cyan-500/25 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/35'
                : 'bg-slate-900/85 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            3D 건물 {showBuildings ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => onToggleCollision(!enableCollision)}
            className={`rounded-xl backdrop-blur-xl border shadow-xl px-3 py-2 text-xs transition-all flex items-center gap-1.5 font-medium ${
              enableCollision
                ? 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/35'
                : 'bg-amber-500/25 border-amber-400/40 text-amber-200 hover:bg-amber-500/35'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            충돌 {enableCollision ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={onReset}
            className="rounded-xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-xl px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            리셋
          </button>
        </div>
      </div>

      {/* Location chip */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 max-w-md w-full px-4 pointer-events-none">
        <div className="rounded-full bg-slate-900/75 backdrop-blur-md border border-white/10 shadow-lg px-4 py-1.5 flex items-center justify-center gap-1.5">
          <MapPin className="h-3 w-3 text-cyan-400 shrink-0" />
          <span className="text-xs text-slate-200 truncate">{locationLabel}</span>
        </div>
      </div>
    </>
  );
}
