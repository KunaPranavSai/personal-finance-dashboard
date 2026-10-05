import { User, SlidersHorizontal, ShieldCheck, HardDrive, Bell, LifeBuoy, Info, Wallet, type LucideIcon } from "lucide-react";

export interface HubItem { href: string; label: string; desc: string }
export interface HubFamily { slug: string; label: string; desc: string; icon: LucideIcon; items: HubItem[] }

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
  ] },
  { slug: "planning", label: "Planning & Reports", desc: "Bills, goals, savings, reports", icon: Wallet, items: [
    { href: "/bills", label: "Bills & EMIs", desc: "Upcoming payments" },
    { href: "/goals", label: "Goals", desc: "Track what you save for" },
    { href: "/savings", label: "Savings", desc: "Your savings plans" },
    { href: "/accounts", label: "Wallets & Categories", desc: "Manage money sources and categories" },
    { href: "/analytics", label: "Analytics", desc: "Trends and insights" },
    { href: "/reports", label: "Reports", desc: "Export and review" },
  ] },
  { slug: "security", label: "Security & Privacy", desc: "Protect your account", icon: ShieldCheck, items: [
    { href: "/settings/security", label: "Login & Security", desc: "Daily PIN, 2FA, passkeys, password" },
    { href: "/settings?tab=privacy", label: "Privacy", desc: "Control your data" },
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
  ] },
  { slug: "about", label: "About", desc: "Product and legal", icon: Info, items: [
    { href: "/terms", label: "Terms of Service", desc: "Legal & consent" },
    { href: "/privacy-policy", label: "Privacy Policy", desc: "How we handle data" },
  ] },
];
