"use client";

import { useMemo } from "react";
import { CuboidCollider, CylinderCollider, RigidBody } from "@react-three/rapier";

import { Scatter } from "./Scatter";
import {
  ALL_TREES,
  BIG_ROCKS,
  BOUNDARY_SEGMENTS,
  COLORS,
  FIGURE_HEADS,
  FIGURE_HEAD_HEIGHT,
  GRASS,
  INTERIOR_TREES,
  LANDMARKS,
  LANDMARK_PILLARS,
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
 * The stone the Runes sit on. The crystals themselves live in Runes, which
 * owns their state; these plinths are static scenery and carry the colliders.
 */
function RunePlinths() {
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
        </group>
      ))}
    </>
  );
}

/** Static scenery and every collider in the diorama. */
export function World() {
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

      <RunePlinths />

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

      {/*
        Landmark composition — ruined columns, standing figures and posts, all
        in one instanced batch each so the three sites cost two draw calls.
      */}
      <Scatter items={LANDMARK_PILLARS} palette={COLORS.rock} yOffset={0.5}>
        <cylinderGeometry args={[0.15, 0.19, 1, 6]} />
        <meshLambertMaterial flatShading />
      </Scatter>
      <Scatter
        items={FIGURE_HEADS}
        palette={COLORS.rock}
        yOffset={FIGURE_HEAD_HEIGHT}
      >
        <icosahedronGeometry args={[0.16, 0]} />
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
