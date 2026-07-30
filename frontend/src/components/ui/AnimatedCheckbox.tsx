"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  id?: string;
}

export function AnimatedCheckbox({ checked, onChange, label, id }: AnimatedCheckboxProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 select-none">
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked
            ? "border-purple-400 bg-gradient-to-br from-indigo-500 to-purple-500"
            : "border-white/20 bg-white/5"
        }`}
      >
        <motion.div
          initial={false}
          animate={{ scale: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <Check className="h-3 w-3 text-white" strokeWidth={3} />
        </motion.div>
      </button>
      <span className="text-xs text-[#94A3B8]">{label}</span>
    </label>
  );
}
