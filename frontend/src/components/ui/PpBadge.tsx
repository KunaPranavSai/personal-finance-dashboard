import { cn } from "@/lib/format";

// User-facing status badge — approved palette only (Mantis/Vulcanico/
// Turmeric + neutral). Separate file from Badge.tsx (shared with Admin),
// same export name so callers only change the import path.
type Tone = "green" | "red" | "yellow" | "orange" | "gray" | "teal";

const toneClasses: Record<Tone, string> = {
  green: "bg-mantis/15 text-mantis",
  red: "bg-vulcanico/15 text-vulcanico",
  yellow: "bg-turmeric/15 text-turmeric",
  orange: "bg-turmeric/20 text-turmeric",
  gray: "bg-pp-surface-2 text-pp-text-dim",
  teal: "bg-pp-accent/10 text-pp-accent",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", toneClasses[tone])}>
      {children}
    </span>
  );
}
