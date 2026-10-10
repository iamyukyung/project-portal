"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { RUNE_ORDER } from "@/lib/runes";
import { COLORS, WORLD } from "@/lib/worldLayout";
import { countRunes, useGameStore } from "@/store/gameStore";

const HALF_PI = Math.PI / 2;

const DORMANT = new THREE.Color(COLORS.portalDormant);
const ACTIVE = new THREE.Color(COLORS.portalActive);
const NO_GLOW = new THREE.Color("#000000");
const GLOW = new THREE.Color(COLORS.portalGlow);

/** Motes orbiting the ring once it is more than half charged. */
const MOTE_COUNT = 18;
/** Charge fraction below which the inner glyph and motes stay hidden. */
const AWAKE_AT = 0.56;

const dummy = new THREE.Object3D();

/**
 * The Portal reads its own state from the rune flags. Four steps:
 *
 *   0/3  cold stone, no emission
 *   1/3  the faintest tint of energy
 *   2/3  inner glyph lit, motes start orbiting
 *   3/3  fully open
 *
 * Charge is damped rather than stepped, so collecting a rune ramps the ring up
 * instead of snapping it.
 */
export function Portal({ reducedMotion }: { reducedMotion: boolean }) {
  const runes = useGameStore((state) => state.runes);
  const phase = useGameStore((state) => state.phase);

  const ringRef = useRef<THREE.MeshLambertMaterial>(null);
  const glyphRef = useRef<THREE.Mesh>(null);
  const glyphMaterialRef = useRef<THREE.MeshLambertMaterial>(null);
  const motesRef = useRef<THREE.InstancedMesh>(null);
  const motesMaterialRef = useRef<THREE.MeshBasicMaterial>(null);

  const charge = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const target = countRunes(runes) / RUNE_ORDER.length;

    charge.current = reducedMotion
      ? target
      : THREE.MathUtils.damp(charge.current, target, 2.4, dt);
    const c = charge.current;

    // One extra push while the activation sequence is on screen.
    const surge = phase === "PORTAL_OPEN" ? 1.35 : 1;
    const elapsed = state.clock.elapsedTime;

    const ring = ringRef.current;
    if (ring) {
      ring.color.lerpColors(DORMANT, ACTIVE, c);
      ring.emissive.lerpColors(NO_GLOW, GLOW, c);
      ring.emissiveIntensity = c * c * 1.05 * surge;
    }

    const awake = c > AWAKE_AT;
    const glyph = glyphRef.current;
    if (glyph) {
      glyph.visible = awake;
      if (awake) {
        // Ramp in over the top of the threshold so it never pops on.
        const lit = (c - AWAKE_AT) / (1 - AWAKE_AT);
        glyph.scale.setScalar(0.75 + lit * 0.25);
        glyph.rotation.z = reducedMotion ? 0 : elapsed * 0.35;
        const material = glyphMaterialRef.current;
        if (material) {
          material.emissiveIntensity = lit * 1.2 * surge;
          material.opacity = 0.35 + lit * 0.65;
        }
      }
    }

    const motes = motesRef.current;
    if (motes) {
      motes.visible = awake;
      if (awake) {
        const lit = (c - AWAKE_AT) / (1 - AWAKE_AT);
        const spin = reducedMotion ? 0 : elapsed * 0.55;
        for (let i = 0; i < MOTE_COUNT; i++) {
          const angle = spin + (i / MOTE_COUNT) * Math.PI * 2;
          // Motes ride the circumference of the ring, so the energy reads as
          // belonging to the gate rather than floating nearby.
          const radius = 2 + Math.sin(elapsed * 1.4 + i) * 0.12;
          dummy.position.set(
            Math.cos(angle) * radius,
            2.45 + Math.sin(angle) * radius,
            Math.sin(elapsed * 0.9 + i * 1.7) * 0.14,
          );
          dummy.scale.setScalar(0.075 * lit * surge);
          dummy.rotation.set(angle, angle * 1.3, 0);
          dummy.updateMatrix();
          motes.setMatrixAt(i, dummy.matrix);
        }
        motes.instanceMatrix.needsUpdate = true;
        const material = motesMaterialRef.current;
        if (material) material.opacity = 0.55 + lit * 0.45;
      }
    }
  });

  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-HALF_PI, 0, 0]}>
        <circleGeometry args={[WORLD.plazaRadius, 40]} />
        <meshLambertMaterial color={COLORS.plaza} />
      </mesh>

      {/* The gate itself. */}
      <mesh position={[0, 2.45, 0]}>
        <torusGeometry args={[2, 0.22, 8, 28]} />
        <meshLambertMaterial ref={ringRef} flatShading />
      </mesh>

      {/* Inner glyph — a second, hexagonal ring that lights at 2/3. */}
      <mesh ref={glyphRef} position={[0, 2.45, 0]} visible={false}>
        <ringGeometry args={[1.05, 1.35, 6]} />
        <meshLambertMaterial
          ref={glyphMaterialRef}
          color={COLORS.portalActive}
          emissive={COLORS.portalGlow}
          emissiveIntensity={0}
          side={THREE.DoubleSide}
          transparent
          opacity={0}
          depthWrite={false}
          flatShading
        />
      </mesh>

      <instancedMesh
        ref={motesRef}
        args={[undefined, undefined, MOTE_COUNT]}
        visible={false}
        frustumCulled={false}
      >
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          ref={motesMaterialRef}
          color={COLORS.portalActive}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </instancedMesh>

      {[-2.9, 2.9].map((x) => (
        <mesh key={x} position={[x, 1.15, 0]}>
          <cylinderGeometry args={[0.32, 0.42, 2.3, 6]} />
          <meshLambertMaterial color={COLORS.stone} flatShading />
        </mesh>
      ))}
    </group>
  );
}
