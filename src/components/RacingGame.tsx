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
  const [showcaseTimer, setShowcaseTimer] = useState<number>(60);
  const [showcaseSpeed, setShowcaseSpeed] = useState<number>(50); // 50 km/h smooth cruise speed
  const [showcasePaused, setShowcasePaused] = useState<boolean>(false);
  const [autoCameraSwitch, setAutoCameraSwitch] = useState<boolean>(true); // Auto cycle camera angles
  const [isCinematicLetterbox, setIsCinematicLetterbox] = useState<boolean>(false);

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

      // Store initial marker
      const el = document.createElement('div');
      el.className = 'car-marker';
      el.innerHTML = `
        <svg width="36" height="52" viewBox="0 0 36 52" fill="none">
          <rect x="3" y="1" width="30" height="50" rx="8" fill="#0284c7" stroke="#000000" stroke-width="1.5"/>
          <rect x="6" y="10" width="24" height="14" rx="4" fill="#38bdf8" opacity="0.9"/>
          <rect x="6" y="30" width="24" height="12" rx="3" fill="#1e293b"/>
          <circle cx="9" cy="4" r="2.5" fill="#fef08a"/>
          <circle cx="27" cy="4" r="2.5" fill="#fef08a"/>
          <rect x="4" y="16" width="4" height="8" rx="1.5" fill="#1a1a1a"/>
          <rect x="28" y="16" width="4" height="8" rx="1.5" fill="#1a1a1a"/>
          <rect x="4" y="40" width="4" height="8" rx="1.5" fill="#1a1a1a"/>
          <rect x="28" y="40" width="4" height="8" rx="1.5" fill="#1a1a1a"/>
        </svg>
      `;
      const wheelL = el.querySelector('rect:nth-of-type(3)') as SVGRectElement | null;
      const wheelR = el.querySelector('rect:nth-of-type(4)') as SVGRectElement | null;

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

  // Smooth camera following sync with damped exponential interpolation
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const marker = (map as any)._marker;
    if (marker) {
      marker.setLngLat([car.lng, car.lat]);
      marker.setRotation(car.heading);

      const el = markerRef.current;
      if (el) {
        const wL = (el as any)._wheelL as SVGRectElement | null;
        const wR = (el as any)._wheelR as SVGRectElement | null;
        const steerDeg = car.steerAngle * 30;
        [wL, wR].forEach((w) => {
          if (w) w.setAttribute('transform', `rotate(${steerDeg} 6 20)`);
        });
      }
    }

    const cfg = CAMERA_CONFIG[cameraMode];
    let targetBearing = car.heading;

    if (cameraMode === 'cinematic') {
      const nowSec = performance.now() / 1000;
      targetBearing = (nowSec * 10) % 360;
    }

    const curState = cameraStateRef.current;
    let deltaBearing = (targetBearing - curState.bearing) % 360;
    if (deltaBearing > 180) deltaBearing -= 360;
    if (deltaBearing < -180) deltaBearing += 360;

    // Smooth Lerp factor (0.04 for showcase/cinematic mode for ultra calm motion, 0.18 for manual driving)
    const lerpFactor = isShowcaseMode || cameraMode === 'cinematic' ? 0.04 : 0.18;
    curState.bearing = (curState.bearing + deltaBearing * lerpFactor + 360) % 360;
    curState.lat += (car.lat - curState.lat) * lerpFactor;
    curState.lng += (car.lng - curState.lng) * lerpFactor;

    map.jumpTo({
      center: [curState.lng, curState.lat],
      bearing: curState.bearing,
      pitch: cfg.pitch,
      zoom: cfg.zoom,
    });
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
  useEffect(() => {
    if (!isTimeAutoFlow) return;
    const interval = setInterval(() => {
      setTimeInMinutes((prev) => (prev + 1) % 1440);
    }, 400);
    return () => clearInterval(interval);
  }, [isTimeAutoFlow]);

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
      options?: { keepCameraMode?: boolean; keepTerrainScale?: boolean; cameraMode?: CameraMode; terrainScale?: number },
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

      setCar({
        lat,
        lng,
        heading: 0,
        speed: 0,
        steerAngle: 0,
        turbo: false,
      });

      cameraStateRef.current = {
        lat,
        lng,
        bearing: 0,
      };

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
    [setCar, refreshBuildings, keysRef],
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
      });

      const trackIdx = DRIVING_BGM_PLAYLIST.findIndex((t) => t.id === scene.bgmTrackId);
      if (trackIdx !== -1) {
        (musicPlayer as any).currentTrackIndex = trackIdx;
        musicPlayer.play();
      }
    },
    [handleTeleport],
  );

  const handleStartShowcase = useCallback(() => {
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
          handleNextShowcase();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isShowcaseMode, active, showcasePaused, handleNextShowcase]);

  // Auto camera angle rotation while zoning out in Showcase Mode
  useEffect(() => {
    if (!isShowcaseMode || !active || !autoCameraSwitch) return;

    const interval = setInterval(() => {
      setCameraMode((prev) => {
        const idx = CAMERA_MODES.indexOf(prev);
        return CAMERA_MODES[(idx + 1) % CAMERA_MODES.length];
      });
    }, 14000);

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
                <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
                  <path d="M20 70 L50 30 L80 70 Z" fill="#38bdf8" opacity="0.8" />
                  <path d="M50 30 L50 70" stroke="#0f172a" strokeWidth="4" strokeDasharray="6 4" />
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

      {/* HUD & Showcase Banner */}
      {active && (
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

      {/* Cinematic Letterbox Film Bars */}
      {(isCinematicLetterbox || isShowcaseMode) && (
        <>
          <div className="absolute top-0 left-0 right-0 h-12 sm:h-14 bg-slate-950/95 backdrop-blur-md z-[55] border-b border-white/10 flex items-center justify-between px-6 transition-all duration-500 animate-fade-in pointer-events-auto">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-bold">
                🎬 시네마틱 멍때리기 뷰
              </span>
              <span className="text-xs text-slate-300 font-semibold truncate hidden sm:inline">
                {SHOWCASE_SCENES[showcaseIndex]?.title}
              </span>
            </div>
            <button
              onClick={() => setIsCinematicLetterbox(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-white/10 transition-colors"
            >
              ✕ 레터박스 닫기
            </button>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-12 sm:h-14 bg-slate-950/95 backdrop-blur-md z-[55] border-t border-white/10 flex items-center justify-between px-6 transition-all duration-500 animate-fade-in pointer-events-none" />
        </>
      )}

      {/* Showcase Mode Ambient Control Banner */}
      {isShowcaseMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 animate-fade-in pointer-events-auto max-w-[calc(100vw-2rem)]">
          <div className="rounded-2xl bg-slate-900/95 backdrop-blur-2xl border-2 border-amber-400/50 shadow-2xl p-3 flex flex-col sm:flex-row items-center gap-3">
            {/* Location Title & Info */}
            <div className="flex items-center gap-3 pr-2 sm:border-r border-white/15">
              <Film className="h-5 w-5 text-amber-400 animate-pulse shrink-0" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-amber-300 tracking-wider uppercase">
                    ☕ 멍때리기 구경하기 ({showcaseIndex + 1}/{SHOWCASE_SCENES.length})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 font-bold">
                    {showcasePaused ? '⏸️ 일시정지' : `다음 장소 ${showcaseTimer}초`}
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-bold text-white tracking-wide truncate max-w-[220px] sm:max-w-xs">
                  {SHOWCASE_SCENES[showcaseIndex]?.title}
                </span>
              </div>
            </div>

            {/* Navigation & Speed Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePrevShowcase}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-amber-200 text-xs font-bold transition-all active:scale-95 shrink-0"
                title="이전 장소로 이동"
              >
                ⏮️ 이전
              </button>

              <button
                onClick={handleNextShowcase}
                className="px-3 py-1.5 rounded-xl bg-amber-500/30 hover:bg-amber-500/40 border border-amber-400/50 text-amber-200 text-xs font-bold transition-all flex items-center gap-1 shadow-lg shadow-amber-950/40 active:scale-95 shrink-0 animate-pulse"
                title="다음 장소로 이동"
              >
                ⏭️ 다음 장소
              </button>

              <button
                onClick={() => setShowcasePaused((prev) => !prev)}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-slate-200 text-xs font-bold transition-all active:scale-95 shrink-0"
                title="자동 순환 일시정지/재개"
              >
                {showcasePaused ? '▶️ 재개' : '⏸️ 정지'}
              </button>

              {/* Speed Preset Switcher */}
              <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setShowcaseSpeed(35)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    showcaseSpeed === 35
                      ? 'bg-amber-400 text-slate-950 font-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="🐌 차분히 (35km/h 스무스 관람)"
                >
                  🐌 35
                </button>
                <button
                  onClick={() => setShowcaseSpeed(60)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    showcaseSpeed === 60
                      ? 'bg-amber-400 text-slate-950 font-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="🚗 보통 (60km/h)"
                >
                  🚗 60
                </button>
                <button
                  onClick={() => setShowcaseSpeed(95)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    showcaseSpeed === 95
                      ? 'bg-amber-400 text-slate-950 font-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="🏎️ 빠르게 (95km/h)"
                >
                  🏎️ 95
                </button>
              </div>

              {/* Auto Camera Cycle Toggle */}
              <button
                onClick={() => setAutoCameraSwitch((prev) => !prev)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  autoCameraSwitch
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                    : 'bg-white/5 text-slate-400 border-white/10'
                }`}
                title="시점 14초마다 자동 전환"
              >
                🎥 시점자동 {autoCameraSwitch ? 'ON' : 'OFF'}
              </button>

              {/* Stop Showcase */}
              <button
                onClick={() => {
                  setIsShowcaseMode(false);
                  setIsCinematicLetterbox(false);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-bold transition-all active:scale-95 shrink-0"
              >
                🛑 직접 운전
              </button>
            </div>
          </div>
          <p className="text-[10px] font-medium text-amber-200/80 bg-slate-950/80 px-3 py-0.5 rounded-full border border-amber-400/20 drop-shadow text-center">
            ☕ 편안하게 멍때리며 관람하는 모드입니다. 자동차 시점, 날씨, 시간, 장소가 차분하게 자동 연출됩니다.
          </p>
        </div>
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
