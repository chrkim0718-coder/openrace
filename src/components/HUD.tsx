import { useState } from 'react';
import { Gauge, MapPin, Sparkles, Building2, Shield, Mountain, Tag, Camera, CloudSun, Volume2, VolumeX, Clock } from 'lucide-react';
import type { CarState, WeatherMode } from '@/types/game';
import { getTimeOfDayAtmosphere } from '@/utils/timeOfDay';

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
  timeInMinutes: number;
  isTimeAutoFlow: boolean;
  onWeatherChange: (w: WeatherMode) => void;
  onToggleBuildings: (show: boolean) => void;
  onToggleCollision: (enable: boolean) => void;
  onToggleLabels: (show: boolean) => void;
  onTerrainScaleChange: (scale: number) => void;
  onToggleCameraMode: (mode: CameraMode) => void;
  onToggleLiveWeather: () => void;
  onToggleMute: () => void;
  onTimeChange: (mins: number) => void;
  onToggleTimeAutoFlow: () => void;
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
  timeInMinutes,
  isTimeAutoFlow,
  onWeatherChange,
  onToggleBuildings,
  onToggleCollision,
  onToggleLabels,
  onTerrainScaleChange,
  onToggleCameraMode,
  onToggleLiveWeather,
  onToggleMute,
  onTimeChange,
  onToggleTimeAutoFlow,
  onReset,
}: Props) {
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const speed = Math.abs(Math.round(car.speed));
  const gear = car.speed >= 0 ? 'D' : 'R';
  const atmos = getTimeOfDayAtmosphere(timeInMinutes);

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
            <span className="text-[9px] text-slate-500 font-mono">Shift</span>
          </div>
        </div>
      </div>

      {/* Location Badge */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <div className="rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl px-4 py-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-cyan-400 animate-bounce" />
          <span className="text-sm font-bold text-white tracking-wide">
            {locationLabel}
          </span>
        </div>
      </div>

      {/* Control instructions overlay */}
      <div className="absolute bottom-4 right-4 z-50 pointer-events-none hidden sm:block">
        <div className="rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl px-4 py-3 text-xs text-slate-300 flex flex-col gap-1.5">
          <div className="flex items-center justify-center gap-2">
            <kbd className="text-[10px] text-slate-300 bg-white/10 rounded px-1.5 py-1 font-bold">
              W / ↑
            </kbd>
          </div>
          <div className="flex items-center gap-1.5">
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

      {/* Top Right Controls & Weather Bar */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2 items-end">
        <div className="rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl p-1.5 flex gap-1.5 items-center">
          {/* Time Picker Toggle Button */}
          <div className="relative">
            <button
              onClick={() => setTimePickerOpen((prev) => !prev)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
              title="24시간 실시간 시간 슬라이더 및 일출/낮/석양/밤 조절"
            >
              <Clock className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
              <span>⏰ {atmos.formattedTime} ({atmos.periodLabel})</span>
            </button>

            {/* Time Picker Slider Popup */}
            {timePickerOpen && (
              <div className="absolute top-11 right-0 w-80 p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-amber-400/40 shadow-2xl space-y-3 z-[70] animate-fade-in">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-xs font-bold text-amber-300 tracking-wider uppercase flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-amber-400" />
                    시간 슬라이더 (00:00 ~ 23:59)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 font-bold">
                    {atmos.formattedTime} ({atmos.periodLabel})
                  </span>
                </div>

                {/* Range Slider */}
                <div className="space-y-1.5">
                  <input
                    type="range"
                    min="0"
                    max="1439"
                    step="5"
                    value={timeInMinutes}
                    onChange={(e) => onTimeChange(parseInt(e.target.value, 10))}
                    className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-0.5">
                    <span>00:00 (밤)</span>
                    <span>06:00 (새벽)</span>
                    <span>12:00 (낮)</span>
                    <span>18:00 (노을)</span>
                    <span>23:59 (밤)</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-white/10">
                  <button
                    onClick={() => onTimeChange(360)}
                    className="py-1.5 px-1 rounded-xl bg-orange-500/20 text-orange-200 border border-orange-400/30 text-[10px] font-bold hover:bg-orange-500/30 transition-all text-center"
                  >
                    🌅 06:00 새벽
                  </button>
                  <button
                    onClick={() => onTimeChange(720)}
                    className="py-1.5 px-1 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[10px] font-bold hover:bg-amber-500/30 transition-all text-center"
                  >
                    ☀️ 12:00 낮
                  </button>
                  <button
                    onClick={() => onTimeChange(1110)}
                    className="py-1.5 px-1 rounded-xl bg-rose-500/20 text-rose-200 border border-rose-400/30 text-[10px] font-bold hover:bg-rose-500/30 transition-all text-center"
                  >
                    🌇 18:30 노을
                  </button>
                  <button
                    onClick={() => onTimeChange(1380)}
                    className="py-1.5 px-1 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[10px] font-bold hover:bg-indigo-500/30 transition-all text-center"
                  >
                    🌙 23:00 밤
                  </button>
                </div>

                {/* Time Auto Flow Toggle */}
                <button
                  onClick={onToggleTimeAutoFlow}
                  className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    isTimeAutoFlow
                      ? 'bg-amber-500/30 text-amber-200 border-amber-400/50 animate-pulse'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {isTimeAutoFlow ? '⏸️ 시간 흐름 일시정지' : '▶️ 시간 실시간 자동흐름 시작'}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onToggleLiveWeather}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
              isLiveWeather
                ? 'bg-amber-500/25 border-amber-400/50 text-amber-300 shadow-md shadow-amber-500/20 animate-pulse'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="실시간 날씨 API 연동"
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

        {/* Row 2 Controls */}
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
            title="엔진음 및 환경음 사운드 ON/OFF"
          >
            {!isMuted ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-emerald-300" />
                사운드 ON
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                사운드 OFF
              </>
            )}
          </button>

          <button
            onClick={() => onToggleLabels(!showLabels)}
            className={`rounded-xl backdrop-blur-xl border shadow-xl px-3 py-2 text-xs transition-all flex items-center gap-1.5 font-medium ${
              showLabels
                ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30'
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
                ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-200 hover:bg-cyan-500/30'
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
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 hover:bg-amber-500/30'
                : 'bg-slate-900/85 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            충돌 {enableCollision ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={onReset}
            className="rounded-xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-xl px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1.5 font-medium"
            title="차량을 도로로 복귀"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            리셋
          </button>
        </div>
      </div>
    </>
  );
}
