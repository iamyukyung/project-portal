"use client";

import { COLORS } from "@/lib/worldLayout";

/**
 * Sky, fog and lighting. Deliberately simple: no shadow maps and no
 * post-processing, so the scene stays cheap on phones. Depth comes from the
 * exponential fog and from the value split between ground, canopy and horizon.
 */
export function SceneEnvironment() {
  return (
    <>
      <color attach="background" args={[COLORS.sky]} />
      {/*
        Light enough to keep local colour intact at the play camera's ~28u
        distance, while still burying the far horizon.
      */}
      <fogExp2 attach="fog" args={[COLORS.sky, 0.0075]} />

      {/* Fill is kept low so the key light still carves out the low-poly facets. */}
      <ambientLight intensity={0.5} color="#d8ecf4" />
      <hemisphereLight intensity={0.7} color="#cbeaf5" groundColor="#5e7a41" />
      <directionalLight
        intensity={1.9}
        color="#fff2d4"
        position={[12, 20, 8]}
      />
    </>
  );
}
