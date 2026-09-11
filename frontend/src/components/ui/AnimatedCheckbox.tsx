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
  const labelId = id ? `${id}-label` : undefined;
  return (
    // Deliberately a <div>, not a <label>: the label text may contain a nested
    // link (e.g. "Terms of Service"). A native <label htmlFor> would forward a
    // click anywhere inside it — including on that link — to the checkbox
    // button too, silently toggling it whenever the link is clicked. Using a
    // plain wrapper with an explicit onClick (that ignores clicks landing on
    // an <a>) keeps the link and the checkbox independently clickable.
    <div
      className="flex items-start gap-2 select-none"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        onChange(!checked);
      }}
    >
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
        className={`relative mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-md border transition-colors ${
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
      <span id={labelId} className="cursor-pointer text-xs text-[#94A3B8]">{label}</span>
    </div>
  );
}
