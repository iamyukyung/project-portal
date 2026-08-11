"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";

import { clearJoystickInput, setJoystickInput } from "@/hooks/usePlayerInput";
import { useGameStore } from "@/store/gameStore";

/** Distance from the origin at which the stick reads full tilt. */
const MAX_RADIUS = 56;
/** Ignores the jitter of a resting thumb. */
const DEADZONE = 6;

/**
 * Floating joystick: there is no visible stick until a thumb lands on the left
 * half of the screen, and wherever it lands becomes the origin. Everything is
 * driven through direct DOM writes rather than state, so dragging never
 * re-renders the React tree while the game is running.
 */
export function FloatingJoystick() {
  const phase = useGameStore((state) => state.phase);

  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });

  const hide = useCallback(() => {
    activePointer.current = null;
    if (baseRef.current) baseRef.current.style.opacity = "0";
    clearJoystickInput();
  }, []);

  // Never leave the character walking if the joystick unmounts mid-drag.
  useEffect(() => hide, [hide]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== null) return;

    activePointer.current = event.pointerId;
    try {
      // Capture keeps the drag alive if the thumb slides outside the zone.
      // Safari throws here when the pointer is already gone; the joystick
      // still works off the zone's own listeners, so the failure is ignorable.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // no-op
    }

    const rect = event.currentTarget.getBoundingClientRect();
    origin.current = { x: event.clientX, y: event.clientY };

    const base = baseRef.current;
    if (base) {
      base.style.left = `${event.clientX - rect.left}px`;
      base.style.top = `${event.clientY - rect.top}px`;
      base.style.opacity = "1";
    }
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(-50%, -50%)";
    }

    setJoystickInput(0, 0);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointer.current) return;

    const dx = event.clientX - origin.current.x;
    const dy = event.clientY - origin.current.y;
    const distance = Math.hypot(dx, dy);
    const nx = distance > 0 ? dx / distance : 0;
    const ny = distance > 0 ? dy / distance : 0;
    const clamped = Math.min(distance, MAX_RADIUS);

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(-50%, -50%) translate(${nx * clamped}px, ${ny * clamped}px)`;
    }

    const magnitude =
      distance <= DEADZONE
        ? 0
        : (clamped - DEADZONE) / (MAX_RADIUS - DEADZONE);

    // Screen-space Y grows downwards; the player's forward axis does not.
    setJoystickInput(nx * magnitude, -ny * magnitude);
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== activePointer.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    hide();
  };

  if (phase !== "PLAYING") return null;

  return (
    <div
      className="fixed bottom-0 left-0 z-10 w-[60%] touch-none select-none"
      // Starts below the HUD so the placeholder header stays tappable later.
      style={{ top: "calc(var(--safe-top) + 72px)" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
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
