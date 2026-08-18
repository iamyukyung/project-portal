"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";

import {
  clearJoystickInput,
  clearPointerTarget,
  setJoystickInput,
  setPointerTarget,
} from "@/hooks/usePlayerInput";
import { pickGround } from "@/lib/groundPick";
import { useGameStore } from "@/store/gameStore";

/** Distance from the origin at which the stick reads full tilt. */
const MAX_RADIUS = 56;
/** Ignores the jitter of a resting thumb. */
const DEADZONE = 6;
/**
 * Movement past this many CSS pixels commits the gesture to the joystick.
 * Below it the touch is still a tap candidate — which is why nothing is drawn
 * yet, and why a tap never flashes a joystick.
 */
const DRAG_THRESHOLD = 11;
/** A motionless touch held longer than this reads as a rest, not a tap. */
const HOLD_LIMIT_MS = 800;

/** idle → candidate → drag. A gesture never goes back up this list. */
type GestureMode = "idle" | "candidate" | "drag";

/**
 * The whole touch gameplay surface: one finger, two gestures.
 *
 *   tap   — walk to that spot on the ground
 *   drag  — a floating joystick, anchored where the finger first landed
 *
 * Which one it is stays undecided until the finger either moves past the drag
 * threshold or lifts, so neither gesture has to guess at the other's expense.
 *
 * Every way a gesture can end funnels through one `endGesture`, and it is
 * reachable from four directions: the element's own pointerup/pointercancel,
 * a window-level net for events that never reach the element, the loss of
 * pointer capture, and the page going away. A stuck input here means the
 * character walks forever, so the cleanup is deliberately over-covered rather
 * than relying on any single event arriving.
 */
export function FloatingJoystick() {
  const phase = useGameStore((state) => state.phase);

  const layerRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  const activePointerId = useRef<number | null>(null);
  const mode = useRef<GestureMode>("idle");
  const origin = useRef({ x: 0, y: 0 });
  const startedAt = useRef(0);

  /**
   * The single teardown. Idempotent, so the belt-and-braces listeners below
   * can all call it without coordinating.
   */
  const endGesture = useCallback(() => {
    const pointerId = activePointerId.current;

    // Drop the movement input first. Everything after this line is tidying —
    // if any of it threw, the character would still come to a stop.
    clearJoystickInput();

    activePointerId.current = null;
    mode.current = "idle";

    const base = baseRef.current;
    if (base) base.style.opacity = "0";

    // Cleared before releasing, so the lostpointercapture this triggers sees
    // no active pointer and returns without recursing.
    const layer = layerRef.current;
    if (pointerId !== null && layer) {
      try {
        if (layer.hasPointerCapture(pointerId)) {
          layer.releasePointerCapture(pointerId);
        }
      } catch {
        // The pointer is already gone; nothing left to release.
      }
    }
  }, []);

  useEffect(() => {
    // A pointerup that lands on the HUD, the minimap, or anywhere else that
    // takes its own pointer events never reaches this layer. Without capture
    // — which can fail — that would leave the stick held down forever.
    const onWindowPointerEnd = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== activePointerId.current) return;
      endGesture();
    };
    // Capture can be revoked without a pointerup ever arriving.
    const onLostCapture = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== activePointerId.current) return;
      endGesture();
    };
    // Backgrounding the tab or the app switcher can swallow the pointerup.
    const onBlur = () => endGesture();
    const onVisibilityChange = () => {
      if (document.hidden) endGesture();
    };

    window.addEventListener("pointerup", onWindowPointerEnd);
    window.addEventListener("pointercancel", onWindowPointerEnd);
    window.addEventListener("lostpointercapture", onLostCapture);
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pointerup", onWindowPointerEnd);
      window.removeEventListener("pointercancel", onWindowPointerEnd);
      window.removeEventListener("lostpointercapture", onLostCapture);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // Unmounting mid-drag — a rune panel opening, for instance.
      endGesture();
    };
  }, [endGesture]);

  const applyStick = (dx: number, dy: number) => {
    const distance = Math.hypot(dx, dy);
    const nx = distance > 0 ? dx / distance : 0;
    const ny = distance > 0 ? dy / distance : 0;
    const clamped = Math.min(distance, MAX_RADIUS);

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(-50%, -50%) translate(${nx * clamped}px, ${ny * clamped}px)`;
    }

    const magnitude =
      distance <= DEADZONE ? 0 : (clamped - DEADZONE) / (MAX_RADIUS - DEADZONE);

    // Screen-space Y grows downwards; the player's forward axis does not.
    setJoystickInput(nx * magnitude, -ny * magnitude);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // A second finger must not disturb the gesture already in flight.
    if (activePointerId.current !== null) return;

    activePointerId.current = event.pointerId;
    mode.current = "candidate";
    origin.current = { x: event.clientX, y: event.clientY };
    startedAt.current = performance.now();
    // Deliberately nothing drawn, no capture and no input published yet.
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointerId.current) return;

    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;

    if (mode.current === "candidate") {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

      mode.current = "drag";
      // Taking the stick cancels a tap destination outright, so the two are
      // never steering the character at the same time.
      clearPointerTarget();

      try {
        // Keeps move and up coming here even once the thumb is over the HUD,
        // the minimap, or off the edge of the screen entirely.
        layerRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // Best effort — the window-level listeners are the real guarantee.
      }

      const base = baseRef.current;
      if (base) {
        const rect = event.currentTarget.getBoundingClientRect();
        base.style.left = `${origin.current.x - rect.left}px`;
        base.style.top = `${origin.current.y - rect.top}px`;
        base.style.opacity = "1";
      }
    }

    if (mode.current !== "drag") return;
    applyStick(dx, dy);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointerId.current) return;

    // Once a gesture has become a drag it can never be read as a tap, so
    // lifting the stick cannot leave a destination behind.
    const isTap =
      mode.current === "candidate" &&
      performance.now() - startedAt.current <= HOLD_LIMIT_MS;
    const { clientX, clientY } = event;

    // Tear down first: whatever the tap does next, the stick is already
    // released and the input already zeroed.
    endGesture();

    if (!isTap) return;
    const hit = pickGround(clientX, clientY);
    if (hit) setPointerTarget(hit.x, hit.z, true);
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointerId.current) return;
    endGesture();
  };

  // Unmounted outside open play, which is what disables both gestures while a
  // rune panel is up or the portal sequence is running.
  if (phase !== "PLAYING") return null;

  return (
    <div
      ref={layerRef}
      className="fixed inset-0 z-[5] touch-none select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        ref={baseRef}
        className="pointer-events-none absolute h-[124px] w-[124px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/10 opacity-0 backdrop-blur-[1px] transition-opacity duration-150"
      >
        <div
          ref={knobRef}
          className="absolute top-1/2 left-1/2 h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/45 bg-white/25"
        />
      </div>
    </div>
  );
}
