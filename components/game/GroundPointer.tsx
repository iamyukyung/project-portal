"use client";

import { useEffect } from "react";
import type { ThreeEvent } from "@react-three/fiber";

import {
  clearPointerTarget,
  setPointerDragging,
  setPointerTarget,
} from "@/hooks/usePlayerInput";
import { useGameStore } from "@/store/gameStore";
import { WORLD } from "@/lib/worldLayout";

/**
 * Reaches past the walls so clicks near the edge of the world still register;
 * the destination itself is clamped to the walkable area.
 */
const PLANE_RADIUS = WORLD.walkRadius + 10;

type GroundPointerProps = {
  /** Toggles the canvas cursor so the ground reads as somewhere you can go. */
  onHoverChange: (hovering: boolean) => void;
};

/**
 * Click-to-move. An invisible disc over the ground turns pointer hits into a
 * world-space destination; R3F's raycaster hands us `event.point` directly, so
 * no manual Raycaster plumbing is needed.
 *
 * Holding the button and dragging keeps re-targeting, which reads as steering.
 * Nothing here moves the character — it only publishes a destination that the
 * player's existing physics movement walks towards.
 *
 * Desktop only; the mobile joystick owns touch input.
 */
export function GroundPointer({ onHoverChange }: GroundPointerProps) {
  const controlsEnabled = useGameStore((state) => state.controlsEnabled);

  useEffect(() => {
    // Releasing off-canvas would otherwise leave the drag flag stuck on.
    const endDrag = () => setPointerDragging(false);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      setPointerDragging(false);
      clearPointerTarget();
      onHoverChange(false);
    };
  }, [onHoverChange]);

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!controlsEnabled || event.button !== 0) return;
    event.stopPropagation();
    setPointerDragging(true);
    setPointerTarget(event.point.x, event.point.z, true);
  };

  const onPointerMove = (event: ThreeEvent<PointerEvent>) => {
    // `buttons` is authoritative about the held state, so a pointerup we never
    // saw cannot leave us dragging.
    if (!controlsEnabled || (event.buttons & 1) === 0) return;
    setPointerTarget(event.point.x, event.point.z, false);
  };

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.015, 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setPointerDragging(false)}
      onPointerOver={() => onHoverChange(true)}
      onPointerOut={() => onHoverChange(false)}
    >
      <circleGeometry args={[PLANE_RADIUS, 8]} />
      {/* Present for the raycaster, absent from the picture. */}
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
