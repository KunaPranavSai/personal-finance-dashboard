// Shared, plain-language validators so every form states the same rule the same way.
import { z } from "zod";

/** Money amount typed as text or number: > 0, at most 2 decimals, a sane upper bound, no "1e5" / "Infinity". */
export const amountSchema = (label = "Amount", max = 1_000_000_000) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v.trim()) : NaN) : v),
    z.number({ message: `Enter ${label.toLowerCase()} as a number, like 450 or 1200.50.` })
      .refine((n) => Number.isFinite(n), `Enter ${label.toLowerCase()} as a number, like 450 or 1200.50.`)
      .refine((n) => n > 0, `${label} must be more than zero.`)
      .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, `${label} can have at most 2 decimal places.`)
      .refine((n) => n <= max, `${label} can't be more than ${max.toLocaleString("en-IN")}.`),
  );

export const nameSchema = (label = "Name", max = 50) =>
  z.string({ message: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} can be at most ${max} characters.`);

export const emailSchema = z.string({ message: "Enter your email address." }).trim().toLowerCase()
  .min(1, "Enter your email address.").max(254, "That email address is too long.").email("Enter a valid email address, like name@example.com.");

/** Phone: optional leading +, 7-15 digits (spaces, dashes and brackets allowed). */
export const phoneSchema = z.string().trim().refine((v) => v === "" || (/^[+\d\s()\-]+$/.test(v) && v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15), "Enter a phone number with 7 to 15 digits.");

// Plain checks usable outside zod (mobile sheets, auth pages).
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const phoneDigits = (v: string) => v.replace(/\D/g, "");
export const isValidPhone = (v: string) => /^[+\d\s()\-]+$/.test(v.trim()) && phoneDigits(v).length >= 7 && phoneDigits(v).length <= 15;

/** A PIN the server will also accept: 4-6 digits, not one repeated digit, not a straight run. */
export function pinProblem(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return "A PIN can only contain digits.";
  if (pin.length < 4 || pin.length > 6) return "A PIN must be 4 to 6 digits.";
  if (/^(\d)\1+$/.test(pin)) return "Choose a PIN that isn't one repeated digit, like 1111.";
  const d = [...pin].map(Number);
  if (d.every((n, i) => i === 0 || n === d[i - 1] + 1) || d.every((n, i) => i === 0 || n === d[i - 1] - 1)) return "Choose a PIN that isn't a straight run, like 1234.";
  return null;
}

/** Password rules: server minimum (default 8), a letter and a number. Returns the first problem, or null. */
export function passwordProblem(pw: string, min = 8): string | null {
  if (pw.length < min) return `Use at least ${min} characters.`;
  if (pw.length > 72) return "Use at most 72 characters.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Include at least one letter and one number.";
  return null;
}
export const passwordRuleHint = (min = 8) => `At least ${min} characters, with a letter and a number.`;

if (process.env.NODE_ENV === "test") {
  console.assert(pinProblem("1111") !== null && pinProblem("1234") !== null && pinProblem("2846") === null);
  console.assert(passwordProblem("abc") !== null && passwordProblem("abcdefg1") === null);
  console.assert(amountSchema().safeParse("1e5").success === false && amountSchema().safeParse("450.50").success === true);
}
