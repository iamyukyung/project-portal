"use client";

import { useEffect } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import {
  clearPointerTarget,
  setPointerDragging,
  setPointerTarget,
} from "@/hooks/usePlayerInput";
import { setGroundPicker } from "@/lib/groundPick";
import { useGameStore } from "@/store/gameStore";
import { WORLD } from "@/lib/worldLayout";

/**
 * Reaches past the walls so clicks near the edge of the world still register;
 * the destination itself is clamped to the walkable area.
 */
const PLANE_RADIUS = WORLD.walkRadius + 10;
/** Height of the pick plane, matching the invisible disc below. */
const PLANE_Y = 0.015;
/** Hits beyond this are sky or far scenery, not somewhere to walk. */
const MAX_PICK_RADIUS = WORLD.groundRadius;

type GroundPointerProps = {
  /**
   * Desktop only. Touch devices get their destinations from the gesture layer
   * in the DOM instead, which keeps the scene free of interactive objects and
   * so keeps R3F from raycasting on every pointer move.
   */
  interactive: boolean;
  /** Toggles the canvas cursor so the ground reads as somewhere you can go. */
  onHoverChange: (hovering: boolean) => void;
};

/**
 * Turns pointer positions into world-space destinations.
 *
 * Nothing here moves the character — it only publishes a destination that the
 * player's existing physics movement walks towards.
 */
export function GroundPointer({
  interactive,
  onHoverChange,
}: GroundPointerProps) {
  const controlsEnabled = useGameStore((state) => state.controlsEnabled);
  const camera = useThree((state) => state.camera);
  const domElement = useThree((state) => state.gl.domElement);

  // Publish a screen-to-ground picker for the touch gesture layer, which
  // cannot reach the camera from outside the Canvas.
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLANE_Y);
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();

    setGroundPicker((clientX, clientY) => {
      const rect = domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);

      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      // A tap on the sky or the far forest is not a destination.
      if (Math.hypot(hit.x, hit.z) > MAX_PICK_RADIUS) return null;
      return { x: hit.x, z: hit.z };
    });

    return () => setGroundPicker(null);
  }, [camera, domElement]);

  useEffect(() => {
    if (!interactive) return;
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
  }, [interactive, onHoverChange]);

  if (!interactive) return null;

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
      position={[0, PLANE_Y, 0]}
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
