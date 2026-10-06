import { SlidersHorizontal, ShieldCheck, Eye, Database, UserCircle, Wallet, Bell, Compass, BookOpen, ScrollText, FileText, LifeBuoy, type LucideIcon } from "lucide-react";

export interface HubItem { href: string; label: string; desc: string; icon: LucideIcon }
export interface HubGroup { label: string; items: HubItem[] }

// Set NEXT_PUBLIC_SUPPORT_EMAIL to show Contact Support / Send Feedback.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

/** The More page: one screen, three groups. "Settings" mirrors the five Settings tabs. */
export const HUB_GROUPS: HubGroup[] = [
  { label: "Manage", items: [
    { href: "/customizations", label: "Wallets, Categories & Sources", desc: "Organise how money is tracked", icon: Wallet },
    { href: "/notifications", label: "Notifications", desc: "Your alerts", icon: Bell },
  ] },
  { label: "Settings", items: [
    { href: "/settings?tab=preferences", label: "Preferences", desc: "Theme, currency, language, alerts", icon: SlidersHorizontal },
    { href: "/settings?tab=security", label: "Security", desc: "Password, PIN, 2FA, sessions", icon: ShieldCheck },
    { href: "/settings?tab=privacy", label: "Privacy", desc: "Control your data", icon: Eye },
    { href: "/settings?tab=data", label: "Data & Storage", desc: "Backup, restore, export", icon: Database },
    { href: "/settings?tab=account", label: "Account", desc: "Profile, help, delete account", icon: UserCircle },
  ] },
  { label: "Help & About", items: [
    { href: "/dashboard?tour=onboarding", label: "Product Tour", desc: "Replay the guided walkthrough", icon: Compass },
    { href: "/manual", label: "User Manual", desc: "How to use the app", icon: BookOpen },
    ...(SUPPORT_EMAIL ? [{ href: `mailto:${SUPPORT_EMAIL}?subject=Support`, label: "Contact Support", desc: "Get help from our team", icon: LifeBuoy }] : []),
    { href: "/privacy-policy", label: "Privacy Policy", desc: "How we handle data", icon: ScrollText },
    { href: "/terms", label: "Terms of Service", desc: "Legal & consent", icon: FileText },
  ] },
];
