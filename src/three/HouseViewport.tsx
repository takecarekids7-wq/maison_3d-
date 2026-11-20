import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CAMERA_PRESETS,
  PLAN_OFFSET,
  ROOMS,
  ROOMS_BY_ID,
  toWorld,
} from '../data/housePlanData';
import { WallCollider, buildHouseModel, isPointInsideRoom } from './houseBuilder';
import { createMaterialPalette } from './materials';

export type NavMode = 'orbit' | 'walk';
export type LightingMode = 'day' | 'golden' | 'night';

export interface CameraTelemetry {
  planX: number;
  planZ: number;
  yaw: number;
  currentRoomId: string | null;
}

interface HouseViewportProps {
  navMode: NavMode;
  wallHeight: number;
  selectedRoomId: string | null;
  hoveredRoomId: string | null;
  showFurniture: boolean;
  showLabels: boolean;
  lightingMode: LightingMode;
  presetRequest: { id: string; seq: number } | null;
  focusRoomRequest: { roomId: string; seq: number } | null;
  onSelectRoom: (roomId: string | null) => void;
  onHoverRoom: (roomId: string | null) => void;
  onCameraTelemetry: (telemetry: CameraTelemetry) => void;
}

// Reusable pre-allocated math helpers outside render loop
const _vec3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _mouse = new THREE.Vector2();

function resolveWalkCollision(
  x: number,
  z: number,
  radius: number,
  colliders: WallCollider[],
): { x: number; z: number } {
  let rx = x;
  let rz = z;
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const abx = c.bx - c.ax;
      const abz = c.bz - c.az;
      const lenSq = abx * abx + abz * abz;
      if (lenSq < 1e-6) continue;
      const apx = rx - c.ax;
      const apz = rz - c.az;
      const t = THREE.MathUtils.clamp((apx * abx + apz * abz) / lenSq, 0, 1);
      const closestX = c.ax + abx * t;
      const closestZ = c.az + abz * t;
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;
      const minDist = radius + c.halfThick;
      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        if (dist > 1e-5) {
          const push = minDist - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          const len = Math.sqrt(lenSq);
          rx += (-abz / len) * minDist;
          rz += (abx / len) * minDist;
        }
      }
    }
  }
  return { x: rx, z: rz };
}

export const HouseViewport: React.FC<HouseViewportProps> = ({
  navMode,
  wallHeight,
  selectedRoomId,
  hoveredRoomId,
  showFurniture,
  showLabels,
  lightingMode,
  presetRequest,
  focusRoomRequest,
  onSelectRoom,
  onHoverRoom,
  onCameraTelemetry,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelLayerRef = useRef<HTMLDivElement | null>(null);
  const labelNodesRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [contextLost, setContextLost] = useState(false);

  // Sync latest props into refs so the WebGL lifecycle never tears down
  const propsRef = useRef({
    navMode,
    wallHeight,
    selectedRoomId,
    hoveredRoomId,
    showFurniture,
    showLabels,
    lightingMode,
    onSelectRoom,
    onHoverRoom,
    onCameraTelemetry,
  });
  propsRef.current = {
    navMode,
    wallHeight,
    selectedRoomId,
    hoveredRoomId,
    showFurniture,
    showLabels,
    lightingMode,
    onSelectRoom,
    onHoverRoom,
    onCameraTelemetry,
  };

  // Bridge imperative triggers from React props into the mounted Three.js engine
  const engineApiRef = useRef<{
    requestRender: () => void;
    flyTo: (pos: [number, number, number], target: [number, number, number]) => void;
    teleportWalk: (worldX: number, worldZ: number) => void;
    applyLighting: (mode: LightingMode) => void;
    applyFurnitureVisibility: (visible: boolean) => void;
    applySelection: (sel: string | null, hov: string | null) => void;
    onNavModeChanged: (mode: NavMode) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8e6e1);
    scene.fog = new THREE.FogExp2(0xe8e6e1, 0.011);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      180,
    );
    const initPreset = CAMERA_PRESETS[0];
    camera.position.set(...initPreset.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...initPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 4;
    controls.maxDistance = 42;
    controls.update();

    // Three-Point Studio + Architectural Sunlight Rig
    const hemiLight = new THREE.HemisphereLight(0xdce8f5, 0x9e9484, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.1);
    keyLight.position.set(-14, 24, 16);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 64;
    const d = 17;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xcbe0ff, 0.75);
    rimLight.position.set(16, 12, -16);
    scene.add(rimLight);

    // Subtle warm interior accent lights for Night ambiance (intensity 0 in Day)
    const interiorLights: THREE.PointLight[] = [
      new THREE.PointLight(0xffcb88, 0, 12, 1.5),
      new THREE.PointLight(0xffcb88, 0, 12, 1.5),
      new THREE.PointLight(0xffcb88, 0, 10, 1.5),
    ];
    const l1 = toWorld(ROOMS_BY_ID.sejour_1.center);
    const l2 = toWorld(ROOMS_BY_ID.sejour_vip.center);
    const l3 = toWorld(ROOMS_BY_ID.ch1.center);
    interiorLights[0].position.set(l1.x, 2.35, l1.z);
    interiorLights[1].position.set(l2.x, 2.35, l2.z);
    interiorLights[2].position.set(l3.x, 2.35, l3.z);
    interiorLights.forEach((pt) => scene.add(pt));

    // Build Materials & House Model
    const mats = createMaterialPalette(renderer, isSoftwareGl);
    const house = buildHouseModel(mats);
    scene.add(house.root);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Dynamic state inside animation loop
    let currentWallH = propsRef.current.wallHeight;
    let cameraGoalPos: THREE.Vector3 | null = null;
    let cameraGoalTarget: THREE.Vector3 | null = null;

    // 1st-Person Walk state (starts in Véranda looking into Séjour 1)
    const startWalk = toWorld({ x: 2.0, z: 12.2 });
    const walkState = {
      x: startWalk.x,
      z: startWalk.z,
      yaw: -Math.PI / 2, // looking +X into Séjour 1
      pitch: -0.05,
      dragging: false,
      lastX: 0,
      lastY: 0,
    };
    const keys: Record<string, boolean> = {};

    const updateProjectedLabels = () => {
      const layer = labelLayerRef.current;
      if (!layer) return;
      const show = propsRef.current.showLabels && propsRef.current.navMode === 'orbit';
      layer.style.display = show ? 'block' : 'none';
      if (!show) return;

      const w = container.clientWidth;
      const h = container.clientHeight;
      for (const room of ROOMS) {
        const node = labelNodesRef.current.get(room.id);
        if (!node) continue;
        const wp = toWorld(room.center);
        _projVec.set(wp.x, 0.35, wp.z);
        _projVec.project(camera);
        if (_projVec.z > 1 || _projVec.z < -1) {
          node.style.opacity = '0';
          node.style.pointerEvents = 'none';
          continue;
        }
        const sx = ((_projVec.x + 1) / 2) * w;
        const sy = ((-_projVec.y + 1) / 2) * h;
        node.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
        node.style.opacity = '1';
        node.style.pointerEvents = 'auto';
      }
    };

    let lastTelemetryTime = 0;
    const emitTelemetry = (force = false) => {
      const now = performance.now();
      if (!force && now - lastTelemetryTime < 75) return;
      lastTelemetryTime = now;

      let camX = camera.position.x;
      let camZ = camera.position.z;
      let yaw = 0;
      let currentRoomId: string | null = null;

      if (propsRef.current.navMode === 'walk') {
        camX = walkState.x;
        camZ = walkState.z;
        yaw = walkState.yaw;
        for (const r of ROOMS) {
          if (isPointInsideRoom(r, camX, camZ)) {
            currentRoomId = r.id;
            break;
          }
        }
      } else {
        camera.getWorldDirection(_vec3);
        yaw = Math.atan2(-_vec3.x, -_vec3.z);
      }

      propsRef.current.onCameraTelemetry({
        planX: camX - PLAN_OFFSET.x,
        planZ: camZ - PLAN_OFFSET.z,
        yaw,
        currentRoomId,
      });
    };

    // Coalesced On-Demand & Software-GL Paced Render Engine
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTickTime = performance.now();
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepAndRender() {
      if (disposed) return;
      renderDirty = false;
      const now = performance.now();
      const delta = Math.min((now - lastTickTime) / 1000, 0.1);
      lastTickTime = now;

      let needsAnotherFrame = false;

      // 1. Smoothly damp horizontal wall cutaway height
      const targetWallH = propsRef.current.wallHeight;
      if (Math.abs(currentWallH - targetWallH) > 0.004) {
        currentWallH = THREE.MathUtils.damp(currentWallH, targetWallH, 12, delta);
        house.setWallHeight(currentWallH);
        needsAnotherFrame = true;
      } else if (currentWallH !== targetWallH) {
        currentWallH = targetWallH;
        house.setWallHeight(currentWallH);
      }

      // 2. Navigation mode handling
      if (propsRef.current.navMode === 'orbit') {
        if (cameraGoalPos && cameraGoalTarget) {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, cameraGoalPos.x, 7, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, cameraGoalPos.y, 7, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, cameraGoalPos.z, 7, delta);
          controls.target.x = THREE.MathUtils.damp(controls.target.x, cameraGoalTarget.x, 7, delta);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, cameraGoalTarget.y, 7, delta);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, cameraGoalTarget.z, 7, delta);

          if (
            camera.position.distanceTo(cameraGoalPos) < 0.04 &&
            controls.target.distanceTo(cameraGoalTarget) < 0.04
          ) {
            camera.position.copy(cameraGoalPos);
            controls.target.copy(cameraGoalTarget);
            cameraGoalPos = null;
            cameraGoalTarget = null;
          } else {
            needsAnotherFrame = true;
          }
        }
        if (controls.update()) {
          needsAnotherFrame = true;
        }
      } else {
        // Walk mode movement
        const moveF =
          (keys['KeyW'] || keys['KeyZ'] || keys['ArrowUp'] ? 1 : 0) -
          (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
        const moveR =
          (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) -
          (keys['KeyA'] || keys['KeyQ'] || keys['ArrowLeft'] ? 1 : 0);

        if (moveF !== 0 || moveR !== 0) {
          const speed = keys['ShiftLeft'] || keys['ShiftRight'] ? 5.2 : 3.2;
          _forward.set(-Math.sin(walkState.yaw), 0, -Math.cos(walkState.yaw));
          _right.set(Math.cos(walkState.yaw), 0, -Math.sin(walkState.yaw));

          _vec3
            .set(0, 0, 0)
            .addScaledVector(_forward, moveF)
            .addScaledVector(_right, moveR);
          if (_vec3.lengthSq() > 0) {
            _vec3.normalize().multiplyScalar(speed * delta);
            const next = resolveWalkCollision(
              walkState.x + _vec3.x,
              walkState.z + _vec3.z,
              0.24,
              house.colliders,
            );
            walkState.x = next.x;
            walkState.z = next.z;
          }
          needsAnotherFrame = true;
        }

        camera.position.set(walkState.x, 1.65, walkState.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = walkState.yaw;
        camera.rotation.x = walkState.pitch;
        camera.rotation.z = 0;
        emitTelemetry();
      }

      updateProjectedLabels();
      renderer.render(scene, camera);

      const done = () => {
        renderBusy = false;
        if (renderDirty || needsAnotherFrame) {
          requestRender();
        }
      };

      if (isSoftwareGl) afterDraw(done);
      else done();
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(stepAndRender);
    }

    // Cancel camera transitions when user starts dragging OrbitControls
    const onControlsStart = () => {
      cameraGoalPos = null;
      cameraGoalTarget = null;
    };
    const onControlsChange = () => {
      if (propsRef.current.navMode === 'orbit') {
        requestRender();
      }
    };
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', onControlsChange);

    // Raycasting for Room Click & Throttled Hover
    const raycaster = new THREE.Raycaster();
    let pointerDownXY = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const updateMouseFromEvent = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownXY = { x: e.clientX, y: e.clientY };
      if (propsRef.current.navMode === 'walk') {
        walkState.dragging = true;
        walkState.lastX = e.clientX;
        walkState.lastY = e.clientY;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (propsRef.current.navMode === 'walk') {
        if (walkState.dragging) {
          const dx = e.clientX - walkState.lastX;
          const dy = e.clientY - walkState.lastY;
          walkState.lastX = e.clientX;
          walkState.lastY = e.clientY;
          walkState.yaw -= dx * 0.0045;
          walkState.pitch = THREE.MathUtils.clamp(walkState.pitch - dy * 0.0035, -0.75, 0.75);
          emitTelemetry(true);
          requestRender();
        }
        return;
      }

      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;

      updateMouseFromEvent(e);
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(house.pickMeshes, false);
      const hitRoom = hits.length > 0 ? (hits[0].object.userData.roomId as string) : null;
      if (hitRoom !== propsRef.current.hoveredRoomId) {
        propsRef.current.onHoverRoom(hitRoom);
      }
      renderer.domElement.style.cursor = hitRoom ? 'pointer' : 'grab';
    };

    const onPointerUp = (e: PointerEvent) => {
      if (propsRef.current.navMode === 'walk') {
        walkState.dragging = false;
        return;
      }
      const dist = Math.hypot(e.clientX - pointerDownXY.x, e.clientY - pointerDownXY.y);
      if (dist > 6) return;

      updateMouseFromEvent(e);
      raycaster.setFromCamera(_mouse, camera);
      const hits = raycaster.intersectObjects(house.pickMeshes, false);
      const hitRoom = hits.length > 0 ? (hits[0].object.userData.roomId as string) : null;
      propsRef.current.onSelectRoom(hitRoom);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keys[e.code] = true;
      if (propsRef.current.navMode === 'walk') {
        requestRender();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.code] = false;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    // Expose imperative API to React sync effects
    engineApiRef.current = {
      requestRender,
      flyTo: (pos, target) => {
        cameraGoalPos = new THREE.Vector3(...pos);
        cameraGoalTarget = new THREE.Vector3(...target);
        requestRender();
      },
      teleportWalk: (worldX, worldZ) => {
        const safe = resolveWalkCollision(worldX, worldZ, 0.24, house.colliders);
        walkState.x = safe.x;
        walkState.z = safe.z;
        emitTelemetry(true);
        requestRender();
      },
      applyLighting: (mode) => {
        if (mode === 'day') {
          scene.background = new THREE.Color(0xe8e6e1);
          scene.fog = new THREE.FogExp2(0xe8e6e1, 0.011);
          keyLight.color.setHex(0xfff5e4);
          keyLight.intensity = 2.1;
          keyLight.position.set(-14, 24, 16);
          hemiLight.color.setHex(0xdce8f5);
          hemiLight.groundColor.setHex(0x9e9484);
          hemiLight.intensity = 0.85;
          rimLight.intensity = 0.75;
          renderer.toneMappingExposure = 1.08;
          interiorLights.forEach((pt) => (pt.intensity = 0));
        } else if (mode === 'golden') {
          scene.background = new THREE.Color(0xdccbb8);
          scene.fog = new THREE.FogExp2(0xdccbb8, 0.012);
          keyLight.color.setHex(0xffb56b);
          keyLight.intensity = 2.4;
          keyLight.position.set(-22, 11, 12);
          hemiLight.color.setHex(0xffdfc2);
          hemiLight.groundColor.setHex(0x706358);
          hemiLight.intensity = 0.7;
          rimLight.intensity = 0.65;
          renderer.toneMappingExposure = 1.05;
          interiorLights.forEach((pt) => (pt.intensity = 1.4));
        } else {
          scene.background = new THREE.Color(0x14171c);
          scene.fog = new THREE.FogExp2(0x14171c, 0.014);
          keyLight.color.setHex(0x88a8d8);
          keyLight.intensity = 0.75;
          keyLight.position.set(12, 20, -14);
          hemiLight.color.setHex(0x3a4a68);
          hemiLight.groundColor.setHex(0x1e2024);
          hemiLight.intensity = 0.55;
          rimLight.intensity = 0.45;
          renderer.toneMappingExposure = 1.15;
          interiorLights.forEach((pt) => (pt.intensity = 3.8));
        }
        requestRender();
      },
      applyFurnitureVisibility: (visible) => {
        house.furnitureGroup.visible = visible;
        requestRender();
      },
      applySelection: (sel, hov) => {
        house.setSelectedRoom(sel, hov);
        requestRender();
      },
      onNavModeChanged: (mode) => {
        cameraGoalPos = null;
        cameraGoalTarget = null;
        if (mode === 'walk') {
          controls.enabled = false;
          renderer.domElement.style.cursor = 'crosshair';
          camera.position.set(walkState.x, 1.65, walkState.z);
          camera.rotation.order = 'YXZ';
          camera.rotation.y = walkState.yaw;
          camera.rotation.x = walkState.pitch;
          camera.rotation.z = 0;
          emitTelemetry(true);
        } else {
          controls.enabled = true;
          renderer.domElement.style.cursor = 'grab';
          camera.position.set(...CAMERA_PRESETS[0].position);
          controls.target.set(...CAMERA_PRESETS[0].target);
          controls.update();
        }
        requestRender();
      },
    };

    // Initial render
    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      house.dispose();
      mats.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      engineApiRef.current = null;
    };
  }, []);

  // Sync React props to Three.js engine without remounting
  useEffect(() => {
    engineApiRef.current?.requestRender();
  }, [wallHeight, showLabels]);

  useEffect(() => {
    engineApiRef.current?.applySelection(selectedRoomId, hoveredRoomId);
  }, [selectedRoomId, hoveredRoomId]);

  useEffect(() => {
    engineApiRef.current?.applyFurnitureVisibility(showFurniture);
  }, [showFurniture]);

  useEffect(() => {
    engineApiRef.current?.applyLighting(lightingMode);
  }, [lightingMode]);

  useEffect(() => {
    engineApiRef.current?.onNavModeChanged(navMode);
  }, [navMode]);

  useEffect(() => {
    if (!presetRequest) return;
    const preset = CAMERA_PRESETS.find((p) => p.id === presetRequest.id);
    if (preset) {
      engineApiRef.current?.flyTo(preset.position, preset.target);
    }
  }, [presetRequest]);

  useEffect(() => {
    if (!focusRoomRequest) return;
    const room = ROOMS_BY_ID[focusRoomRequest.roomId];
    if (!room) return;
    const wp = toWorld(room.center);
    if (propsRef.current.navMode === 'walk') {
      engineApiRef.current?.teleportWalk(wp.x, wp.z);
    } else {
      engineApiRef.current?.flyTo([wp.x - 5.2, 7.6, wp.z + 6.2], [wp.x, 0.6, wp.z]);
    }
  }, [focusRoomRequest]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mountRef} className="h-full w-full" />

      {/* Projected 3D Room Labels (DOM overlay, zero canvas text baking) */}
      <div
        ref={labelLayerRef}
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      >
        {ROOMS.map((room) => {
          const isSelected = selectedRoomId === room.id;
          return (
            <button
              key={room.id}
              ref={(el) => {
                if (el) labelNodesRef.current.set(room.id, el);
                else labelNodesRef.current.delete(room.id);
              }}
              type="button"
              onClick={() => onSelectRoom(room.id)}
              onMouseEnter={() => onHoverRoom(room.id)}
              onMouseLeave={() => onHoverRoom(null)}
              className={`pointer-events-auto absolute top-0 left-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap transition-colors duration-150 ${
                isSelected
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'bg-[#181a1e]/82 text-zinc-100 border border-white/15 hover:border-amber-400/70'
              }`}
            >
              {room.shortLabel}
            </button>
          );
        })}
      </div>

      {/* WebGL Context Lost Graceful Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#14171c] p-6 text-center text-zinc-200">
          <div className="max-w-sm border border-white/15 bg-[#1d2026] p-6">
            <h2 className="text-base font-semibold">Rendu 3D suspendu</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Le contexte WebGL a été interrompu par le navigateur. Utilisez le plan 2D interactif ou rechargez la page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
