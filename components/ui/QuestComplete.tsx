"use client";

import { useGameStore } from "@/store/gameStore";

/**
 * A fixed prototype number. Nothing is reserved and nothing is issued — this
 * is set dressing for the ending, and must not be read as a real position in
 * a queue.
 */
const MOCK_ADVENTURER_NUMBER = "#001842";

/** The payoff. Everything before this was the quest; this is the reward. */
export function QuestComplete({ reducedMotion }: { reducedMotion: boolean }) {
  const phase = useGameStore((state) => state.phase);
  const restartQuest = useGameStore((state) => state.restartQuest);

  if (phase !== "COMPLETE") return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center px-8 text-center"
      style={{
        paddingTop: "calc(var(--safe-top) + 24px)",
        paddingBottom: "calc(var(--safe-bottom) + 24px)",
        background:
          "radial-gradient(ellipse at center, rgba(19,44,60,0.72) 0%, rgba(8,18,26,0.94) 100%)",
        animation: reducedMotion ? undefined : "quest-complete-in 700ms ease-out",
      }}
    >
      <p className="text-[22px] font-semibold tracking-[0.28em] text-white sm:text-[30px] sm:tracking-[0.34em]">
        QUEST COMPLETE
      </p>
      <p className="mt-3 text-[12px] tracking-[0.22em] text-[#7fd4d8] sm:text-sm">
        YOUR JOURNEY BEGINS.
      </p>

      <div className="mt-10 flex flex-col items-center gap-1">
        <p className="text-[10px] tracking-[0.3em] text-white/45">
          EARLY ADVENTURER
        </p>
        <p className="text-[19px] font-semibold tracking-[0.16em] text-white/90">
          {MOCK_ADVENTURER_NUMBER}
        </p>
      </div>

      <p className="mt-9 text-[10px] tracking-[0.32em] text-white/40">
        COMING SOON
      </p>

      <button
        type="button"
        onClick={restartQuest}
        className="mt-12 min-h-[44px] rounded-full border border-white/25 px-6 text-[12px] tracking-[0.18em] text-white/75 transition-colors hover:bg-white/10"
      >
        다시 탐험하기
      </button>
    </div>
  );
}
