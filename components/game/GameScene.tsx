"use client";

import { useEffect, useRef } from "react";
import { Physics } from "@react-three/rapier";
import * as THREE from "three";

import { DestinationMarker } from "./DestinationMarker";
import { FollowCamera } from "./FollowCamera";
import { SceneEnvironment } from "./Environment";
import { GroundPointer } from "./GroundPointer";
import { Player } from "./Player";
import { Portal } from "./Portal";
import { Runes } from "./Runes";
import { World } from "./World";
import type { GameSettings } from "@/hooks/useResponsiveGameSettings";
import { useGameStore } from "@/store/gameStore";
import { PLAYER, SPAWN } from "@/lib/worldLayout";

/**
 * Rendered inside <Physics>, which suspends until the Rapier WASM module is
 * ready — so this mounting is the signal that the world is actually playable.
 */
function SceneReady() {
  const markReady = useGameStore((state) => state.markReady);
  useEffect(() => markReady(), [markReady]);
  return null;
}

type GameSceneProps = {
  settings: GameSettings;
  reducedMotion: boolean;
  /** Desktop cursor feedback, handled by the DOM layer outside the canvas. */
  onGroundHoverChange: (hovering: boolean) => void;
};

export function GameScene({
  settings,
  reducedMotion,
  onGroundHoverChange,
}: GameSceneProps) {
  // Shared between the player (writer) and the camera (reader). Deliberately a
  // ref: the position changes every frame and must not trigger renders.
  const playerPosition = useRef(
    new THREE.Vector3(SPAWN.x, PLAYER.centerY, SPAWN.z),
  );

  return (
    <>
      <SceneEnvironment />
      <FollowCamera
        targetRef={playerPosition}
        settings={settings.camera}
        reducedMotion={reducedMotion}
      />

      {/*
        Click-to-move is desktop only. Leaving these out on touch also leaves
        the scene with zero interactive objects, so R3F skips raycasting
        entirely on every pointer move — which is where the phones benefit.
      */}
      {!settings.isTouch && (
        <>
          <GroundPointer onHoverChange={onGroundHoverChange} />
          <DestinationMarker reducedMotion={reducedMotion} />
        </>
      )}

      <Portal reducedMotion={reducedMotion} />

      <Physics gravity={[0, -22, 0]} timeStep="vary">
        <SceneReady />
        <World />
        <Player
          positionRef={playerPosition}
          movement={settings.movement}
          reducedMotion={reducedMotion}
        />
        {/* Inside Physics so it reads the player's post-step position. */}
        <Runes positionRef={playerPosition} reducedMotion={reducedMotion} />
      </Physics>
    </>
  );
}
