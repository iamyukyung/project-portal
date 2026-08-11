"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";

import { readMoveVector } from "@/hooks/usePlayerInput";
import { useGameStore } from "@/store/gameStore";
import {
  COLORS,
  PLAYER,
  SPAWN,
  type MovementTuning,
} from "@/lib/worldLayout";

/** Distance from the capsule's centre to its feet. */
const FOOT_OFFSET = PLAYER.halfHeight + PLAYER.radius;
/** Below this the character keeps its previous facing instead of snapping. */
const TURN_DEADZONE = 0.08;
/** Stand-in while controls are still locked during the intro camera travel. */
const ZERO_MOVE = { x: 0, z: 0, magnitude: 0 } as const;

/** Interpolates an angle along the shorter arc, framerate independently. */
function dampAngle(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  const delta = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + delta * (1 - Math.exp(-lambda * dt));
}

/** Low-poly explorer. Faces local +Z, feet on the group's origin. */
function PlayerModel() {
  return (
    <>
      <mesh position={[0, 0.21, 0]}>
        <cylinderGeometry args={[0.19, 0.24, 0.42, 6]} />
        <meshLambertMaterial color={COLORS.player.boots} flatShading />
      </mesh>

      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.22, 0.34, 0.62, 8]} />
        <meshLambertMaterial color={COLORS.player.cloak} flatShading />
      </mesh>

      <mesh position={[0, 0.82, -0.26]}>
        <boxGeometry args={[0.3, 0.34, 0.18]} />
        <meshLambertMaterial color={COLORS.player.pack} flatShading />
      </mesh>

      {/* Scarf — a bright band that keeps the silhouette readable at distance. */}
      <mesh position={[0, 0.99, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.1, 8]} />
        <meshLambertMaterial color={COLORS.player.trim} flatShading />
      </mesh>

      <mesh position={[0, 1.16, 0]}>
        <icosahedronGeometry args={[0.24, 0]} />
        <meshLambertMaterial color={COLORS.player.skin} flatShading />
      </mesh>

      <mesh position={[0, 1.3, -0.02]}>
        <coneGeometry args={[0.3, 0.34, 7]} />
        <meshLambertMaterial color={COLORS.player.cloak} flatShading />
      </mesh>

      {/* Forward-pointing visor: the clearest read on which way you are facing. */}
      <mesh position={[0, 1.13, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.1, 0.24, 4]} />
        <meshLambertMaterial color={COLORS.player.trim} flatShading />
      </mesh>
    </>
  );
}

/** Fake contact shadow plus a soft ring — cheaper than a shadow map. */
function GroundDecals() {
  return (
    <>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 16]} />
        <meshBasicMaterial
          color="#24402c"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.56, 0.66, 22]} />
        <meshBasicMaterial
          color={COLORS.player.trim}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

type PlayerProps = {
  /** Written every frame so the camera can follow without re-rendering. */
  positionRef: RefObject<THREE.Vector3>;
  /** Device-specific feel — see MOVEMENT in lib/worldLayout. */
  movement: MovementTuning;
  reducedMotion: boolean;
};

export function Player({ positionRef, movement, reducedMotion }: PlayerProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  /** Ground velocity we drive the body with; x/y map to world x/z. */
  const velocity = useRef(new THREE.Vector2());
  const facing = useRef(Math.PI);
  const stride = useRef(0);

  const controlsEnabled = useGameStore((state) => state.controlsEnabled);

  useLayoutEffect(() => {
    // YXZ lets us layer a forward lean on top of the yaw without the two
    // rotations fighting each other.
    visualRef.current?.rotation.reorder("YXZ");
  }, []);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    const visual = visualRef.current;
    if (!body || !visual) return;

    // A tab that was backgrounded can hand us a huge delta; clamping keeps the
    // acceleration curve stable instead of teleporting the player.
    const dt = Math.min(delta, 1 / 30);

    // Read the position first: click-to-move resolves against it, and its own
    // progress is what the stall guard watches.
    const translation = body.translation();
    const move = controlsEnabled
      ? readMoveVector(translation.x, translation.z, dt)
      : ZERO_MOVE;
    const { x: dirX, z: dirZ, magnitude } = move;

    // Ease into and out of motion, but stay responsive: deceleration is
    // deliberately faster than acceleration so stopping never feels floaty.
    const lambda = magnitude > 0.01 ? movement.accel : movement.decel;
    const blend = 1 - Math.exp(-lambda * dt);
    velocity.current.x +=
      (dirX * movement.maxSpeed - velocity.current.x) * blend;
    velocity.current.y +=
      (dirZ * movement.maxSpeed - velocity.current.y) * blend;

    // Keep gravity's contribution; we only own the horizontal plane.
    const current = body.linvel();
    body.setLinvel(
      { x: velocity.current.x, y: current.y, z: velocity.current.y },
      true,
    );

    if (magnitude > TURN_DEADZONE) {
      facing.current = dampAngle(
        facing.current,
        Math.atan2(dirX, dirZ),
        movement.turnRate,
        dt,
      );
    }
    visual.rotation.y = facing.current;

    const speed = velocity.current.length();
    const speedRatio = Math.min(speed / movement.maxSpeed, 1);

    if (reducedMotion) {
      visual.position.y = -FOOT_OFFSET;
      visual.rotation.x = 0;
    } else {
      stride.current += dt * speedRatio * 11;
      visual.position.y =
        -FOOT_OFFSET + Math.abs(Math.sin(stride.current)) * 0.055 * speedRatio;
      visual.rotation.x = THREE.MathUtils.damp(
        visual.rotation.x,
        speedRatio * 0.09,
        8,
        dt,
      );
    }

    positionRef.current.set(translation.x, translation.y, translation.z);
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={[SPAWN.x, PLAYER.centerY, SPAWN.z]}
      // The capsule must never topple or spin: game feel over realism.
      enabledRotations={[false, false, false]}
      linearDamping={0}
      mass={1}
      ccd
    >
      <CapsuleCollider
        args={[PLAYER.halfHeight, PLAYER.radius]}
        // Near-frictionless so brushing a tree slides instead of sticking.
        friction={0.02}
        restitution={0}
      />
      <group ref={visualRef} position={[0, -FOOT_OFFSET, 0]}>
        <GroundDecals />
        <PlayerModel />
      </group>
    </RigidBody>
  );
}
