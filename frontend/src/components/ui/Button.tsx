import { cn } from "@/lib/format";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-dark",
  secondary: "bg-teal/10 text-teal hover:bg-teal/20",
  ghost: "bg-transparent text-navy hover:bg-black/5 dark:text-white dark:hover:bg-white/10",
  danger: "bg-red-50 text-red-600 hover:bg-red-100",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className ?? ""
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
