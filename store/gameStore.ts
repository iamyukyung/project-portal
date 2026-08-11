import { create } from "zustand";

/**
 * Sprint 1A only drives LOADING -> INTRO -> PLAYING.
 * The remaining phases are declared up front so later sprints can extend the
 * flow without reshaping the store.
 */
export type GamePhase =
  | "LOADING"
  | "INTRO"
  | "PLAYING"
  | "DISCOVERY"
  | "PORTAL_OPEN"
  | "REGISTER"
  | "COMPLETE";

type GameState = {
  phase: GamePhase;
  /**
   * Movement input is ignored until the intro camera has finished travelling
   * to the player, so the transition never fights the user.
   */
  controlsEnabled: boolean;
  setPhase: (phase: GamePhase) => void;
  markReady: () => void;
  startGame: () => void;
  setControlsEnabled: (enabled: boolean) => void;
};

export const useGameStore = create<GameState>((set) => ({
  phase: "LOADING",
  controlsEnabled: false,
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
}));
