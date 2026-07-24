import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCarPhysics } from '@/hooks/useCarPhysics';
import type { CollisionData } from '@/hooks/useCarPhysics';
import SearchPanel from '@/components/SearchPanel';
import HUD from '@/components/HUD';
import {
  fetchAreaData,
  getCachedData,
  isPointInsideBuilding,
  findSafeRoadPosition,
} from '@/utils/buildings';
import type { WeatherMode, KeysPressed } from '@/types/game';

const INITIAL = { lat: 37.5665, lng: 126.978, heading: 0 }; // Seoul

const WEATHER_FILTERS: Record<WeatherMode, string> = {
  day: 'none',
  night: 'brightness(0.45) contrast(1.15) hue-rotate(200deg) saturate(0.7)',
  rain: 'brightness(0.7) contrast(1.1) saturate(0.8) hue-rotate(5deg)',
  snow: 'brightness(1.15) contrast(0.9) saturate(0.5) hue-rotate(180deg)',
};

const WEATHER_OVERLAY: Record<WeatherMode, string> = {
  day: 'transparent',
  night: 'rgba(10,15,40,0.35)',
  rain: 'rgba(20,30,50,0.2)',
  snow: 'rgba(220,230,255,0.12)',
};

export default function RacingGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<HTMLDivElement | null>(null);

  const [active, setActive] = useState(false);
  const [weather, setWeather] = useState<WeatherMode>('day');
  const [locationLabel, setLocationLabel] = useState('서울');
  const [ready, setReady] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const collisionRef = useRef<CollisionData | null>(null);
  const [collisionFlash, setCollisionFlash] = useState(0);

  const { car, setCar, keysRef, collisionFlashRef } = useCarPhysics(
    INITIAL,
    active,
    collisionRef,
  );

  // init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: '© Esri Satellite',
          },
        },
        layers: [
          {
            id: 'satellite-tiles',
            type: 'raster',
            source: 'satellite',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [INITIAL.lng, INITIAL.lat],
      zoom: 17,
      bearing: 0,
      pitch: 55,
      attributionControl: { compact: true },
      dragRotate: false,
      dragPan: false,
      scrollZoom: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      keyboard: false,
    });

    mapRef.current = map;

    map.on('error', () => {
      setMapError('지도 로딩 중 오류가 발생했습니다');
    });

    map.on('load', async () => {
      setMapLoading(false);

      // Add 3D Terrain DEM source & enable 3D terrain elevation mesh
      if (!map.getSource('terrain-dem')) {
        map.addSource('terrain-dem', {
          type: 'raster-dem',
          tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          ],
          encoding: 'terrarium',
          tileSize: 256,
          maxzoom: 15,
        });
      }

      try {
        map.setTerrain({
          source: 'terrain-dem',
          exaggeration: 1.9,
        });
      } catch (err) {
        console.warn('3D Terrain setTerrain error:', err);
      }

      // Add 3D hillshading layer for realistic mountain & slope shadows
      if (!map.getLayer('hillshade')) {
        map.addLayer(
          {
            id: 'hillshade',
            type: 'hillshade',
            source: 'terrain-dem',
            paint: {
              'hillshade-exaggeration': 0.5,
              'hillshade-shadow-color': '#090d16',
              'hillshade-highlight-color': '#ffffff',
            },
          },
          'satellite-tiles',
        );
      }

      // Initialize GeoJSON source & 3D buildings layer unconditionally
      if (!map.getSource('buildings')) {
        map.addSource('buildings', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }
      if (!map.getLayer('3d-buildings')) {
        map.addLayer({
          id: '3d-buildings',
          source: 'buildings',
          type: 'fill-extrusion',
          paint: {
            'fill-extrusion-color': ['coalesce', ['get', 'color'], '#cbd5e1'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.88,
          },
        });
      }

      // Fetch 3D buildings + roads from Overpass API
      try {
        const { buildings, roads } = await fetchAreaData(INITIAL.lat, INITIAL.lng, 500);
        if (buildings.length > 0) {
          const src = map.getSource('buildings') as maplibregl.GeoJSONSource | undefined;
          if (src) {
            const geojson = { type: 'FeatureCollection', features: buildings };
            src.setData(geojson as any);
            (src as any)._data = geojson;
          }
        }
        // Set initial collision data
        collisionRef.current = { buildings, roads };
        lastFetchCellRef.current = `${Math.floor(INITIAL.lat / 0.008)},${Math.floor(INITIAL.lng / 0.008)}`;
      } catch (e) {
        console.error('Failed to load buildings:', e);
      }

      // car marker element
      const el = document.createElement('div');
      el.style.cssText = `
        width: 36px; height: 60px;
        will-change: transform;
        transition: none;
      `;
      el.innerHTML = `
        <svg width="36" height="60" viewBox="0 0 36 60" style="display:block;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.5))">
          <defs>
            <linearGradient id="cbody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#f97316"/>
              <stop offset="0.5" stop-color="#ea580c"/>
              <stop offset="1" stop-color="#c2410c"/>
            </linearGradient>
            <linearGradient id="cwind" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#1e293b"/>
              <stop offset="1" stop-color="#334155"/>
            </linearGradient>
          </defs>
          <!-- rear -->
          <rect x="6" y="44" width="24" height="12" rx="4" fill="url(#cbody)"/>
          <!-- body -->
          <path d="M8 14 L8 50 L28 50 L28 14 Q28 6 18 6 Q8 6 8 14 Z" fill="url(#cbody)"/>
          <!-- windshield -->
          <path d="M11 14 L11 28 L25 28 L25 14 Q25 9 18 9 Q11 9 11 14 Z" fill="url(#cwind)" opacity="0.85"/>
          <!-- roof line -->
          <rect x="11" y="28" width="14" height="10" fill="#0f172a" opacity="0.3"/>
          <!-- headlights -->
          <rect x="9" y="8" width="4" height="3" rx="1" fill="#fef3c7"/>
          <rect x="23" y="8" width="4" height="3" rx="1" fill="#fef3c7"/>
          <!-- taillights -->
          <rect x="9" y="51" width="4" height="3" rx="1" fill="#ef4444"/>
          <rect x="23" y="51" width="4" height="3" rx="1" fill="#ef4444"/>
          <!-- wheels -->
          <rect x="4" y="16" width="4" height="8" rx="1.5" fill="#1a1a1a"/>
          <rect x="28" y="16" width="4" height="8" rx="1.5" fill="#1a1a1a"/>
          <rect x="4" y="40" width="4" height="8" rx="1.5" fill="#1a1a1a"/>
          <rect x="28" y="40" width="4" height="8" rx="1.5" fill="#1a1a1a"/>
        </svg>
      `;
      // front wheels for steer visual
      const wheelL = el.querySelector('rect:nth-of-type(3)') as SVGRectElement | null;
      const wheelR = el.querySelector('rect:nth-of-type(4)') as SVGRectElement | null;

      // store refs on element
      (el as any)._wheelL = wheelL;
      (el as any)._wheelR = wheelR;

      markerRef.current = el;

      const marker = new maplibregl.Marker({
        element: el,
        rotationAlignment: 'map',
        pitchAlignment: 'map',
      })
        .setLngLat([INITIAL.lng, INITIAL.lat])
        .addTo(map);

      (mapRef.current as any)._marker = marker;

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // sync car -> map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const marker = (map as any)._marker;
    if (!marker) return;

    marker.setLngLat([car.lng, car.lat]);
    marker.setRotation(car.heading);

    // steer wheels visual
    const el = markerRef.current;
    if (el) {
      const wL = (el as any)._wheelL as SVGRectElement | null;
      const wR = (el as any)._wheelR as SVGRectElement | null;
      const steerDeg = car.steerAngle * 30;
      [wL, wR].forEach((w) => {
        if (w) w.setAttribute('transform', `rotate(${steerDeg} 6 20)`);
      });
    }

    // camera follows car with 3D pitch view
    map.jumpTo({
      center: [car.lng, car.lat],
      bearing: car.heading,
      pitch: 62,
    });
  }, [car, ready]);

  // weather overlay
  const applyWeather = useCallback((w: WeatherMode) => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.style.filter = WEATHER_FILTERS[w];
    const container = map.getContainer();
    container.style.setProperty('--weather-overlay', WEATHER_OVERLAY[w]);
  }, []);

  useEffect(() => {
    applyWeather(weather);
  }, [weather, applyWeather, ready]);

  // Collision flash visual feedback
  useEffect(() => {
    let raf = 0;
    const check = () => {
      const flashTime = collisionFlashRef.current;
      if (flashTime > 0 && performance.now() - flashTime < 600) {
        setCollisionFlash(1 - (performance.now() - flashTime) / 600);
        raf = requestAnimationFrame(check);
      } else {
        setCollisionFlash(0);
        collisionFlashRef.current = 0;
      }
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [collisionFlashRef]);

  // Dynamic building loading
  const lastFetchCellRef = useRef<string | null>(null);

  const refreshBuildings = useCallback(
    async (lat: number, lng: number) => {
      const map = mapRef.current;
      if (!map) return;
      try {
        const { buildings, roads } = await fetchAreaData(lat, lng, 500);

        // Update collision data from cache (includes nearby cells)
        const cached = getCachedData(lat, lng);
        collisionRef.current = {
          buildings: cached.buildings,
          roads: cached.roads,
        };

        if (!map.getSource('buildings')) {
          map.addSource('buildings', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
        }
        if (!map.getLayer('3d-buildings')) {
          map.addLayer({
            id: '3d-buildings',
            source: 'buildings',
            type: 'fill-extrusion',
            paint: {
              'fill-extrusion-color': ['coalesce', ['get', 'color'], '#cbd5e1'],
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.88,
            },
          });
        }

        // Merge buildings into the map source for display
        const src = map.getSource('buildings') as maplibregl.GeoJSONSource | undefined;
        const allBuildings = cached.buildings.length > 0 ? cached.buildings : buildings;
        if (src && allBuildings.length > 0) {
          const geojson = { type: 'FeatureCollection', features: allBuildings };
          src.setData(geojson as any);
          (src as any)._data = geojson;
        }

        // Check if current target position is inside a building and auto-relocate to nearby road
        if (isPointInsideBuilding(lat, lng, cached.buildings)) {
          const safePos = findSafeRoadPosition(
            lat,
            lng,
            cached.buildings,
            cached.roads,
          );
          if (safePos && (safePos.lat !== lat || safePos.lng !== lng)) {
            setCar((c) => ({
              ...c,
              lat: safePos.lat,
              lng: safePos.lng,
              speed: 0,
            }));
            map.jumpTo({
              center: [safePos.lng, safePos.lat],
            });
          }
        }
      } catch (e) {
        console.error('Failed to refresh buildings:', e);
      }
    },
    [setCar],
  );

  useEffect(() => {
    if (!ready) return;
    const cellLat = Math.floor(car.lat / 0.008);
    const cellLng = Math.floor(car.lng / 0.008);
    const cellKey = `${cellLat},${cellLng}`;
    if (cellKey === lastFetchCellRef.current) return;
    lastFetchCellRef.current = cellKey;
    refreshBuildings(car.lat, car.lng);
  }, [car.lat, car.lng, ready, refreshBuildings]);

  // teleport
  const handleTeleport = useCallback(
    (lat: number, lng: number, label: string) => {
      const map = mapRef.current;
      if (!map) return;

      setCar((c) => ({
        ...c,
        lat,
        lng,
        speed: 0,
        heading: 0,
        steerAngle: 0,
      }));

      map.jumpTo({
        center: [lng, lat],
        bearing: 0,
        zoom: 17,
      });

      setLocationLabel(label);

      // Clear old buildings and fetch for new location
      lastFetchCellRef.current = null;
      const src = map.getSource('buildings') as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData({ type: 'FeatureCollection', features: [] } as any);
        (src as any)._data = { type: 'FeatureCollection', features: [] };
      }
      collisionRef.current = null;
      refreshBuildings(lat, lng);
    },
    [setCar, refreshBuildings],
  );

  const handleReset = useCallback(() => {
    setCar((c) => ({
      ...c,
      lat: INITIAL.lat,
      lng: INITIAL.lng,
      heading: INITIAL.heading,
      speed: 0,
      steerAngle: 0,
    }));
    setLocationLabel('서울');
    mapRef.current?.jumpTo({
      center: [INITIAL.lng, INITIAL.lat],
      bearing: 0,
      zoom: 17,
    });
  }, [setCar]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* map */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Map loading indicator */}
      {mapLoading && (
        <div className="absolute inset-0 z-[55] flex items-center justify-center bg-slate-900">
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mb-4" />
            <p className="text-sm text-slate-400">
              {mapError || '지도 데이터 로딩 중...'}
            </p>
          </div>
        </div>
      )}

      {/* Collision flash overlay */}
      {collisionFlash > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-40"
          style={{
            boxShadow: `inset 0 0 120px rgba(255,0,0,${collisionFlash * 0.6})`,
            backgroundColor: `rgba(255,0,0,${collisionFlash * 0.15})`,
          }}
        />
      )}

      {/* weather overlay tint */}
      <div
        className="absolute inset-0 pointer-events-none z-30 transition-colors duration-700"
        style={{ backgroundColor: WEATHER_OVERLAY[weather] }}
      />

      {/* rain effect */}
      {weather === 'rain' && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-px h-8 bg-gradient-to-b from-transparent via-cyan-200/40 to-transparent animate-rain"
              style={{
                left: `${(i * 1.7) % 100}%`,
                animationDelay: `${(i % 10) * 0.12}s`,
                animationDuration: `${0.5 + (i % 5) * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* snow effect */}
      {weather === 'snow' && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-white/70 animate-snow"
              style={{
                left: `${(i * 2.3) % 100}%`,
                animationDelay: `${(i % 8) * 0.4}s`,
                animationDuration: `${3 + (i % 4) * 0.8}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Start overlay */}
      {!active && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="text-center max-w-md px-6">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 blur-2xl bg-cyan-500/30 rounded-full" />
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 80 80"
                  className="relative drop-shadow-lg"
                >
                  <defs>
                    <linearGradient id="bigcar" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stop-color="#f97316" />
                      <stop offset="1" stop-color="#dc2626" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M10 30 L60 30 L70 40 L70 55 L10 55 Z"
                    fill="url(#bigcar)"
                    stroke="#7c2d12"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M22 30 L40 14 L52 30 Z"
                    fill="#1e293b"
                    opacity="0.85"
                  />
                  <circle cx="20" cy="55" r="8" fill="#1a1a1a" />
                  <circle cx="60" cy="55" r="8" fill="#1a1a1a" />
                  <circle cx="20" cy="55" r="3" fill="#555" />
                  <circle cx="60" cy="55" r="3" fill="#555" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              OSM 레이싱
            </h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              실제 OpenStreetMap 위에서 달리는 레이싱 게임.
              <br />
              왼쪽 검색창에서 위치를 검색해 원하는 도시로 순간이동하세요.
            </p>
            <button
              onClick={() => setActive(true)}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg shadow-lg shadow-cyan-500/30 hover:scale-105 hover:shadow-cyan-500/50 transition-all"
            >
              시작하기
            </button>
            <p className="mt-4 text-xs text-slate-500">
              W/A/S/D 또는 방향키로 조작
            </p>
          </div>
        </div>
      )}

      {/* HUD */}
      {active && (
        <>
          <SearchPanel onTeleport={handleTeleport} currentLabel={locationLabel} />
          <HUD
            car={car}
            locationLabel={locationLabel}
            weather={weather}
            onWeatherChange={setWeather}
            onReset={handleReset}
          />
        </>
      )}

      {/* Mobile touch controls */}
      {active && (
        <MobileControls keysRef={keysRef} />
      )}
    </div>
  );
}

function MobileControls({
  keysRef,
}: {
  keysRef: React.MutableRefObject<KeysPressed>;
}) {
  const press = (key: keyof KeysPressed, val: boolean) => {
    keysRef.current[key] = val;
  };

  const btn = (
    label: string,
    key: 'forward' | 'backward' | 'left' | 'right' | 'turbo',
    extraClass = '',
  ) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        press(key, true);
      }}
      onPointerUp={() => press(key, false)}
      onPointerLeave={() => press(key, false)}
      onPointerCancel={() => press(key, false)}
      className={`w-14 h-14 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/15 text-white text-xl font-bold flex items-center justify-center active:bg-cyan-500/40 active:scale-95 transition-all touch-none select-none ${extraClass}`}
    >
      {label}
    </button>
  );

  return (
    <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-6 items-end">
      <div className="grid grid-cols-2 gap-1">
        {btn('←', 'left')}
        {btn('→', 'right')}
      </div>
      <div className="grid grid-cols-2 gap-1">
        {btn('↑', 'forward')}
        {btn('↓', 'backward')}
      </div>
      <div className="grid grid-cols-1 gap-1">
        {btn('⚡', 'turbo', 'active:bg-orange-500/40 border-orange-400/30')}
      </div>
    </div>
  );
}
