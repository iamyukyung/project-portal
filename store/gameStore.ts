import { create } from "zustand";

import { RUNE_ORDER, type RuneId } from "@/lib/runes";

/**
 * LOADING -> INTRO -> PLAYING is the spine. DISCOVERY and PORTAL_OPEN are
 * transient and hand control back to PLAYING, so everything that keys off
 * PLAYING keeps working unchanged.
 *
 * PORTAL_ENTERING onwards is one-way: the quest ends there.
 */
export type GamePhase =
  | "LOADING"
  | "INTRO"
  | "PLAYING"
  | "DISCOVERY"
  | "PORTAL_OPEN"
  | "PORTAL_ENTERING"
  | "REGISTER"
  | "COMPLETE";

/** Phases where the world is no longer the player's to move around in. */
export function isQuestEnding(phase: GamePhase) {
  return (
    phase === "PORTAL_ENTERING" ||
    phase === "REGISTER" ||
    phase === "COMPLETE"
  );
}

export type RuneState = Record<RuneId, boolean>;

type GameState = {
  phase: GamePhase;
  /**
   * Movement input is ignored while this is false — during the intro camera
   * travel, while a rune panel is open, and through portal activation.
   */
  controlsEnabled: boolean;
  /** One flag per rune. All three true is what opens the portal. */
  runes: RuneState;
  /** The rune whose content panel is currently open. */
  activeRune: RuneId | null;
  /** Latched, so the activation sequence can only ever run once. */
  portalActivated: boolean;
  /** Latched the same way, so the player can only ever enter once. */
  portalEntered: boolean;
  /** Drives the one camera move in the activation sequence. */
  cameraFocus: "player" | "portal";
  bannerVisible: boolean;
  /** Bumped by a restart so the player can be put back at the spawn. */
  resetKey: number;

  setPhase: (phase: GamePhase) => void;
  markReady: () => void;
  startGame: () => void;
  setControlsEnabled: (enabled: boolean) => void;

  discoverRune: (id: RuneId) => void;
  dismissRune: () => void;
  setCameraFocus: (focus: "player" | "portal") => void;
  setBannerVisible: (visible: boolean) => void;
  finishPortalActivation: () => void;

  enterPortal: () => void;
  beginRegistration: () => void;
  completeQuest: () => void;
  restartQuest: () => void;
};

const NO_RUNES: RuneState = { world: false, heroes: false, reward: false };

export function countRunes(runes: RuneState): number {
  return RUNE_ORDER.reduce((total, id) => total + (runes[id] ? 1 : 0), 0);
}

export const useGameStore = create<GameState>((set) => ({
  phase: "LOADING",
  controlsEnabled: false,
  runes: NO_RUNES,
  activeRune: null,
  portalActivated: false,
  portalEntered: false,
  cameraFocus: "player",
  bannerVisible: false,
  resetKey: 0,

  setPhase: (phase) => set({ phase }),
  markReady: () =>
    set((state) => (state.phase === "LOADING" ? { phase: "INTRO" } : state)),
  startGame: () =>
    set((state) =>
      state.phase === "INTRO"
        ? { phase: "PLAYING", controlsEnabled: false }
        : state,
    ),
  setControlsEnabled: (controlsEnabled) => set({ controlsEnabled }),

  discoverRune: (id) =>
    set((state) => {
      // Only ever fires from open play, and never twice for the same rune.
      if (state.phase !== "PLAYING" || state.runes[id]) return state;
      return {
        runes: { ...state.runes, [id]: true },
        activeRune: id,
        phase: "DISCOVERY",
        controlsEnabled: false,
      };
    }),

  dismissRune: () =>
    set((state) => {
      if (state.activeRune === null) return state;

      const complete = countRunes(state.runes) === RUNE_ORDER.length;
      if (complete && !state.portalActivated) {
        // Hand straight to the activation sequence; it releases the controls.
        return {
          activeRune: null,
          phase: "PORTAL_OPEN",
          portalActivated: true,
          controlsEnabled: false,
        };
      }

      return { activeRune: null, phase: "PLAYING", controlsEnabled: true };
    }),

  setCameraFocus: (cameraFocus) => set({ cameraFocus }),
  setBannerVisible: (bannerVisible) => set({ bannerVisible }),
  finishPortalActivation: () =>
    set({
      phase: "PLAYING",
      controlsEnabled: true,
      cameraFocus: "player",
      bannerVisible: false,
    }),

  /**
   * The gate only opens for someone carrying all three runes, and only once —
   * proximity is checked every frame, so the latch is what keeps the entry
   * sequence from restarting on the frames that follow.
   */
  enterPortal: () =>
    set((state) => {
      if (state.phase !== "PLAYING") return state;
      if (!state.portalActivated || state.portalEntered) return state;
      return {
        phase: "PORTAL_ENTERING",
        portalEntered: true,
        controlsEnabled: false,
        cameraFocus: "portal",
      };
    }),

  beginRegistration: () =>
    set((state) =>
      state.phase === "PORTAL_ENTERING" ? { phase: "REGISTER" } : state,
    ),

  completeQuest: () =>
    set((state) => (state.phase === "REGISTER" ? { phase: "COMPLETE" } : state)),

  /** Puts the whole run back to the start without reloading the page. */
  restartQuest: () =>
    set((state) => ({
      phase: "PLAYING",
      controlsEnabled: true,
      runes: NO_RUNES,
      activeRune: null,
      portalActivated: false,
      portalEntered: false,
      cameraFocus: "player",
      bannerVisible: false,
      resetKey: state.resetKey + 1,
    })),
}));
