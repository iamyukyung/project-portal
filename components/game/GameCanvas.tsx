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
import { Minimap } from "@/components/ui/Minimap";
import { PortalBanner } from "@/components/ui/PortalBanner";
import { QuestComplete } from "@/components/ui/QuestComplete";
import { Registration } from "@/components/ui/Registration";
import { RuneSheet } from "@/components/ui/RuneSheet";
import {
  usePrefersReducedMotion,
  useResponsiveGameSettings,
} from "@/hooks/useResponsiveGameSettings";
import { usePlayerInput } from "@/hooks/usePlayerInput";
import { isQuestEnding, useGameStore } from "@/store/gameStore";
import { isWebGLAvailable } from "@/lib/webgl";
import { CAMERA_DIR, PLAYER, SPAWN } from "@/lib/worldLayout";

/** Matches the intro camera travel in FollowCamera. */
const INTRO_TRAVEL_MS = 1100;

/**
 * Portal activation, start to finish in ~3.3s: the rune absorbs, a beat of
 * nothing, the camera swings to the gate as it lights, the line lands, then
 * the camera comes back and control returns. Reduced motion keeps the beats
 * but drops the camera move, so it runs shorter.
 */
const ACTIVATION_STEPS = {
  full: { focusPortal: 350, bannerIn: 1150, bannerOut: 2500, focusPlayer: 2650, done: 3300 },
  reduced: { bannerIn: 150, bannerOut: 1500, done: 1800 },
} as const;

/**
 * Portal entry, ~1.7s: the gate draws the player in while its light floods the
 * screen, and the form arrives as the world washes out. Reduced motion drops
 * the pull and runs it as a short fade instead.
 */
const ENTRY_STEPS = {
  full: { veil: 550, register: 1700 },
  reduced: { veil: 120, register: 900 },
} as const;

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
  const setCameraFocus = useGameStore((state) => state.setCameraFocus);
  const setBannerVisible = useGameStore((state) => state.setBannerVisible);
  const finishPortalActivation = useGameStore(
    (state) => state.finishPortalActivation,
  );
  const beginRegistration = useGameStore((state) => state.beginRegistration);

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

  // The portal activation sequence. Entering PORTAL_OPEN is already latched by
  // the store, so this can only ever run once per session.
  useEffect(() => {
    if (phase !== "PORTAL_OPEN") return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) =>
      timers.push(setTimeout(run, ms));

    if (reducedMotion) {
      const step = ACTIVATION_STEPS.reduced;
      at(step.bannerIn, () => setBannerVisible(true));
      at(step.bannerOut, () => setBannerVisible(false));
      at(step.done, finishPortalActivation);
    } else {
      const step = ACTIVATION_STEPS.full;
      at(step.focusPortal, () => setCameraFocus("portal"));
      at(step.bannerIn, () => setBannerVisible(true));
      at(step.bannerOut, () => setBannerVisible(false));
      at(step.focusPlayer, () => setCameraFocus("player"));
      at(step.done, finishPortalActivation);
    }

    return () => timers.forEach(clearTimeout);
  }, [
    phase,
    reducedMotion,
    setCameraFocus,
    setBannerVisible,
    finishPortalActivation,
  ]);

  // Portal entry. `enterPortal` is latched in the store, so this runs once.
  const entrySteps = reducedMotion ? ENTRY_STEPS.reduced : ENTRY_STEPS.full;
  useEffect(() => {
    if (phase !== "PORTAL_ENTERING") return;
    const timer = setTimeout(beginRegistration, entrySteps.register);
    return () => clearTimeout(timer);
  }, [phase, entrySteps, beginRegistration]);

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
      {settings && (
        <Minimap
          isTouch={settings.isTouch}
          isPortrait={settings.isPortrait}
          reducedMotion={reducedMotion}
        />
      )}
      <IntroScreen
        isTouch={settings?.isTouch ?? false}
        reducedMotion={reducedMotion}
      />
      <ControlsHint
        isTouch={settings?.isTouch ?? false}
        reducedMotion={reducedMotion}
      />
      <RuneSheet
        isTouch={settings?.isTouch ?? false}
        reducedMotion={reducedMotion}
      />
      <PortalBanner reducedMotion={reducedMotion} />

      {/*
        The gate's light washing over the screen. One CSS layer rather than a
        post-processing pass — it also keeps the world legible behind the form.
      */}
      {isQuestEnding(phase) && (
        <div
          className="pointer-events-none fixed inset-0 z-30"
          aria-hidden="true"
          style={{
            // Mounted only for the ending phases, so the fade is an animation
            // with a delay rather than state — it replays cleanly on a restart.
            animation: `portal-veil-in 900ms ease ${entrySteps.veil}ms both`,
            background:
              "radial-gradient(ellipse at center, rgba(150,220,235,0.55) 0%, rgba(12,28,38,0.9) 70%)",
            backdropFilter: "blur(6px)",
          }}
        />
      )}

      <Registration
        isTouch={settings?.isTouch ?? false}
        reducedMotion={reducedMotion}
      />
      <QuestComplete reducedMotion={reducedMotion} />

      {settings?.isTouch && <FloatingJoystick />}
    </div>
  );
}
