"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import * as THREE from "three";

import type { Placement } from "@/lib/worldLayout";

const dummy = new THREE.Object3D();
const tint = new THREE.Color();

type ScatterProps = {
  items: readonly Placement[];
  /** Per-instance tint, picked with the placement's `variant`. */
  palette: readonly string[];
  /**
   * Y of the geometry's centre in un-scaled units. Multiplied by each
   * instance's scale so a tree's canopy stays on top of its own trunk.
   */
  yOffset?: number;
  /** Geometry + material nodes. */
  children: ReactNode;
};

/**
 * Draws every placement of one kind of prop in a single InstancedMesh, which
 * keeps the ~350 pieces of scenery down to a handful of draw calls.
 */
export function Scatter({
  items,
  palette,
  yOffset = 0,
  children,
}: ScatterProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    items.forEach((item, index) => {
      dummy.position.set(item.x, yOffset * item.scale, item.z);
      dummy.rotation.set(item.tiltX, item.rotation, item.tiltZ);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, tint.set(palette[item.variant % palette.length]));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [items, palette, yOffset]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, items.length]}
      // The set spans the whole world, so per-instance culling would never pay
      // for itself and a stale bounding sphere could drop the whole batch.
      frustumCulled={false}
    >
      {children}
    </instancedMesh>
  );
}
