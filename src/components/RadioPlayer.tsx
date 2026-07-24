import { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Radio, Volume2, Music } from 'lucide-react';
import { musicPlayer, DRIVING_BGM_PLAYLIST } from '@/utils/musicPlayer';
import type { BGMTrack } from '@/utils/musicPlayer';

export default function RadioPlayer() {
  const [track, setTrack] = useState<BGMTrack>(musicPlayer.getCurrentTrack());
  const [isPlaying, setIsPlaying] = useState<boolean>(musicPlayer.getIsPlaying());
  const [volume, setVolume] = useState<number>(musicPlayer.getVolume());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = musicPlayer.subscribe(() => {
      setTrack(musicPlayer.getCurrentTrack());
      setIsPlaying(musicPlayer.getIsPlaying());
      setVolume(musicPlayer.getVolume());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="absolute top-[108px] right-4 z-[60] flex flex-col items-end">
      {/* Main Radio Control Bar */}
      <div className="rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-cyan-400/40 shadow-2xl p-2 flex items-center gap-2 transition-all duration-200">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/25 hover:bg-purple-500/35 border border-purple-400/40 text-purple-200 text-xs font-bold transition-all select-none"
          title="클릭하여 플레이리스트 및 볼륨 조절창 열기"
        >
          <Radio className={`h-4 w-4 text-purple-300 ${isPlaying ? 'animate-pulse' : ''}`} />
          <span className="truncate max-w-[130px] font-semibold text-white">
            {isPlaying ? track.title : '📻 BGM 라디오'}
          </span>
        </button>

        {/* Prev */}
        <button
          onClick={() => musicPlayer.prevTrack()}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all select-none"
          title="이전 곡"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={() => musicPlayer.togglePlay()}
          className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 hover:scale-105 active:scale-95 transition-all select-none"
          title={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Next */}
        <button
          onClick={() => musicPlayer.nextTrack()}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-all select-none"
          title="다음 곡"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded Playlist & Volume Popup */}
      {expanded && (
        <div className="mt-2 w-80 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-purple-400/30 shadow-2xl p-3.5 space-y-3 transition-all animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="text-xs font-bold text-purple-300 tracking-wider uppercase flex items-center gap-1.5">
              <Music className="h-4 w-4 text-purple-400" />
              드라이빙 BGM 라디오
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 font-semibold">
              {track.genre}
            </span>
          </div>

          {/* Current Playing Track Banner */}
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-white/10 flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-bold text-white truncate">{track.title}</p>
              <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
            </div>
            <button
              onClick={() => musicPlayer.togglePlay()}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-bold shrink-0"
            >
              {isPlaying ? '▶ 재생 중' : '⏸ 정지'}
            </button>
          </div>

          {/* Track Selection List */}
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {DRIVING_BGM_PLAYLIST.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (musicPlayer.getCurrentTrack().id === t.id) {
                    musicPlayer.togglePlay();
                  } else {
                    const idx = DRIVING_BGM_PLAYLIST.findIndex((x) => x.id === t.id);
                    (musicPlayer as any).currentTrackIndex = idx;
                    musicPlayer.play();
                  }
                }}
                className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                  track.id === t.id
                    ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <span className="truncate">{t.title}</span>
                <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                  {t.genre}
                </span>
              </button>
            ))}
          </div>

          {/* Volume Slider */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <Volume2 className="h-4 w-4 text-slate-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => musicPlayer.setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
            <span className="text-[10px] text-slate-300 font-bold w-8 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
