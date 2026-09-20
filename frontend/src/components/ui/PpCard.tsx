import { cn } from "@/lib/format";
import { HTMLAttributes } from "react";

// User-facing card — same visual language as the approved mobile .ppm-card
// (flat surface, hairline border, soft elevation), built as its own file
// (not a Card.tsx retheme) because Card.tsx is shared with the Admin/Super
// Admin panel and must stay visually untouched. Exports the same names as
// Card.tsx on purpose: user-facing files only ever need to change their
// import path (`@/components/ui/Card` -> `@/components/ui/PpCard`), not
// any JSX.
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-pp border border-pp-border bg-pp-surface shadow-pp transition-colors overflow-hidden min-w-0",
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
  return <h3 className={cn("text-sm font-semibold text-pp-text-dim truncate", className ?? "")} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className ?? "")} {...props} />;
}
