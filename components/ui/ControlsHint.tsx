"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { hasInteracted, subscribeInteraction } from "@/hooks/usePlayerInput";
import { useGameStore } from "@/store/gameStore";

/** Dismissed on its own this long after the hint appears. */
const AUTO_DISMISS_MS = 4500;
const FADE_MS = 450;

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-white/40 bg-white/10 px-[3px] text-[10px] leading-none font-medium text-white/90">
      {children}
    </span>
  );
}

/** W over A S D, the shape players already recognise. */
function KeyCluster() {
  return (
    <span className="inline-flex flex-col items-center gap-[3px]">
      <KeyCap>W</KeyCap>
      <span className="inline-flex gap-[3px]">
        <KeyCap>A</KeyCap>
        <KeyCap>S</KeyCap>
        <KeyCap>D</KeyCap>
      </span>
    </span>
  );
}

function MouseGlyph() {
  return (
    <svg
      width="13"
      height="18"
      viewBox="0 0 13 18"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        x="0.75"
        y="0.75"
        width="11.5"
        height="16.5"
        rx="5.75"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.75"
      />
      <path
        d="M6.5 4.4v3.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The floating joystick, drawn small. */
function SwipeGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle
        cx="9"
        cy="9"
        r="7.4"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.55"
      />
      <circle cx="11.4" cy="6.6" r="3" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

/**
 * A quiet line of controls guidance that appears once the player takes over,
 * then gets out of the way: the moment any input arrives it fades, and it
 * expires on its own if nothing happens.
 */
export function ControlsHint({
  isTouch,
  reducedMotion,
}: {
  isTouch: boolean;
  reducedMotion: boolean;
}) {
  const phase = useGameStore((state) => state.phase);
  const controlsEnabled = useGameStore((state) => state.controlsEnabled);

  const interacted = useSyncExternalStore(
    subscribeInteraction,
    hasInteracted,
    () => false,
  );

  const [expired, setExpired] = useState(false);
  const [mounted, setMounted] = useState(true);

  const active = phase === "PLAYING" && controlsEnabled;

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setExpired(true), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [active]);

  const visible = active && !interacted && !expired;
  const dismissed = interacted || expired;

  // Unmount once the fade has run so it can never sit over the game.
  useEffect(() => {
    if (!dismissed) return;
    const timer = setTimeout(
      () => setMounted(false),
      reducedMotion ? 0 : FADE_MS,
    );
    return () => clearTimeout(timer);
  }, [dismissed, reducedMotion]);

  if (!mounted) return null;
  // Stay out of the DOM entirely until the player actually has control, so the
  // hint never sits invisibly behind the loading and intro screens.
  if (!active && !dismissed) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-5"
      style={{
        paddingBottom: "calc(var(--safe-bottom) + 26px)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: reducedMotion
          ? "none"
          : `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
      }}
    >
      <div className="flex items-center gap-3.5 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-white/80 backdrop-blur-[2px]">
        {isTouch ? (
          <span className="flex items-center gap-2 text-[12px] tracking-wide">
            <SwipeGlyph />
            탭해서 이동 · 드래그해서 조작
          </span>
        ) : (
          <>
            <span className="flex items-center gap-2 text-[11px] tracking-wide">
              <KeyCluster />
              <span className="leading-tight">
                이동
                <span className="block text-[10px] text-white/50">
                  방향키도 됩니다
                </span>
              </span>
            </span>

            <span className="h-6 w-px bg-white/15" aria-hidden="true" />

            <span className="flex items-center gap-2 text-[11px] tracking-wide">
              <MouseGlyph />
              바닥을 클릭해도 이동해요
            </span>
          </>
        )}
      </div>
    </div>
  );
}
