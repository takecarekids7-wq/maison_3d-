import * as THREE from 'three';
import { FurniturePlacement, toWorld } from '../data/housePlanData';
import { MaterialPalette } from './materials';

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x: number,
  yCenter: number,
  z: number,
  castShadow = true,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, yCenter, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function buildBed(mats: MaterialPalette, isMaster: boolean): THREE.Group {
  const g = new THREE.Group();
  const w = isMaster ? 1.85 : 1.45;
  const l = 2.05;
  // Bed frame
  g.add(box(w + 0.08, 0.24, l + 0.06, mats.woodDark, 0, 0.12, 0));
  // Headboard
  g.add(box(w + 0.16, 1.05, 0.09, mats.woodDark, 0, 0.525, -l / 2 - 0.03));
  // Mattress
  g.add(box(w - 0.02, 0.22, l - 0.04, mats.fabricLight, 0, 0.35, 0.01));
  // Duvet blanket
  g.add(box(w + 0.04, 0.06, l * 0.65, mats.fabricAccent, 0, 0.47, l * 0.16));
  // Pillows
  const pW = isMaster ? 0.68 : 0.54;
  g.add(box(pW, 0.1, 0.42, mats.fabricLinen, -w * 0.25, 0.5, -l * 0.33));
  g.add(box(pW, 0.1, 0.42, mats.fabricLinen, w * 0.25, 0.5, -l * 0.33));
  // Nightstands + lamps
  const nsOffset = w / 2 + 0.34;
  [-1, 1].forEach((side) => {
    g.add(box(0.44, 0.46, 0.42, mats.woodWarm, side * nsOffset, 0.23, -l / 2 + 0.24));
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.18, 12),
      mats.metalBrass,
    );
    base.position.set(side * nsOffset, 0.55, -l / 2 + 0.24);
    g.add(base);
    const shade = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.13, 0.16, 14),
      mats.fabricLight,
    );
    shade.position.set(side * nsOffset, 0.69, -l / 2 + 0.24);
    g.add(shade);
  });
  return g;
}

function buildWardrobe(mats: MaterialPalette): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.9, 2.1, 0.58, mats.woodWarm, 0, 1.05, 0));
  // Recessed panel doors
  [-0.62, 0, 0.62].forEach((dx) => {
    g.add(box(0.58, 1.98, 0.03, mats.fabricLight, dx, 1.05, 0.3));
    g.add(box(0.025, 0.22, 0.025, mats.metalBrass, dx + 0.22, 1.05, 0.325, false));
  });
  return g;
}

function buildSofaLiving(mats: MaterialPalette, isVip: boolean): THREE.Group {
  const g = new THREE.Group();
  // Area rug (y = 0.006 so it never Z-fights floor)
  g.add(box(3.8, 0.012, 3.0, mats.fabricLinen, 0, 0.006, 0.2, false));

  // Main sofa along -Z
  const sofaMat = isVip ? mats.fabricCharcoal : mats.fabricLinen;
  const cushionMat = isVip ? mats.fabricAccent : mats.fabricCharcoal;
  g.add(box(2.7, 0.14, 0.92, mats.woodDark, -0.2, 0.07, -0.95));
  g.add(box(2.64, 0.28, 0.86, sofaMat, -0.2, 0.28, -0.95));
  g.add(box(2.7, 0.52, 0.2, sofaMat, -0.2, 0.56, -1.31));
  g.add(box(0.2, 0.42, 0.92, sofaMat, -1.45, 0.35, -0.95));
  g.add(box(0.2, 0.42, 0.92, sofaMat, 1.05, 0.35, -0.95));
  // Chaise / L-extension
  g.add(box(0.95, 0.28, 1.4, sofaMat, 0.67, 0.28, -0.05));
  // Throw pillows
  g.add(box(0.38, 0.34, 0.14, cushionMat, -1.0, 0.56, -1.1));
  g.add(box(0.38, 0.34, 0.14, cushionMat, 0.65, 0.56, -1.1));

  // Accent armchair on opposite side
  g.add(box(0.84, 0.28, 0.82, cushionMat, -1.5, 0.22, 0.75));
  g.add(box(0.84, 0.46, 0.18, cushionMat, -1.83, 0.45, 0.75));

  // Coffee table
  g.add(box(1.25, 0.05, 0.75, mats.woodWarm, -0.25, 0.36, 0.25));
  g.add(box(1.1, 0.32, 0.6, mats.metalBrushed, -0.25, 0.16, 0.25));

  // TV Console + Flat screen at +Z
  g.add(box(2.2, 0.42, 0.44, mats.woodDark, -0.1, 0.21, 1.65));
  g.add(box(1.55, 0.88, 0.05, mats.graniteDark, -0.1, 0.94, 1.68));
  g.add(box(0.32, 0.08, 0.16, mats.metalBrushed, -0.1, 0.46, 1.68));
  return g;
}

function buildDiningSet(mats: MaterialPalette): THREE.Group {
  const g = new THREE.Group();
  // Rug
  g.add(box(3.1, 0.01, 2.3, mats.fabricLinen, 0, 0.005, 0, false));
  // Table top + 4 metal legs
  g.add(box(2.2, 0.06, 1.05, mats.woodWarm, 0, 0.75, 0));
  [
    [-0.95, -0.4],
    [0.95, -0.4],
    [-0.95, 0.4],
    [0.95, 0.4],
  ].forEach(([lx, lz]) => {
    g.add(box(0.06, 0.72, 0.06, mats.graniteDark, lx, 0.36, lz));
  });
  // 6 dining chairs
  [-0.65, 0, 0.65].forEach((cx) => {
    [-0.7, 0.7].forEach((cz) => {
      const dir = cz > 0 ? 1 : -1;
      g.add(box(0.44, 0.06, 0.44, mats.fabricCharcoal, cx, 0.45, cz));
      g.add(box(0.44, 0.45, 0.06, mats.fabricCharcoal, cx, 0.68, cz + dir * 0.2));
      g.add(box(0.38, 0.42, 0.38, mats.woodDark, cx, 0.21, cz));
    });
  });
  return g;
}

function buildKitchenL(mats: MaterialPalette): THREE.Group {
  const g = new THREE.Group();
  // Counter along +X (right wall) and +Z (bottom wall)
  g.add(box(0.68, 0.88, 2.8, mats.fabricLight, 1.05, 0.44, -0.2));
  g.add(box(0.72, 0.05, 2.84, mats.graniteDark, 1.05, 0.905, -0.2));
  g.add(box(2.6, 0.88, 0.68, mats.fabricLight, -0.1, 0.44, 1.05));
  g.add(box(2.64, 0.05, 0.72, mats.graniteDark, -0.1, 0.905, 1.05));
  // Sink basin + faucet
  g.add(box(0.55, 0.02, 0.44, mats.metalBrushed, 1.05, 0.935, 0.1));
  g.add(box(0.04, 0.22, 0.04, mats.metalBrushed, 1.28, 1.04, 0.1, false));
  // Cooktop glass + 4 burners
  g.add(box(0.65, 0.02, 0.52, mats.graniteDark, -0.2, 0.94, 1.05, false));
  // Fridge
  g.add(box(0.76, 1.88, 0.72, mats.metalBrushed, 1.0, 0.94, -2.05));
  // Center prep island
  g.add(box(1.35, 0.88, 0.8, mats.woodWarm, -0.5, 0.44, -0.45));
  g.add(box(1.4, 0.05, 0.85, mats.graniteDark, -0.5, 0.905, -0.45));
  return g;
}

function buildPantryShelves(mats: MaterialPalette): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.2, 1.85, 0.42, mats.woodWarm, 0, 0.925, -0.55));
  [0.45, 0.95, 1.45].forEach((y) => {
    g.add(box(0.32, 0.22, 0.3, mats.fabricLinen, -0.32, y + 0.12, -0.55));
    g.add(box(0.32, 0.22, 0.3, mats.fabricAccent, 0.25, y + 0.12, -0.55));
  });
  return g;
}

function buildLaundrySet(mats: MaterialPalette): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.85, 0.88, 0.65, mats.fabricLight, 0, 0.44, -0.9));
  g.add(box(1.9, 0.05, 0.68, mats.graniteDark, 0, 0.905, -0.9));
  // Washer drum ring
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18),
    mats.metalBrushed,
  );
  drum.rotation.x = Math.PI / 2;
  drum.position.set(-0.48, 0.45, -0.56);
  g.add(drum);
  return g;
}

function buildBathroom(mats: MaterialPalette, full: boolean): THREE.Group {
  const g = new THREE.Group();
  // Vanity cabinet + basin + mirror
  g.add(box(1.15, 0.82, 0.5, mats.woodWarm, -0.35, 0.41, -0.95));
  g.add(box(0.55, 0.08, 0.38, mats.ceramicWhite, -0.35, 0.86, -0.95));
  g.add(box(1.05, 0.72, 0.03, mats.metalBrushed, -0.35, 1.45, -1.18, false));
  // Ceramic WC
  g.add(box(0.42, 0.4, 0.56, mats.ceramicWhite, 0.55, 0.2, -0.92));
  g.add(box(0.42, 0.42, 0.2, mats.ceramicWhite, 0.55, 0.58, -1.1));
  // Glass walk-in shower tray + partition
  const trayW = full ? 1.05 : 0.92;
  g.add(box(trayW, 0.06, 0.92, mats.ceramicWhite, -0.35, 0.03, 0.65, false));
  g.add(box(0.03, 2.0, 0.92, mats.glassPane, -0.35 + trayW / 2, 1.03, 0.65, false));
  return g;
}

function buildOfficeDesk(mats: MaterialPalette): THREE.Group {
  const g = new THREE.Group();
  g.add(box(1.55, 0.05, 0.74, mats.woodWarm, 0, 0.74, -0.25));
  g.add(box(0.06, 0.72, 0.68, mats.graniteDark, -0.7, 0.36, -0.25));
  g.add(box(0.38, 0.72, 0.68, mats.woodDark, 0.55, 0.36, -0.25));
  // Monitor
  g.add(box(0.68, 0.42, 0.03, mats.graniteDark, -0.05, 1.04, -0.45));
  g.add(box(0.14, 0.14, 0.12, mats.metalBrushed, -0.05, 0.82, -0.45));
  // Chair
  g.add(box(0.5, 0.08, 0.5, mats.fabricCharcoal, -0.05, 0.46, 0.35));
  g.add(box(0.48, 0.52, 0.07, mats.fabricCharcoal, -0.05, 0.72, 0.58));
  g.add(box(0.1, 0.42, 0.1, mats.metalBrushed, -0.05, 0.21, 0.35));
  return g;
}

function buildVerandaLounge(mats: MaterialPalette): THREE.Group {
  const g = new THREE.Group();
  g.add(box(2.2, 0.34, 0.85, mats.woodWarm, 0, 0.17, -0.85));
  g.add(box(2.1, 0.12, 0.75, mats.fabricLight, 0, 0.38, -0.85));
  g.add(box(2.1, 0.38, 0.18, mats.fabricLight, 0, 0.55, -1.16));
  g.add(box(1.1, 0.32, 0.65, mats.woodDark, 0, 0.16, 0.15));
  return g;
}

function buildPlanter(mats: MaterialPalette): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.2, 0.48, 16),
    mats.ceramicWhite,
  );
  pot.position.y = 0.24;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);

  const foliageOffsets = [
    [0, 0.72, 0, 0.32],
    [-0.14, 0.64, 0.12, 0.2],
    [0.15, 0.68, -0.1, 0.22],
  ];
  foliageOffsets.forEach(([fx, fy, fz, r]) => {
    const leaf = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), mats.foliage);
    leaf.position.set(fx, fy, fz);
    leaf.castShadow = true;
    g.add(leaf);
  });
  return g;
}

export function buildFurnitureGroup(
  placements: FurniturePlacement[],
  mats: MaterialPalette,
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'FurnitureGroup';

  for (const item of placements) {
    let sub: THREE.Group;
    switch (item.kind) {
      case 'master-bed':
        sub = buildBed(mats, true);
        break;
      case 'bed':
        sub = buildBed(mats, false);
        break;
      case 'wardrobe':
        sub = buildWardrobe(mats);
        break;
      case 'sofa-vip':
        sub = buildSofaLiving(mats, true);
        break;
      case 'sofa-l':
        sub = buildSofaLiving(mats, false);
        break;
      case 'dining-set':
        sub = buildDiningSet(mats);
        break;
      case 'kitchen-l':
        sub = buildKitchenL(mats);
        break;
      case 'pantry-shelves':
        sub = buildPantryShelves(mats);
        break;
      case 'laundry-set':
        sub = buildLaundrySet(mats);
        break;
      case 'bathroom-full':
        sub = buildBathroom(mats, true);
        break;
      case 'bathroom-compact':
        sub = buildBathroom(mats, false);
        break;
      case 'office-desk':
        sub = buildOfficeDesk(mats);
        break;
      case 'veranda-lounge':
        sub = buildVerandaLounge(mats);
        break;
      case 'planter':
        sub = buildPlanter(mats);
        break;
    }
    const wp = toWorld({ x: item.x, z: item.z });
    sub.position.set(wp.x, 0.022, wp.z);
    sub.rotation.y = item.rotationY;
    sub.userData.roomId = item.roomId;
    root.add(sub);
  }

  return root;
}
