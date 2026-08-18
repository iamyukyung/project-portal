import { create } from "zustand";

import { RUNE_ORDER, type RuneId } from "@/lib/runes";

/**
 * LOADING -> INTRO -> PLAYING is the Sprint 1A spine. DISCOVERY and
 * PORTAL_OPEN are transient: both hand control back to PLAYING when they
 * finish, so everything that keys off PLAYING keeps working unchanged.
 * REGISTER and COMPLETE are declared for the sprint after this one.
 */
export type GamePhase =
  | "LOADING"
  | "INTRO"
  | "PLAYING"
  | "DISCOVERY"
  | "PORTAL_OPEN"
  | "REGISTER"
  | "COMPLETE";

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
  /** Drives the one camera move in the activation sequence. */
  cameraFocus: "player" | "portal";
  bannerVisible: boolean;

  setPhase: (phase: GamePhase) => void;
  markReady: () => void;
  startGame: () => void;
  setControlsEnabled: (enabled: boolean) => void;

  discoverRune: (id: RuneId) => void;
  dismissRune: () => void;
  setCameraFocus: (focus: "player" | "portal") => void;
  setBannerVisible: (visible: boolean) => void;
  finishPortalActivation: () => void;
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
  cameraFocus: "player",
  bannerVisible: false,

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
}));
