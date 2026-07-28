import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useCarPhysics } from '@/hooks/useCarPhysics';
import type { CollisionData } from '@/hooks/useCarPhysics';
import SearchPanel from '@/components/SearchPanel';
import HUD, { CameraMode, CAMERA_CONFIG, CAMERA_MODES } from '@/components/HUD';
import RadioPlayer from '@/components/RadioPlayer';
import {
  fetchAreaData,
  getCachedData,
  isPointInsideBuilding,
  findSafeRoadPosition,
} from '@/utils/buildings';
import type { LandmarkPOI } from '@/utils/buildings';
import type { WeatherMode, KeysPressed, ScenicCourse } from '@/types/game';
import { audioEngine } from '@/utils/audioEngine';
import { fetchLiveWeather } from '@/utils/liveWeather';
import { SCENIC_COURSES } from '@/data/scenicDrives';
import { getTimeOfDayAtmosphere } from '@/utils/timeOfDay';
import { SHOWCASE_SCENES } from '@/data/showcaseScenes';
import { musicPlayer, DRIVING_BGM_PLAYLIST } from '@/utils/musicPlayer';
import { Film } from 'lucide-react';

const INITIAL = { lat: 35.1587, lng: 129.1604, heading: 0 }; // Busan Haeundae Beach

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
  // No Three.js layer — using premium HTML/SVG marker for reliable cross-platform rendering

  const [active, setActive] = useState(false);
  const [weather, setWeather] = useState<WeatherMode>('day');
  const [showBuildings, setShowBuildings] = useState(false);
  const [enableCollision, setEnableCollision] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [terrainScale, setTerrainScale] = useState(1.0);
  const [cameraMode, setCameraMode] = useState<CameraMode>('topdown');
  const [isLiveWeather, setIsLiveWeather] = useState(false);
  const [liveWeatherDesc, setLiveWeatherDesc] = useState<string>('');
  const [isMuted, setIsMuted] = useState(true);
  const [locationLabel, setLocationLabel] = useState('부산 해운대');
  const [ready, setReady] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const collisionRef = useRef<CollisionData | null>(null);
  const floatingMarkersRef = useRef<maplibregl.Marker[]>([]);
  const lastLandmarksRef = useRef<LandmarkPOI[]>([]);
  const [collisionFlash, setCollisionFlash] = useState(0);

  // Showcase & Spectator Ambient Mode State
  const [isShowcaseMode, setIsShowcaseMode] = useState<boolean>(false);
  const [showcaseIndex, setShowcaseIndex] = useState<number>(0);
  const [showcaseTimer, setShowcaseTimer] = useState<number>(80);
  const [showcaseSpeed, setShowcaseSpeed] = useState<number>(30); // 30 km/h — calm relaxing pace
  const [showcasePaused, setShowcasePaused] = useState<boolean>(false);
  const [autoCameraSwitch, setAutoCameraSwitch] = useState<boolean>(true);
  const [isCinematicLetterbox, setIsCinematicLetterbox] = useState<boolean>(false);
  const [showcaseFade, setShowcaseFade] = useState<boolean>(false); // blackout fade between scenes

  const { car, setCar, keysRef, collisionFlashRef: physCollisionFlashRef } = useCarPhysics(
    INITIAL,
    active,
    collisionRef,
    enableCollision,
    isShowcaseMode,
    showcaseSpeed,
  );

  // Camera state for smooth exponential lerping
  const cameraStateRef = useRef({
    lat: INITIAL.lat,
    lng: INITIAL.lng,
    bearing: INITIAL.heading,
  });

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
            maxzoom: 16,
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
      zoom: 17.6,
      bearing: 0,
      pitch: 70,
      maxPitch: 75,
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

      // Sky horizon atmosphere
      try {
        if (typeof (map as any).setFog === 'function') {
          (map as any).setFog({
            range: [1.0, 12.0],
            color: '#87ceeb',
            'horizon-blend': 0.1,
            'high-color': '#1e293b',
            'space-color': '#0f172a',
          });
        }
      } catch (err) {
        console.warn('setFog error:', err);
      }

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
          exaggeration: 1.0,
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

      // Add Reference Place Labels (City, Landmark, Street Names Overlay)
      if (!map.getSource('place-labels')) {
        map.addSource('place-labels', {
          type: 'raster',
          tiles: [
            'https://basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png',
            'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
          ],
          tileSize: 256,
          maxzoom: 19,
        });
      }
      if (!map.getLayer('place-labels-layer')) {
        map.addLayer({
          id: 'place-labels-layer',
          type: 'raster',
          source: 'place-labels',
          layout: {
            visibility: showLabels ? 'visible' : 'none',
          },
          paint: {
            'raster-opacity': 0.95,
          },
        });
      }

      // Initialize GeoJSON source & 3D buildings layer unconditionally
      if (!map.getSource('buildings')) {
        map.addSource('buildings', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }
      if (!map.getLayer('building-outlines')) {
        map.addLayer(
          {
            id: 'building-outlines',
            source: 'buildings',
            type: 'line',
            layout: {
              visibility: showBuildings ? 'visible' : 'none',
            },
            paint: {
              'line-color': '#38bdf8',
              'line-width': 2,
              'line-opacity': 0.6,
            },
          },
          'satellite-tiles',
        );
      }
      if (!map.getLayer('3d-buildings')) {
        map.addLayer({
          id: '3d-buildings',
          source: 'buildings',
          type: 'fill-extrusion',
          layout: {
            visibility: showBuildings ? 'visible' : 'none',
          },
          paint: {
            'fill-extrusion-color': ['coalesce', ['get', 'color'], '#38bdf8'],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.38,
          },
        });
      }

      // Fetch 3D buildings + roads from Overpass API
      try {
        const { buildings, roads } = await fetchAreaData(INITIAL.lat, INITIAL.lng, 500);
        if (buildings.length > 0) {
          const src = map.getSource('buildings') as maplibregl.GeoJSONSource | undefined;
          if (src) {
            src.setData({ type: 'FeatureCollection', features: buildings });
          }
        }
        collisionRef.current = { buildings, roads };
      } catch (err) {
        console.warn('Initial buildings fetch failed:', err);
      }

      // ── Translucent Center Crosshair Marker (Car marker completely removed) ──
      const el = document.createElement('div');
      el.className = 'flight-crosshair-marker';
      el.style.cssText = 'position:relative; width:16px; height:16px; pointer-events:none; display:flex; align-items:center; justify-content:center; opacity:0.4; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));';
      el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="8" cy="8" r="3" stroke="white" stroke-width="1" opacity="0.8"/>
          <line x1="8" y1="0" x2="8" y2="5" stroke="white" stroke-width="1" opacity="0.8"/>
          <line x1="8" y1="11" x2="8" y2="16" stroke="white" stroke-width="1" opacity="0.8"/>
          <line x1="0" y1="8" x2="5" y2="8" stroke="white" stroke-width="1" opacity="0.8"/>
          <line x1="11" y1="8" x2="16" y2="8" stroke="white" stroke-width="1" opacity="0.8"/>
        </svg>
      `;

      markerRef.current = el;

      const marker = new maplibregl.Marker({
        element: el,
        rotationAlignment: 'map',
        pitchAlignment: 'map',
        anchor: 'center',
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

  // Smooth camera following sync with damped exponential interpolation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    // ── Update crosshair marker location & rotation ──────────────────
    const marker = (map as any)._marker;
    if (marker) {
      marker.setLngLat([car.lng, car.lat]);
      marker.setRotation(car.heading);
    }

    const cfg = CAMERA_CONFIG[cameraMode];
    let targetBearing = car.heading;

    // Cinematic / GTA: slow orbit around car
    if (cameraMode === 'cinematic' || cameraMode === 'gta') {
      const nowSec = performance.now() / 1000;
      const orbitSpeed = cameraMode === 'gta' ? 12 : 6; // deg/sec
      targetBearing = (car.heading + nowSec * orbitSpeed) % 360;
    }

    const curState = cameraStateRef.current;
    let deltaBearing = (targetBearing - curState.bearing) % 360;
    if (deltaBearing > 180) deltaBearing -= 360;
    if (deltaBearing < -180) deltaBearing += 360;

    // In showcase: ultra-buttery lerp (0.018), no shake whatsoever — pure cinematic calm
    const lerpFactor = isShowcaseMode ? 0.018 :
      (cameraMode === 'cinematic' || cameraMode === 'gta') ? 0.035 : 0.18;

    curState.bearing = (curState.bearing + deltaBearing * lerpFactor + 360) % 360;
    curState.lat += (car.lat - curState.lat) * lerpFactor;
    curState.lng += (car.lng - curState.lng) * lerpFactor;

    // Manual mode only: subtle speed feel (zoom + pitch). Showcase is always steady.
    const speedFactor = isShowcaseMode ? 0 : Math.min(car.speed / 120, 1);
    const targetZoom = cfg.zoom + speedFactor * -0.5;
    const targetPitch = Math.min(cfg.pitch + speedFactor * 3, 82);

    // Perfectly still center — no shake in showcase
    map.jumpTo({
      center: [curState.lng, curState.lat],
      bearing: curState.bearing,
      pitch: targetPitch,
      zoom: targetZoom,
    });

    // Manual mode only: motion blur at high speed
    if (!isShowcaseMode && car.speed > 60) {
      const canvas = map.getCanvas();
      const blurPx = ((car.speed - 60) / 100) * 1.2;
      canvas.style.filter = (canvas.style.filter || '').replace(/ blur\([^)]+\)/g, '') +
        ` blur(${blurPx.toFixed(2)}px)`;
    }
  }, [car, ready, cameraMode, isShowcaseMode]);

  // V key shortcut to cycle camera view mode
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyV') {
        setCameraMode((prev) => {
          const idx = CAMERA_MODES.indexOf(prev);
          return CAMERA_MODES[(idx + 1) % CAMERA_MODES.length];
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  const [weatherIntensity, setWeatherIntensity] = useState<number>(3); // 1 to 5 intensity
  const [timeInMinutes, setTimeInMinutes] = useState<number>(720); // Default 12:00 PM
  const [isTimeAutoFlow, setIsTimeAutoFlow] = useState<boolean>(false);

  // Auto-advance time cycle when isTimeAutoFlow is enabled
  // Showcase: very slow (2.4s per game-minute = ~1 real hour per hour), natural sky drift
  useEffect(() => {
    if (!isTimeAutoFlow) return;
    const interval = setInterval(() => {
      setTimeInMinutes((prev) => (prev + 1) % 1440);
    }, isShowcaseMode ? 2400 : 400);
    return () => clearInterval(interval);
  }, [isTimeAutoFlow, isShowcaseMode]);

  // Apply weather and 24-hour time of day atmosphere
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const atmos = getTimeOfDayAtmosphere(timeInMinutes);

    const canvas = map.getCanvas();
    if (weather === 'day' || weather === 'night') {
      canvas.style.filter = atmos.canvasFilter;
    } else {
      canvas.style.filter = WEATHER_FILTERS[weather];
    }

    const container = map.getContainer();
    container.style.setProperty(
      '--weather-overlay',
      weather === 'day' || weather === 'night' ? atmos.overlayColor : WEATHER_OVERLAY[weather],
    );

    try {
      if (typeof (map as any).setFog === 'function') {
        (map as any).setFog({
          range: atmos.fogRange,
          color: atmos.fogColor,
          'horizon-blend': 0.1,
        });
      }
    } catch (e) {
      console.warn('setFog error:', e);
    }
  }, [timeInMinutes, weather, ready]);

  // toggle 3d-buildings and outlines visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vis = showBuildings ? 'visible' : 'none';
    if (map.getLayer('3d-buildings')) {
      map.setLayoutProperty('3d-buildings', 'visibility', vis);
    }
    if (map.getLayer('building-outlines')) {
      map.setLayoutProperty('building-outlines', 'visibility', vis);
    }
  }, [showBuildings, ready]);

  // toggle place-labels visibility (flat ground-attached labels)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (map.getLayer('place-labels-layer')) {
      map.setLayoutProperty(
        'place-labels-layer',
        'visibility',
        showLabels ? 'visible' : 'none',
      );
    }
  }, [showLabels, ready]);

  // dynamic 3d terrain scale exaggeration update
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      if (terrainScale === 0) {
        map.setTerrain(null);
      } else {
        map.setTerrain({
          source: 'terrain-dem',
          exaggeration: terrainScale,
        });
      }
    } catch (err) {
      console.warn('Dynamic terrain exaggeration error:', err);
    }
  }, [terrainScale, ready]);

  // Collision flash visual feedback
  useEffect(() => {
    let raf = 0;
    const check = () => {
      const flashTime = physCollisionFlashRef.current;
      if (flashTime > 0 && performance.now() - flashTime < 600) {
        setCollisionFlash(1 - (performance.now() - flashTime) / 600);
        raf = requestAnimationFrame(check);
      } else {
        setCollisionFlash(0);
        physCollisionFlashRef.current = 0;
      }
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [physCollisionFlashRef]);

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
        }

        // Check if current target position is inside a building and auto-relocate to nearby road if collision is enabled
        if (enableCollision && isPointInsideBuilding(lat, lng, cached.buildings)) {
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
    [enableCollision, setCar],
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
    (
      lat: number,
      lng: number,
      label: string,
      options?: {
        keepCameraMode?: boolean;
        keepTerrainScale?: boolean;
        cameraMode?: CameraMode;
        terrainScale?: number;
        heading?: number;
        speed?: number;
      },
    ) => {
      const map = mapRef.current;
      if (!map) return;

      if (!options?.keepCameraMode) {
        setCameraMode(options?.cameraMode || 'topdown');
      }
      if (!options?.keepTerrainScale) {
        setTerrainScale(options?.terrainScale ?? 1.0);
      }

      keysRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        turbo: false,
      };

      const initHeading = options?.heading ?? 0;
      const initSpeed = options?.speed ?? (isShowcaseMode ? showcaseSpeed : 0);

      setCar({
        lat,
        lng,
        heading: initHeading,
        speed: initSpeed,
        steerAngle: 0,
        turbo: false,
      });

      cameraStateRef.current = {
        lat,
        lng,
        bearing: initHeading,
      };

      map.jumpTo({
        center: [lng, lat],
        bearing: initHeading,
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
    [setCar, refreshBuildings, keysRef, isShowcaseMode, showcaseSpeed],
  );

  // Live weather fetch helper
  const updateLiveWeather = useCallback(async (targetLat: number, targetLng: number) => {
    const live = await fetchLiveWeather(targetLat, targetLng);
    if (live) {
      setWeather(live.weather);
      setLiveWeatherDesc(live.description);
    }
  }, []);

  const handleToggleLiveWeather = useCallback(() => {
    setIsLiveWeather((prev) => {
      const next = !prev;
      if (next) {
        updateLiveWeather(car.lat, car.lng);
      } else {
        setLiveWeatherDesc('');
      }
      return next;
    });
  }, [car.lat, car.lng, updateLiveWeather]);

  // Audio Engine loop
  useEffect(() => {
    if (active && !isMuted) {
      audioEngine.update(car.speed, car.turbo);
    }
  }, [car.speed, car.turbo, active, isMuted]);

  useEffect(() => {
    if (active && !isMuted) {
      audioEngine.setWeather(weather);
    }
  }, [weather, active, isMuted]);

  const handleToggleMute = useCallback(() => {
    const muted = audioEngine.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleWeatherChange = useCallback((w: WeatherMode) => {
    setWeather(w);
    if (w === 'night') {
      setTimeInMinutes(1380); // 23:00 Night
    } else if (w === 'rain') {
      setTimeInMinutes(1110); // 18:30 Sunset
    } else if (w === 'snow') {
      setTimeInMinutes(360); // 06:00 Sunrise
    } else if (w === 'day') {
      setTimeInMinutes(720); // 12:00 Day
    }
  }, []);

  // Course selection and Random Scenic generator
  const handleSelectCourse = useCallback(
    (course: ScenicCourse) => {
      setIsLiveWeather(false);
      setLiveWeatherDesc('');
      setWeather(course.weather);
      if (course.weather === 'night') {
        setTimeInMinutes(1380); // 23:00 Night
      } else if (course.weather === 'rain') {
        setTimeInMinutes(1110); // 18:30 Sunset
      } else if (course.weather === 'snow') {
        setTimeInMinutes(360); // 06:00 Sunrise
      } else {
        setTimeInMinutes(720); // 12:00 Day
      }
      setCameraMode('topdown');
      setTerrainScale(1.0);
      handleTeleport(course.lat, course.lng, `${course.name} (${course.location})`);
    },
    [handleTeleport],
  );

  const handleRandomScenic = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * SCENIC_COURSES.length);
    const course = SCENIC_COURSES[randomIndex];
    handleSelectCourse(course);
  }, [handleSelectCourse]);

  // Showcase Ambient Engine
  const applyShowcaseScene = useCallback(
    (idx: number) => {
      const total = SHOWCASE_SCENES.length;
      const sceneIndex = ((idx % total) + total) % total;
      const scene = SHOWCASE_SCENES[sceneIndex];

      setShowcaseIndex(sceneIndex);
      setShowcaseTimer(60);

      setIsLiveWeather(false);
      setLiveWeatherDesc('');
      setTimeInMinutes(scene.timeInMinutes);
      setIsTimeAutoFlow(true); // Automatically flow time for real-time atmosphere shifts
      setWeather(scene.weather);
      setWeatherIntensity(scene.weatherIntensity);
      setCameraMode(scene.cameraMode);
      setTerrainScale(scene.terrainScale);

      handleTeleport(scene.lat, scene.lng, scene.locationLabel, {
        keepCameraMode: true,
        keepTerrainScale: true,
        heading: scene.heading ?? 0,
        speed: showcaseSpeed,
      });

      const trackIdx = DRIVING_BGM_PLAYLIST.findIndex((t) => t.id === scene.bgmTrackId);
      if (trackIdx !== -1) {
        (musicPlayer as any).currentTrackIndex = trackIdx;
        musicPlayer.play();
      }
    },
    [handleTeleport, showcaseSpeed],
  );

  const handleStartShowcase = useCallback(() => {
    setActive(true); // Ensure game physics loop is active!
    setIsShowcaseMode(true);
    setShowcasePaused(false);
    setIsCinematicLetterbox(true);
    applyShowcaseScene(0);
  }, [applyShowcaseScene]);

  const handleNextShowcase = useCallback(() => {
    applyShowcaseScene(showcaseIndex + 1);
  }, [applyShowcaseScene, showcaseIndex]);

  const handlePrevShowcase = useCallback(() => {
    applyShowcaseScene(showcaseIndex - 1);
  }, [applyShowcaseScene, showcaseIndex]);

  // Showcase Countdown Timer Loop
  useEffect(() => {
    if (!isShowcaseMode || !active || showcasePaused) return;

    const timer = setInterval(() => {
      setShowcaseTimer((prev) => {
        if (prev <= 1) {
          // Smooth fade-to-black → next scene → fade in
          setShowcaseFade(true);
          setTimeout(() => {
            handleNextShowcase();
            setTimeout(() => setShowcaseFade(false), 900);
          }, 800);
          return 80;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isShowcaseMode, active, showcasePaused, handleNextShowcase]);

  // Calm camera rotation — only peaceful angles, slow 20s cycle
  const CALM_CAMERAS: CameraMode[] = ['chase', 'sky', 'topdown'];
  useEffect(() => {
    if (!isShowcaseMode || !active || !autoCameraSwitch) return;

    const interval = setInterval(() => {
      setCameraMode((prev) => {
        const idx = CALM_CAMERAS.indexOf(prev as CameraMode);
        return CALM_CAMERAS[(idx + 1) % CALM_CAMERAS.length] ?? 'chase';
      });
    }, 20000); // 20s — slow, non-jarring

    return () => clearInterval(interval);
  }, [isShowcaseMode, active, autoCameraSwitch]);

  // Manual keypress detection -> Exit Showcase mode
  useEffect(() => {
    if (!isShowcaseMode) return;
    const handleUserControl = (e: KeyboardEvent) => {
      if (
        ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code,
        )
      ) {
        setIsShowcaseMode(false);
        setIsCinematicLetterbox(false);
        keysRef.current.forward = false;
        keysRef.current.backward = false;
        keysRef.current.left = false;
        keysRef.current.right = false;
      }
    };
    window.addEventListener('keydown', handleUserControl);
    return () => window.removeEventListener('keydown', handleUserControl);
  }, [isShowcaseMode, keysRef]);

  const handleReset = useCallback(() => {
    const currentLat = car.lat;
    const currentLng = car.lng;

    const cached = getCachedData(currentLat, currentLng);
    let targetLat = currentLat;
    let targetLng = currentLng;

    if (cached.roads && cached.roads.length > 0) {
      const safePos = findSafeRoadPosition(
        currentLat,
        currentLng,
        cached.buildings,
        cached.roads,
      );
      if (safePos) {
        targetLat = safePos.lat;
        targetLng = safePos.lng;
      }
    } else {
      const initCached = getCachedData(INITIAL.lat, INITIAL.lng);
      const safePos = findSafeRoadPosition(
        INITIAL.lat,
        INITIAL.lng,
        initCached.buildings,
        initCached.roads,
      );
      if (safePos) {
        targetLat = safePos.lat;
        targetLng = safePos.lng;
      } else {
        targetLat = INITIAL.lat;
        targetLng = INITIAL.lng;
      }
    }

    setCar((c) => ({
      ...c,
      lat: targetLat,
      lng: targetLng,
      heading: 0,
      speed: 0,
      steerAngle: 0,
    }));

    mapRef.current?.jumpTo({
      center: [targetLng, targetLat],
      bearing: 0,
      pitch: 62,
    });
  }, [car.lat, car.lng, setCar]);

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
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            </div>
            <p className="text-white font-bold text-sm">3D 지형 지도 로딩 중...</p>
          </div>
        </div>
      )}

      {/* Map error indicator */}
      {mapError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] bg-rose-500/90 text-white text-xs px-4 py-2 rounded-xl shadow-lg font-semibold flex items-center gap-2">
          <span>⚠️ {mapError}</span>
          <button
            onClick={() => setMapError(null)}
            className="text-white/80 hover:text-white underline ml-2"
          >
            닫기
          </button>
        </div>
      )}

      {/* Collision Flash Effect */}
      {collisionFlash > 0 && (
        <div
          className="absolute inset-0 z-[52] pointer-events-none transition-opacity duration-75 bg-red-600/30 border-4 border-red-500"
          style={{ opacity: collisionFlash }}
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
          {Array.from({ length: weatherIntensity * 40 + 10 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-px bg-gradient-to-b from-transparent via-cyan-200/50 to-transparent animate-rain"
              style={{
                height: `${24 + weatherIntensity * 6}px`,
                left: `${(i * 1.37) % 100}%`,
                animationDelay: `${(i % 10) * 0.08}s`,
                animationDuration: `${Math.max(0.2, 0.65 - weatherIntensity * 0.08 + (i % 5) * 0.05)}s`,
                opacity: Math.min(1, 0.4 + weatherIntensity * 0.12),
              }}
            />
          ))}
        </div>
      )}

      {/* snow effect */}
      {weather === 'snow' && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {Array.from({ length: weatherIntensity * 40 + 10 }).map((_, i) => {
            const size = (i % 3) * 1.5 + 2;
            return (
              <div
                key={i}
                className="absolute rounded-full bg-white/80 animate-snow shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  left: `${(i * 1.17) % 100}%`,
                  animationDelay: `${(i % 12) * 0.2}s`,
                  animationDuration: `${Math.max(1.5, 3.5 - weatherIntensity * 0.3 + (i % 5) * 0.5)}s`,
                  opacity: Math.min(1, 0.5 + weatherIntensity * 0.1),
                }}
              />
            );
          })}
        </div>
      )}

      {/* Start screen modal overlay */}
      {!active && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
          <div className="text-center max-w-md p-8 rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.5-.1-.9.1-1.2.5l-.6.9c-.3.4-.2 1 .2 1.3L8 12.5l-3.5 3.5-2.1-.7c-.4-.1-.8.1-1 .5l-.3.5c-.2.4-.1.8.2 1.1l3 3c.3.3.7.4 1.1.2l.5-.3c.4-.2.6-.6.5-1l-.7-2.1 3.5-3.5 3.1 4.3c.3.4.9.5 1.3.2l.9-.6c.4-.3.6-.7.5-1.2z"/>
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              OpenRaceKorea: Free Flight
            </h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              실제 OpenStreetMap 기반 지도 위를 자유롭게 비행하세요.
              <br />
              검색창에서 원하는 도시로 이동하고, 하늘에서 한국을 탐험해보세요.
            </p>
            <button
              onClick={() => setActive(true)}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-lg shadow-lg shadow-cyan-500/30 hover:scale-105 hover:shadow-cyan-500/50 transition-all"
            >
              시작하기
            </button>
            <div className="mt-4 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-cyan-300">W/A/S/D 또는 방향키로 비행</p>
              <p>Shift: 가속 &nbsp;|&nbsp; Space: 감속</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Normal Game UI (hidden completely in showcase mode) ─────────── */}
      {active && !isShowcaseMode && (
        <>
          <SearchPanel
            onTeleport={handleTeleport}
            onSelectCourse={handleSelectCourse}
            onRandomScenic={handleRandomScenic}
            onStartShowcase={handleStartShowcase}
            currentLabel={locationLabel}
          />
          <HUD
            car={car}
            locationLabel={locationLabel}
            weather={weather}
            weatherIntensity={weatherIntensity}
            showBuildings={showBuildings}
            enableCollision={enableCollision}
            showLabels={showLabels}
            terrainScale={terrainScale}
            cameraMode={cameraMode}
            isLiveWeather={isLiveWeather}
            timeInMinutes={timeInMinutes}
            isTimeAutoFlow={isTimeAutoFlow}
            isMuted={isMuted}
            liveWeatherDesc={liveWeatherDesc}
            onTimeChange={setTimeInMinutes}
            onToggleTimeAutoFlow={() => setIsTimeAutoFlow((prev) => !prev)}
            onWeatherChange={handleWeatherChange}
            onWeatherIntensityChange={setWeatherIntensity}
            onToggleBuildings={setShowBuildings}
            onToggleCollision={setEnableCollision}
            onToggleLabels={setShowLabels}
            onTerrainScaleChange={setTerrainScale}
            onToggleCameraMode={setCameraMode}
            onToggleLiveWeather={handleToggleLiveWeather}
            onToggleMute={handleToggleMute}
            onStartShowcase={handleStartShowcase}
            onReset={handleReset}
          />
          <RadioPlayer />
        </>
      )}

      {/* ── Cinematic Showcase Overlay (全스크린 영화 모드) ──────────────── */}
      {isShowcaseMode && (
        <div className="absolute inset-0 z-[60] pointer-events-none select-none">

          {/* Film grain overlay */}
          <div
            className="absolute inset-0 opacity-[0.04] z-[1]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
              backgroundSize: '128px 128px',
            }}
          />

          {/* Scene transition: fade-to-black overlay */}
          <div
            className="absolute inset-0 z-[50] bg-black pointer-events-none"
            style={{
              opacity: showcaseFade ? 1 : 0,
              transition: showcaseFade ? 'opacity 0.7s ease-in' : 'opacity 0.9s ease-out',
            }}
          />

          {/* Top letterbox bar — fades in on hover via CSS group */}
          <div
            className="absolute top-0 left-0 right-0 z-[10] flex flex-col pointer-events-auto"
            style={{ background: 'linear-gradient(to bottom, rgba(2,4,12,0.96) 60%, transparent)' }}
          >
            {/* Top black bar */}
            <div className="h-14 sm:h-16 flex items-center justify-between px-6 sm:px-10">
              {/* Left: badge + scene title */}
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black tracking-widest uppercase"
                  style={{
                    background: 'rgba(245,158,11,0.15)',
                    border: '1px solid rgba(245,158,11,0.4)',
                    color: '#fcd34d',
                    letterSpacing: '0.12em',
                  }}
                >
                  🎬 CINEMATIC DRIVE
                </span>
                <span className="text-[13px] font-semibold text-white/80 hidden sm:inline truncate max-w-xs">
                  {SHOWCASE_SCENES[showcaseIndex]?.locationLabel}
                </span>
              </div>

              {/* Right: timer + minimal controls (always visible) */}
              <div className="flex items-center gap-2">
                {/* Countdown dot ring */}
                <div className="relative flex items-center justify-center w-9 h-9">
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" width="36" height="36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                    <circle
                      cx="18" cy="18" r="15" fill="none"
                      stroke="#fbbf24" strokeWidth="2.5" strokeLinecap="round"
                      strokeDasharray={`${(showcaseTimer / 60) * 94.2} 94.2`}
                      style={{ transition: 'stroke-dasharray 0.8s linear' }}
                    />
                  </svg>
                  <span className="text-[10px] font-black text-amber-300">{showcasePaused ? '⏸' : showcaseTimer}</span>
                </div>

                <button
                  onClick={() => setShowcasePaused((p) => !p)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
                  title={showcasePaused ? '재개' : '일시정지'}
                >
                  {showcasePaused ? '▶' : '⏸'}
                </button>

                <button
                  onClick={handlePrevShowcase}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
                  title="이전 장소"
                >
                  ⏮
                </button>

                <button
                  onClick={handleNextShowcase}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all hover:scale-110"
                  style={{ background: 'rgba(251,191,36,0.25)', border: '1px solid rgba(251,191,36,0.5)' }}
                  title="다음 장소"
                >
                  ⏭
                </button>

                {/* EXIT — always visible, prominent */}
                <button
                  onClick={() => {
                    setIsShowcaseMode(false);
                    setIsCinematicLetterbox(false);
                    setIsTimeAutoFlow(false);
                  }}
                  className="ml-2 px-4 py-1.5 rounded-full text-xs font-black tracking-wider transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: 'rgba(239,68,68,0.18)',
                    border: '1px solid rgba(239,68,68,0.45)',
                    color: '#fca5a5',
                  }}
                >
                  ✕ 나가기
                </button>
              </div>
            </div>
          </div>

          {/* Bottom letterbox bar with scene info */}
          <div
            className="absolute bottom-0 left-0 right-0 z-[10] pointer-events-auto"
            style={{ background: 'linear-gradient(to top, rgba(2,4,12,0.96) 60%, transparent)' }}
          >
            <div className="h-16 sm:h-20 flex items-end justify-between px-6 sm:px-10 pb-4 sm:pb-5">
              {/* Scene title card */}
              <div className="flex flex-col gap-0.5">
                <span
                  className="text-[10px] font-black tracking-[0.2em] uppercase"
                  style={{ color: 'rgba(251,191,36,0.7)' }}
                >
                  SCENE {showcaseIndex + 1} / {SHOWCASE_SCENES.length}
                </span>
                <span className="text-base sm:text-xl font-black text-white leading-tight truncate max-w-[280px] sm:max-w-lg">
                  {SHOWCASE_SCENES[showcaseIndex]?.title}
                </span>
                <span className="text-[11px] text-white/50 hidden sm:block">
                  {SHOWCASE_SCENES[showcaseIndex]?.description}
                </span>
              </div>

              {/* Speed display */}
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-3xl sm:text-4xl font-black text-white tabular-nums" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(car.speed)}
                </span>
                <span className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  KM/H
                </span>
              </div>
            </div>
          </div>

          {/* Left/right vignette edges */}
          <div
            className="absolute inset-0 z-[2] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)',
            }}
          />
        </div>
      )}

      {/* Mobile touch controls (only in manual mode) */}
      {active && !isShowcaseMode && (
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
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const baseRef = useRef<HTMLDivElement>(null);

  const updateJoystick = useCallback(
    (clientX: number, clientY: number) => {
      if (!baseRef.current) return;
      const rect = baseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      const maxRadius = 42; // Joystick max knob offset radius
      const clampedDist = Math.min(dist, maxRadius);
      const angle = Math.atan2(dy, dx);

      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      setKnobPos({ x: knobX, y: knobY });

      // Normalized values from -1.0 to 1.0
      const normX = dx / maxRadius;
      const normY = dy / maxRadius;

      // Deadzone threshold
      const deadzone = 0.22;

      keysRef.current.left = normX < -deadzone;
      keysRef.current.right = normX > deadzone;
      keysRef.current.forward = normY < -deadzone;
      keysRef.current.backward = normY > deadzone;
    },
    [keysRef],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    updateJoystick(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateJoystick(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    keysRef.current.forward = false;
    keysRef.current.backward = false;
    keysRef.current.left = false;
    keysRef.current.right = false;
  };

  return (
    <div className="md:hidden absolute bottom-5 left-4 right-4 z-50 flex items-end justify-between pointer-events-none touch-none select-none">
      {/* 360° Virtual Joystick */}
      <div className="pointer-events-auto flex flex-col items-center">
        <div
          ref={baseRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative w-32 h-32 rounded-full bg-slate-950/85 backdrop-blur-xl border-2 border-cyan-400/50 shadow-2xl shadow-cyan-950/50 flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
        >
          {/* Inner ring track guide */}
          <div className="absolute inset-2 rounded-full border border-dashed border-cyan-500/25 pointer-events-none" />
          <div className="absolute w-full h-[1px] bg-cyan-500/15 pointer-events-none" />
          <div className="absolute h-full w-[1px] bg-cyan-500/15 pointer-events-none" />

          {/* Thumb Knob */}
          <div
            className={`w-14 h-14 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-lg shadow-cyan-500/40 border-2 border-white/70 flex items-center justify-center transition-transform ${
              isDragging ? 'scale-105 shadow-cyan-400/60' : 'duration-150'
            }`}
            style={{
              transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            }}
          >
            <div className="w-5 h-5 rounded-full bg-white/30 border border-white/50" />
          </div>
        </div>
        <span className="text-[10px] text-cyan-300/80 mt-1 font-semibold tracking-wider drop-shadow">
          360° 조이스틱
        </span>
      </div>

      {/* Turbo Boost Button */}
      <div className="pointer-events-auto flex items-center pb-2">
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            keysRef.current.turbo = true;
          }}
          onPointerUp={() => (keysRef.current.turbo = false)}
          onPointerLeave={() => (keysRef.current.turbo = false)}
          onPointerCancel={() => (keysRef.current.turbo = false)}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/90 to-amber-600/90 backdrop-blur-xl border border-orange-400/60 text-white font-black text-xs flex flex-col items-center justify-center shadow-xl shadow-orange-500/40 active:scale-95 transition-all touch-none select-none"
        >
          <span className="text-xl leading-none mb-0.5">⚡</span>
          <span>TURBO</span>
        </button>
      </div>
    </div>
  );
}
