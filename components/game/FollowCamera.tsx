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

/** How fast the camera swings to the portal and back during activation. */
const FOCUS_BLEND_RATE = 2.4;
/** Pulled back a little, because the gate is much larger than the player. */
const FOCUS_DISTANCE_SCALE = 1.35;
/** Aimed at the middle of the ring rather than its base. */
const PORTAL_FOCUS = new THREE.Vector3(0, 1.9, 0);

const desiredPosition = new THREE.Vector3();
const desiredLookAt = new THREE.Vector3();
const focusTarget = new THREE.Vector3();

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
  const cameraFocus = useGameStore((state) => state.cameraFocus);

  const position = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const blend = useRef(0);
  const focus = useRef(0);
  const initialized = useRef(false);

  useFrame((state, delta) => {
    const camera = state.camera as THREE.PerspectiveCamera;
    const dt = Math.min(delta, 1 / 30);
    // Keyed off "has the intro finished", not "is the player in control" —
    // otherwise opening a rune panel would pull the camera back out to the
    // establishing shot.
    const started = phase !== "LOADING" && phase !== "INTRO";

    // Re-applied here rather than in an effect so a tier change (rotating the
    // device, resizing the window) lands on the very next frame.
    if (camera.fov !== settings.fov || camera.far !== 220) {
      camera.fov = settings.fov;
      camera.near = 0.5;
      camera.far = 220;
      camera.updateProjectionMatrix();
    }

    // Reduced motion keeps the framing but drops the travel: the intro snaps
    // and the activation sequence never moves the camera off the player.
    const focusGoal = cameraFocus === "portal" && !reducedMotion ? 1 : 0;
    if (reducedMotion) {
      blend.current = started ? 1 : 0;
      focus.current = focusGoal;
    } else {
      blend.current = THREE.MathUtils.damp(
        blend.current,
        started ? 1 : 0,
        INTRO_BLEND_RATE,
        dt,
      );
      focus.current = THREE.MathUtils.damp(
        focus.current,
        focusGoal,
        FOCUS_BLEND_RATE,
        dt,
      );
    }

    // Smoothstep keeps the intro move from starting and stopping abruptly.
    const t = blend.current * blend.current * (3 - 2 * blend.current);
    const f = focus.current * focus.current * (3 - 2 * focus.current);

    const distance =
      THREE.MathUtils.lerp(
        settings.distance * INTRO_DISTANCE_SCALE,
        settings.distance,
        t,
      ) * THREE.MathUtils.lerp(1, FOCUS_DISTANCE_SCALE, f);
    const height =
      THREE.MathUtils.lerp(
        settings.height * INTRO_HEIGHT_SCALE,
        settings.height,
        t,
      ) * THREE.MathUtils.lerp(1, FOCUS_DISTANCE_SCALE, f);
    // The intro keeps the player centred; play framing pushes the aim point
    // past them so they sit low in frame with the road ahead visible. Focusing
    // the portal aims straight at it instead.
    const lookAhead = THREE.MathUtils.lerp(0, settings.lookAhead, t) * (1 - f);

    // Slide the whole rig between the player and the gate.
    focusTarget.copy(targetRef.current).lerp(PORTAL_FOCUS, f);

    desiredPosition.set(
      focusTarget.x + CAMERA_DIR.x * distance,
      focusTarget.y + height,
      focusTarget.z + CAMERA_DIR.z * distance,
    );
    desiredLookAt.set(
      focusTarget.x + SCREEN_FORWARD.x * lookAhead,
      focusTarget.y,
      focusTarget.z + SCREEN_FORWARD.z * lookAhead,
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
      const rate = started ? settings.followRate : INTRO_BLEND_RATE;
      const step = 1 - Math.exp(-rate * dt);
      position.current.lerp(desiredPosition, step);
      lookAt.current.lerp(desiredLookAt, step);
    }

    camera.position.copy(position.current);
    camera.lookAt(lookAt.current);
  });

  return null;
}
