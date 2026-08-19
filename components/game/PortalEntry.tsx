"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

import { resetAllMovementInput } from "@/hooks/usePlayerInput";
import { useGameStore } from "@/store/gameStore";

/**
 * Close enough that stepping into the ring counts, far enough that brushing
 * the edge of the plaza does not.
 */
const ENTRY_RADIUS = 2.6;
/** Seconds inside the radius before the gate takes the player. */
const ENTRY_DWELL = 0.3;

/**
 * Watches for the player stepping into an open portal.
 *
 * Same shape as rune discovery — proximity plus a dwell, no interact button on
 * either platform. The store refuses everything except a first entry from open
 * play with all three runes, so the per-frame check here cannot double-fire.
 */
export function PortalEntry({
  positionRef,
}: {
  positionRef: RefObject<THREE.Vector3>;
}) {
  const phase = useGameStore((state) => state.phase);
  const controlsEnabled = useGameStore((state) => state.controlsEnabled);
  const portalActivated = useGameStore((state) => state.portalActivated);
  const portalEntered = useGameStore((state) => state.portalEntered);
  const enterPortal = useGameStore((state) => state.enterPortal);

  const dwell = useRef(0);

  useFrame((_, delta) => {
    // A dormant gate is scenery: no proximity check runs until all three
    // runes are in, which is what keeps an early visit from triggering it.
    const armed =
      phase === "PLAYING" && controlsEnabled && portalActivated && !portalEntered;

    if (!armed) {
      dwell.current = 0;
      return;
    }

    const player = positionRef.current;
    if (Math.hypot(player.x, player.z) > ENTRY_RADIUS) {
      dwell.current = 0;
      return;
    }

    dwell.current += Math.min(delta, 1 / 30);
    if (dwell.current < ENTRY_DWELL) return;

    // Whatever was held down at this instant — a key, the stick, a walk
    // destination — is dropped before control is taken away.
    resetAllMovementInput();
    enterPortal();
  });

  return null;
}
