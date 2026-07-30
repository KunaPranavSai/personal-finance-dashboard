"use client";

import { useState, InputHTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/format";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  toggleClassName?: string;
}

export function PasswordInput({ className, toggleClassName, ...props }: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={show ? "text" : "password"}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 overflow-hidden text-navy/30 transition-colors hover:text-navy/60 dark:text-white/30 dark:hover:text-white/60",
          toggleClassName
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={show ? "hide" : "show"}
            initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            className="block"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
