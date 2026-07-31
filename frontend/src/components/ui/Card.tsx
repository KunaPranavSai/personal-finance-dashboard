import { cn } from "@/lib/format";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // "Midnight Cockpit": translucent ice-glass in light mode (over the
        // page's ambient mesh canvas — see globals.css), dark slate frosted
        // glass in dark mode, both with a tinted indigo/violet border that
        // glows brighter on hover.
        "rounded-xl2 border border-[rgba(199,210,254,0.7)] bg-white/[0.82] shadow-[0_10px_30px_-10px_rgba(79,70,229,0.08),0_4px_12px_-2px_rgba(0,0,0,0.03)] backdrop-blur-2xl transition-[background-color,border-color,box-shadow] hover:border-[rgba(251,191,36,0.3)] hover:bg-white/[0.9] dark:border-white/[0.08] dark:bg-[rgba(15,23,42,0.75)] dark:shadow-card dark:backdrop-blur-xl dark:hover:border-[rgba(99,102,241,0.3)] dark:hover:bg-[rgba(15,23,42,0.85)] overflow-hidden min-w-0",
        className ?? ""
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-4 pb-2", className ?? "")} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-sm font-semibold text-navy/70 dark:text-white/70 truncate", className ?? "")} {...props} />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className ?? "")} {...props} />;
}
