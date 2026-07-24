import { useEffect, useRef, useState } from 'react';
import type { CarState, KeysPressed } from '@/types/game';
import type { BuildingFeature, RoadSegment } from '@/utils/buildings';
import {
  pointInPolygon,
  distToNearestRoad,
  isPointInsideBuilding,
  findSafeRoadPosition,
} from '@/utils/buildings';

const MAX_SPEED = 420; // km/h (Uncapped high speed!)
const TURBO_SPEED = 650; // km/h boost mode!
const MIN_SPEED = -60; // km/h reverse
const ACCEL = 120; // km/h per second
const TURBO_ACCEL = 260; // km/h per second when boosting
const BRAKE = 180;
const FRICTION = 12;
const OFF_ROAD_FRICTION = 10;
const OFF_ROAD_MAX_SPEED = 350; // km/h off-road max speed
const STEER_RATE = 135; // degrees per second at full steer
const STEER_RETURN = 8; // how fast wheel returns to center

export interface CollisionData {
  buildings: BuildingFeature[];
  roads: RoadSegment[];
}

export function useCarPhysics(
  initial: { lat: number; lng: number; heading: number },
  active: boolean,
  collisionRef?: React.MutableRefObject<CollisionData | null>,
  enableCollision: boolean = true,
  isShowcaseMode: boolean = false,
  showcaseSpeedTarget: number = 40,
) {
  const [car, setCar] = useState<CarState>({
    lat: initial.lat,
    lng: initial.lng,
    heading: initial.heading,
    speed: 0,
    steerAngle: 0,
    turbo: false,
  });

  const keysRef = useRef<KeysPressed>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    turbo: false,
  });

  const carRef = useRef(car);
  carRef.current = car;

  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const collisionFlashRef = useRef(0);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      setCar((c) => ({ ...c, speed: 0, steerAngle: 0 }));
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;

      setCar((prev) => {
        const k = keysRef.current;
        let speed = prev.speed;
        let steer = prev.steerAngle;

        const turboActive = k.turbo && k.forward && speed >= 0;
        const maxSpeed = turboActive ? TURBO_SPEED : MAX_SPEED;
        const accel = turboActive ? TURBO_ACCEL : ACCEL;

        if (isShowcaseMode) {
          // Smooth cruise speed control in showcase mode (calm and steady)
          if (speed < showcaseSpeedTarget) {
            speed = Math.min(showcaseSpeedTarget, speed + ACCEL * dt * 0.3);
          } else if (speed > showcaseSpeedTarget) {
            speed = Math.max(showcaseSpeedTarget, speed - BRAKE * dt * 0.4);
          }

          // Ultra gentle long-wave curve steering without any sharp dizzying turns
          const nowSec = performance.now() / 1000;
          const targetSteer = Math.sin(nowSec * 0.15) * 0.12;
          steer += (targetSteer - steer) * Math.min(1, 2 * dt);
        } else {
          // Manual driving controls
          if (k.forward) speed += accel * dt;
          else if (k.backward) speed -= ACCEL * dt * 1.5;
          else {
            if (speed > 0) speed = Math.max(0, speed - FRICTION * dt);
            else if (speed < 0) speed = Math.min(0, speed + FRICTION * dt);
          }

          speed = Math.max(MIN_SPEED, Math.min(maxSpeed, speed));

          if (k.backward && speed > 0) speed = Math.max(0, speed - BRAKE * dt);
          if (k.forward && speed < 0) speed = Math.min(0, speed + BRAKE * dt);

          // Manual steering
          const steerInput = (k.right ? 1 : 0) - (k.left ? 1 : 0);
          if (steerInput !== 0) {
            steer += steerInput * STEER_RETURN * dt;
            steer = Math.max(-1, Math.min(1, steer));
          } else {
            if (steer > 0) steer = Math.max(0, steer - STEER_RETURN * dt * 2);
            else if (steer < 0) steer = Math.min(0, steer + STEER_RETURN * dt * 2);
          }
        }

        const speedFactor = Math.min(1, Math.abs(speed) / 25);
        let heading = prev.heading;
        if (speedFactor > 0.01) {
          heading += steer * STEER_RATE * dt * speedFactor * (speed >= 0 ? 1 : -1);
          heading = (heading + 360) % 360;
        }

        // ── Compute next position ─────────────────────────
        const speedMs = speed / 3.6;
        const dist = speedMs * dt;
        const rad = (heading * Math.PI) / 180;
        const cosH = Math.cos(rad);
        const sinH = Math.sin(rad);
        const dLat = (dist * cosH) / 111111;
        const dLng =
          (dist * sinH) /
          (111111 * Math.cos((prev.lat * Math.PI) / 180));

        const nextLat = prev.lat + dLat;
        const nextLng = prev.lng + dLng;

        // ── Collision detection ────────────────────────────
        const coll = collisionRef?.current;
        let finalLat = nextLat;
        let finalLng = nextLng;
        let collided = false;
        let offRoad = false;

        if (enableCollision && coll && Math.abs(speed) > 0.5) {
          // Check building collision
          for (const b of coll.buildings) {
            const poly = b.geometry.coordinates[0];
            if (poly.length < 3) continue;
            // Quick bounding-box check
            let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
            for (const c of poly) {
              if (c[1] < minLat) minLat = c[1];
              if (c[1] > maxLat) maxLat = c[1];
              if (c[0] < minLng) minLng = c[0];
              if (c[0] > maxLng) maxLng = c[0];
            }
            if (nextLat < minLat || nextLat > maxLat || nextLng < minLng || nextLng > maxLng)
              continue;

            if (pointInPolygon(nextLat, nextLng, poly)) {
              collided = true;
              break;
            }
          }

          if (collided) {
            // Bounce back: keep old position, reverse speed
            finalLat = prev.lat;
            finalLng = prev.lng;
            speed = -speed * 0.15;
            collisionFlashRef.current = performance.now();
          } else {
            // Check off-road
            const roadDist = distToNearestRoad(nextLat, nextLng, coll.roads);
            if (roadDist > 5) {
              offRoad = true;
            }
          }
        } else if (enableCollision && coll && Math.abs(speed) <= 0.5) {
          // If stationary and stuck inside building, push to nearest road
          if (isPointInsideBuilding(prev.lat, prev.lng, coll.buildings)) {
            const safePos = findSafeRoadPosition(
              prev.lat,
              prev.lng,
              coll.buildings,
              coll.roads,
            );
            if (safePos && (safePos.lat !== prev.lat || safePos.lng !== prev.lng)) {
              finalLat = safePos.lat;
              finalLng = safePos.lng;
            }
          }
        }

        // ── Off-road friction ──────────────────────────────
        if (offRoad) {
          // Extra friction slows the car
          if (speed > 0) speed = Math.max(0, speed - OFF_ROAD_FRICTION * dt);
          else if (speed < 0) speed = Math.min(0, speed + OFF_ROAD_FRICTION * dt);
          // Cap speed off-road
          if (speed > OFF_ROAD_MAX_SPEED) speed = OFF_ROAD_MAX_SPEED;
          if (speed < -OFF_ROAD_MAX_SPEED) speed = -OFF_ROAD_MAX_SPEED;
        }

        return {
          lat: finalLat,
          lng: finalLng,
          heading,
          speed,
          steerAngle: steer,
          turbo: turboActive,
        };
      });

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, collisionRef]);

  // keyboard
  useEffect(() => {
    if (!active) return;

    const down = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          keysRef.current.forward = true;
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 'KeyS':
          keysRef.current.backward = true;
          e.preventDefault();
          break;
        case 'ArrowLeft':
        case 'KeyA':
          keysRef.current.left = true;
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'KeyD':
          keysRef.current.right = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keysRef.current.turbo = true;
          break;
      }
    };

    const up = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':
        case 'KeyW':
          keysRef.current.forward = false;
          break;
        case 'ArrowDown':
        case 'KeyS':
          keysRef.current.backward = false;
          break;
        case 'ArrowLeft':
        case 'KeyA':
          keysRef.current.left = false;
          break;
        case 'ArrowRight':
        case 'KeyD':
          keysRef.current.right = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keysRef.current.turbo = false;
          break;
      }
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      keysRef.current = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        turbo: false,
      };
    };
  }, [active]);

  return { car, setCar, keysRef, collisionFlashRef };
}
