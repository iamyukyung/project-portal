/**
 * Deterministic layout data for the Sprint 1A test diorama.
 *
 * Everything here is generated once at module load from a fixed seed so the
 * world is identical on every reload and between server/client, and so the
 * render components stay free of scatter logic.
 */

export type Placement = {
  x: number;
  z: number;
  scale: number;
  /** Yaw, radians. */
  rotation: number;
  tiltX: number;
  tiltZ: number;
  /** Index into a colour palette, keeps instances visually varied. */
  variant: number;
};

type Circle = { x: number; z: number; r: number };

export const WORLD = {
  /** Radius the player can actually walk in — ringed by invisible walls. */
  walkRadius: 25,
  /** Grass disc. Comfortably past the forest wall so no edge is ever in shot. */
  groundRadius: 50,
  /** Far disc that carries the distant silhouettes out to the horizon. */
  farGroundRadius: 130,
  /** Radius scenery is scattered within. */
  sceneryRadius: 36,
  /** Empty plaza kept clear for the Portal in a later sprint. */
  plazaRadius: 5.6,
  /** Distance from the centre to each future Rune landmark. */
  landmarkRadius: 16,
} as const;

/** Capsule dimensions. Shared by every device — only the feel is tuned. */
export const PLAYER = {
  radius: 0.35,
  /** Half height of the capsule's cylindrical section. Total height = 1.4. */
  halfHeight: 0.35,
  /** Y of the rigid body origin when standing on the ground. */
  centerY: 0.72,
} as const;

export type MovementTuning = {
  /** Units per second at full input. */
  maxSpeed: number;
  /** How sharply velocity ramps up. Higher = more immediate. */
  accel: number;
  /** How sharply velocity bleeds off once input stops. */
  decel: number;
  /** How fast the character swings round to face its heading. */
  turnRate: number;
};

/**
 * Feel is split by input device so the two can be tuned independently — a
 * mouse and keyboard want a brisker character than a thumb on a joystick.
 * These are the only numbers to touch when adjusting movement.
 */
export const MOVEMENT: Record<"desktop" | "touch", MovementTuning> = {
  // 25% quicker than touch, with a slightly sharper ramp so a key press bites
  // straight away. Deceleration is deliberately left alone so stops stay soft,
  // and the turn rate is nudged up just enough that the wider arcs the extra
  // speed would otherwise produce still feel controlled.
  // Crossing the 50u world takes ~11.8s.
  desktop: { maxSpeed: 4.25, accel: 13, decel: 15, turnRate: 12 },
  // Unchanged from Sprint 1A. Crossing the 50u world takes ~14.7s.
  touch: { maxSpeed: 3.4, accel: 11, decel: 15, turnRate: 11 },
};

/**
 * The camera never rotates, so the mapping from screen space to world space is
 * a constant. Screen "up" is the direction the camera looks along the ground.
 */
export const CAMERA_YAW = Math.PI / 4;
export const CAMERA_DIR = {
  x: Math.sin(CAMERA_YAW),
  z: Math.cos(CAMERA_YAW),
} as const;

/**
 * Sits on the camera axis, 18 units out from the plaza, so the Portal is
 * straight up-screen from the very first frame and "forward" is unambiguous.
 */
export const SPAWN = {
  x: CAMERA_DIR.x * 18,
  z: CAMERA_DIR.z * 18,
} as const;
export const SCREEN_FORWARD = { x: -CAMERA_DIR.x, z: -CAMERA_DIR.z } as const;
export const SCREEN_RIGHT = {
  x: Math.cos(CAMERA_YAW),
  z: -Math.sin(CAMERA_YAW),
} as const;

export const COLORS = {
  sky: "#9fcbd8",
  ground: "#7fa74f",
  farGround: "#688b52",
  plaza: "#b3b0a4",
  trunk: ["#6d4a37", "#7d5a3f"],
  canopy: ["#4c8c4f", "#3f7a47", "#5d9e55", "#69a95b"],
  rock: ["#8c939b", "#7a8189", "#9aa0a6"],
  grass: ["#79a44f", "#8cb75c", "#6c9748"],
  mountain: ["#7f9a86", "#6f8a79"],
  stone: "#a3a89e",
  /** The portal ring lerps between these as runes are collected. */
  portalDormant: "#8f959d",
  portalActive: "#7d8fd8",
  portalGlow: "#4a63d8",
  rune: "#e3c66d",
  runeEmissive: "#6b5320",
  player: {
    cloak: "#f2652a",
    trim: "#f2c14e",
    skin: "#f5d7b2",
    boots: "#3f3b46",
    pack: "#8a5a3b",
  },
} as const;

/** Three landmark plinths where the Runes will live in a later sprint. */
export const LANDMARKS = [30, 150, 270].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return {
    x: WORLD.landmarkRadius * Math.cos(a),
    z: WORLD.landmarkRadius * Math.sin(a),
  };
});

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ScatterOptions = {
  count: number;
  minRadius: number;
  maxRadius: number;
  /** Minimum distance between two items of this set. */
  spacing: number;
  scale: [number, number];
  variants: number;
  /** Max random tilt in radians, for rocks and grass. */
  tilt?: number;
  avoid?: Circle[];
  /** Previously placed sets that should also be kept clear. */
  avoidPlacements?: { items: readonly Placement[]; distance: number }[];
};

function scatter(random: () => number, options: ScatterOptions): Placement[] {
  const {
    count,
    minRadius,
    maxRadius,
    spacing,
    scale,
    variants,
    tilt = 0,
    avoid = [],
    avoidPlacements = [],
  } = options;

  const placed: Placement[] = [];
  const maxAttempts = count * 60;

  for (let attempt = 0; attempt < maxAttempts && placed.length < count; attempt++) {
    const angle = random() * Math.PI * 2;
    // sqrt keeps the distribution even across the annulus instead of clumping
    // towards the inner edge.
    const t = Math.sqrt(random());
    const radius = minRadius + (maxRadius - minRadius) * t;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (avoid.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
    if (placed.some((p) => Math.hypot(x - p.x, z - p.z) < spacing)) continue;

    const blocked = avoidPlacements.some(({ items, distance }) =>
      items.some((p) => Math.hypot(x - p.x, z - p.z) < distance),
    );
    if (blocked) continue;

    placed.push({
      x,
      z,
      scale: scale[0] + random() * (scale[1] - scale[0]),
      rotation: random() * Math.PI * 2,
      tiltX: tilt ? (random() - 0.5) * tilt : 0,
      tiltZ: tilt ? (random() - 0.5) * tilt : 0,
      variant: Math.floor(random() * variants),
    });
  }

  return placed;
}

const random = mulberry32(20260810);

/** Kept clear so the plaza, the landmarks and the spawn stay readable. */
const KEEP_CLEAR: Circle[] = [
  { x: 0, z: 0, r: WORLD.plazaRadius + 2.2 },
  ...LANDMARKS.map((l) => ({ x: l.x, z: l.z, r: 5 })),
  { x: SPAWN.x, z: SPAWN.z, r: 4.5 },
];

/**
 * Trees inside the walkable area — these get colliders. Kept sparse and a
 * little shorter than the border so sightlines stay open and the character
 * never gets lost in the canopy.
 */
export const INTERIOR_TREES = scatter(random, {
  count: 30,
  minRadius: WORLD.plazaRadius + 2.4,
  maxRadius: WORLD.walkRadius - 1.5,
  spacing: 3.8,
  scale: [0.7, 1.15],
  variants: 4,
  avoid: KEEP_CLEAR,
});

/** Forest border outside the walls — decorative only, no colliders. */
export const OUTER_TREES = scatter(random, {
  count: 150,
  minRadius: WORLD.walkRadius + 1.2,
  maxRadius: 42,
  spacing: 1.7,
  scale: [0.9, 1.7],
  variants: 4,
});

export const ALL_TREES: readonly Placement[] = [
  ...INTERIOR_TREES,
  ...OUTER_TREES,
];

/** Boulders large enough to block the player. */
export const BIG_ROCKS = scatter(random, {
  count: 13,
  minRadius: WORLD.plazaRadius + 2.8,
  maxRadius: WORLD.walkRadius - 2.5,
  spacing: 5,
  scale: [1, 1.7],
  variants: 3,
  tilt: 0.4,
  avoid: KEEP_CLEAR,
  avoidPlacements: [{ items: INTERIOR_TREES, distance: 3.2 }],
});

/** Pebbles — decoration only, deliberately without colliders. */
export const SMALL_ROCKS = scatter(random, {
  count: 34,
  minRadius: 3,
  maxRadius: WORLD.sceneryRadius,
  spacing: 1.2,
  scale: [0.28, 0.6],
  variants: 3,
  tilt: 0.8,
});

export const GRASS = scatter(random, {
  count: 170,
  minRadius: 3,
  maxRadius: WORLD.sceneryRadius,
  spacing: 0.75,
  scale: [0.55, 1.1],
  variants: 3,
  tilt: 0.25,
});

/** Distant silhouettes that give the horizon some depth. */
export const MOUNTAINS = scatter(random, {
  count: 30,
  minRadius: 52,
  maxRadius: 100,
  spacing: 11,
  scale: [5, 12],
  variants: 2,
});

/** Stones marking each future Rune landmark. */
export const LANDMARK_STONES: Placement[] = LANDMARKS.flatMap((landmark, i) =>
  [0, 1, 2, 3].map((k) => {
    const a = (k / 4) * Math.PI * 2 + i * 0.4;
    return {
      x: landmark.x + Math.cos(a) * 2.1,
      z: landmark.z + Math.sin(a) * 2.1,
      scale: 0.5 + ((i + k) % 3) * 0.08,
      rotation: a,
      tiltX: 0.12,
      tiltZ: -0.08,
      variant: (i + k) % 3,
    };
  }),
);

/** Segment count for the invisible wall ring around the walkable area. */
export const BOUNDARY_SEGMENTS = 18;
