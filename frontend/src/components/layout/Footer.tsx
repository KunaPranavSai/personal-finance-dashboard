import Link from "next/link";
import { cn } from "@/lib/format";

export function Footer({ variant = "app" }: { variant?: "app" | "dark" }) {
  const textClass = variant === "dark" ? "text-white/20" : "text-navy/30 dark:text-white/20";
  const linkClass = variant === "dark" ? "hover:text-white/50" : "hover:text-navy/60 dark:hover:text-white/50";

  return (
    <footer className={cn("space-y-1.5 py-4 text-center text-xs", textClass)}>
      <p>Designed and developed by Kuna Pranav Sai · © {new Date().getFullYear()} Penny Pilot</p>
      <p className="flex items-center justify-center gap-2">
        <Link href="/privacy-policy" className={cn("underline-offset-2 hover:underline", linkClass)}>
          Privacy Policy
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms" className={cn("underline-offset-2 hover:underline", linkClass)}>
          Terms of Service
        </Link>
      </p>
    </footer>
  );
}
