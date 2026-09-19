"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

export function AdminPageHeader({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-5 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "var(--cc-accent-dim)", color: "var(--cc-accent)", border: "1px solid var(--cc-border-strong)" }}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div>
          <h1 className="cc-mono text-lg font-bold uppercase tracking-wide" style={{ color: "var(--cc-text)" }}>{title}</h1>
          {description && <p className="text-sm" style={{ color: "var(--cc-text-dim)" }}>{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.div>
  );
}
