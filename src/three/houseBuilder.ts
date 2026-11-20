import * as THREE from 'three';
import {
  COLUMNS,
  FURNITURE,
  ROOMS,
  RoomDefinition,
  WALL_SEGMENTS,
  toWorld,
} from '../data/housePlanData';
import { buildFurnitureGroup } from './furnitureBuilder';
import { MaterialPalette } from './materials';

export interface WallCollider {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  halfThick: number;
}

interface CuttableElement {
  mesh: THREE.Mesh;
  baseY: number;
  fullHeight: number;
  isCap?: boolean;
  capThresholdBottom?: number;
  capThresholdTop?: number;
}

export interface HouseSceneHandle {
  root: THREE.Group;
  furnitureGroup: THREE.Group;
  pickMeshes: THREE.Mesh[];
  highlightMeshes: Map<string, THREE.Mesh>;
  colliders: WallCollider[];
  setWallHeight: (height: number) => void;
  setSelectedRoom: (selectedId: string | null, hoveredId: string | null) => void;
  dispose: () => void;
}

const DEFAULT_WALL_HEIGHT = 2.8;

function createUnitHeightBoxGeo(w: number, d: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(w, 1, d);
  // Anchor bottom at y = 0 so scale.y grows upward cleanly
  geo.translate(0, 0.5, 0);
  return geo;
}

export function buildHouseModel(mats: MaterialPalette): HouseSceneHandle {
  const root = new THREE.Group();
  root.name = 'VillaRoot';

  const geometries: THREE.BufferGeometry[] = [];
  const extraMaterials: THREE.Material[] = [];
  const cuttables: CuttableElement[] = [];
  const pickMeshes: THREE.Mesh[] = [];
  const highlightMeshes = new Map<string, THREE.Mesh>();
  const colliders: WallCollider[] = [];

  const regGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // 1. Surrounding architectural ground lawn & concrete plinth
  const groundGeo = regGeo(new THREE.PlaneGeometry(68, 68));
  groundGeo.rotateX(-Math.PI / 2);
  const groundMesh = new THREE.Mesh(groundGeo, mats.lawnGround);
  groundMesh.position.y = -0.24;
  groundMesh.receiveShadow = true;
  root.add(groundMesh);

  // Subtle architectural stepped foundation plinth under the villa
  const plinthGeo = regGeo(new THREE.BoxGeometry(17.4, 0.24, 24.4));
  const plinthMesh = new THREE.Mesh(plinthGeo, mats.plinthConcrete);
  plinthMesh.position.set(0, -0.12, 0.4);
  plinthMesh.receiveShadow = true;
  plinthMesh.castShadow = true;
  root.add(plinthMesh);

  // 2. Room Floor Slabs + Interactive Room Highlight & Pick Planes
  for (const room of ROOMS) {
    const shape = new THREE.Shape();
    room.polygon.forEach((pt, idx) => {
      const wp = toWorld(pt);
      // Shape is in XY plane; after rotateX(-PI/2), shape Y maps to -Z, so use -wp.z
      if (idx === 0) shape.moveTo(wp.x, -wp.z);
      else shape.lineTo(wp.x, -wp.z);
    });
    shape.closePath();

    const floorGeo = regGeo(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.02,
        bevelEnabled: false,
      }),
    );
    floorGeo.rotateX(-Math.PI / 2);

    // Normalize UVs to world-meter scale so tile textures match across rooms
    const posAttr = floorGeo.attributes.position;
    const uvAttr = floorGeo.attributes.uv;
    for (let i = 0; i < posAttr.count; i++) {
      uvAttr.setXY(i, posAttr.getX(i), posAttr.getZ(i));
    }
    uvAttr.needsUpdate = true;

    const floorMesh = new THREE.Mesh(floorGeo, mats.floors[room.floorType]);
    floorMesh.position.y = 0.002;
    floorMesh.receiveShadow = true;
    floorMesh.userData.roomId = room.id;
    root.add(floorMesh);
    pickMeshes.push(floorMesh);

    // Subtle selection/hover highlight overlay (polygonOffset prevents Z-fighting)
    const hiGeo = regGeo(new THREE.ShapeGeometry(shape));
    hiGeo.rotateX(-Math.PI / 2);
    const hiMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    extraMaterials.push(hiMat);

    const hiMesh = new THREE.Mesh(hiGeo, hiMat);
    hiMesh.position.y = 0.025;
    hiMesh.visible = false;
    hiMesh.renderOrder = 2;
    root.add(hiMesh);
    highlightMeshes.set(room.id, hiMesh);
  }

  // 3. Cuttable Walls, Openings (Doors, Archways, Windows, Sliding Glass) & Caps
  const wallGroup = new THREE.Group();
  wallGroup.name = 'WallsGroup';
  root.add(wallGroup);

  const addCuttableBox = (
    w: number,
    d: number,
    baseY: number,
    fullHeight: number,
    mat: THREE.Material,
    cx: number,
    cz: number,
    angleY: number,
    castShadow = true,
  ) => {
    if (w <= 0.01 || fullHeight <= 0.01) return;
    const geo = regGeo(createUnitHeightBoxGeo(w, d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, 0.02 + baseY, cz);
    mesh.rotation.y = angleY;
    mesh.scale.y = fullHeight;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    wallGroup.add(mesh);
    cuttables.push({ mesh, baseY, fullHeight });

    // Add dark architectural section cap if this is masonry/wall
    if (mat === mats.wallPlaster || mat === mats.wallExterior) {
      const capGeo = regGeo(new THREE.BoxGeometry(w + 0.004, 0.022, d + 0.004));
      const capMesh = new THREE.Mesh(capGeo, mats.wallCutCap);
      capMesh.position.set(cx, 0.02 + baseY + fullHeight, cz);
      capMesh.rotation.y = angleY;
      wallGroup.add(capMesh);
      cuttables.push({
        mesh: capMesh,
        baseY: 0,
        fullHeight: 0.022,
        isCap: true,
        capThresholdBottom: baseY,
        capThresholdTop: baseY + fullHeight,
      });
    }
  };

  for (const wall of WALL_SEGMENTS) {
    const ws = toWorld(wall.start);
    const we = toWorld(wall.end);
    const dx = we.x - ws.x;
    const dz = we.z - ws.z;
    const totalLen = Math.hypot(dx, dz);
    if (totalLen < 0.01) continue;

    // Rotation around Y: local +X aligns with (dx, dz) -> rotation.y = -atan2(dz, dx)
    const angleY = -Math.atan2(dz, dx);
    const dirX = dx / totalLen;
    const dirZ = dz / totalLen;
    const wallMat = wall.isExterior ? mats.wallExterior : mats.wallPlaster;

    const sorted = [...wall.openings].sort((a, b) => a.offset - b.offset);
    let cursor = 0;

    const addSolidSegment = (segStart: number, segEnd: number) => {
      const len = segEnd - segStart;
      if (len <= 0.02) return;
      const mid = (segStart + segEnd) / 2;
      const cx = ws.x + dirX * mid;
      const cz = ws.z + dirZ * mid;
      addCuttableBox(len, wall.thickness, 0, DEFAULT_WALL_HEIGHT, wallMat, cx, cz, angleY);

      colliders.push({
        ax: ws.x + dirX * segStart,
        az: ws.z + dirZ * segStart,
        bx: ws.x + dirX * segEnd,
        bz: ws.z + dirZ * segEnd,
        halfThick: wall.thickness / 2,
      });
    };

    for (const op of sorted) {
      if (op.offset > cursor) {
        addSolidSegment(cursor, op.offset);
      }

      const opMid = op.offset + op.width / 2;
      const cx = ws.x + dirX * opMid;
      const cz = ws.z + dirZ * opMid;

      // Sill wall below window
      if (op.sillHeight > 0.02) {
        addCuttableBox(op.width, wall.thickness, 0, op.sillHeight, wallMat, cx, cz, angleY);
        // Window blocks walking in 1st-person mode
        colliders.push({
          ax: ws.x + dirX * op.offset,
          az: ws.z + dirZ * op.offset,
          bx: ws.x + dirX * (op.offset + op.width),
          bz: ws.z + dirZ * (op.offset + op.width),
          halfThick: wall.thickness / 2,
        });
      }

      // Lintel above opening
      const lintelH = DEFAULT_WALL_HEIGHT - op.headHeight;
      if (lintelH > 0.02) {
        addCuttableBox(
          op.width,
          wall.thickness,
          op.headHeight,
          lintelH,
          wallMat,
          cx,
          cz,
          angleY,
        );
      }

      // Joinery details (doors, windows, sliding glass)
      if (op.type === 'window' || op.type === 'sliding') {
        const glassH = op.headHeight - op.sillHeight;
        addCuttableBox(
          op.width - 0.06,
          0.025,
          op.sillHeight + 0.03,
          glassH - 0.06,
          mats.glassPane,
          cx,
          cz,
          angleY,
          false,
        );
        // Dark aluminum window sill/frame bar
        addCuttableBox(
          op.width,
          wall.thickness + 0.03,
          op.sillHeight,
          0.04,
          mats.graniteDark,
          cx,
          cz,
          angleY,
          false,
        );
      } else if (op.type === 'door') {
        // Open 35-degree wooden door leaf hinged at opening start so user can walk right through!
        const leafW = Math.min(op.width - 0.06, 0.88);
        const hingeX = ws.x + dirX * (op.offset + 0.03);
        const hingeZ = ws.z + dirZ * (op.offset + 0.03);
        const swing = (op.swingDir ?? 1) * 0.65; // ~37 degrees ajar
        const doorAngle = angleY + swing;
        const leafCx = hingeX + Math.cos(-doorAngle) * (leafW / 2);
        const leafCz = hingeZ + Math.sin(-doorAngle) * (leafW / 2);
        addCuttableBox(
          leafW,
          0.045,
          0,
          op.headHeight - 0.02,
          mats.woodDoor,
          leafCx,
          leafCz,
          doorAngle,
          true,
        );
      }

      cursor = op.offset + op.width;
    }

    if (cursor < totalLen - 0.02) {
      addSolidSegment(cursor, totalLen);
    }
  }

  // 4. Veranda & Terrace Structural Columns + Perimeter Beam Header
  for (const col of COLUMNS) {
    const wp = toWorld({ x: col.x, z: col.z });
    addCuttableBox(col.size, col.size, 0, DEFAULT_WALL_HEIGHT, mats.wallExterior, wp.x, wp.z, 0);
    colliders.push({
      ax: wp.x - col.size / 2,
      az: wp.z,
      bx: wp.x + col.size / 2,
      bz: wp.z,
      halfThick: col.size / 2,
    });
  }

  // 5. Furniture Group
  const furnitureGroup = buildFurnitureGroup(FURNITURE, mats);
  root.add(furnitureGroup);

  const setWallHeight = (height: number) => {
    const h = THREE.MathUtils.clamp(height, 0.25, DEFAULT_WALL_HEIGHT);
    for (const item of cuttables) {
      if (item.isCap) {
        const b = item.capThresholdBottom ?? 0;
        const t = item.capThresholdTop ?? DEFAULT_WALL_HEIGHT;
        if (h > b + 0.02 && h <= t + 0.02) {
          item.mesh.visible = true;
          item.mesh.position.y = 0.02 + Math.min(h, t);
        } else {
          item.mesh.visible = false;
        }
      } else {
        if (item.baseY >= h - 0.01) {
          item.mesh.visible = false;
        } else {
          item.mesh.visible = true;
          const visibleH = Math.min(item.fullHeight, h - item.baseY);
          item.mesh.scale.y = Math.max(0.01, visibleH);
        }
      }
    }
  };

  const setSelectedRoom = (selectedId: string | null, hoveredId: string | null) => {
    highlightMeshes.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (id === selectedId) {
        mesh.visible = true;
        mat.color.setHex(0xf59e0b);
        mat.opacity = 0.26;
      } else if (id === hoveredId) {
        mesh.visible = true;
        mat.color.setHex(0xfbbf24);
        mat.opacity = 0.14;
      } else {
        mesh.visible = false;
      }
    });
  };

  // Initial height
  setWallHeight(DEFAULT_WALL_HEIGHT);

  return {
    root,
    furnitureGroup,
    pickMeshes,
    highlightMeshes,
    colliders,
    setWallHeight,
    setSelectedRoom,
    dispose() {
      geometries.forEach((g) => g.dispose());
      extraMaterials.forEach((m) => m.dispose());
      furnitureGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
    },
  };
}

export function isPointInsideRoom(room: RoomDefinition, worldX: number, worldZ: number): boolean {
  const poly = room.polygon.map(toWorld);
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const zi = poly[i].z;
    const xj = poly[j].x;
    const zj = poly[j].z;
    const intersect =
      zi > worldZ !== zj > worldZ &&
      worldX < ((xj - xi) * (worldZ - zi)) / (zj - zi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
