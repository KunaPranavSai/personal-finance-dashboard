import { cn } from "@/lib/format";

type Tone = "green" | "red" | "yellow" | "orange" | "gray" | "teal";

const toneClasses: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  yellow: "bg-amber-50 text-amber-700",
  orange: "bg-orange-50 text-orange-700",
  gray: "bg-gray-100 text-gray-600",
  teal: "bg-teal/10 text-teal",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", toneClasses[tone])}>
      {children}
    </span>
  );
}
