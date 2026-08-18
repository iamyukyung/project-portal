"use client";

import { useEffect, useRef } from "react";

import { playerTransform } from "@/lib/playerTransform";
import { RUNES, RUNE_ORDER, type RuneId } from "@/lib/runes";
import { COLORS, SCREEN_FORWARD, SCREEN_RIGHT, WORLD } from "@/lib/worldLayout";
import { countRunes, useGameStore } from "@/store/gameStore";

/** A little past the walls so nothing ever sits on the frame edge. */
const MAP_EXTENT = WORLD.walkRadius + 1.5;
/** Radius of the walkable area in viewBox units. */
const BOUNDARY = (WORLD.walkRadius / MAP_EXTENT) * 50;

/** Identity is only revealed once a rune has been found. */
const RUNE_LETTER: Record<RuneId, string> = {
  world: "W",
  heroes: "H",
  reward: "R",
};

/**
 * World XZ to a 0..100 viewBox.
 *
 * Fixed orientation: "up" is the camera's forward axis, so the map reads the
 * same way round as the screen does. It is locked there — it never rotates
 * with the player, only the player's own marker does.
 */
function project(x: number, z: number) {
  const right = x * SCREEN_RIGHT.x + z * SCREEN_RIGHT.z;
  const forward = x * SCREEN_FORWARD.x + z * SCREEN_FORWARD.z;
  return {
    cx: 50 + (right / MAP_EXTENT) * 50,
    cy: 50 - (forward / MAP_EXTENT) * 50,
  };
}

/** Player yaw to a clockwise SVG rotation in the map's fixed frame. */
function headingDegrees(facing: number) {
  const hx = Math.sin(facing);
  const hz = Math.cos(facing);
  const right = hx * SCREEN_RIGHT.x + hz * SCREEN_RIGHT.z;
  const forward = hx * SCREEN_FORWARD.x + hz * SCREEN_FORWARD.z;
  return (Math.atan2(right, forward) * 180) / Math.PI;
}

/** A four-pointed star, drawn rather than typed so it renders identically. */
const STAR_PATH =
  "M 0 -4.4 Q 0.85 -0.85 4.4 0 Q 0.85 0.85 0 4.4 Q -0.85 0.85 -4.4 0 Q -0.85 -0.85 0 -4.4 Z";

type MinimapProps = {
  isTouch: boolean;
  isPortrait: boolean;
  reducedMotion: boolean;
};

/**
 * A flat SVG overlay — no second scene, camera or renderer, and no extra
 * render pass. Every coordinate comes from lib/worldLayout via lib/runes, so
 * the map cannot drift out of sync with the world it describes.
 */
export function Minimap({ isTouch, isPortrait, reducedMotion }: MinimapProps) {
  const phase = useGameStore((state) => state.phase);
  const runes = useGameStore((state) => state.runes);
  const bannerVisible = useGameStore((state) => state.bannerVisible);

  const playerRef = useRef<SVGGElement>(null);
  const visible = phase !== "LOADING" && phase !== "INTRO";

  // The only per-frame work in the whole component, and it touches one
  // attribute on one node — React never re-renders for player movement.
  useEffect(() => {
    if (!visible) return;
    let frame = 0;
    const tick = () => {
      const marker = playerRef.current;
      if (marker) {
        const { cx, cy } = project(playerTransform.x, playerTransform.z);
        marker.setAttribute(
          "transform",
          `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${headingDegrees(
            playerTransform.facing,
          ).toFixed(1)})`,
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  const found = countRunes(runes);
  const charge = found / RUNE_ORDER.length;
  const open = found === RUNE_ORDER.length;
  const portal = project(0, 0);

  const size = isTouch ? (isPortrait ? 92 : 104) : 128;

  // Desktop sits bottom-left. Touch keeps well clear of the joystick, which
  // owns the whole left side of the screen, so it goes top-right instead.
  const placement = isTouch
    ? {
        top: "calc(var(--safe-top) + 62px)",
        right: "calc(var(--safe-right) + 18px)",
      }
    : {
        bottom: "calc(var(--safe-bottom) + 20px)",
        left: "calc(var(--safe-left) + 20px)",
      };

  return (
    <div
      // Takes its own pointer events so a tap on the map is never mistaken for
      // a tap on the ground behind it. Nothing here is clickable — it simply
      // absorbs, which is what keeps the character still.
      className="pointer-events-auto fixed z-20"
      style={{
        ...placement,
        width: size,
        height: size,
        opacity: visible ? 1 : 0,
        transition: reducedMotion ? "none" : "opacity 500ms ease 400ms",
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="rgba(8, 20, 26, 0.42)"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
        />

        {/* The walkable island. */}
        <circle
          cx="50"
          cy="50"
          r={BOUNDARY}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="0.8"
          strokeDasharray="3 3"
        />

        {/* Portal — brightens step by step, and outranks the runes once open. */}
        <g>
          {open && (
            <circle
              cx={portal.cx}
              cy={portal.cy}
              r="9"
              fill="none"
              stroke={COLORS.portalActive}
              strokeWidth="0.8"
              opacity="0.5"
              className={
                bannerVisible && !reducedMotion ? "minimap-pulse" : undefined
              }
            />
          )}
          <circle
            cx={portal.cx}
            cy={portal.cy}
            r={open ? 6 : 5.2}
            fill="none"
            stroke={found === 0 ? "rgba(255,255,255,0.4)" : COLORS.portalActive}
            strokeWidth={open ? 1.6 : 1.1}
            opacity={0.45 + charge * 0.55}
          />
          <circle
            cx={portal.cx}
            cy={portal.cy}
            r={2.6}
            fill={COLORS.portalActive}
            opacity={found === 0 ? 0 : 0.15 + charge * 0.8}
          />
        </g>

        {/* Runes — anonymous until found, then named and marked done. */}
        {RUNE_ORDER.map((id) => {
          const { cx, cy } = project(RUNES[id].position.x, RUNES[id].position.z);
          const rune = RUNES[id];

          if (!runes[id]) {
            return (
              <path
                key={id}
                d={STAR_PATH}
                transform={`translate(${cx} ${cy})`}
                fill="none"
                stroke="rgba(255,255,255,0.62)"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
            );
          }

          return (
            <g
              key={id}
              // Mounts at the moment of discovery, so this plays exactly once.
              className={reducedMotion ? undefined : "minimap-claimed"}
            >
              <circle
                cx={cx}
                cy={cy}
                r="3.1"
                fill={rune.accent}
                opacity="0.5"
              />
              <path
                d={`M ${cx - 1.5} ${cy} l 1.1 1.2 l 2.2 -2.5`}
                fill="none"
                stroke="#0f2027"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />
              <text
                x={cx}
                y={cy - 5.4}
                textAnchor="middle"
                fontSize="7"
                fontWeight="600"
                fill={rune.accent}
                opacity="0.75"
              >
                {RUNE_LETTER[id]}
              </text>
            </g>
          );
        })}

        {/* Player — an arrowhead that turns with the character. */}
        <g ref={playerRef}>
          <path
            d="M 0 -4.8 L 3.4 4.1 L 0 2.1 L -3.4 4.1 Z"
            fill={COLORS.player.cloak}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="0.7"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}
