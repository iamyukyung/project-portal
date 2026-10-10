"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { RUNES, type RuneContent, type RuneId } from "@/lib/runes";
import { useGameStore } from "@/store/gameStore";

const FADE_MS = 320;

function ArchetypeCards({ rune }: { rune: RuneContent }) {
  if (!rune.archetypes) return null;
  return (
    <ul className="mt-4 grid grid-cols-3 gap-2">
      {rune.archetypes.map((archetype, index) => (
        <li
          key={archetype.name}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-2 py-3"
        >
          <ArchetypeGlyph index={index} accent={rune.accent} />
          <span className="text-[11px] font-medium tracking-wide text-white/90">
            {archetype.name}
          </span>
          <span className="text-[10px] text-white/45">{archetype.korean}</span>
        </li>
      ))}
    </ul>
  );
}

/** Silhouette stand-ins — no character art in this sprint. */
function ArchetypeGlyph({ index, accent }: { index: number; accent: string }) {
  return (
    <svg
      width="22"
      height="26"
      viewBox="0 0 22 26"
      fill="none"
      aria-hidden="true"
      style={{ color: accent }}
    >
      <circle cx="11" cy="5" r="3.1" fill="currentColor" opacity="0.85" />
      <path
        d="M11 9c-3.4 0-5.6 2.2-5.6 5.4V22h11.2v-7.6C16.6 11.2 14.4 9 11 9Z"
        fill="currentColor"
        opacity="0.55"
      />
      {index === 0 ? (
        // Warrior — blade
        <path
          d="M18.4 7.5v11"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : index === 1 ? (
        // Mage — staff with a mote
        <>
          <path
            d="M18.4 9.5v9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="18.4" cy="7" r="2" fill="currentColor" />
        </>
      ) : (
        // Ranger — bow
        <path
          d="M17 8c2.4 2.6 2.4 7.4 0 10"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function RewardList({ rune }: { rune: RuneContent }) {
  if (!rune.rewards) return null;
  return (
    <div className="mt-4">
      <p className="text-[10px] tracking-[0.2em] text-white/45 uppercase">
        {rune.rewardTitle}
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rune.rewards.map((reward) => (
          <li
            key={reward}
            className="flex items-center gap-2.5 text-[13px] text-white/85"
          >
            <span
              className="h-1.5 w-1.5 rotate-45"
              style={{ background: rune.accent }}
              aria-hidden="true"
            />
            {reward}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RuneBody({ rune }: { rune: RuneContent }) {
  return (
    <>
      <p
        className="text-[10px] font-semibold tracking-[0.34em]"
        style={{ color: rune.accent }}
      >
        {rune.label}
      </p>
      <h2 className="mt-2 text-[19px] leading-snug font-semibold text-white">
        {rune.headline}
      </h2>
      <div className="mt-2.5 space-y-0.5">
        {rune.body.map((line) => (
          <p key={line} className="text-[13px] leading-relaxed text-white/60">
            {line}
          </p>
        ))}
      </div>
      <ArchetypeCards rune={rune} />
      <RewardList rune={rune} />
    </>
  );
}

/**
 * Rune content. A light panel off to the side on desktop and a bottom sheet on
 * touch — in both cases the world stays visible and un-dimmed behind it, so it
 * reads as part of the game rather than a web modal.
 */
export function RuneSheet({
  isTouch,
  reducedMotion,
}: {
  isTouch: boolean;
  reducedMotion: boolean;
}) {
  const activeRune = useGameStore((state) => state.activeRune);
  const dismissRune = useGameStore((state) => state.dismissRune);

  // The store drops activeRune the instant Continue is pressed, so the panel
  // remembers which rune it was showing for the length of the exit animation.
  // Closing always comes from an event, which is where this is set.
  const [closingRune, setClosingRune] = useState<RuneId | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    if (activeRune) setClosingRune(activeRune);
    dismissRune();
  }, [activeRune, dismissRune]);

  useEffect(() => {
    if (!closingRune || activeRune) return;
    const timer = setTimeout(
      () => setClosingRune(null),
      reducedMotion ? 0 : FADE_MS,
    );
    return () => clearTimeout(timer);
  }, [closingRune, activeRune, reducedMotion]);

  // Escape closes it, and the Continue button takes focus so the panel is
  // reachable without a mouse.
  useEffect(() => {
    if (!activeRune) return;
    continueRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeRune, close]);

  const shown = activeRune ?? closingRune;
  if (!shown) return null;

  const rune = RUNES[shown];
  const visible = activeRune !== null;
  const transition = reducedMotion
    ? "none"
    : `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;

  const button = (
    <button
      ref={continueRef}
      type="button"
      onClick={close}
      className="mt-5 w-full rounded-full px-5 py-2.5 text-[13px] font-semibold tracking-[0.14em] text-[#0f2027] transition-opacity hover:opacity-90"
      style={{ background: rune.accent }}
    >
      CONTINUE
    </button>
  );

  if (isTouch) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <section
          role="dialog"
          aria-label={`${rune.label} 룬`}
          className="pointer-events-auto max-h-[58dvh] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-black/60 px-5 pt-3 backdrop-blur-md"
          style={{
            paddingBottom: "calc(var(--safe-bottom) + 18px)",
            transform: visible ? "translateY(0)" : "translateY(100%)",
            opacity: visible ? 1 : 0,
            transition,
          }}
        >
          <span
            className="mx-auto mb-3 block h-1 w-9 rounded-full bg-white/25"
            aria-hidden="true"
          />
          <RuneBody rune={rune} />
          {button}
        </section>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-y-0 right-0 z-30 flex items-center px-6 sm:px-10">
      <section
        role="dialog"
        aria-label={`${rune.label} 룬`}
        className="pointer-events-auto w-[330px] max-w-[86vw] rounded-2xl border border-white/15 bg-black/45 p-6 backdrop-blur-md"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "translateX(0)" : "translateX(16px)",
          transition,
        }}
      >
        <RuneBody rune={rune} />
        {button}
      </section>
    </div>
  );
}
