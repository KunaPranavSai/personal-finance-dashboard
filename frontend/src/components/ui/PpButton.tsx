import { cn } from "@/lib/format";
import { ButtonHTMLAttributes, forwardRef } from "react";

// User-facing button — approved palette (matches .ppm-sheet-submit /
// .ppm-danger-btn in the mobile UI). Separate file from Button.tsx (which
// is shared with the Admin panel and must stay visually untouched), but
// exports the same name so callers only ever change the import path.
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-pp-accent text-pp-accent-ink hover:opacity-90",
  secondary: "bg-pp-chip-bg text-pp-accent hover:bg-pp-surface-2",
  ghost: "bg-transparent text-pp-text hover:bg-pp-surface-2",
  danger: "bg-vulcanico/10 text-vulcanico hover:bg-vulcanico/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5 min-h-[36px]",
  md: "text-sm px-4 py-2.5 min-h-[44px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[opacity,background-color] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className ?? ""
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
