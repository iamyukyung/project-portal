"use client";

import { useEffect, useState } from "react";

import { useGameStore } from "@/store/gameStore";

const FADE_MS = 600;

type IntroScreenProps = {
  isTouch: boolean;
  reducedMotion: boolean;
};

/**
 * LOADING and INTRO live here. Once the player starts, the overlay fades out
 * while the camera travels in, then unmounts so it can never eat a pointer.
 */
export function IntroScreen({ isTouch, reducedMotion }: IntroScreenProps) {
  const phase = useGameStore((state) => state.phase);
  const startGame = useGameStore((state) => state.startGame);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (phase === "LOADING" || phase === "INTRO") return;
    const timer = setTimeout(() => setMounted(false), reducedMotion ? 0 : FADE_MS);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion]);

  if (!mounted) return null;

  const isLoading = phase === "LOADING";
  const visible = isLoading || phase === "INTRO";

  return (
    <button
      type="button"
      onClick={startGame}
      disabled={!visible || isLoading}
      aria-label={isTouch ? "탭해서 시작하기" : "클릭해서 시작하기"}
      className="fixed inset-0 z-30 flex w-full cursor-pointer flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_center,rgba(6,20,26,0.42)_0%,rgba(6,20,26,0.82)_100%)] px-6 text-center disabled:cursor-default"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transition: reducedMotion ? "none" : `opacity ${FADE_MS}ms ease`,
        paddingTop: "var(--safe-top)",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      {/* Tracking is dialled back on narrow phones so the title never clips. */}
      <span className="text-[21px] leading-tight font-semibold tracking-[0.22em] text-white sm:text-4xl sm:tracking-[0.3em]">
        PROJECT PORTAL
      </span>
      <span className="text-[10px] tracking-[0.26em] text-white/65 sm:text-sm sm:tracking-[0.34em]">
        THE JOURNEY BEGINS
      </span>

      <span
        className="mt-8 rounded-full border border-white/35 px-6 py-2.5 text-[12px] tracking-[0.24em] text-white/95 sm:text-sm"
        style={{
          animation:
            isLoading || reducedMotion
              ? undefined
              : "portal-pulse 2.2s ease-in-out infinite",
        }}
      >
        {isLoading
          ? "LOADING…"
          : isTouch
            ? "[ TAP TO START ]"
            : "[ CLICK TO START ]"}
      </span>
    </button>
  );
}
