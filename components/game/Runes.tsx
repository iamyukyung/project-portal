"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { clearPointerTarget } from "@/hooks/usePlayerInput";
import {
  DISCOVER_DWELL,
  DISCOVER_RADIUS,
  RUNES,
  RUNE_ORDER,
  type RuneId,
} from "@/lib/runes";
import { COLORS } from "@/lib/worldLayout";
import { useGameStore } from "@/store/gameStore";

const SPENT_COLOR = new THREE.Color(COLORS.stone);
const BLACK = new THREE.Color("#000000");

/** Resting height of an undiscovered crystal. */
const IDLE_HEIGHT = 1.85;
/** Where it rises to while its panel is open. */
const ACTIVE_HEIGHT = 2.75;
/** Where a claimed crystal settles, small and dark. */
const SPENT_HEIGHT = 1.5;

/** Life of the ring that pings out when a rune is found. */
const WAVE_MS = 700;

type RuneRuntime = {
  scale: number;
  height: number;
  glow: number;
  /** 0 = live crystal, 1 = claimed and dimmed. */
  spent: number;
  spin: number;
  /** Seconds the player has been inside the radius. */
  dwell: number;
};

function createRuntime(): RuneRuntime {
  return {
    scale: 1,
    height: IDLE_HEIGHT,
    glow: 0.75,
    spent: 0,
    spin: 0,
    dwell: 0,
  };
}

type RunesProps = {
  /** The player's live position, written by Player every frame. */
  positionRef: RefObject<THREE.Vector3>;
  reducedMotion: boolean;
};

/**
 * The three collectable crystals plus the proximity check that finds them.
 *
 * There is no interact button on either platform: standing near a rune for a
 * moment is the whole interaction. The dwell requirement is what stops a rune
 * firing when the player merely clips the edge of the plinth in passing.
 */
export function Runes({ positionRef, reducedMotion }: RunesProps) {
  const runes = useGameStore((state) => state.runes);
  const activeRune = useGameStore((state) => state.activeRune);
  const phase = useGameStore((state) => state.phase);
  const controlsEnabled = useGameStore((state) => state.controlsEnabled);
  const discoverRune = useGameStore((state) => state.discoverRune);

  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const materialRefs = useRef<(THREE.MeshLambertMaterial | null)[]>([]);
  const runtime = useRef<RuneRuntime[]>(RUNE_ORDER.map(createRuntime));

  const waveRef = useRef<THREE.Mesh>(null);
  const waveMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const lastActive = useRef<RuneId | null>(null);
  const waveStart = useRef(0);

  const palette = useMemo(
    () =>
      RUNE_ORDER.map((id) => ({
        accent: new THREE.Color(RUNES[id].accent),
        emissive: new THREE.Color(RUNES[id].emissive),
      })),
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const elapsed = state.clock.elapsedTime;
    const player = positionRef.current;
    // Discovery only ever fires from open play, never mid-panel or mid-intro.
    const canDiscover = phase === "PLAYING" && controlsEnabled;

    RUNE_ORDER.forEach((id, index) => {
      const rune = RUNES[id];
      const rt = runtime.current[index];
      const mesh = meshRefs.current[index];
      const material = materialRefs.current[index];
      const found = runes[id];
      const isActive = activeRune === id;

      if (!found && canDiscover) {
        const distance = Math.hypot(
          player.x - rune.position.x,
          player.z - rune.position.z,
        );
        if (distance <= DISCOVER_RADIUS) {
          rt.dwell += dt;
          // The store guards against repeats, so calling twice is harmless.
          if (rt.dwell >= DISCOVER_DWELL) {
            // Drop any click destination too, or the character would resume
            // walking to it the moment the panel closes.
            clearPointerTarget();
            discoverRune(id);
          }
        } else {
          rt.dwell = 0;
        }
      } else {
        rt.dwell = 0;
      }

      const bob =
        reducedMotion || found || isActive
          ? 0
          : Math.sin(elapsed * 1.1 + index * 2.1) * 0.12;

      const targetScale = isActive ? 1.45 : found ? 0.42 : 1;
      const targetHeight = isActive
        ? ACTIVE_HEIGHT
        : found
          ? SPENT_HEIGHT
          : IDLE_HEIGHT + bob;
      const targetGlow = isActive ? 1.6 : found ? 0.05 : 0.75;
      const targetSpent = found && !isActive ? 1 : 0;

      if (reducedMotion) {
        rt.scale = targetScale;
        rt.height = targetHeight;
        rt.glow = targetGlow;
        rt.spent = targetSpent;
      } else {
        rt.scale = THREE.MathUtils.damp(rt.scale, targetScale, 7, dt);
        rt.height = THREE.MathUtils.damp(rt.height, targetHeight, 7, dt);
        rt.glow = THREE.MathUtils.damp(rt.glow, targetGlow, 6, dt);
        rt.spent = THREE.MathUtils.damp(rt.spent, targetSpent, 5, dt);
        rt.spin += dt * (isActive ? 3.2 : found ? 0.15 : 0.5);
      }

      if (mesh) {
        mesh.position.y = rt.height;
        mesh.scale.setScalar(rt.scale);
        mesh.rotation.y = rt.spin;
      }
      if (material) {
        material.color.lerpColors(
          palette[index].accent,
          SPENT_COLOR,
          rt.spent,
        );
        material.emissive.lerpColors(palette[index].emissive, BLACK, rt.spent);
        material.emissiveIntensity = rt.glow;
      }
    });

    // Discovery ping — restarted whenever a new panel opens.
    if (activeRune !== lastActive.current) {
      lastActive.current = activeRune;
      if (activeRune) {
        waveStart.current = performance.now();
        const { position } = RUNES[activeRune];
        waveRef.current?.position.set(position.x, 0.04, position.z);
      }
    }

    const wave = waveRef.current;
    const waveMaterial = waveMaterialRef.current;
    if (wave && waveMaterial) {
      const age = performance.now() - waveStart.current;
      const alive = activeRune !== null && age < WAVE_MS;
      wave.visible = alive;
      if (alive) {
        const progress = age / WAVE_MS;
        wave.scale.setScalar(reducedMotion ? 2.4 : 0.4 + progress * 2.8);
        waveMaterial.opacity = 0.5 * (1 - progress);
        waveMaterial.color.set(RUNES[activeRune].accent);
      }
    }
  });

  return (
    <>
      {RUNE_ORDER.map((id, index) => (
        <mesh
          key={id}
          ref={(mesh) => {
            meshRefs.current[index] = mesh;
          }}
          position={[RUNES[id].position.x, IDLE_HEIGHT, RUNES[id].position.z]}
        >
          <octahedronGeometry args={[0.42, 0]} />
          <meshLambertMaterial
            ref={(material) => {
              materialRefs.current[index] = material;
            }}
            color={RUNES[id].accent}
            emissive={RUNES[id].emissive}
            emissiveIntensity={0.75}
            flatShading
          />
        </mesh>
      ))}

      <mesh ref={waveRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.6, 0.78, 6]} />
        <meshBasicMaterial
          ref={waveMaterialRef}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
