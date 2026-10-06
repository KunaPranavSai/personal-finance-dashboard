import {
  BarChart3, CalendarClock, Flag, HardDrive, Home, LayoutDashboard, Landmark, LineChart, PartyPopper, PiggyBank, Receipt,
  ShieldCheck, Sparkles, TrendingUp, Wallet, type LucideIcon,
} from "lucide-react";
import type { TourStep } from "./Tour";

/** Remember finished/skipped tours per browser (and per account for the onboarding tour). Never stores anything sensitive. */
export const tourKey = (name: "welcome" | "onboarding", uid?: string) => `pp_tour_${name}${uid ? `_${uid}` : ""}`;
export function isTourDone(name: "welcome" | "onboarding", uid?: string): boolean {
  try { return localStorage.getItem(tourKey(name, uid)) !== null; } catch { return false; }
}
export function markTourDone(name: "welcome" | "onboarding", uid: string | undefined, reason: "done" | "skipped") {
  try { localStorage.setItem(tourKey(name, uid), reason); } catch { /* storage unavailable: the tour may show again, harmless */ }
}

const icon = (i: LucideIcon) => i;

/** 1) Welcome tour: advertises the product on the public landing page. Generic cards only: no user data is shown. */
export const WELCOME_STEPS: TourStep[] = [
  { icon: icon(Sparkles), title: "Welcome to Penny Pilot", body: "Your smarter way to understand, manage and grow your money." },
  { icon: icon(LayoutDashboard), title: "See your financial life clearly", body: "One dashboard that brings everything together.", bullets: ["Net worth at a glance", "Income and expenses this month", "Trends that show where you are heading"] },
  { icon: icon(Wallet), title: "Track every rupee", body: "Record income and expenses in seconds and organise them by wallet or money source.", bullets: ["Quick add for income and expenses", "Categories, wallets and payment methods", "Search and filter your whole history"] },
  { icon: icon(CalendarClock), title: "Stay ahead of bills and EMIs", body: "Never be surprised by a payment again.", bullets: ["Upcoming due dates", "Recurring bills, subscriptions and EMIs", "Reminders before they are due"] },
  { icon: icon(Landmark), title: "Build your capital", body: "Watch the money you are building for the future.", bullets: ["Investments and returns", "Savings", "Goals with progress tracking"] },
  { icon: icon(LineChart), title: "Understand your money", body: "Turn everyday activity into useful insight.", bullets: ["Analytics across any date range", "Reports you can export", "Spending patterns by category"] },
  { icon: icon(ShieldCheck), title: "Your data. Your control.", body: "Choose where your data lives, and keep it protected.", bullets: ["Store data in your own Google Drive", "PIN, two-factor and passkeys", "Backup, export and restore"] },
  {
    icon: icon(PartyPopper), title: "Ready to take control?", body: "Create your free account in under a minute.",
    actions: [{ label: "Create Free Account", href: "/signup" }, { label: "Explore Again", restart: true }],
  },
];

/** 2) Onboarding tour: runs inside the signed-in app after the first sign-in and teaches by pointing at the real interface. */
const nav = (path: string) => [`.ppm-navbtn[href="${path}"]`, `a[href="${path}"]`];
export const ONBOARDING_STEPS: TourStep[] = [
  { icon: icon(PartyPopper), title: "You're in!", body: "Let's get Penny Pilot set up for you. This takes about a minute and you can skip any time." },
  { icon: icon(Home), title: "Your dashboard", body: "This is your financial command centre. Income, expenses, capital and net worth come together here.", route: "/dashboard", target: nav("/dashboard") },
  { icon: icon(TrendingUp), title: "Add your first transaction", body: "This button records income and expenses. Tap it to open the Add page.", route: "/dashboard", target: ['button[aria-label="Add transaction"]'], interactive: true },
  { icon: icon(Receipt), title: "Income and expenses", body: "Pick what you want to record, choose the wallet it belongs to, then enter the amount. Try it now, or carry on with the tour." },
  { icon: icon(Wallet), title: "Wallets and money sources", body: "Organise your money by wallet or source so every transaction has a home.", route: "/accounts", target: nav("/accounts") },
  { icon: icon(CalendarClock), title: "Bills and EMIs", body: "Never lose track of upcoming obligations.", route: "/bills", target: nav("/bills") },
  { icon: icon(PiggyBank), title: "Investments and savings", body: "Track the money you are building for the future.", route: "/investments", target: nav("/investments") },
  { icon: icon(Flag), title: "Goals", body: "Create financial goals and watch your progress.", route: "/goals", target: nav("/goals") },
  { icon: icon(BarChart3), title: "Analytics", body: "Turn your financial activity into useful insights.", route: "/analytics", target: nav("/analytics") },
  { icon: icon(HardDrive), title: "Backup and account settings", body: "Keep your data protected and backed up. Manage storage, security and your PIN here.", route: "/settings", target: nav("/more").concat(nav("/settings?tab=backup")) },
  {
    icon: icon(PartyPopper), title: "You're ready to take control of your money", body: "You can replay this tour any time from Help & Support.",
    actions: [{ label: "Start Using Penny Pilot", href: "/dashboard" }],
  },
];
