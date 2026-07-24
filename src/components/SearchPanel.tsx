import { useCallback, useRef, useState } from 'react';
import { Search, Loader2, MapPin, X, Navigation, Dices, Globe, ChevronUp, ChevronDown, Film } from 'lucide-react';
import type { SearchResult, ScenicCourse, ThemeCategory } from '@/types/game';
import { SCENIC_COURSES, THEMES } from '@/data/scenicDrives';

interface Props {
  onTeleport: (lat: number, lng: number, label: string) => void;
  onSelectCourse: (course: ScenicCourse) => void;
  onRandomScenic: () => void;
  onStartShowcase: () => void;
  currentLabel: string;
}

export default function SearchPanel({
  onTeleport,
  onSelectCourse,
  onRandomScenic,
  onStartShowcase,
  currentLabel,
}: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'world' | 'seoul' | 'nationwide'>('world');
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

  const filteredCourses = SCENIC_COURSES.filter((c) => {
    if (activeTab === 'seoul') {
      return c.location.includes('서울') || c.name.includes('서울') || c.name.includes('남산') || c.name.includes('반포');
    }
    if (activeTab === 'nationwide') {
      return (
        c.location.includes('대한민국') ||
        c.location.includes('부산') ||
        c.location.includes('강원') ||
        c.location.includes('제주') ||
        c.location.includes('경주')
      );
    }
    // World tab
    if (selectedTheme === 'all') return true;
    return c.theme === selectedTheme;
  });

  return (
    <div className="absolute top-4 left-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <div className="rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300">
        {/* Header Bar with Toggle Collapse */}
        <div className="p-2.5 flex items-center justify-between border-b border-white/10 bg-white/5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="주소, 도시, 전 세계 랜드마크 검색..."
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setCollapsed((prev) => !prev)}
            className="ml-2 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            title={collapsed ? '검색 패널 펼치기' : '검색 패널 접기'}
          >
            {collapsed ? <ChevronDown className="h-4 w-4 text-cyan-400" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>

        {/* Collapsible Content */}
        {!collapsed && (
          <>
            {/* Search Results Dropdown */}
            {open && (results.length > 0 || loading || error) && (
              <div className="max-h-60 overflow-y-auto border-b border-white/10 p-2 space-y-1">
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                    검색 중...
                  </div>
                )}
                {error && (
                  <div className="py-3 text-center text-xs text-amber-400">
                    {error}
                  </div>
                )}
                {results.map((r, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(r)}
                    className="p-2 rounded-lg hover:bg-cyan-500/20 text-xs text-slate-200 cursor-pointer flex items-center gap-2 transition-colors border border-transparent hover:border-cyan-400/30"
                  >
                    <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">{r.display_name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 3 Main Categories Tabs (World / Seoul / Korea Nationwide) */}
            <div className="grid grid-cols-3 p-1.5 gap-1 bg-slate-950/40">
              <button
                onClick={() => {
                  setActiveTab('world');
                  setSelectedTheme('all');
                }}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                  activeTab === 'world'
                    ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-300 shadow-md shadow-cyan-500/20'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                월드
              </button>
              <button
                onClick={() => setActiveTab('seoul')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                  activeTab === 'seoul'
                    ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-300 shadow-md shadow-cyan-500/20'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                🏛️ 서울
              </button>
              <button
                onClick={() => setActiveTab('nationwide')}
                className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                  activeTab === 'nationwide'
                    ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-300 shadow-md shadow-cyan-500/20'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                🇰🇷 전국
              </button>
            </div>

            {/* Main Action Buttons */}
            <div className="p-3 border-t border-white/10 max-h-80 overflow-y-auto space-y-2.5">
              {/* Showcase Auto Drive Button */}
              <button
                onClick={onStartShowcase}
                className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xl shadow-rose-950/50 active:scale-95 transition-all border border-white/30 tracking-wide animate-pulse"
                title="알아서 멋진 3D 드라이브를 보여드립니다! (아무 키나 터치하면 직접 운전)"
              >
                <Film className="h-4 w-4 text-amber-300 animate-bounce" />
                <span>🎬 구경하기 (자동 드라이브 쇼케이스)</span>
              </button>

              {/* Random Scenic Pick Button */}
              <button
                onClick={onRandomScenic}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600/80 via-indigo-600/80 to-cyan-600/80 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 active:scale-95 transition-all border border-white/20"
              >
                <Dices className="h-4 w-4 text-yellow-300 animate-spin-slow" />
                <span>🎲 오늘의 랜덤 절경 드라이브</span>
              </button>

              {/* Theme filter pills (World tab only) */}
              {activeTab === 'world' && (
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
              )}

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
          </>
        )}

        {/* Current Location Footer Badge */}
        <div className="p-2 bg-slate-950/90 border-t border-white/10 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5 text-cyan-300 font-semibold truncate pr-2">
            <Navigation className="h-3.5 w-3.5 shrink-0 text-cyan-400 animate-pulse" />
            <span className="truncate">{currentLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
