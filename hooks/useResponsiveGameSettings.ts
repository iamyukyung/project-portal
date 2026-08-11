"use client";

import { useSyncExternalStore } from "react";

import { MOVEMENT, type MovementTuning } from "@/lib/worldLayout";

export type CameraSettings = {
  /** Vertical field of view, degrees. */
  fov: number;
  /** Horizontal distance from the player to the camera. */
  distance: number;
  /** Height of the camera above the player. */
  height: number;
  /**
   * How far past the player the camera aims. Pushing the aim point away from
   * the camera drops the player lower in frame and opens up the space ahead.
   */
  lookAhead: number;
  /** How quickly the camera converges on the player. Higher = tighter. */
  followRate: number;
};

export type ViewportTier =
  | "mobilePortrait"
  | "mobileLandscape"
  | "tablet"
  | "desktop";

export type GameSettings = {
  tier: ViewportTier;
  camera: CameraSettings;
  /**
   * Movement feel. Keyed off the input device rather than the viewport tier: a
   * narrow desktop window resolves to the `tablet` camera but still deserves
   * the keyboard-and-mouse pace.
   */
  movement: MovementTuning;
  /** Upper bound for devicePixelRatio — never trust the device's own value. */
  dprMax: number;
  isTouch: boolean;
  isPortrait: boolean;
};

/**
 * Every tier shares a 38-degree camera elevation so the isometric silhouette
 * stays consistent; only the distance and the aim point change. The numbers
 * were solved against the projection rather than eyeballed — the trailing
 * comments are the resulting on-screen character height and its vertical
 * placement, measured from the top of the viewport:
 *
 *   phones sit inside the 10-15% band the brief asks for and place the
 *   character low so the road ahead is visible; desktop pulls back so the
 *   character reads small against a much wider slice of the world.
 */
const CAMERA_BY_TIER: Record<ViewportTier, CameraSettings> = {
  // 10.5% tall, 62% down
  mobilePortrait: {
    fov: 42,
    distance: 10.8,
    height: 8.43,
    lookAhead: 2.37,
    followRate: 6.5,
  },
  // 10.5% tall, 56% down — less headroom in landscape, so less offset
  mobileLandscape: {
    fov: 48,
    distance: 9.31,
    height: 7.27,
    lookAhead: 1.14,
    followRate: 6.5,
  },
  // 8.5% tall, 60% down
  tablet: {
    fov: 40,
    distance: 14.06,
    height: 10.98,
    lookAhead: 2.35,
    followRate: 5.5,
  },
  // 7% tall, 57% down
  desktop: {
    fov: 36,
    distance: 19.12,
    height: 14.94,
    lookAhead: 1.92,
    followRate: 5,
  },
};

function resolveTier(
  width: number,
  height: number,
  isTouch: boolean,
): ViewportTier {
  const isPortrait = height >= width;
  const shortSide = Math.min(width, height);

  if (!isTouch && width >= 1024) return "desktop";
  if (isPortrait && shortSide < 600) return "mobilePortrait";
  if (!isPortrait && height < 600) return "mobileLandscape";
  if (shortSide < 1024) return "tablet";
  return "desktop";
}

function measure(): GameSettings {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouch =
    window.matchMedia("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0;
  const tier = resolveTier(width, height, isTouch);

  return {
    tier,
    camera: CAMERA_BY_TIER[tier],
    movement: isTouch ? MOVEMENT.touch : MOVEMENT.desktop,
    // Phones gain far more from a lower ceiling here than from the extra
    // sharpness, so cap them harder than desktop.
    dprMax: isTouch ? 1.6 : 2,
    isTouch,
    isPortrait: height >= width,
  };
}

function isSameSettings(a: GameSettings, b: GameSettings) {
  return (
    a.tier === b.tier &&
    a.dprMax === b.dprMax &&
    a.isTouch === b.isTouch &&
    a.isPortrait === b.isPortrait
  );
}

/**
 * Cached so `getSnapshot` keeps returning the same object while the viewport
 * category is unchanged — a fresh object every call would loop React.
 */
let cachedSettings: GameSettings | null = null;

function getSettingsSnapshot(): GameSettings {
  const next = measure();
  if (cachedSettings && isSameSettings(cachedSettings, next)) {
    return cachedSettings;
  }
  cachedSettings = next;
  return next;
}

/** No viewport on the server, so the canvas simply waits a render. */
function getSettingsServerSnapshot(): GameSettings | null {
  return null;
}

function subscribeViewport(onChange: () => void) {
  let frame = 0;
  const handle = () => {
    cancelAnimationFrame(frame);
    // iOS reports stale dimensions for a frame or two after a rotation.
    frame = requestAnimationFrame(onChange);
  };

  window.addEventListener("resize", handle);
  window.addEventListener("orientationchange", handle);

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("resize", handle);
    window.removeEventListener("orientationchange", handle);
  };
}

/**
 * Viewport-driven camera framing. Returns `null` for the server and hydration
 * render so the canvas never mounts with a desktop framing on a phone.
 */
export function useResponsiveGameSettings(): GameSettings | null {
  return useSyncExternalStore(
    subscribeViewport,
    getSettingsSnapshot,
    getSettingsServerSnapshot,
  );
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}
