"use client";

import { motion } from "framer-motion";

function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

const LEVELS = [
  { label: "", color: "bg-pp-chip-bg" },
  { label: "Weak", color: "bg-vulcanico" },
  { label: "Fair", color: "bg-turmeric" },
  { label: "Good", color: "bg-pp-accent" },
  { label: "Strong", color: "bg-mantis" },
];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const score = scorePassword(password);
  if (!password) return null;
  const level = LEVELS[score];

  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-pp-chip-bg">
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: i < score ? 1 : 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`h-full origin-left rounded-full ${level.color}`}
            />
          </div>
        ))}
      </div>
      {level.label && <p className="mt-1 text-[11px] text-pp-text-dim">{level.label}</p>}
    </div>
  );
}
