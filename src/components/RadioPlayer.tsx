import { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Radio, Volume2 } from 'lucide-react';
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
    <div className="absolute top-16 right-4 z-40 flex flex-col items-end">
      {/* Collapsed Radio Chip */}
      <div className="rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl p-2 flex items-center gap-2 transition-all duration-200">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold transition-all select-none"
          title="드라이빙 BGM 라디오 정보"
        >
          <Radio className={`h-3.5 w-3.5 text-cyan-300 ${isPlaying ? 'animate-pulse' : ''}`} />
          <span className="truncate max-w-[120px]">{track.title}</span>
        </button>

        {/* Prev */}
        <button
          onClick={() => musicPlayer.prevTrack()}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all select-none"
          title="이전 곡"
        >
          <SkipBack className="h-3.5 w-3.5" />
        </button>

        {/* Play / Pause */}
        <button
          onClick={() => musicPlayer.togglePlay()}
          className="p-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:scale-105 active:scale-95 transition-all select-none"
          title={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          )}
        </button>

        {/* Next */}
        <button
          onClick={() => musicPlayer.nextTrack()}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all select-none"
          title="다음 곡"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded Playlist & Volume Widget */}
      {expanded && (
        <div className="mt-2 w-72 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl p-3 space-y-2.5 transition-all animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-cyan-300 tracking-wider uppercase flex items-center gap-1">
              <Radio className="h-3.5 w-3.5 text-cyan-400" />
              BGM 라디오 트랙
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {track.genre}
            </span>
          </div>

          {/* Current Track Banner */}
          <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5 flex items-center justify-between">
            <div className="truncate pr-2">
              <p className="text-xs font-bold text-slate-100 truncate">{track.title}</p>
              <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold shrink-0">
              {track.genre}
            </span>
          </div>

          {/* Track Selection List */}
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
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
                className={`w-full text-left p-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                  track.id === t.id
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="truncate">{t.title}</span>
                <span className="text-[9px] text-slate-500 shrink-0 ml-1">
                  {t.genre}
                </span>
              </button>
            ))}
          </div>

          {/* Volume Control Slider */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <Volume2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => musicPlayer.setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
            <span className="text-[10px] text-slate-400 font-semibold w-7 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
