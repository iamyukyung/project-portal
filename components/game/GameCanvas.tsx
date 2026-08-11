"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { Canvas } from "@react-three/fiber";

import { GameScene } from "./GameScene";
import { ControlsHint } from "@/components/ui/ControlsHint";
import { FloatingJoystick } from "@/components/ui/FloatingJoystick";
import { HUD } from "@/components/ui/HUD";
import { IntroScreen } from "@/components/ui/IntroScreen";
import {
  usePrefersReducedMotion,
  useResponsiveGameSettings,
} from "@/hooks/useResponsiveGameSettings";
import { usePlayerInput } from "@/hooks/usePlayerInput";
import { useGameStore } from "@/store/gameStore";
import { isWebGLAvailable } from "@/lib/webgl";
import { CAMERA_DIR, PLAYER, SPAWN } from "@/lib/worldLayout";

/** Matches the intro camera travel in FollowCamera. */
const INTRO_TRAVEL_MS = 1100;

/**
 * WebGL support never changes for the life of the document, so the store is a
 * one-shot probe with no subscription. Assuming support on the server keeps the
 * fallback out of the HTML for the overwhelming majority of visitors.
 */
let webglProbe: boolean | null = null;
const subscribeWebGL = () => () => {};
const getWebGLSnapshot = () => (webglProbe ??= isWebGLAvailable());
const getWebGLServerSnapshot = () => true;

function WebGLFallback() {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#0f2027] px-8 text-center"
      style={{
        paddingTop: "calc(var(--safe-top) + 24px)",
        paddingBottom: "calc(var(--safe-bottom) + 24px)",
      }}
    >
      <p className="text-sm font-semibold tracking-[0.3em] text-white/90">
        PROJECT PORTAL
      </p>
      <p className="max-w-xs text-sm leading-relaxed text-white/70">
        이 브라우저에서는 3D 월드를 실행할 수 없습니다. 최신 브라우저에서
        열거나 하드웨어 가속을 켠 뒤 다시 시도해 주세요.
      </p>
    </div>
  );
}

export function GameCanvas() {
  const settings = useResponsiveGameSettings();
  const reducedMotion = usePrefersReducedMotion();
  const phase = useGameStore((state) => state.phase);
  const setControlsEnabled = useGameStore((state) => state.setControlsEnabled);

  const webglSupported = useSyncExternalStore(
    subscribeWebGL,
    getWebGLSnapshot,
    getWebGLServerSnapshot,
  );

  // Cursor feedback is a class toggle rather than state: hovering the ground
  // must not re-render the tree, and CSS already owns the canvas cursor.
  const rootRef = useRef<HTMLDivElement>(null);
  const onGroundHoverChange = useCallback((hovering: boolean) => {
    rootRef.current?.classList.toggle("is-over-ground", hovering);
  }, []);

  usePlayerInput(phase === "PLAYING");

  // Hand control over once the camera has finished travelling to the player,
  // so the intro move is never fighting the player's first input.
  useEffect(() => {
    if (phase !== "PLAYING") return;
    if (reducedMotion) {
      setControlsEnabled(true);
      return;
    }
    const timer = setTimeout(() => setControlsEnabled(true), INTRO_TRAVEL_MS);
    return () => clearTimeout(timer);
  }, [phase, reducedMotion, setControlsEnabled]);

  // Only read at Canvas creation; FollowCamera owns the camera afterwards.
  const initialCamera = useMemo(() => {
    if (!settings) return undefined;
    const distance = settings.camera.distance * 1.55;
    const height = settings.camera.height * 1.7;
    return {
      fov: settings.camera.fov,
      near: 0.5,
      far: 220,
      position: [
        SPAWN.x + CAMERA_DIR.x * distance,
        PLAYER.centerY + height,
        SPAWN.z + CAMERA_DIR.z * distance,
      ] as [number, number, number],
    };
  }, [settings]);

  if (!webglSupported) return <WebGLFallback />;

  return (
    <div className="game-root" ref={rootRef}>
      {settings && webglSupported && (
        <Canvas
          // `flat` disables tone mapping — the palette is authored, not lit.
          flat
          dpr={[1, settings.dprMax]}
          camera={initialCamera}
          gl={{
            antialias: !settings.isTouch,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
          }}
        >
          <Suspense fallback={null}>
            <GameScene
              settings={settings}
              reducedMotion={reducedMotion}
              onGroundHoverChange={onGroundHoverChange}
            />
          </Suspense>
        </Canvas>
      )}

      <HUD reducedMotion={reducedMotion} />
      <IntroScreen
        isTouch={settings?.isTouch ?? false}
        reducedMotion={reducedMotion}
      />
      <ControlsHint
        isTouch={settings?.isTouch ?? false}
        reducedMotion={reducedMotion}
      />
      {settings?.isTouch && <FloatingJoystick />}
    </div>
  );
}
