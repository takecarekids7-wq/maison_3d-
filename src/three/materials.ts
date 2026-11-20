import * as THREE from 'three';
import { FloorMaterialType } from '../data/housePlanData';

export interface MaterialPalette {
  wallPlaster: THREE.MeshStandardMaterial;
  wallExterior: THREE.MeshStandardMaterial;
  wallCutCap: THREE.MeshStandardMaterial;
  plinthConcrete: THREE.MeshStandardMaterial;
  lawnGround: THREE.MeshStandardMaterial;
  woodDoor: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  woodWarm: THREE.MeshStandardMaterial;
  fabricLight: THREE.MeshStandardMaterial;
  fabricCharcoal: THREE.MeshStandardMaterial;
  fabricLinen: THREE.MeshStandardMaterial;
  fabricAccent: THREE.MeshStandardMaterial;
  ceramicWhite: THREE.MeshStandardMaterial;
  graniteDark: THREE.MeshStandardMaterial;
  metalBrushed: THREE.MeshStandardMaterial;
  metalBrass: THREE.MeshStandardMaterial;
  glassPane: THREE.MeshPhysicalMaterial;
  foliage: THREE.MeshStandardMaterial;
  floors: Record<FloorMaterialType, THREE.MeshStandardMaterial>;
  dispose: () => void;
}

function makeCanvasTexture(
  size: number,
  repeatX: number,
  repeatY: number,
  maxAniso: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createMaterialPalette(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): MaterialPalette {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];

  const regTex = (t: THREE.Texture) => {
    textures.push(t);
    return t;
  };
  const regMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // 1. Oak Parquet (Bedrooms & Office)
  const parquetTex = regTex(
    makeCanvasTexture(512, 0.55, 0.55, maxAniso, (ctx, s) => {
      ctx.fillStyle = '#c89e72';
      ctx.fillRect(0, 0, s, s);
      const rows = 8;
      const cols = 4;
      const rowH = s / rows;
      const colW = s / cols;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const x = c * colW + offset;
          const y = r * rowH;
          const shade = ((r * 7 + c * 13) % 15) - 7;
          ctx.fillStyle = `rgb(${198 + shade}, ${152 + shade}, ${106 + shade})`;
          ctx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);
          ctx.strokeStyle = 'rgba(110, 72, 38, 0.14)';
          ctx.lineWidth = 1;
          for (let g = 0; g < 4; g++) {
            const gy = y + 6 + g * (rowH / 4);
            ctx.beginPath();
            ctx.moveTo(x + 3, gy);
            ctx.lineTo(x + colW - 3, gy + ((c + g) % 3) - 1);
            ctx.stroke();
          }
        }
      }
    }),
  );

  // 2. Warm Travertine Tile (Living Rooms & Corridor)
  const travertineTex = regTex(
    makeCanvasTexture(512, 0.45, 0.45, maxAniso, (ctx, s) => {
      ctx.fillStyle = '#e6dfd3';
      ctx.fillRect(0, 0, s, s);
      const grid = 4;
      const cell = s / grid;
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const delta = ((r * 5 + c * 9) % 9) - 4;
          ctx.fillStyle = `rgb(${232 + delta}, ${225 + delta}, ${214 + delta})`;
          ctx.fillRect(c * cell + 2, r * cell + 2, cell - 4, cell - 4);
          ctx.fillStyle = 'rgba(170, 158, 140, 0.12)';
          ctx.fillRect(c * cell + 14, r * cell + cell * 0.45, cell - 28, 3);
        }
      }
      ctx.strokeStyle = '#c8bfb2';
      ctx.lineWidth = 2;
      for (let i = 0; i <= grid; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(s, i * cell);
        ctx.stroke();
      }
    }),
  );

  // 3. Kitchen / Utility Ceramic Slate
  const ceramicTex = regTex(
    makeCanvasTexture(512, 0.55, 0.55, maxAniso, (ctx, s) => {
      ctx.fillStyle = '#cfd3d6';
      ctx.fillRect(0, 0, s, s);
      const grid = 4;
      const cell = s / grid;
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const delta = ((r * 3 + c * 7) % 10) - 5;
          ctx.fillStyle = `rgb(${205 + delta}, ${210 + delta}, ${214 + delta})`;
          ctx.fillRect(c * cell + 2, r * cell + 2, cell - 4, cell - 4);
        }
      }
      ctx.strokeStyle = '#9aa1a8';
      ctx.lineWidth = 2;
      for (let i = 0; i <= grid; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, s);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * cell);
        ctx.lineTo(s, i * cell);
        ctx.stroke();
      }
    }),
  );

  // 4. Bathroom Fine Mosaic
  const mosaicTex = regTex(
    makeCanvasTexture(256, 0.85, 0.85, maxAniso, (ctx, s) => {
      ctx.fillStyle = '#d9e3e6';
      ctx.fillRect(0, 0, s, s);
      const grid = 8;
      const cell = s / grid;
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          const alt = (r + c) % 3 === 0 ? -10 : (r * c) % 5;
          ctx.fillStyle = `rgb(${214 + alt}, ${228 + alt}, ${232 + alt})`;
          ctx.fillRect(c * cell + 1.5, r * cell + 1.5, cell - 3, cell - 3);
        }
      }
    }),
  );

  // 5. Outdoor Veranda / Terrace Stone Pavers
  const terraceTex = regTex(
    makeCanvasTexture(512, 0.45, 0.45, maxAniso, (ctx, s) => {
      ctx.fillStyle = '#bfb6a8';
      ctx.fillRect(0, 0, s, s);
      const rows = 6;
      const cols = 3;
      const rowH = s / rows;
      const colW = s / cols;
      for (let r = 0; r < rows; r++) {
        const off = (r % 2) * (colW * 0.5);
        for (let c = -1; c <= cols; c++) {
          const d = ((r * 11 + c * 5) % 12) - 6;
          ctx.fillStyle = `rgb(${194 + d}, ${185 + d}, ${172 + d})`;
          ctx.fillRect(c * colW + off + 2, r * rowH + 2, colW - 4, rowH - 4);
        }
      }
    }),
  );

  // 6. Subtle Architectural Lawn Grid
  const lawnTex = regTex(
    makeCanvasTexture(512, 6, 6, maxAniso, (ctx, s) => {
      ctx.fillStyle = '#9aa88c';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 600; i++) {
        const x = (i * 73) % s;
        const y = (i * 137) % s;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(130, 146, 114, 0.28)' : 'rgba(176, 188, 160, 0.22)';
        ctx.fillRect(x, y, 4, 4);
      }
    }),
  );

  return {
    wallPlaster: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xf5f2eb,
        roughness: 0.86,
        metalness: 0.02,
      }),
    ),
    wallExterior: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xeae5db,
        roughness: 0.88,
        metalness: 0.03,
      }),
    ),
    wallCutCap: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x22262b,
        roughness: 0.55,
        metalness: 0.15,
      }),
    ),
    plinthConcrete: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xb7b2a9,
        roughness: 0.85,
        metalness: 0.05,
      }),
    ),
    lawnGround: regMat(
      new THREE.MeshStandardMaterial({
        map: lawnTex,
        roughness: 0.95,
        metalness: 0.0,
      }),
    ),
    woodDoor: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x9b6b43,
        roughness: 0.52,
        metalness: 0.05,
      }),
    ),
    woodDark: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x4b3626,
        roughness: 0.48,
        metalness: 0.06,
      }),
    ),
    woodWarm: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xb88456,
        roughness: 0.55,
        metalness: 0.04,
      }),
    ),
    fabricLight: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xf2eee6,
        roughness: 0.92,
        metalness: 0.0,
      }),
    ),
    fabricCharcoal: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x3b4048,
        roughness: 0.88,
        metalness: 0.02,
      }),
    ),
    fabricLinen: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xd5cab8,
        roughness: 0.9,
        metalness: 0.0,
      }),
    ),
    fabricAccent: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x9b5d3e,
        roughness: 0.86,
        metalness: 0.02,
      }),
    ),
    ceramicWhite: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xfafaf8,
        roughness: 0.22,
        metalness: 0.08,
      }),
    ),
    graniteDark: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x2c3035,
        roughness: 0.3,
        metalness: 0.12,
      }),
    ),
    metalBrushed: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xc2c8ce,
        roughness: 0.26,
        metalness: 0.88,
      }),
    ),
    metalBrass: regMat(
      new THREE.MeshStandardMaterial({
        color: 0xc89b4b,
        roughness: 0.28,
        metalness: 0.85,
      }),
    ),
    glassPane: regMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xb8dce8,
        roughness: 0.08,
        metalness: 0.05,
        transmission: isSoftwareGl ? 0 : 0.78,
        transparent: true,
        opacity: isSoftwareGl ? 0.38 : 0.92,
        ior: 1.5,
        thickness: 0.04,
        depthWrite: false,
      }),
    ),
    foliage: regMat(
      new THREE.MeshStandardMaterial({
        color: 0x4f7a4b,
        roughness: 0.78,
        metalness: 0.02,
      }),
    ),
    floors: {
      parquet: regMat(
        new THREE.MeshStandardMaterial({
          map: parquetTex,
          roughness: 0.56,
          metalness: 0.04,
        }),
      ),
      travertine: regMat(
        new THREE.MeshStandardMaterial({
          map: travertineTex,
          roughness: 0.42,
          metalness: 0.05,
        }),
      ),
      ceramic: regMat(
        new THREE.MeshStandardMaterial({
          map: ceramicTex,
          roughness: 0.38,
          metalness: 0.06,
        }),
      ),
      mosaic: regMat(
        new THREE.MeshStandardMaterial({
          map: mosaicTex,
          roughness: 0.32,
          metalness: 0.08,
        }),
      ),
      terrace: regMat(
        new THREE.MeshStandardMaterial({
          map: terraceTex,
          roughness: 0.78,
          metalness: 0.02,
        }),
      ),
    },
    dispose() {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
