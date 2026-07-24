import { useCallback, useRef, useState } from 'react';
import { Search, Loader2, MapPin, X, Navigation } from 'lucide-react';
import type { SearchResult } from '@/types/game';

interface Props {
  onTeleport: (lat: number, lng: number, label: string) => void;
  currentLabel: string;
}

export default function SearchPanel({ onTeleport, currentLabel }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=8&addressdetails=1`,
        { headers: { 'Accept-Language': 'ko,en' } },
      );
      if (!res.ok) throw new Error('Search failed');
      const data = (await res.json()) as SearchResult[];
      setResults(data);
      if (data.length === 0) setError('결과를 찾을 수 없습니다');
    } catch {
      setError('검색 중 오류가 발생했습니다');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (r: SearchResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    onTeleport(lat, lng, r.display_name.split(',').slice(0, 2).join(','));
    setQuery(r.display_name.split(',').slice(0, 2).join(','));
    setOpen(false);
    setResults([]);
  };

  const clear = () => {
    setQuery('');
    setResults([]);
    setError(null);
    setOpen(false);
  };

  return (
    <div className="absolute left-4 top-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <div className="rounded-2xl bg-slate-900/85 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Search className="h-5 w-5 text-cyan-400 shrink-0" />
          <input
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="주소, 도시, 랜드마크 검색..."
            className="flex-1 bg-transparent text-white placeholder-slate-400 text-sm outline-none"
          />
          {loading && <Loader2 className="h-4 w-4 text-cyan-400 animate-spin" />}
          {query && !loading && (
            <button
              onClick={clear}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {open && (results.length > 0 || error) && (
          <div className="border-t border-white/10 max-h-72 overflow-y-auto">
            {error && (
              <p className="px-3 py-3 text-sm text-slate-400">{error}</p>
            )}
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <MapPin className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-200 leading-relaxed line-clamp-2">
                  {r.display_name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Seoul Landmark presets */}
        <div className="px-3 py-2 border-t border-white/10">
          <p className="text-[10px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
            서울 주요 명소
          </p>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {[
              { name: '🏛️ 경복궁', lat: 37.5759, lng: 126.9768 },
              { name: '🗼 N서울타워', lat: 37.5512, lng: 126.9882 },
              { name: '🏙️ 강남역', lat: 37.4979, lng: 127.0276 },
              { name: '🏢 롯데월드타워', lat: 37.5126, lng: 127.1025 },
              { name: '🌉 여의도63', lat: 37.5202, lng: 126.9248 },
              { name: '🎨 DDP', lat: 37.5665, lng: 127.0092 },
              { name: '🛍️ 명동', lat: 37.5636, lng: 126.9849 },
              { name: '🌳 서울숲', lat: 37.5447, lng: 127.0378 },
              { name: '🌊 반포대교', lat: 37.5134, lng: 126.9961 },
              { name: '⛩️ 북촌한옥마을', lat: 37.5826, lng: 126.9837 },
            ].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => onTeleport(preset.lat, preset.lng, preset.name)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/25 hover:border-cyan-400/50 border border-white/10 text-xs text-slate-200 hover:text-white font-medium transition-all shrink-0 select-none active:scale-95"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/10 bg-slate-950/40">
          <Navigation className="h-3 w-3 text-slate-500" />
          <span className="text-[11px] text-slate-400 truncate">
            {currentLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
