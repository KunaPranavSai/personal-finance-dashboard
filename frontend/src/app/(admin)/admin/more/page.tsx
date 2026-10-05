"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Megaphone, Zap, Send, Settings, Plug, UserCircle, Monitor, LogOut, HardDrive, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

interface Item { href: string; label: string; desc: string; icon: LucideIcon }
// Two levels at most: More -> page. Whole card is the link; the arrow is decorative.
const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Communication",
    items: [
      { href: "/admin/announcements", label: "Announcements", desc: "Messages shown to users", icon: Megaphone },
      { href: "/admin/email", label: "Send Email", desc: "Email one user or a group", icon: Send },
      { href: "/admin/email-templates", label: "Email Templates", desc: "Edit system emails", icon: Mail },
      { href: "/admin/automated-emails", label: "Automated Emails", desc: "Triggers and schedules", icon: Zap },
    ],
  },
  {
    title: "Operations",
    items: [{ href: "/admin/migration", label: "Migration Status", desc: "Data migration progress", icon: HardDrive }],
  },
  {
    title: "Configuration",
    items: [
      { href: "/admin/settings", label: "Application Settings", desc: "Platform-wide settings", icon: Settings },
      { href: "/admin/integrations", label: "Integrations", desc: "Connected services", icon: Plug },
    ],
  },
  {
    title: "Your account",
    items: [
      { href: "/admin/account", label: "Account & Security", desc: "Password, 2FA and sign-in PIN", icon: UserCircle },
      { href: "/admin/sessions", label: "Sessions", desc: "Where you are signed in", icon: Monitor },
    ],
  },
];

export default function AdminMorePage() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    await logout();
    // Hard navigation tears down the whole in-memory app, as the desktop sidebar does.
    window.location.href = "/admin-login";
  };

  return (
    <div className="px-4 pb-6 pt-1">
      <div className="ppm-page-title">
        <h2>More</h2>
        <p>{user?.name || "Administrator"} · {user?.role?.replace("_", " ")}</p>
      </div>
      {SECTIONS.map((sec) => (
        <section key={sec.title} aria-label={sec.title}>
          <div className="ppm-section-label" style={{ margin: "16px 2px 8px" }}>{sec.title}</div>
          <div className="ppm-hub" style={{ marginTop: 0 }}>
            {sec.items.map(({ href, label, desc, icon: Icon }) => (
              <Link key={href} href={href} className="ppm-card ppm-hub-card">
                <div className="ppm-ic" aria-hidden="true"><Icon size={20} /></div>
                <div className="ppm-info">
                  <div className="ppm-name">{label}</div>
                  <div className="ppm-meta">{desc}</div>
                </div>
                <span className="ppm-chev" aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <button type="button" className="ppm-danger-btn" style={{ width: "100%", marginTop: 20 }} onClick={signOut} disabled={busy}>
        <LogOut size={16} style={{ display: "inline", verticalAlign: "-3px", marginRight: 6 }} />
        {busy ? "Signing out…" : "Sign Out"}
      </button>
    </div>
  );
}
