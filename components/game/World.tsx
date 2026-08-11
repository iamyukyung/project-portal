"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

import { Scatter } from "./Scatter";
import {
  ALL_TREES,
  BIG_ROCKS,
  BOUNDARY_SEGMENTS,
  COLORS,
  GRASS,
  INTERIOR_TREES,
  LANDMARKS,
  LANDMARK_STONES,
  MOUNTAINS,
  SMALL_ROCKS,
  WORLD,
} from "@/lib/worldLayout";

const HALF_PI = Math.PI / 2;

/** Invisible wall ring so the player cannot leave the diorama. */
function useBoundarySegments() {
  return useMemo(() => {
    const radius = WORLD.walkRadius + 0.3;
    // Slight overlap between neighbours avoids seams the capsule could snag on.
    const halfWidth = radius * Math.tan(Math.PI / BOUNDARY_SEGMENTS) + 0.4;

    return Array.from({ length: BOUNDARY_SEGMENTS }, (_, i) => {
      const angle = (i / BOUNDARY_SEGMENTS) * Math.PI * 2;
      return {
        position: [
          Math.cos(angle) * radius,
          2,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        rotationY: -(angle + HALF_PI),
        halfWidth,
      };
    });
  }, []);
}

/**
 * The Portal itself arrives in a later sprint. For now the plaza stays empty
 * and only a dim ring marks where it will stand, so the centre of the world
 * still reads as the destination.
 */
function PortalPlaceholder() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-HALF_PI, 0, 0]}>
        <circleGeometry args={[WORLD.plazaRadius, 40]} />
        <meshLambertMaterial color={COLORS.plaza} />
      </mesh>

      <mesh position={[0, 2.45, 0]}>
        <torusGeometry args={[2, 0.22, 8, 28]} />
        <meshLambertMaterial
          color={COLORS.portal}
          emissive={COLORS.portalEmissive}
          emissiveIntensity={0.6}
          flatShading
        />
      </mesh>

      {[-2.9, 2.9].map((x) => (
        <mesh key={x} position={[x, 1.15, 0]}>
          <cylinderGeometry args={[0.32, 0.42, 2.3, 6]} />
          <meshLambertMaterial color={COLORS.stone} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Three plinths reserved for the Runes, placed around the plaza. */
function RuneLandmarks({ reducedMotion }: { reducedMotion: boolean }) {
  const runesRef = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    runesRef.current.forEach((rune, i) => {
      if (!rune) return;
      rune.position.y = 1.85 + Math.sin(t * 1.1 + i * 2.1) * 0.12;
      rune.rotation.y = t * 0.5 + i;
    });
  });

  return (
    <>
      {LANDMARKS.map((landmark, i) => (
        <group key={i} position={[landmark.x, 0, landmark.z]}>
          <mesh position={[0, 0.02, 0]} rotation={[-HALF_PI, 0, 0]}>
            <circleGeometry args={[2.6, 24]} />
            <meshLambertMaterial color={COLORS.plaza} />
          </mesh>

          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.5, 0.62, 1, 6]} />
            <meshLambertMaterial color={COLORS.stone} flatShading />
          </mesh>

          <mesh
            ref={(mesh) => {
              runesRef.current[i] = mesh;
            }}
            position={[0, 1.85, 0]}
          >
            <octahedronGeometry args={[0.42, 0]} />
            <meshLambertMaterial
              color={COLORS.rune}
              emissive={COLORS.runeEmissive}
              emissiveIntensity={0.7}
              flatShading
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

export function World({ reducedMotion }: { reducedMotion: boolean }) {
  const boundary = useBoundarySegments();

  return (
    <>
      {/* Ground */}
      <mesh rotation={[-HALF_PI, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[WORLD.groundRadius, 64]} />
        <meshLambertMaterial color={COLORS.ground} />
      </mesh>
      <mesh rotation={[-HALF_PI, 0, 0]} position={[0, -0.08, 0]}>
        <circleGeometry args={[WORLD.farGroundRadius, 64]} />
        <meshLambertMaterial color={COLORS.farGround} />
      </mesh>

      <PortalPlaceholder />
      <RuneLandmarks reducedMotion={reducedMotion} />

      {/* Scenery — one instanced draw call per row. */}
      <Scatter items={ALL_TREES} palette={COLORS.trunk} yOffset={0.8}>
        <cylinderGeometry args={[0.16, 0.24, 1.6, 6]} />
        <meshLambertMaterial flatShading />
      </Scatter>
      <Scatter items={ALL_TREES} palette={COLORS.canopy} yOffset={2.05}>
        <coneGeometry args={[1.05, 1.5, 7]} />
        <meshLambertMaterial flatShading />
      </Scatter>
      <Scatter items={ALL_TREES} palette={COLORS.canopy} yOffset={3}>
        <coneGeometry args={[0.7, 1.3, 7]} />
        <meshLambertMaterial flatShading />
      </Scatter>

      <Scatter items={BIG_ROCKS} palette={COLORS.rock} yOffset={0.45}>
        <dodecahedronGeometry args={[0.9, 0]} />
        <meshLambertMaterial flatShading />
      </Scatter>
      <Scatter items={SMALL_ROCKS} palette={COLORS.rock} yOffset={0.22}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshLambertMaterial flatShading />
      </Scatter>
      <Scatter items={LANDMARK_STONES} palette={COLORS.rock} yOffset={0.28}>
        <dodecahedronGeometry args={[0.6, 0]} />
        <meshLambertMaterial flatShading />
      </Scatter>

      <Scatter items={GRASS} palette={COLORS.grass} yOffset={0.3}>
        <coneGeometry args={[0.13, 0.6, 4]} />
        <meshLambertMaterial flatShading />
      </Scatter>
      <Scatter items={MOUNTAINS} palette={COLORS.mountain} yOffset={0.8}>
        <coneGeometry args={[1, 1.7, 5]} />
        <meshLambertMaterial flatShading />
      </Scatter>

      {/*
        Every static collider lives on one fixed body: the ground slab, the
        boundary ring, the interior trees and the boulders. Small rocks, grass
        and the outer forest are decoration only.
      */}
      <RigidBody type="fixed" colliders={false} friction={0.2}>
        <CuboidCollider args={[40, 1, 40]} position={[0, -1, 0]} />

        {boundary.map((segment, i) => (
          <CuboidCollider
            key={`wall-${i}`}
            args={[segment.halfWidth, 2, 0.5]}
            position={segment.position}
            rotation={[0, segment.rotationY, 0]}
          />
        ))}

        {INTERIOR_TREES.map((tree, i) => (
          <CylinderCollider
            key={`tree-${i}`}
            args={[1.6 * tree.scale, 0.42 * tree.scale]}
            position={[tree.x, 1.6 * tree.scale, tree.z]}
          />
        ))}

        {BIG_ROCKS.map((rock, i) => (
          <CylinderCollider
            key={`rock-${i}`}
            args={[0.6 * rock.scale, 0.82 * rock.scale]}
            position={[rock.x, 0.6 * rock.scale, rock.z]}
          />
        ))}

        {[-2.9, 2.9].map((x) => (
          <CylinderCollider
            key={`portal-pillar-${x}`}
            args={[1.15, 0.42]}
            position={[x, 1.15, 0]}
          />
        ))}

        {LANDMARKS.map((landmark, i) => (
          <CylinderCollider
            key={`plinth-${i}`}
            args={[0.5, 0.62]}
            position={[landmark.x, 0.5, landmark.z]}
          />
        ))}
      </RigidBody>
    </>
  );
}
