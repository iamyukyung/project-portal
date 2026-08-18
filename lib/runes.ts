import { LANDMARKS } from "./worldLayout";

export type RuneId = "world" | "heroes" | "reward";

/** Fixed slot order for the HUD. Discovery order itself is never forced. */
export const RUNE_ORDER: readonly RuneId[] = ["world", "heroes", "reward"];

export type RuneContent = {
  id: RuneId;
  /** Overline, shown in caps. */
  label: string;
  headline: string;
  /** Korean body copy, one entry per line. */
  body: string[];
  /** HEROES only — display-only archetypes, nothing is selectable yet. */
  archetypes?: { name: string; korean: string }[];
  /** REWARD only — mock content. */
  rewardTitle?: string;
  rewards?: string[];
  /** Where the crystal floats, taken from the existing landmark plinths. */
  position: { x: number; z: number };
  /** Crystal and UI accent. Each rune reads differently from a distance. */
  accent: string;
  emissive: string;
};

/**
 * The three landmarks sit on an equilateral triangle 27.7u apart, which is a
 * 6.5s walk on desktop and 8.1s on touch — far enough not to cluster, close
 * enough that the next one is never a hunt. WORLD takes the plinth nearest the
 * spawn so something interesting is on screen from the first frame.
 */
export const RUNES: Record<RuneId, RuneContent> = {
  world: {
    id: "world",
    label: "WORLD",
    headline: "A forgotten world is calling.",
    body: [
      "한때 빛으로 가득했던 땅이",
      "다시 모험가를 기다리고 있습니다.",
    ],
    position: LANDMARKS[0],
    accent: "#6fd3d8",
    emissive: "#1d6b73",
  },
  heroes: {
    id: "heroes",
    label: "HEROES",
    headline: "Choose who you will become.",
    body: ["세 개의 길이 당신을 기다립니다."],
    archetypes: [
      { name: "Warrior", korean: "전사" },
      { name: "Mage", korean: "마법사" },
      { name: "Ranger", korean: "레인저" },
    ],
    position: LANDMARKS[1],
    accent: "#c495f5",
    emissive: "#5b3a8c",
  },
  reward: {
    id: "reward",
    label: "REWARD",
    headline: "Begin before everyone else.",
    body: ["먼저 출발한 모험가에게 주어집니다."],
    rewardTitle: "Pre-registration Reward",
    rewards: ["Exclusive Mount", "Limited Costume", "1,000 Crystal"],
    position: LANDMARKS[2],
    accent: "#e3c66d",
    emissive: "#6b5320",
  },
};

/**
 * Close enough that walking onto the landmark plinth counts, but the dwell
 * requirement means clipping the edge in passing does not.
 */
export const DISCOVER_RADIUS = 2.4;
/** Seconds the player must stay inside the radius before it triggers. */
export const DISCOVER_DWELL = 0.35;
