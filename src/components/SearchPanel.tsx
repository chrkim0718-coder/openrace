import { useCallback, useRef, useState } from 'react';
import { Search, Loader2, MapPin, X, Navigation, Dices, Globe } from 'lucide-react';
import type { SearchResult, ScenicCourse, ThemeCategory } from '@/types/game';
import { SCENIC_COURSES, THEMES } from '@/data/scenicDrives';

interface Props {
  onTeleport: (lat: number, lng: number, label: string) => void;
  onSelectCourse: (course: ScenicCourse) => void;
  onRandomScenic: () => void;
  currentLabel: string;
}

export default function SearchPanel({
  onTeleport,
  onSelectCourse,
  onRandomScenic,
  currentLabel,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'world' | 'seoul'>('world');
  const [selectedTheme, setSelectedTheme] = useState<ThemeCategory | 'all'>('all');
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
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (r: SearchResult) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    onTeleport(lat, lng, r.display_name.split(',')[0]);
    setOpen(false);
    setQuery('');
  };

  const filteredCourses = selectedTheme === 'all'
    ? SCENIC_COURSES
    : SCENIC_COURSES.filter((c) => c.theme === selectedTheme);

  return (
    <div className="absolute top-4 left-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <div className="rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-200">
        {/* Search input */}
        <div className="relative flex items-center px-3 py-2.5">
          <Search className="h-4 w-4 text-cyan-400 shrink-0 ml-1" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder="주소, 도시, 전 세계 랜드마크 검색..."
            className="w-full bg-transparent border-0 px-2 py-1 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-0"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 text-cyan-400 animate-spin shrink-0 mr-1" />
          ) : query ? (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4 shrink-0 mr-1" />
            </button>
          ) : null}
        </div>

        {/* Search Dropdown Results */}
        {open && results.length > 0 && (
          <div className="border-t border-white/10 max-h-60 overflow-y-auto">
            {error && (
              <p className="px-3 py-3 text-xs text-slate-400">{error}</p>
            )}
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <MapPin className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-200 leading-relaxed line-clamp-2">
                  {r.display_name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-t border-white/10 bg-slate-950/60 p-1 gap-1">
          <button
            onClick={() => setActiveTab('world')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'world'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            World Scenic Drives
          </button>
          <button
            onClick={() => setActiveTab('seoul')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'seoul'
                ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏛️ 서울 명소
          </button>
        </div>

        {/* Tab Content 1: World Scenic Drives */}
        {activeTab === 'world' && (
          <div className="p-3 border-t border-white/10 max-h-72 overflow-y-auto space-y-2.5">
            {/* Random Scenic Pick Button */}
            <button
              onClick={onRandomScenic}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600/80 via-indigo-600/80 to-cyan-600/80 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 active:scale-95 transition-all border border-white/20"
            >
              <Dices className="h-4 w-4 text-yellow-300 animate-spin-slow" />
              <span>🎲 오늘의 랜덤 절경 드라이브</span>
            </button>

            {/* Theme filter pills */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
              <button
                onClick={() => setSelectedTheme('all')}
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 transition-all ${
                  selectedTheme === 'all'
                    ? 'bg-white/20 text-white border border-white/40'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                전체 ({SCENIC_COURSES.length})
              </button>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTheme(t.id)}
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 transition-all border ${
                    selectedTheme === t.id
                      ? `${t.badgeColor} scale-105`
                      : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  {t.icon} {t.name}
                </button>
              ))}
            </div>

            {/* Scenic course list */}
            <div className="space-y-1.5">
              {filteredCourses.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelectCourse(c)}
                  className="p-2.5 rounded-xl bg-slate-950/50 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-slate-100 group-hover:text-cyan-200 transition-colors">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {c.location}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content 2: Seoul Landmark presets */}
        {activeTab === 'seoul' && (
          <div className="p-3 border-t border-white/10 max-h-64 overflow-y-auto">
            <div className="grid grid-cols-2 gap-1.5">
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
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/25 hover:border-cyan-400/50 border border-white/10 text-xs text-slate-200 hover:text-white font-medium transition-all text-left truncate select-none active:scale-95"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current location label footer */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-white/10 bg-slate-950/60">
          <Navigation className="h-3 w-3 text-cyan-400 shrink-0" />
          <span className="text-[11px] text-slate-300 truncate font-medium">
            {currentLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
