"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { getPointerTarget } from "@/hooks/usePlayerInput";
import { COLORS } from "@/lib/worldLayout";

/** Total life of the marker after the button is released. */
const FADE_MS = 480;
/** How long the ring takes to open out to full size. */
const GROW_MS = 200;
const PEAK_OPACITY = 0.45;

/**
 * A small rune-like ring that blinks where you clicked. This is acknowledgement
 * feedback, not an effect — it stays quiet enough to ignore. While the button
 * is held it tracks the cursor so a drag reads as a destination being steered.
 */
export function DestinationMarker({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const group = groupRef.current;
    const material = materialRef.current;
    if (!group || !material) return;

    const target = getPointerTarget();
    if (!target.active) {
      group.visible = false;
      return;
    }

    const age = performance.now() - target.stamp;
    const visible = target.dragging || age < FADE_MS;
    group.visible = visible;
    if (!visible) return;

    group.position.set(target.x, 0.03, target.z);

    const grow = reducedMotion ? 1 : Math.min(age / GROW_MS, 1);
    group.scale.setScalar(0.6 + grow * 0.4);

    material.opacity = target.dragging
      ? PEAK_OPACITY * 0.9
      : PEAK_OPACITY *
        (1 - Math.max(0, (age - GROW_MS) / (FADE_MS - GROW_MS)));
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        {/* Six segments so it reads as cut stone, like the rest of the world. */}
        <ringGeometry args={[0.4, 0.54, 6]} />
        <meshBasicMaterial
          ref={materialRef}
          color={COLORS.rune}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
