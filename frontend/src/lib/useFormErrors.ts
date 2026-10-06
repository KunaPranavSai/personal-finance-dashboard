"use client";

import { useCallback, useState } from "react";
import { fieldErrorsOf, toUserMessage } from "./errorMessage";

/**
 * Field-level error state for forms that manage their own state (the mobile sheets).
 * `set` replaces all errors, `clear(field)` removes one as soon as the user edits it, `fromServer(err)` maps a rejected
 * request onto its fields and leaves anything it could not place in `form` (shown as a banner).
 */
export function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<string | null>(null);

  const set = useCallback((next: Record<string, string>) => { setErrors(next); setForm(null); }, []);
  const clear = useCallback((field: string) => setErrors((e) => { if (!(field in e)) return e; const { [field]: _gone, ...rest } = e; void _gone; return rest; }), []);
  const reset = useCallback(() => { setErrors({}); setForm(null); }, []);
  const fromServer = useCallback((err: unknown, known: string[] = []) => {
    const fields = fieldErrorsOf(err);
    const placed: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) if (!known.length || known.includes(k)) placed[k] = v;
    setErrors(placed);
    setForm(Object.keys(placed).length ? null : toUserMessage(err));
  }, []);
  /** Focus the first invalid control (by id) after a failed submit so keyboard and screen-reader users land on it. */
  const focusFirst = useCallback((ids: Record<string, string>) => {
    const first = Object.keys(errors)[0];
    if (first && ids[first]) document.getElementById(ids[first])?.focus();
  }, [errors]);

  return { errors, form, set, clear, reset, fromServer, focusFirst, hasErrors: Object.keys(errors).length > 0 };
}
