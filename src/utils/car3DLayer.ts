/**
 * car3DLayer.ts
 * Three.js 3D car model rendered as a MapLibre custom layer.
 * Features: body roll on turns, spinning wheels, glowing headlights/taillights,
 * metallic paint, chrome rims, subtle suspension bounce.
 */
import * as THREE from 'three';
import type maplibregl from 'maplibre-gl';
import maplibre from 'maplibre-gl';

export interface Car3DState {
  lat: number;
  lng: number;
  heading: number; // degrees
  speed: number;   // km/h
  steerAngle: number; // -1..1
}

// The mutable ref the custom layer reads each frame – no React re-renders needed
let _stateRef: Car3DState = { lat: 0, lng: 0, heading: 0, speed: 0, steerAngle: 0 };

export function setCar3DState(s: Car3DState) {
  _stateRef = s;
}

// ─── Car mesh builder ──────────────────────────────────────────────
function buildCarGroup(): {
  group: THREE.Group;
  wheels: THREE.Mesh[];
  frontWheels: THREE.Mesh[];
  bodyMesh: THREE.Mesh;
  shadowPlane: THREE.Mesh;
} {
  const group = new THREE.Group();

  // ── Materials ──
  const bodyPaint = new THREE.MeshPhongMaterial({
    color: 0x1a56db,
    specular: 0x88aaff,
    shininess: 160,
    reflectivity: 1,
  });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x0d0d0d, shininess: 40 });
  const glassMat = new THREE.MeshPhongMaterial({
    color: 0x8ecae6,
    transparent: true,
    opacity: 0.55,
    shininess: 300,
    specular: 0xffffff,
  });
  const chromeMat = new THREE.MeshPhongMaterial({
    color: 0xcccccc,
    specular: 0xffffff,
    shininess: 400,
    reflectivity: 1,
  });
  const headlightMat = new THREE.MeshPhongMaterial({
    color: 0xfff8e1,
    emissive: 0xffe082,
    emissiveIntensity: 2.0,
    shininess: 200,
  });
  const taillightMat = new THREE.MeshPhongMaterial({
    color: 0xff1744,
    emissive: 0xff1744,
    emissiveIntensity: 2.5,
    shininess: 200,
  });
  const underbodyMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 10 });

  // ── Scale: 1 unit = 1 meter ──
  // Car dimensions (sedan): 4.5m long, 1.9m wide, 1.45m tall

  // Lower body
  const lowerBodyGeo = new THREE.BoxGeometry(1.85, 0.52, 4.4);
  const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyPaint);
  lowerBody.position.set(0, 0.56, 0);
  lowerBody.castShadow = true;
  group.add(lowerBody);

  // Front hood (sloped)
  const hoodGeo = new THREE.BoxGeometry(1.82, 0.08, 1.3);
  const hood = new THREE.Mesh(hoodGeo, bodyPaint);
  hood.position.set(0, 0.84, 1.3);
  hood.rotation.x = 0.06;
  hood.castShadow = true;
  group.add(hood);

  // Trunk
  const trunkGeo = new THREE.BoxGeometry(1.82, 0.08, 1.0);
  const trunk = new THREE.Mesh(trunkGeo, bodyPaint);
  trunk.position.set(0, 0.84, -1.45);
  trunk.rotation.x = -0.04;
  trunk.castShadow = true;
  group.add(trunk);

  // Cabin roof
  const roofGeo = new THREE.BoxGeometry(1.6, 0.45, 2.1);
  const roof = new THREE.Mesh(roofGeo, bodyPaint);
  roof.position.set(0, 1.14, -0.1);
  roof.castShadow = true;
  group.add(roof);

  // Windshield front
  const wfGeo = new THREE.BoxGeometry(1.52, 0.7, 0.08);
  const wf = new THREE.Mesh(wfGeo, glassMat);
  wf.position.set(0, 1.04, 1.0);
  wf.rotation.x = 0.52;
  group.add(wf);

  // Windshield rear
  const wrGeo = new THREE.BoxGeometry(1.52, 0.62, 0.08);
  const wr = new THREE.Mesh(wrGeo, glassMat);
  wr.position.set(0, 1.02, -1.12);
  wr.rotation.x = -0.52;
  group.add(wr);

  // Side windows (left)
  const swGeo = new THREE.BoxGeometry(0.06, 0.42, 1.7);
  const swL = new THREE.Mesh(swGeo, glassMat);
  swL.position.set(-0.82, 1.04, -0.1);
  group.add(swL);
  const swR = new THREE.Mesh(swGeo, glassMat);
  swR.position.set(0.82, 1.04, -0.1);
  group.add(swR);

  // Front bumper
  const fbGeo = new THREE.BoxGeometry(1.8, 0.28, 0.18);
  const fb = new THREE.Mesh(fbGeo, darkMat);
  fb.position.set(0, 0.38, 2.29);
  group.add(fb);

  // Rear bumper
  const rbGeo = new THREE.BoxGeometry(1.8, 0.28, 0.18);
  const rb = new THREE.Mesh(rbGeo, darkMat);
  rb.position.set(0, 0.38, -2.29);
  group.add(rb);

  // Front grille
  const grGeo = new THREE.BoxGeometry(1.1, 0.14, 0.05);
  const gr = new THREE.Mesh(grGeo, chromeMat);
  gr.position.set(0, 0.48, 2.38);
  group.add(gr);

  // Headlights (2x)
  const hlGeo = new THREE.BoxGeometry(0.42, 0.14, 0.06);
  const hlL = new THREE.Mesh(hlGeo, headlightMat);
  hlL.position.set(-0.62, 0.68, 2.23);
  group.add(hlL);
  const hlR = new THREE.Mesh(hlGeo, headlightMat);
  hlR.position.set(0.62, 0.68, 2.23);
  group.add(hlR);

  // Taillights (2x)
  const tlGeo = new THREE.BoxGeometry(0.55, 0.12, 0.06);
  const tlL = new THREE.Mesh(tlGeo, taillightMat);
  tlL.position.set(-0.6, 0.72, -2.23);
  group.add(tlL);
  const tlR = new THREE.Mesh(tlGeo, taillightMat);
  tlR.position.set(0.6, 0.72, -2.23);
  group.add(tlR);

  // Spoiler
  const spGeo = new THREE.BoxGeometry(1.55, 0.06, 0.24);
  const sp = new THREE.Mesh(spGeo, bodyPaint);
  sp.position.set(0, 1.38, -2.0);
  group.add(sp);
  const spLegGeo = new THREE.BoxGeometry(0.06, 0.22, 0.06);
  [-0.65, 0.65].forEach((x) => {
    const leg = new THREE.Mesh(spLegGeo, bodyPaint);
    leg.position.set(x, 1.26, -2.0);
    group.add(leg);
  });

  // Underbody flat plate
  const ubGeo = new THREE.BoxGeometry(1.7, 0.05, 4.2);
  const ub = new THREE.Mesh(ubGeo, underbodyMat);
  ub.position.set(0, 0.29, 0);
  group.add(ub);

  // ── Wheels ──
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 24);
  const tireMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 20 });
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.26, 6);
  const rimMat = new THREE.MeshPhongMaterial({ color: 0xbdbdbd, specular: 0xffffff, shininess: 500 });
  const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.28, 8);
  const hubMat = new THREE.MeshPhongMaterial({ color: 0x888888, shininess: 300 });

  const wheels: THREE.Mesh[] = [];
  const frontWheels: THREE.Mesh[] = [];

  const wheelPositions = [
    { x: -0.97, z: 1.45, front: true },
    { x: 0.97, z: 1.45, front: true },
    { x: -0.97, z: -1.45, front: false },
    { x: 0.97, z: -1.45, front: false },
  ];

  wheelPositions.forEach(({ x, z, front }) => {
    const wGroup = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wGroup.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wGroup.add(rim);

    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    wGroup.add(hub);

    wGroup.position.set(x, 0.34, z);
    group.add(wGroup);
    wheels.push(wGroup as unknown as THREE.Mesh);
    if (front) frontWheels.push(wGroup as unknown as THREE.Mesh);
  });

  // Drop shadow plane (billboard circle below car)
  const shadowGeo = new THREE.CircleGeometry(2.0, 24);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.01;
  group.add(shadowPlane);

  return { group, wheels, frontWheels, bodyMesh: lowerBody, shadowPlane };
}

// ─── MapLibre Custom Layer ─────────────────────────────────────────
export function createCar3DLayer(map: maplibregl.Map): maplibregl.CustomLayerInterface {
  let camera: THREE.Camera;
  let scene: THREE.Scene;
  let renderer: THREE.WebGLRenderer;
  let carGroup: THREE.Group;
  let wheels: THREE.Mesh[];
  let frontWheels: THREE.Mesh[];
  let bodyMesh: THREE.Mesh;
  let wheelRotation = 0;

  const layer: maplibregl.CustomLayerInterface = {
    id: 'car-3d-model',
    type: 'custom',
    renderingMode: '3d',

    onAdd(_map, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      // Directional sunlight
      const sun = new THREE.DirectionalLight(0xfff8f0, 2.2);
      sun.position.set(0.5, 1, 0.5);
      scene.add(sun);

      // Ambient fill
      const ambient = new THREE.AmbientLight(0x405070, 1.2);
      scene.add(ambient);

      // Hemisphere sky light
      const hemi = new THREE.HemisphereLight(0x89c4f4, 0x444444, 0.8);
      scene.add(hemi);

      const built = buildCarGroup();
      carGroup = built.group;
      wheels = built.wheels;
      frontWheels = built.frontWheels;
      bodyMesh = built.bodyMesh;

      scene.add(carGroup);

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
      renderer.shadowMap.enabled = true;
    },

    render(_gl, matrix) {
      const s = _stateRef;

      // Convert lat/lng → Mercator coordinate
      const mc = maplibre.MercatorCoordinate.fromLngLat({ lng: s.lng, lat: s.lat }, 0);
      const metersPerUnit = mc.meterInMercatorCoordinateUnits();

      // Car orientation: MapLibre map has Y-up, north = +Z
      // heading 0 = north = +Z in our car model (car faces +Z by default)
      const headingRad = (s.heading * Math.PI) / 180;

      // Position matrix in Mercator space
      const tx = mc.x;
      const ty = mc.y;
      const tz = mc.z ?? 0;
      const scale = metersPerUnit;

      // Build model matrix: translate → scale → rotate Y (heading)
      // MapLibre matrix: world space is Mercator, Y is inverted
      const rotY = new THREE.Matrix4().makeRotationY(headingRad);
      const scaleM = new THREE.Matrix4().makeScale(scale, -scale, scale);
      const translateM = new THREE.Matrix4().makeTranslation(tx, ty, tz);

      const modelMatrix = new THREE.Matrix4()
        .fromArray(matrix)
        .multiply(translateM)
        .multiply(scaleM)
        .multiply(rotY);

      camera.projectionMatrix = modelMatrix;

      // ── Wheel spinning based on speed ──
      const speedMs = s.speed / 3.6;
      const wheelCircumference = 2 * Math.PI * 0.34; // r=0.34m
      const dRot = (speedMs / wheelCircumference) * (1 / 60) * (2 * Math.PI); // approx per frame @60fps
      wheelRotation -= dRot; // negative = forward spin
      wheels.forEach((w) => {
        // tire is a child with rotation.z = PI/2, so spinning means rotation.y
        const tire = w.children[0] as THREE.Mesh;
        if (tire) tire.rotation.x = wheelRotation;
      });

      // ── Front wheel steering ──
      const steerMax = 0.42; // radians max
      const steer = s.steerAngle * steerMax;
      frontWheels.forEach((w) => {
        w.rotation.y = steer;
      });

      // ── Body roll on corners ──
      const bodyRoll = -s.steerAngle * 0.045 * Math.min(s.speed / 60, 1);
      carGroup.rotation.z = bodyRoll;

      // ── Suspension bounce ──
      const t = performance.now() / 1000;
      const bounce = Math.sin(t * (3 + s.speed * 0.05)) * (0.004 + s.speed * 0.00005);
      carGroup.position.y = bounce;

      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  };

  return layer;
}
