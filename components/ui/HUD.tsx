"use client";

import { RUNES, RUNE_ORDER } from "@/lib/runes";
import { countRunes, isQuestEnding, useGameStore } from "@/store/gameStore";

/**
 * Rune progress, as three dots rather than a counter. Slots are fixed to
 * WORLD / HEROES / REWARD, which is only a layout choice — discovery order is
 * never forced. Deliberately small: it should register without competing with
 * the world behind it.
 */
function RuneProgress({ reducedMotion }: { reducedMotion: boolean }) {
  const runes = useGameStore((state) => state.runes);

  return (
    <span
      className="mt-2 flex items-center gap-[5px]"
      role="img"
      aria-label={`룬 ${countRunes(runes)} / ${RUNE_ORDER.length} 발견`}
    >
      {RUNE_ORDER.map((id) => {
        const found = runes[id];
        return (
          <span
            key={id}
            className="h-[7px] w-[7px] rounded-full border"
            style={{
              borderColor: found ? RUNES[id].accent : "rgba(255,255,255,0.4)",
              background: found ? RUNES[id].accent : "transparent",
              boxShadow: found ? `0 0 6px ${RUNES[id].accent}88` : "none",
              transition: reducedMotion
                ? "none"
                : "background 420ms ease, border-color 420ms ease, box-shadow 420ms ease",
            }}
          />
        );
      })}
    </span>
  );
}

/**
 * Minimal HUD: the wordmark, rune progress, and a pre-registration
 * placeholder. Sized and padded to stay clear of the safe-area insets.
 */
export function HUD({ reducedMotion }: { reducedMotion: boolean }) {
  const phase = useGameStore((state) => state.phase);
  // Gameplay HUD retires once the quest starts ending — the registration form
  // and the ending own the screen from there.
  const visible =
    phase !== "LOADING" && phase !== "INTRO" && !isQuestEnding(phase);

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
      {/*
        The container stays transparent to pointers so the world underneath is
        still tappable, but the HUD's own marks take their events — otherwise a
        tap on the wordmark would walk the character.
      */}
      <span className="pointer-events-auto flex flex-col items-start">
        <span className="text-[13px] font-semibold tracking-[0.22em] text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)] sm:text-sm">
          PROJECT PORTAL
        </span>
        <RuneProgress reducedMotion={reducedMotion} />
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
