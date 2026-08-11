"use client";

import { useEffect } from "react";

import { SCREEN_FORWARD, SCREEN_RIGHT, WORLD } from "@/lib/worldLayout";

/**
 * Three input sources feed one movement vector:
 *
 *   keyboard — WASD / arrows, screen-space
 *   joystick — the mobile floating stick, screen-space
 *   pointer  — a click-to-move destination on the ground, world-space
 *
 * They are resolved by priority rather than by a state machine: whichever
 * source is actively producing input this frame wins, and taking the keyboard
 * or joystick cancels any pointer destination outright.
 *
 * All of this lives outside React on purpose — the value is read once per
 * animation frame, and routing it through state would re-render the tree 60
 * times a second.
 */
export type InputSource = "keyboard" | "joystick" | "pointer";

/** World-space direction for this frame. Length equals `magnitude` (0..1). */
export type MoveVector = { x: number; z: number; magnitude: number };

/** Destination reached — close enough to stop. */
const ARRIVE_RADIUS = 0.28;
/** Movement eases off inside this radius so arrivals are not abrupt. */
const SLOW_RADIUS = 1.1;
/**
 * A pointer destination that fails to move the player this far within
 * STALL_TIMEOUT seconds is abandoned, so a blocked character never stands
 * there shoving a tree. There is no pathfinding in this sprint by design.
 */
const STALL_PROGRESS = 0.05;
const STALL_TIMEOUT = 0.6;

const KEYS_FORWARD = new Set(["KeyW", "ArrowUp"]);
const KEYS_BACK = new Set(["KeyS", "ArrowDown"]);
const KEYS_LEFT = new Set(["KeyA", "ArrowLeft"]);
const KEYS_RIGHT = new Set(["KeyD", "ArrowRight"]);

const ARROW_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const pressed = new Set<string>();
const joystick = { x: 0, y: 0 };

const pointerTarget = {
  x: 0,
  z: 0,
  active: false,
  /** When the destination was last freshly pressed — drives the marker. */
  stamp: 0,
  /** True while the mouse button is held, so the marker stays up. */
  dragging: false,
};

/** Progress tracking for the stall guard. */
let lastPlayerX = 0;
let lastPlayerZ = 0;
let stalledFor = 0;

const result: MoveVector = { x: 0, z: 0, magnitude: 0 };

function zero(): MoveVector {
  result.x = 0;
  result.z = 0;
  result.magnitude = 0;
  return result;
}

/** Rotates a screen-space stick vector onto the fixed camera's ground axes. */
function screenToWorld(sx: number, sy: number): MoveVector {
  let x = sx * SCREEN_RIGHT.x + sy * SCREEN_FORWARD.x;
  let z = sx * SCREEN_RIGHT.z + sy * SCREEN_FORWARD.z;
  let magnitude = Math.hypot(x, z);
  // Diagonals must not be faster than the cardinals.
  if (magnitude > 1) {
    x /= magnitude;
    z /= magnitude;
    magnitude = 1;
  }
  result.x = x;
  result.z = z;
  result.magnitude = magnitude;
  return result;
}

/* -------------------------------------------------------------------------- */
/* First-interaction signal — the controls hint listens to this.               */
/* -------------------------------------------------------------------------- */

let interacted = false;
const interactionListeners = new Set<() => void>();

function markInteracted() {
  if (interacted) return;
  interacted = true;
  for (const listener of interactionListeners) listener();
}

export function subscribeInteraction(listener: () => void) {
  interactionListeners.add(listener);
  return () => {
    interactionListeners.delete(listener);
  };
}

export function hasInteracted() {
  return interacted;
}

/* -------------------------------------------------------------------------- */
/* Joystick                                                                    */
/* -------------------------------------------------------------------------- */

/** Called by the floating joystick on every pointer move. */
export function setJoystickInput(x: number, y: number) {
  joystick.x = x;
  joystick.y = y;
  if (Math.hypot(x, y) > 0.001) markInteracted();
}

export function clearJoystickInput() {
  joystick.x = 0;
  joystick.y = 0;
}

/* -------------------------------------------------------------------------- */
/* Pointer destination                                                         */
/* -------------------------------------------------------------------------- */

/**
 * @param fresh true for a new press, false while dragging — a drag moves the
 * destination without restarting the marker animation.
 */
export function setPointerTarget(x: number, z: number, fresh: boolean) {
  // Clicks can land outside the walls; aiming at the boundary keeps the
  // character walking in the intended direction instead of into a corner.
  const limit = WORLD.walkRadius - 0.8;
  const radius = Math.hypot(x, z);
  if (radius > limit) {
    x = (x / radius) * limit;
    z = (z / radius) * limit;
  }

  pointerTarget.x = x;
  pointerTarget.z = z;
  if (fresh || !pointerTarget.active) {
    pointerTarget.stamp = performance.now();
    stalledFor = 0;
  }
  pointerTarget.active = true;
  markInteracted();
}

export function clearPointerTarget() {
  pointerTarget.active = false;
  pointerTarget.dragging = false;
  stalledFor = 0;
}

export function setPointerDragging(dragging: boolean) {
  pointerTarget.dragging = dragging;
}

/** Read-only view for the destination marker. Do not hold across frames. */
export function getPointerTarget() {
  return pointerTarget;
}

/* -------------------------------------------------------------------------- */

/**
 * Resolves every source into one world-space direction for this frame.
 *
 * `dt` is only used by the stall guard; the player's own position is what tells
 * us whether a pointer destination is actually making progress, which stays
 * correct even while the destination is being dragged around.
 */
export function readMoveVector(
  playerX: number,
  playerZ: number,
  dt: number,
): MoveVector {
  let keyX = 0;
  let keyY = 0;
  for (const code of pressed) {
    if (KEYS_LEFT.has(code)) keyX -= 1;
    else if (KEYS_RIGHT.has(code)) keyX += 1;
    else if (KEYS_FORWARD.has(code)) keyY += 1;
    else if (KEYS_BACK.has(code)) keyY -= 1;
  }

  if (keyX !== 0 || keyY !== 0) {
    // Taking the keyboard drops any click destination immediately.
    if (pointerTarget.active) clearPointerTarget();
    return screenToWorld(keyX, keyY);
  }

  if (Math.hypot(joystick.x, joystick.y) > 0.001) {
    if (pointerTarget.active) clearPointerTarget();
    return screenToWorld(joystick.x, joystick.y);
  }

  if (!pointerTarget.active) return zero();

  const dx = pointerTarget.x - playerX;
  const dz = pointerTarget.z - playerZ;
  const distance = Math.hypot(dx, dz);

  if (distance <= ARRIVE_RADIUS) {
    clearPointerTarget();
    return zero();
  }

  // Stall guard: measured against how far the player actually travelled, so a
  // collider that blocks the route cancels the destination rather than leaving
  // the character grinding against it.
  if (Math.hypot(playerX - lastPlayerX, playerZ - lastPlayerZ) > STALL_PROGRESS) {
    lastPlayerX = playerX;
    lastPlayerZ = playerZ;
    stalledFor = 0;
  } else {
    stalledFor += dt;
    if (stalledFor >= STALL_TIMEOUT) {
      clearPointerTarget();
      return zero();
    }
  }

  // Ease off on approach so the character settles instead of snapping to a halt.
  const magnitude = Math.min(distance / SLOW_RADIUS, 1);
  result.x = (dx / distance) * magnitude;
  result.z = (dz / distance) * magnitude;
  result.magnitude = magnitude;
  return result;
}

export function clearKeyboardInput() {
  pressed.clear();
}

/**
 * Binds WASD / arrow keys while `enabled`. The joystick and the click-to-move
 * ground feed their own entry points, so touch, mouse and keyboard coexist on
 * hybrid devices.
 */
export function usePlayerInput(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      clearKeyboardInput();
      return;
    }

    const isMoveKey = (code: string) =>
      KEYS_FORWARD.has(code) ||
      KEYS_BACK.has(code) ||
      KEYS_LEFT.has(code) ||
      KEYS_RIGHT.has(code);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!isMoveKey(event.code)) return;
      // Scoped to the movement keys only: arrows would otherwise scroll
      // whatever element happens to hold focus.
      if (ARROW_KEYS.has(event.code)) event.preventDefault();
      pressed.add(event.code);
      clearPointerTarget();
      markInteracted();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      pressed.delete(event.code);
    };

    // Losing focus mid-press would otherwise leave the player walking forever.
    const onBlur = () => clearKeyboardInput();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      clearKeyboardInput();
    };
  }, [enabled]);
}
