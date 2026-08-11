"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { CameraSettings } from "@/hooks/useResponsiveGameSettings";
import { useGameStore } from "@/store/gameStore";
import { CAMERA_DIR, SCREEN_FORWARD } from "@/lib/worldLayout";

/**
 * The intro sits further out and higher up to establish the world, then the
 * camera travels in to the play framing when the player starts.
 */
const INTRO_DISTANCE_SCALE = 1.55;
const INTRO_HEIGHT_SCALE = 1.7;
/** How fast the intro -> play framing blend runs. */
const INTRO_BLEND_RATE = 2.2;

const desiredPosition = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();

type FollowCameraProps = {
  targetRef: RefObject<THREE.Vector3>;
  settings: CameraSettings;
  reducedMotion: boolean;
};

/**
 * Fixed isometric follow camera. The user cannot rotate it, so the mapping
 * between input and world direction stays constant everywhere in the world.
 */
export function FollowCamera({
  targetRef,
  settings,
  reducedMotion,
}: FollowCameraProps) {
  const phase = useGameStore((state) => state.phase);

  const position = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const blend = useRef(0);
  const initialized = useRef(false);

  useFrame((state, delta) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const target = targetRef.current;
    const dt = Math.min(delta, 1 / 30);
    const playing = phase === "PLAYING";

    // Re-applied here rather than in an effect so a tier change (rotating the
    // device, resizing the window) lands on the very next frame.
    if (camera.fov !== settings.fov || camera.far !== 220) {
      camera.fov = settings.fov;
      camera.near = 0.5;
      camera.far = 220;
      camera.updateProjectionMatrix();
    }

    if (reducedMotion) {
      blend.current = playing ? 1 : 0;
    } else {
      blend.current = THREE.MathUtils.damp(
        blend.current,
        playing ? 1 : 0,
        INTRO_BLEND_RATE,
        dt,
      );
    }

    // Smoothstep keeps the intro move from starting and stopping abruptly.
    const t = blend.current * blend.current * (3 - 2 * blend.current);
    const distance = THREE.MathUtils.lerp(
      settings.distance * INTRO_DISTANCE_SCALE,
      settings.distance,
      t,
    );
    const height = THREE.MathUtils.lerp(
      settings.height * INTRO_HEIGHT_SCALE,
      settings.height,
      t,
    );
    // The intro keeps the player centred; play framing pushes the aim point
    // past them so they sit low in frame with the road ahead visible.
    const lookAhead = THREE.MathUtils.lerp(0, settings.lookAhead, t);

    desiredPosition.set(
      target.x + CAMERA_DIR.x * distance,
      target.y + height,
      target.z + CAMERA_DIR.z * distance,
    );
    desiredLookAt.set(
      target.x + SCREEN_FORWARD.x * lookAhead,
      target.y,
      target.z + SCREEN_FORWARD.z * lookAhead,
    );

    if (!initialized.current) {
      position.current.copy(desiredPosition);
      lookAt.current.copy(desiredLookAt);
      initialized.current = true;
    } else if (reducedMotion) {
      position.current.copy(desiredPosition);
      lookAt.current.copy(desiredLookAt);
    } else {
      // Damping both the eye and the aim point is what keeps the horizon from
      // wobbling when the player changes direction.
      const rate = playing ? settings.followRate : INTRO_BLEND_RATE;
      const step = 1 - Math.exp(-rate * dt);
      position.current.lerp(desiredPosition, step);
      lookAt.current.lerp(desiredLookAt, step);
    }

    camera.position.copy(position.current);
    camera.lookAt(lookAt.current);
  });

  return null;
}
