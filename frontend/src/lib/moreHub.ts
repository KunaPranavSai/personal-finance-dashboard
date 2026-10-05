import { User, SlidersHorizontal, ShieldCheck, HardDrive, Bell, LifeBuoy, Info, type LucideIcon } from "lucide-react";

export interface HubItem { href: string; label: string; desc: string }
export interface HubFamily { slug: string; label: string; desc: string; icon: LucideIcon; items: HubItem[] }

// Set NEXT_PUBLIC_SUPPORT_EMAIL to show Contact Support / Send Feedback.
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

// Max depth = 2: More -> family -> feature. Order is the product order (not alphabetical).
export const HUB_FAMILIES: HubFamily[] = [
  { slug: "personal", label: "Personal", desc: "Profile and account", icon: User, items: [
    { href: "/profile", label: "Profile", desc: "Manage your personal information" },
    { href: "/settings/security", label: "Account", desc: "Email, login & account settings" },
  ] },
  { slug: "preferences", label: "Preferences", desc: "Customize your experience", icon: SlidersHorizontal, items: [
    { href: "/settings?tab=appearance", label: "Appearance", desc: "Theme and display" },
    { href: "/settings", label: "Currency, Date & Language", desc: "Regional settings" },
    { href: "/customizations", label: "App Preferences", desc: "Dashboard and default views" },
    { href: "/accounts", label: "Wallets & Categories", desc: "Manage money sources and categories" },
  ] },
  { slug: "security", label: "Security & Privacy", desc: "Protect your account", icon: ShieldCheck, items: [
    { href: "/settings/security", label: "Login & Security", desc: "Daily PIN, 2FA, passkeys, password" },
    { href: "/settings?tab=privacy", label: "Privacy", desc: "Control your data" },
    { href: "/settings/sessions", label: "Sessions", desc: "Where you are signed in" },
  ] },
  { slug: "backup", label: "Backup & Data", desc: "Manage your financial data", icon: HardDrive, items: [
    { href: "/settings/storage", label: "Backup & Storage", desc: "Backup status and restore" },
    { href: "/settings?tab=backup", label: "Data Management", desc: "Export and manage stored data" },
  ] },
  { slug: "notifications", label: "Notifications", desc: "Alerts and reminders", icon: Bell, items: [
    { href: "/notifications", label: "Notifications", desc: "Your alerts" },
    { href: "/settings?tab=notifications", label: "Notification Preferences", desc: "Reminders and alerts" },
  ] },
  { slug: "help", label: "Help & Support", desc: "Get help or contact us", icon: LifeBuoy, items: [
    { href: "/manual", label: "User Manual", desc: "How to use the app" },
    ...(SUPPORT_EMAIL
      ? [
          { href: `mailto:${SUPPORT_EMAIL}?subject=Support`, label: "Contact Support", desc: "Get help from our team" },
          { href: `mailto:${SUPPORT_EMAIL}?subject=Feedback`, label: "Send Feedback", desc: "Tell us what to improve" },
        ]
      : []),
  ] },
  { slug: "about", label: "About", desc: "Product and legal", icon: Info, items: [
    { href: "/terms", label: "Terms of Service", desc: "Legal & consent" },
    { href: "/privacy-policy", label: "Privacy Policy", desc: "How we handle data" },
  ] },
];
