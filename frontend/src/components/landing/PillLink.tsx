"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/format";

const base =
  "inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-7 text-sm font-semibold transition-[filter,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-pp-bg";
const variants = {
  primary: "bg-pp-accent text-pp-accent-ink hover:brightness-110",
  ghost: "border border-white/15 text-pp-text hover:bg-white/10",
};

export function PillLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: keyof typeof variants;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.span
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
      className="inline-flex"
    >
      <Link href={href} className={cn(base, variants[variant], className)}>
        {children}
      </Link>
    </motion.span>
  );
}
