"use client";

import { useGameStore } from "@/store/gameStore";

/** The one line of text in the portal activation sequence. */
export function PortalBanner({ reducedMotion }: { reducedMotion: boolean }) {
  const visible = useGameStore((state) => state.bannerVisible);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-6"
      style={{
        opacity: visible ? 1 : 0,
        transition: reducedMotion ? "none" : "opacity 450ms ease",
      }}
      aria-live="polite"
    >
      <p
        className="text-center text-[15px] font-semibold tracking-[0.3em] text-white sm:text-xl sm:tracking-[0.38em]"
        style={{
          textShadow: "0 2px 18px rgba(10, 22, 48, 0.85)",
          transform: visible || reducedMotion ? "scale(1)" : "scale(0.97)",
          transition: reducedMotion ? "none" : "transform 700ms ease",
        }}
      >
        {visible ? "THE PORTAL IS OPEN" : ""}
      </p>
    </div>
  );
}
