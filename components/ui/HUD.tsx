"use client";

import { useGameStore } from "@/store/gameStore";

/**
 * Minimal placeholder HUD. Nothing here is wired up in Sprint 1A — it exists
 * to hold the corners and to prove the safe-area insets are respected.
 */
export function HUD({ reducedMotion }: { reducedMotion: boolean }) {
  const phase = useGameStore((state) => state.phase);
  const visible = phase !== "LOADING" && phase !== "INTRO";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-4"
      style={{
        paddingTop: "calc(var(--safe-top) + 16px)",
        paddingLeft: "calc(var(--safe-left) + 18px)",
        paddingRight: "calc(var(--safe-right) + 18px)",
        opacity: visible ? 1 : 0,
        transition: reducedMotion ? "none" : "opacity 500ms ease 400ms",
      }}
    >
      <span className="text-[13px] font-semibold tracking-[0.22em] text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] sm:text-sm">
        PROJECT PORTAL
      </span>

      <button
        type="button"
        aria-disabled="true"
        className="pointer-events-auto cursor-default rounded-full border border-white/30 bg-black/25 px-4 py-1.5 text-[12px] font-medium tracking-wide text-white/90 backdrop-blur-sm sm:text-[13px]"
      >
        사전예약
      </button>
    </div>
  );
}
