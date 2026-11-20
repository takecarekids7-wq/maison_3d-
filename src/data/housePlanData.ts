export type FloorMaterialType =
  | 'parquet'
  | 'travertine'
  | 'ceramic'
  | 'mosaic'
  | 'terrace';

export type RoomCategory =
  | 'living'
  | 'bedroom'
  | 'bathroom'
  | 'service'
  | 'circulation'
  | 'outdoor';

export interface Point2D {
  x: number;
  z: number;
}

export interface RoomDefinition {
  id: string;
  name: string;
  shortLabel: string;
  dimensionsLabel: string;
  category: RoomCategory;
  floorType: FloorMaterialType;
  polygon: Point2D[];
  center: Point2D;
  areaSqm: number;
  description: string;
}

export type OpeningType = 'door' | 'arch' | 'window' | 'sliding';

export interface WallOpening {
  type: OpeningType;
  /** Distance along the wall from start point (meters) */
  offset: number;
  /** Width of the opening (meters) */
  width: number;
  /** Bottom sill height from floor (0 for doors/arches, e.g. 0.9 for windows) */
  sillHeight: number;
  /** Top height of the opening from floor */
  headHeight: number;
  /** Door swing angle sign (+1 or -1) for 2D plan arc and 3D door leaf */
  swingDir?: 1 | -1;
}

export interface WallSegment {
  id: string;
  start: Point2D;
  end: Point2D;
  thickness: number;
  isExterior: boolean;
  openings: WallOpening[];
}

export interface ColumnSpec {
  id: string;
  x: number;
  z: number;
  size: number;
}

export interface FurniturePlacement {
  id: string;
  roomId: string;
  kind:
    | 'master-bed'
    | 'bed'
    | 'wardrobe'
    | 'sofa-l'
    | 'sofa-vip'
    | 'dining-set'
    | 'kitchen-l'
    | 'pantry-shelves'
    | 'laundry-set'
    | 'bathroom-full'
    | 'bathroom-compact'
    | 'office-desk'
    | 'veranda-lounge'
    | 'planter';
  x: number;
  z: number;
  rotationY: number;
}

export interface CameraPreset {
  id: string;
  label: string;
  position: [number, number, number];
  target: [number, number, number];
}

// Center offset so the 15m x 22m house sits neatly around (0, 0) in 3D space
export const PLAN_OFFSET = { x: -7.5, z: -10.6 };

export function toWorld(p: Point2D): Point2D {
  return {
    x: p.x + PLAN_OFFSET.x,
    z: p.z + PLAN_OFFSET.z,
  };
}

function computePolygonArea(pts: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
  }
  return Math.round((Math.abs(area) / 2) * 10) / 10;
}

function makeRect(x1: number, z1: number, x2: number, z2: number): Point2D[] {
  return [
    { x: x1, z: z1 },
    { x: x2, z: z1 },
    { x: x2, z: z2 },
    { x: x1, z: z2 },
  ];
}

// 45° angled wing coordinates for CH5 & SE (matching the blueprint's 45° wing)
const COS45 = Math.SQRT1_2;
const SIN45 = Math.SQRT1_2;
const u45 = (len: number): Point2D => ({ x: len * COS45, z: len * SIN45 });
const v45 = (len: number): Point2D => ({ x: -len * SIN45, z: len * COS45 });
const addP = (a: Point2D, b: Point2D): Point2D => ({ x: a.x + b.x, z: a.z + b.z });

const CH5_A: Point2D = { x: 4.1, z: 16.5 };
const CH5_B: Point2D = addP(CH5_A, u45(3.4)); // (6.504, 18.904)
const CH5_C: Point2D = addP(CH5_B, v45(3.15)); // (4.277, 21.131)
const CH5_D: Point2D = addP(CH5_A, v45(3.15)); // (1.873, 18.727)

// SE (Salle d'eau 45° attached to CH5 along CH5_B -> CH5_C)
const SE_A: Point2D = addP(CH5_B, v45(1.15)); // (5.691, 19.717)
const SE_B: Point2D = addP(SE_A, u45(1.5)); // (6.752, 20.778)
const SE_C: Point2D = addP(CH5_C, u45(1.5)); // (5.338, 22.192) -> ~22.00m total depth!
const SE_D: Point2D = CH5_C;

const rawRooms: Omit<RoomDefinition, 'areaSqm'>[] = [
  {
    id: 'ch1',
    name: 'Chambre 1 (Suite)',
    shortLabel: 'CH1',
    dimensionsLabel: '4,60 × 5,00 m',
    category: 'bedroom',
    floorType: 'parquet',
    polygon: makeRect(0.0, 0.0, 4.8, 5.2),
    center: { x: 2.4, z: 2.6 },
    description: 'Suite parentale spacieuse donnant sur le dressing, la salle d’eau et la façade nord.',
  },
  {
    id: 'sde1',
    name: 'Salle d’eau 1',
    shortLabel: 'SDE 1',
    dimensionsLabel: '2,20 × 3,20 m',
    category: 'bathroom',
    floorType: 'mosaic',
    polygon: makeRect(4.8, 0.0, 7.0, 3.2),
    center: { x: 5.9, z: 1.6 },
    description: 'Salle d’eau privative attenante à la suite CH1.',
  },
  {
    id: 'dressing',
    name: 'Dressing',
    shortLabel: 'DRESSING',
    dimensionsLabel: '2,80 × 3,20 m',
    category: 'service',
    floorType: 'travertine',
    polygon: makeRect(7.0, 0.0, 9.8, 3.2),
    center: { x: 8.4, z: 1.6 },
    description: 'Espace rangement et penderie de la suite parentale.',
  },
  {
    id: 'sas',
    name: 'Sas Dégagement',
    shortLabel: 'SAS',
    dimensionsLabel: '5,00 × 1,60 m',
    category: 'circulation',
    floorType: 'travertine',
    polygon: makeRect(4.8, 3.2, 9.8, 4.8),
    center: { x: 7.3, z: 4.0 },
    description: 'Dégagement reliant CH1, SDE 1, Dressing, Séjour VIP et Couloir.',
  },
  {
    id: 'bureau',
    name: 'Bureau',
    shortLabel: 'BUREAU',
    dimensionsLabel: '2,40 × 1,80 m',
    category: 'service',
    floorType: 'parquet',
    polygon: makeRect(1.3, 5.2, 3.8, 7.1),
    center: { x: 2.55, z: 6.15 },
    description: 'Espace de travail calme ouvert vers la terrasse d’entrée.',
  },
  {
    id: 'terrasse',
    name: 'Terrasse Entrée',
    shortLabel: 'TERRASSE',
    dimensionsLabel: '3,80 × 4,60 m',
    category: 'outdoor',
    floorType: 'terrace',
    polygon: [
      { x: 0.0, z: 5.2 },
      { x: 1.3, z: 5.2 },
      { x: 1.3, z: 7.1 },
      { x: 3.8, z: 7.1 },
      { x: 3.8, z: 9.8 },
      { x: 0.0, z: 9.8 },
    ],
    center: { x: 1.9, z: 8.4 },
    description: 'Porche d’accueil couvert précédant l’entrée principale du Séjour VIP.',
  },
  {
    id: 'veranda',
    name: 'Véranda',
    shortLabel: 'VÉRANDA',
    dimensionsLabel: '3,80 × 6,70 m',
    category: 'outdoor',
    floorType: 'terrace',
    polygon: [
      { x: 0.0, z: 9.8 },
      { x: 3.8, z: 9.8 },
      { x: 3.8, z: 16.5 },
      { x: 1.873, z: 18.727 },
      { x: 0.0, z: 16.5 },
    ],
    center: { x: 1.9, z: 13.4 },
    description: 'Grande galerie extérieure à colonnade bordant le Séjour 1.',
  },
  {
    id: 'sejour_vip',
    name: 'Séjour VIP',
    shortLabel: 'SÉJOUR VIP',
    dimensionsLabel: '6,00 × 5,00 m',
    category: 'living',
    floorType: 'travertine',
    polygon: makeRect(3.8, 4.8, 9.8, 9.8),
    center: { x: 6.8, z: 7.3 },
    description: 'Salon de réception principal communiquant par arche ouverte avec le Séjour 1.',
  },
  {
    id: 'sejour_1',
    name: 'Séjour 1',
    shortLabel: 'SÉJOUR 1',
    dimensionsLabel: '6,00 × 6,70 m',
    category: 'living',
    floorType: 'travertine',
    polygon: makeRect(3.8, 9.8, 9.8, 16.5),
    center: { x: 6.8, z: 13.15 },
    description: 'Grand séjour familial lumineux ouvrant sur la Véranda et la Salle à Manger.',
  },
  {
    id: 'couloir',
    name: 'Couloir',
    shortLabel: 'COULOIR',
    dimensionsLabel: '1,20 × 16,50 m',
    category: 'circulation',
    floorType: 'travertine',
    polygon: makeRect(9.8, 0.0, 11.0, 16.5),
    center: { x: 10.4, z: 8.25 },
    description: 'Axe de distribution longitudinal de 1,20 m desservant toutes les chambres.',
  },
  {
    id: 'ch4',
    name: 'Chambre 4',
    shortLabel: 'CH4',
    dimensionsLabel: '4,00 × 3,20 m',
    category: 'bedroom',
    floorType: 'parquet',
    polygon: makeRect(11.0, 0.0, 15.0, 3.3),
    center: { x: 13.0, z: 1.65 },
    description: 'Chambre d’angle nord-est avec accès direct à la salle d’eau 3.',
  },
  {
    id: 'sde3',
    name: 'Salle d’eau 3',
    shortLabel: 'SDE 3',
    dimensionsLabel: '4,00 × 1,50 m',
    category: 'bathroom',
    floorType: 'mosaic',
    polygon: makeRect(11.0, 3.3, 15.0, 4.95),
    center: { x: 13.0, z: 4.12 },
    description: 'Salle d’eau partagée entre les chambres CH3 et CH4.',
  },
  {
    id: 'ch3',
    name: 'Chambre 3',
    shortLabel: 'CH3',
    dimensionsLabel: '4,00 × 3,00 m',
    category: 'bedroom',
    floorType: 'parquet',
    polygon: makeRect(11.0, 4.95, 15.0, 8.15),
    center: { x: 13.0, z: 6.55 },
    description: 'Chambre donnant sur le couloir central.',
  },
  {
    id: 'ch2',
    name: 'Chambre 2',
    shortLabel: 'CH2',
    dimensionsLabel: '4,00 × 3,00 m',
    category: 'bedroom',
    floorType: 'parquet',
    polygon: makeRect(11.0, 8.15, 15.0, 11.35),
    center: { x: 13.0, z: 9.75 },
    description: 'Chambre confortable avec placard intégré le long du couloir.',
  },
  {
    id: 'sde2',
    name: 'Salle d’eau 2',
    shortLabel: 'SDE 2',
    dimensionsLabel: '4,00 × 2,00 m',
    category: 'bathroom',
    floorType: 'mosaic',
    polygon: makeRect(11.0, 11.35, 15.0, 13.55),
    center: { x: 13.0, z: 12.45 },
    description: 'Salle d’eau centrale desservant la chambre CH2 et les espaces de vie.',
  },
  {
    id: 'buanderie',
    name: 'Buanderie',
    shortLabel: 'BUANDERIE',
    dimensionsLabel: '4,00 × 2,60 m',
    category: 'service',
    floorType: 'ceramic',
    polygon: makeRect(11.0, 13.55, 15.0, 16.35),
    center: { x: 13.0, z: 14.95 },
    description: 'Espace technique linge et entretien à proximité immédiate de la cuisine.',
  },
  {
    id: 'magasin',
    name: 'Magasin (Cellier)',
    shortLabel: 'MAGASIN',
    dimensionsLabel: '1,50 × 2,00 m',
    category: 'service',
    floorType: 'ceramic',
    polygon: makeRect(11.0, 16.35, 12.6, 18.35),
    center: { x: 11.8, z: 17.35 },
    description: 'Réserve alimentaire et cellier attenant à la cuisine.',
  },
  {
    id: 'cuisine',
    name: 'Cuisine',
    shortLabel: 'CUISINE',
    dimensionsLabel: '4,00 × 4,00 m',
    category: 'service',
    floorType: 'ceramic',
    polygon: [
      { x: 12.6, z: 16.35 },
      { x: 15.0, z: 16.35 },
      { x: 15.0, z: 20.35 },
      { x: 11.0, z: 20.35 },
      { x: 11.0, z: 18.35 },
      { x: 12.6, z: 18.35 },
    ],
    center: { x: 13.4, z: 18.9 },
    description: 'Cuisine aménagée en L avec îlot technique, accès cellier et salle à manger.',
  },
  {
    id: 'sam',
    name: 'Salle à Manger',
    shortLabel: 'S.A.M.',
    dimensionsLabel: '4,00 × 4,00 m',
    category: 'living',
    floorType: 'travertine',
    polygon: [
      { x: 6.504, z: 16.5 },
      { x: 11.0, z: 16.5 },
      { x: 11.0, z: 20.35 },
      { x: 6.752, z: 20.35 },
      { x: 5.691, z: 19.717 },
      { x: 6.504, z: 18.904 },
    ],
    center: { x: 8.6, z: 18.4 },
    description: 'Salle à manger conviviale reliant la cuisine, le séjour et l’aile à 45°.',
  },
  {
    id: 'ch5',
    name: 'Chambre 5 (Aile 45°)',
    shortLabel: 'CH5',
    dimensionsLabel: '3,40 × 3,15 m (45°)',
    category: 'bedroom',
    floorType: 'parquet',
    polygon: [CH5_A, CH5_B, CH5_C, CH5_D],
    center: {
      x: (CH5_A.x + CH5_B.x + CH5_C.x + CH5_D.x) / 4,
      z: (CH5_A.z + CH5_B.z + CH5_C.z + CH5_D.z) / 4,
    },
    description: 'Chambre indépendante implantée dans le volume architectural incliné à 45°.',
  },
  {
    id: 'se',
    name: 'Salle d’eau (CH5)',
    shortLabel: 'SE',
    dimensionsLabel: '2,00 × 1,50 m (45°)',
    category: 'bathroom',
    floorType: 'mosaic',
    polygon: [SE_A, SE_B, SE_C, SE_D],
    center: {
      x: (SE_A.x + SE_B.x + SE_C.x + SE_D.x) / 4,
      z: (SE_A.z + SE_B.z + SE_C.z + SE_D.z) / 4,
    },
    description: 'Salle d’eau privative de la chambre CH5 formant la pointe sud à 22,00 m.',
  },
];

export const ROOMS: RoomDefinition[] = rawRooms.map((r) => ({
  ...r,
  areaSqm: computePolygonArea(r.polygon),
}));

export const ROOMS_BY_ID: Record<string, RoomDefinition> = Object.fromEntries(
  ROOMS.map((r) => [r.id, r]),
);

const EXT = 0.2;
const INT = 0.13;

export const WALL_SEGMENTS: WallSegment[] = [
  // Top perimeter (z = 0.0, 15.00 m total)
  {
    id: 'w-top-ch1',
    start: { x: 0.0, z: 0.0 },
    end: { x: 4.8, z: 0.0 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 1.5, width: 1.8, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-top-sde1',
    start: { x: 4.8, z: 0.0 },
    end: { x: 9.8, z: 0.0 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.7, width: 0.9, sillHeight: 1.25, headHeight: 2.15 },
      { type: 'window', offset: 3.1, width: 1.0, sillHeight: 1.25, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-top-couloir',
    start: { x: 9.8, z: 0.0 },
    end: { x: 11.0, z: 0.0 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.25, width: 0.7, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-top-ch4',
    start: { x: 11.0, z: 0.0 },
    end: { x: 15.0, z: 0.0 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 1.3, width: 1.5, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },

  // Right perimeter (x = 15.0, z = 0..20.35)
  {
    id: 'w-right-ch4',
    start: { x: 15.0, z: 0.0 },
    end: { x: 15.0, z: 3.3 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.95, width: 1.4, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-right-sde3',
    start: { x: 15.0, z: 3.3 },
    end: { x: 15.0, z: 4.95 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.45, width: 0.75, sillHeight: 1.35, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-right-ch3',
    start: { x: 15.0, z: 4.95 },
    end: { x: 15.0, z: 8.15 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.9, width: 1.4, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-right-ch2',
    start: { x: 15.0, z: 8.15 },
    end: { x: 15.0, z: 11.35 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.9, width: 1.4, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-right-sde2',
    start: { x: 15.0, z: 11.35 },
    end: { x: 15.0, z: 13.55 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.7, width: 0.8, sillHeight: 1.35, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-right-buanderie',
    start: { x: 15.0, z: 13.55 },
    end: { x: 15.0, z: 16.35 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'door', offset: 1.0, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: 1 },
    ],
  },
  {
    id: 'w-right-cuisine',
    start: { x: 15.0, z: 16.35 },
    end: { x: 15.0, z: 20.35 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 1.2, width: 1.6, sillHeight: 1.0, headHeight: 2.15 },
    ],
  },

  // Bottom perimeter (Cuisine + S.A.M.)
  {
    id: 'w-bot-cuisine',
    start: { x: 15.0, z: 20.35 },
    end: { x: 11.0, z: 20.35 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 1.2, width: 1.6, sillHeight: 1.0, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-bot-sam',
    start: { x: 11.0, z: 20.35 },
    end: { x: 6.752, z: 20.35 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'sliding', offset: 1.1, width: 2.0, sillHeight: 0, headHeight: 2.2 },
    ],
  },
  {
    id: 'w-sam-se-join',
    start: { x: 6.752, z: 20.35 },
    end: { x: 6.752, z: 20.778 },
    thickness: EXT,
    isExterior: true,
    openings: [],
  },

  // Left side exterior (CH1, Bureau, Séjour VIP, Séjour 1)
  {
    id: 'w-left-ch1',
    start: { x: 0.0, z: 0.0 },
    end: { x: 0.0, z: 5.2 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 1.7, width: 1.8, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-bot-ch1-terrasse',
    start: { x: 0.0, z: 5.2 },
    end: { x: 1.3, z: 5.2 },
    thickness: EXT,
    isExterior: true,
    openings: [],
  },
  {
    id: 'w-bot-ch1-bureau',
    start: { x: 1.3, z: 5.2 },
    end: { x: 4.8, z: 5.2 },
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-left-bureau',
    start: { x: 1.3, z: 5.2 },
    end: { x: 1.3, z: 7.1 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.45, width: 1.0, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-bot-bureau',
    start: { x: 1.3, z: 7.1 },
    end: { x: 3.8, z: 7.1 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'door', offset: 0.9, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: -1 },
    ],
  },
  {
    id: 'w-left-sejour-vip',
    start: { x: 3.8, z: 5.2 },
    end: { x: 3.8, z: 9.8 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'door', offset: 2.5, width: 1.3, sillHeight: 0, headHeight: 2.2, swingDir: 1 },
    ],
  },
  {
    id: 'w-left-sejour-1',
    start: { x: 3.8, z: 9.8 },
    end: { x: 3.8, z: 16.5 },
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'sliding', offset: 1.4, width: 2.4, sillHeight: 0, headHeight: 2.2 },
      { type: 'window', offset: 4.5, width: 1.3, sillHeight: 0.85, headHeight: 2.15 },
    ],
  },

  // Interior walls: CH1, SDE 1, Dressing, Sas
  {
    id: 'w-ch1-right',
    start: { x: 4.8, z: 0.0 },
    end: { x: 4.8, z: 5.2 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'door', offset: 3.65, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: 1 },
    ],
  },
  {
    id: 'w-sde1-dressing',
    start: { x: 7.0, z: 0.0 },
    end: { x: 7.0, z: 3.2 },
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-sde1-dressing-bot',
    start: { x: 4.8, z: 3.2 },
    end: { x: 9.8, z: 3.2 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'door', offset: 0.65, width: 0.85, sillHeight: 0, headHeight: 2.1, swingDir: -1 },
      { type: 'door', offset: 3.0, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: 1 },
    ],
  },
  {
    id: 'w-sas-vip',
    start: { x: 4.8, z: 4.8 },
    end: { x: 9.8, z: 4.8 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'arch', offset: 1.1, width: 1.4, sillHeight: 0, headHeight: 2.25 },
    ],
  },

  // Partition between Séjour VIP & Séjour 1
  {
    id: 'w-vip-sejour1',
    start: { x: 3.8, z: 9.8 },
    end: { x: 9.8, z: 9.8 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'arch', offset: 1.6, width: 2.6, sillHeight: 0, headHeight: 2.3 },
    ],
  },

  // Couloir left wall (x = 9.8)
  {
    id: 'w-couloir-left',
    start: { x: 9.8, z: 0.0 },
    end: { x: 9.8, z: 16.5 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'arch', offset: 3.4, width: 1.2, sillHeight: 0, headHeight: 2.2 },
      { type: 'arch', offset: 6.4, width: 1.4, sillHeight: 0, headHeight: 2.2 },
      { type: 'arch', offset: 12.2, width: 1.6, sillHeight: 0, headHeight: 2.2 },
    ],
  },

  // Couloir right wall (x = 11.0, z = 0..16.35)
  {
    id: 'w-couloir-right',
    start: { x: 11.0, z: 0.0 },
    end: { x: 11.0, z: 16.35 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'door', offset: 1.65, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: 1 }, // CH4
      { type: 'door', offset: 3.7, width: 0.8, sillHeight: 0, headHeight: 2.1, swingDir: 1 }, // SDE3
      { type: 'door', offset: 6.1, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: 1 }, // CH3
      { type: 'door', offset: 9.3, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: 1 }, // CH2
      { type: 'door', offset: 12.0, width: 0.8, sillHeight: 0, headHeight: 2.1, swingDir: 1 }, // SDE2
      { type: 'door', offset: 14.5, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: 1 }, // Buanderie
    ],
  },

  // Night wing cross-walls (x = 11.0..15.0)
  {
    id: 'w-ch4-sde3',
    start: { x: 11.0, z: 3.3 },
    end: { x: 15.0, z: 3.3 },
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-sde3-ch3',
    start: { x: 11.0, z: 4.95 },
    end: { x: 15.0, z: 4.95 },
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-ch3-ch2',
    start: { x: 11.0, z: 8.15 },
    end: { x: 15.0, z: 8.15 },
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-ch2-sde2',
    start: { x: 11.0, z: 11.35 },
    end: { x: 15.0, z: 11.35 },
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-sde2-buanderie',
    start: { x: 11.0, z: 13.55 },
    end: { x: 15.0, z: 13.55 },
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-buanderie-cuisine',
    start: { x: 11.0, z: 16.35 },
    end: { x: 15.0, z: 16.35 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'door', offset: 2.2, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: -1 },
    ],
  },

  // Magasin & Cuisine / S.A.M. separation
  {
    id: 'w-sam-magasin-cuisine',
    start: { x: 11.0, z: 16.35 },
    end: { x: 11.0, z: 20.35 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'arch', offset: 2.35, width: 1.3, sillHeight: 0, headHeight: 2.2 },
    ],
  },
  {
    id: 'w-magasin-right',
    start: { x: 12.6, z: 16.35 },
    end: { x: 12.6, z: 18.35 },
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-magasin-bot',
    start: { x: 11.0, z: 18.35 },
    end: { x: 12.6, z: 18.35 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'door', offset: 0.4, width: 0.8, sillHeight: 0, headHeight: 2.1, swingDir: 1 },
    ],
  },

  // Séjour 1 -> S.A.M. wall
  {
    id: 'w-sejour1-sam',
    start: { x: 6.504, z: 16.5 },
    end: { x: 9.8, z: 16.5 },
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'arch', offset: 0.4, width: 2.3, sillHeight: 0, headHeight: 2.3 },
    ],
  },

  // Angled 45° wing: CH5 + SE
  {
    id: 'w-sejour1-ch5',
    start: { x: 3.8, z: 16.5 },
    end: CH5_A,
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-ch5-diag-top',
    start: CH5_A,
    end: CH5_B,
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'door', offset: 0.75, width: 0.9, sillHeight: 0, headHeight: 2.1, swingDir: 1 },
    ],
  },
  {
    id: 'w-ch5-sam-link',
    start: CH5_B,
    end: { x: 6.504, z: 16.5 },
    thickness: INT,
    isExterior: false,
    openings: [],
  },
  {
    id: 'w-ch5-diag-right',
    start: CH5_B,
    end: SE_A,
    thickness: EXT,
    isExterior: true,
    openings: [],
  },
  {
    id: 'w-ch5-se-partition',
    start: SE_A,
    end: CH5_C,
    thickness: INT,
    isExterior: false,
    openings: [
      { type: 'door', offset: 0.65, width: 0.8, sillHeight: 0, headHeight: 2.1, swingDir: -1 },
    ],
  },
  {
    id: 'w-ch5-diag-bot',
    start: CH5_C,
    end: CH5_D,
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 1.0, width: 1.4, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-ch5-diag-left',
    start: CH5_D,
    end: CH5_A,
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.9, width: 1.2, sillHeight: 0.9, headHeight: 2.15 },
    ],
  },
  // SE 45° bathroom walls
  {
    id: 'w-se-top',
    start: SE_A,
    end: SE_B,
    thickness: EXT,
    isExterior: true,
    openings: [],
  },
  {
    id: 'w-se-outer',
    start: SE_B,
    end: SE_C,
    thickness: EXT,
    isExterior: true,
    openings: [
      { type: 'window', offset: 0.6, width: 0.8, sillHeight: 1.35, headHeight: 2.15 },
    ],
  },
  {
    id: 'w-se-bot',
    start: SE_C,
    end: SE_D,
    thickness: EXT,
    isExterior: true,
    openings: [],
  },
];

// Veranda & Terrace columns along the left facade (x = 0.22)
export const COLUMNS: ColumnSpec[] = [
  { id: 'col-1', x: 0.22, z: 5.4, size: 0.28 },
  { id: 'col-2', x: 0.22, z: 7.7, size: 0.28 },
  { id: 'col-3', x: 0.22, z: 10.0, size: 0.28 },
  { id: 'col-4', x: 0.22, z: 13.2, size: 0.28 },
  { id: 'col-5', x: 0.22, z: 16.3, size: 0.28 },
  { id: 'col-6', x: 1.87, z: 18.4, size: 0.28 },
];

export const FURNITURE: FurniturePlacement[] = [
  // CH1 Master Bedroom
  { id: 'f-ch1-bed', roomId: 'ch1', kind: 'master-bed', x: 1.85, z: 1.35, rotationY: 0 },
  { id: 'f-ch1-wardrobe', roomId: 'ch1', kind: 'wardrobe', x: 4.45, z: 1.5, rotationY: -Math.PI / 2 },
  // SDE 1
  { id: 'f-sde1-bath', roomId: 'sde1', kind: 'bathroom-full', x: 5.9, z: 1.5, rotationY: 0 },
  // Dressing
  { id: 'f-dress-wardrobe', roomId: 'dressing', kind: 'wardrobe', x: 8.4, z: 0.45, rotationY: 0 },
  // Bureau
  { id: 'f-bureau-desk', roomId: 'bureau', kind: 'office-desk', x: 2.65, z: 5.9, rotationY: 0 },
  // Séjour VIP
  { id: 'f-vip-sofa', roomId: 'sejour_vip', kind: 'sofa-vip', x: 6.9, z: 7.35, rotationY: 0 },
  // Séjour 1
  { id: 'f-s1-sofa', roomId: 'sejour_1', kind: 'sofa-l', x: 6.9, z: 13.1, rotationY: 0 },
  // S.A.M.
  { id: 'f-sam-dining', roomId: 'sam', kind: 'dining-set', x: 8.6, z: 18.45, rotationY: 0 },
  // Cuisine
  { id: 'f-cuisine-l', roomId: 'cuisine', kind: 'kitchen-l', x: 13.5, z: 18.85, rotationY: 0 },
  // Magasin
  { id: 'f-magasin-shelves', roomId: 'magasin', kind: 'pantry-shelves', x: 11.8, z: 17.2, rotationY: 0 },
  // Buanderie
  { id: 'f-buanderie-set', roomId: 'buanderie', kind: 'laundry-set', x: 13.3, z: 14.95, rotationY: -Math.PI / 2 },
  // SDE 2
  { id: 'f-sde2-bath', roomId: 'sde2', kind: 'bathroom-compact', x: 13.1, z: 12.45, rotationY: -Math.PI / 2 },
  // CH2
  { id: 'f-ch2-bed', roomId: 'ch2', kind: 'bed', x: 13.5, z: 9.75, rotationY: -Math.PI / 2 },
  { id: 'f-ch2-wardrobe', roomId: 'ch2', kind: 'wardrobe', x: 12.2, z: 11.0, rotationY: Math.PI },
  // CH3
  { id: 'f-ch3-bed', roomId: 'ch3', kind: 'bed', x: 13.5, z: 6.55, rotationY: -Math.PI / 2 },
  { id: 'f-ch3-wardrobe', roomId: 'ch3', kind: 'wardrobe', x: 12.2, z: 7.8, rotationY: Math.PI },
  // SDE 3
  { id: 'f-sde3-bath', roomId: 'sde3', kind: 'bathroom-compact', x: 13.1, z: 4.12, rotationY: -Math.PI / 2 },
  // CH4
  { id: 'f-ch4-bed', roomId: 'ch4', kind: 'bed', x: 13.5, z: 1.65, rotationY: -Math.PI / 2 },
  { id: 'f-ch4-wardrobe', roomId: 'ch4', kind: 'wardrobe', x: 12.2, z: 0.4, rotationY: 0 },
  // CH5 (45° rotated!)
  {
    id: 'f-ch5-bed',
    roomId: 'ch5',
    kind: 'bed',
    x: (CH5_A.x + CH5_B.x + CH5_C.x + CH5_D.x) / 4 - 0.1,
    z: (CH5_A.z + CH5_B.z + CH5_C.z + CH5_D.z) / 4 + 0.1,
    rotationY: -Math.PI / 4,
  },
  // SE (45° rotated!)
  {
    id: 'f-se-bath',
    roomId: 'se',
    kind: 'bathroom-compact',
    x: (SE_A.x + SE_B.x + SE_C.x + SE_D.x) / 4,
    z: (SE_A.z + SE_B.z + SE_C.z + SE_D.z) / 4,
    rotationY: -Math.PI / 4,
  },
  // Veranda outdoor lounge & planters
  { id: 'f-veranda-lounge', roomId: 'veranda', kind: 'veranda-lounge', x: 1.9, z: 13.2, rotationY: Math.PI / 2 },
  { id: 'f-plant-1', roomId: 'veranda', kind: 'planter', x: 0.7, z: 10.6, rotationY: 0 },
  { id: 'f-plant-2', roomId: 'veranda', kind: 'planter', x: 0.7, z: 16.0, rotationY: 0 },
  { id: 'f-plant-3', roomId: 'terrasse', kind: 'planter', x: 0.7, z: 6.2, rotationY: 0 },
];

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'iso',
    label: 'Vue 3/4',
    position: [-15.5, 16.5, 14.5],
    target: [0, 0.8, 0.2],
  },
  {
    id: 'top',
    label: 'Plan Dessus',
    position: [0, 26.5, 0.01],
    target: [0, 0, 0],
  },
  {
    id: 'veranda',
    label: 'Véranda & Séjour',
    position: [-11.5, 7.5, 9.5],
    target: [-1.5, 1.0, 2.2],
  },
  {
    id: 'night',
    label: 'Aile Nuit',
    position: [13.5, 12.5, -9.5],
    target: [3.2, 0.8, -2.5],
  },
];

export const TOTAL_INTERIOR_AREA_SQM = Math.round(
  ROOMS.filter((r) => r.category !== 'outdoor').reduce((acc, r) => acc + r.areaSqm, 0),
);
