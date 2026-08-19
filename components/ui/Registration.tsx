"use client";

import { useEffect, useId, useRef, useState } from "react";

import { formatPhone, isValidPhone, normalizePhone } from "@/lib/phone";
import { useGameStore } from "@/store/gameStore";

/** Long enough to read as work being done, short enough not to be a wait. */
const SUBMIT_MS = 700;

type Errors = { phone?: string; consent?: string };

/**
 * The last action of the quest, not a web form.
 *
 * Deliberately handles no personal data beyond the current keystroke: the
 * number lives in component state for as long as the form is open and goes
 * nowhere else — no network, no storage, no logging, no analytics. Submitting
 * is a local mock, which is the whole contract of this prototype.
 */
export function Registration({
  isTouch,
  reducedMotion,
}: {
  isTouch: boolean;
  reducedMotion: boolean;
}) {
  const phase = useGameStore((state) => state.phase);
  const completeQuest = useGameStore((state) => state.completeQuest);

  const [digits, setDigits] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const phoneId = useId();
  const consentId = useId();
  const errorId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const open = phase === "REGISTER";
  if (!open) return null;

  const validate = (): Errors => {
    const next: Errors = {};
    if (!isValidPhone(digits)) next.phone = "올바른 휴대폰 번호를 입력해주세요.";
    if (!consent) next.consent = "개인정보 수집 및 이용에 동의해주세요.";
    return next;
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const found = validate();
    setErrors(found);
    if (found.phone || found.consent) return;

    setSubmitting(true);
    timer.current = setTimeout(completeQuest, SUBMIT_MS);
  };

  const transition = reducedMotion
    ? "none"
    : "opacity 320ms ease, transform 380ms cubic-bezier(0.22, 1, 0.36, 1)";

  const body = (
    <form onSubmit={onSubmit} noValidate className="flex flex-col">
      <p className="text-[10px] font-semibold tracking-[0.34em] text-[#7fd4d8]">
        YOUR ADVENTURE
      </p>
      <h2 className="mt-1.5 text-[20px] leading-snug font-semibold text-white sm:text-[22px]">
        IS ABOUT TO BEGIN
      </h2>
      <p className="mt-2 text-[13px] text-white/60">모험에 참가하시겠습니까?</p>

      <label
        htmlFor={phoneId}
        className="mt-6 text-[12px] font-medium tracking-wide text-white/75"
      >
        휴대폰 번호
      </label>
      <input
        id={phoneId}
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder="010-0000-0000"
        value={formatPhone(digits)}
        onChange={(event) => {
          setDigits(normalizePhone(event.target.value));
          if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
        }}
        aria-invalid={errors.phone ? true : undefined}
        aria-describedby={errors.phone ? errorId : undefined}
        disabled={submitting}
        className="mt-2 w-full rounded-xl border border-white/20 bg-white/[0.06] px-4 py-3 text-[16px] tracking-wide text-white placeholder:text-white/30 focus:border-[#7fd4d8] focus:outline-none disabled:opacity-60"
      />

      <label
        htmlFor={consentId}
        className="mt-4 flex items-start gap-2.5 text-[12px] leading-relaxed text-white/70"
      >
        <input
          id={consentId}
          name="consent"
          type="checkbox"
          checked={consent}
          onChange={(event) => {
            setConsent(event.target.checked);
            if (errors.consent) {
              setErrors((prev) => ({ ...prev, consent: undefined }));
            }
          }}
          disabled={submitting}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#7fd4d8]"
        />
        <span>
          개인정보 수집 및 이용에 동의합니다.{" "}
          <span className="text-white/35">(필수)</span>
        </span>
      </label>

      {/* Reserved height, so an error appearing never shifts the CTA. */}
      <p
        id={errorId}
        role="alert"
        aria-live="polite"
        className="mt-3 min-h-[16px] text-[12px] text-[#ff9a7a]"
      >
        {errors.phone ?? errors.consent ?? ""}
      </p>

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 min-h-[48px] w-full rounded-full bg-[#7fd4d8] px-6 text-[14px] font-semibold tracking-[0.12em] text-[#0f2027] transition-opacity hover:opacity-90 disabled:opacity-70"
      >
        {submitting ? "사전예약 중…" : "사전예약하기"}
      </button>
    </form>
  );

  if (isTouch) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <section
          aria-label="사전예약"
          // dvh rather than vh: the sheet has to stay above the on-screen
          // keyboard, and the form scrolls inside itself if it cannot.
          className="pointer-events-auto max-h-[70dvh] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#0d1b22]/95 px-5 pt-4 backdrop-blur-md"
          style={{
            paddingBottom: "calc(var(--safe-bottom) + 20px)",
            transform: "translateY(0)",
            transition,
          }}
        >
          <span
            className="mx-auto mb-4 block h-1 w-9 rounded-full bg-white/25"
            aria-hidden="true"
          />
          {body}
        </section>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-6">
      <section
        aria-label="사전예약"
        className="pointer-events-auto w-[360px] max-w-full rounded-2xl border border-white/15 bg-[#0d1b22]/85 p-7 backdrop-blur-md"
        style={{ transition }}
      >
        {body}
      </section>
    </div>
  );
}
