import { cn } from "@/lib/format";
import { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // "Signature Light Glass": translucent ice-glass surface over the
        // page's ambient mesh canvas (see globals.css) instead of flat
        // white, with a tinted indigo→amber border stroke and layered
        // color elevation. Dark mode keeps its existing glass treatment.
        "rounded-xl2 border border-[rgba(199,210,254,0.5)] bg-white/[0.72] shadow-[0_10px_30px_-10px_rgba(79,70,229,0.08),0_4px_12px_-2px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-[background-color,border-color,box-shadow] hover:border-[rgba(251,191,36,0.3)] hover:bg-white/[0.88] hover:backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 dark:shadow-card dark:hover:border-white/10 dark:hover:bg-white/5 overflow-hidden min-w-0",
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
