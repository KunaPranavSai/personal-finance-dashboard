"use client";

import { motion } from "framer-motion";
import {
  UserCheck, UserX, Pencil, Trash2, KeyRound, IdCard, LogOut, UserPlus,
  ShieldAlert, ShieldCheck, ShieldOff, AlertTriangle, Mail, Activity as ActivityIcon,
  Settings, Database, LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/format";

export interface TimelineEvent {
  id: string;
  event: string;
  detail?: string | null;
  createdAt: string;
  actorLabel?: string | null;
}

const EVENT_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  user_approved: { label: "User approved", icon: UserCheck, tone: "teal" },
  user_rejected: { label: "User rejected", icon: UserX, tone: "amber" },
  user_updated: { label: "User updated", icon: Pencil, tone: "teal" },
  user_deleted: { label: "User deleted", icon: Trash2, tone: "red" },
  user_created: { label: "User created", icon: UserPlus, tone: "teal" },
  password_reset_by_admin: { label: "Password reset by admin", icon: KeyRound, tone: "amber" },
  uid_reset_by_admin: { label: "UID reset by admin", icon: IdCard, tone: "amber" },
  force_logout_by_admin: { label: "Forced logout", icon: LogOut, tone: "amber" },
  signup_requested: { label: "New signup", icon: UserPlus, tone: "teal" },
  password_changed: { label: "Password changed", icon: KeyRound, tone: "teal" },
  password_reset: { label: "Password reset", icon: KeyRound, tone: "amber" },
  password_reset_requested: { label: "Reset code requested", icon: Mail, tone: "navy" },
  password_reset_failed: { label: "Failed password reset", icon: AlertTriangle, tone: "red" },
  uid_changed: { label: "UID changed", icon: IdCard, tone: "teal" },
  uid_change_failed: { label: "Failed UID change", icon: AlertTriangle, tone: "red" },
  "2fa_enabled": { label: "2FA enabled", icon: ShieldCheck, tone: "emerald" },
  "2fa_disabled": { label: "2FA disabled", icon: ShieldOff, tone: "red" },
  login_failed: { label: "Failed login attempt", icon: ShieldAlert, tone: "red" },
  platform_settings_updated: { label: "Platform settings changed", icon: Settings, tone: "teal" },
  platform_backup_downloaded: { label: "Backup downloaded", icon: Database, tone: "navy" },
};

const TONE_CLASSES: Record<string, string> = {
  teal: "bg-teal/10 text-teal",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  red: "bg-red-500/10 text-red-500",
  emerald: "bg-emerald-500/10 text-emerald-600",
  navy: "bg-navy/10 text-navy/70 dark:bg-white/10 dark:text-white/70",
};

export function Timeline({ items }: { items: TimelineEvent[] }) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => {
        const meta = EVENT_META[item.event] ?? { label: item.event, icon: ActivityIcon, tone: "navy" };
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03 }}
            className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
          >
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", TONE_CLASSES[meta.tone])}>
              <meta.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-navy dark:text-white">{meta.label}</p>
              {item.actorLabel && <p className="text-xs text-navy/50 dark:text-white/50">{item.actorLabel}</p>}
              {item.detail && <p className="truncate text-xs text-navy/40 dark:text-white/40">{item.detail}</p>}
            </div>
            <p className="shrink-0 text-[11px] text-navy/30 dark:text-white/30">{new Date(item.createdAt).toLocaleString()}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

export { EVENT_META, TONE_CLASSES };
