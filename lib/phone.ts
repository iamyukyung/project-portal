/**
 * Korean mobile number handling for the pre-registration form.
 *
 * Prototype-grade on purpose: enough to catch a typo, not a carrier lookup.
 * Validation always runs on the normalized digits, never on the formatted
 * string, so the display format can change without touching the rule.
 */

/** Longest Korean mobile number, digits only. */
const MAX_DIGITS = 11;

/** Strips everything that is not a digit and caps the length. */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "").slice(0, MAX_DIGITS);
}

/** 01012345678 -> 010-1234-5678, formatting progressively as it is typed. */
export function formatPhone(digits: string): string {
  if (digits.length <= 3) return digits;
  // Older 10-digit numbers split 3-3-4; 010 numbers split 3-4-4.
  const middle = digits.length <= 10 ? 3 : 4;
  if (digits.length <= 3 + middle) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 3 + middle)}-${digits.slice(3 + middle)}`;
}

/** 10 or 11 digits starting 01. Deliberately not stricter than that. */
export function isValidPhone(digits: string): boolean {
  return /^01\d{8,9}$/.test(digits);
}
