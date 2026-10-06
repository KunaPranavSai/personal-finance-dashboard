"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/format";

export interface FieldControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
}

interface FieldProps {
  label: string;
  /** The message to show under the control; the control is marked invalid while it is set. */
  error?: string | null;
  /** Rule or example shown up front (not only after a failed submit). */
  hint?: string;
  required?: boolean;
  /** Use the mobile `ppm-field` look instead of the desktop Tailwind one. */
  mobile?: boolean;
  className?: string;
  /** Render the input/select/textarea and spread the given props on it. */
  children: (control: FieldControlProps) => ReactNode;
}

/**
 * One accessible label + control + hint + error. The error is announced (role="alert"), linked to the control with
 * aria-describedby, and the control gets aria-invalid, so screen readers and the visual state agree.
 * Works with any input (Tailwind pp-* inputs, ppm-field inputs, PasswordInput).
 */
export function Field({ label, error, hint, required, mobile, className, children }: FieldProps) {
  const id = useId();
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  const control: FieldControlProps = {
    id,
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(required ? { "aria-required": true as const } : {}),
  };
  return (
    <div className={cn(mobile ? "ppm-field" : "space-y-1", className)}>
      <label htmlFor={id} className={mobile ? undefined : "block text-xs font-medium text-pp-text-dim"}>
        {label}
        {required && <span aria-hidden="true" className={mobile ? "req" : "ml-0.5 text-pp-critical"}>*</span>}
      </label>
      {children(control)}
      {hint && !error && <p id={hintId} className={mobile ? "ppm-meta" : "text-xs text-pp-text-dim"}>{hint}</p>}
      {error && <p id={errId} role="alert" className={mobile ? "err" : "text-xs font-medium text-pp-critical"}>{error}</p>}
    </div>
  );
}

/** Class for a desktop text input that turns red when invalid (pair with Field's aria-invalid). */
export const inputClass = "w-full rounded-lg border border-pp-border bg-transparent px-3 py-2 text-sm text-pp-text outline-none transition-colors focus:border-pp-accent aria-[invalid=true]:border-pp-critical";

/** Banner for form-level errors (server rejected the whole request, nothing field-specific to point at). */
export function FormError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className={cn("rounded-lg border border-pp-critical/30 bg-pp-critical/10 px-3 py-2 text-sm text-pp-critical", className)}>
      {message}
    </div>
  );
}
