"use client";

import { useState, useCallback } from "react";
import { Lock } from "lucide-react";
import { Button } from "./Button";
import { PasswordInput } from "./PasswordInput";

interface LockScreenProps {
  isOpen: boolean;
  onUnlock: (password: string) => Promise<void>;
}

export function LockScreen({ isOpen, onUnlock }: LockScreenProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await onUnlock(password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [password, onUnlock]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl dark:bg-navy-dark">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
            <Lock className="h-8 w-8 text-teal" />
          </div>
          <h1 className="text-2xl font-bold text-navy dark:text-white">Session Locked</h1>
          <p className="text-sm text-navy/60 dark:text-white/60">
            Enter your password to unlock your session
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <PasswordInput
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              className="w-full rounded-lg border border-black/10 bg-transparent px-4 py-2 text-sm text-navy placeholder:text-navy/40 focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20 disabled:opacity-50 dark:border-white/10 dark:text-white dark:placeholder:text-white/40"
            />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          </div>
          <Button
            type="submit"
            disabled={!password || isSubmitting}
            className="w-full"
          >
            {isSubmitting ? "Unlocking..." : "Unlock"}
          </Button>
        </form>
      </div>
    </div>
  );
}
