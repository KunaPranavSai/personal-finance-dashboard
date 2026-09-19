"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Shield, Database, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/format";

interface HeroProps {
  onInstallClick?: () => void;
  canInstall?: boolean;
  isInstalled?: boolean;
}

const TRUST_BADGES = [
  { icon: Shield, label: "Encrypted tokens", desc: "AES-256-GCM at rest" },
  { icon: Database, label: "Your Google Drive", desc: "Data stays with you" },
  { icon: Zap, label: "No third-party tracking", desc: "Privacy by default" },
  { icon: CheckCircle, label: "2FA & Passkeys", desc: "Secure authentication" },
];

const DASHBOARD_MOCK_DATA = {
  netWorth: "₹12.4L",
  income: "₹85.2K",
  expense: "₹42.1K",
  savings: "₹43.1K",
  savingsRate: "50.6%",
  financialHealth: 82,
  budgetUsage: "67%",
  emergencyFund: "78%",
};

export function Hero({ onInstallClick, canInstall, isInstalled }: HeroProps) {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
      {/* Background decorative elements */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-teal/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-indigo/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[32rem] w-[32rem] rounded-full bg-teal/5 blur-[150px]" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header/Nav bar - will be rendered by parent */}
        
        {/* Hero Content */}
        <div className="text-center">
          {/* Eyebrow */}
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-teal/30 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal dark:bg-teal/20 dark:border-teal/40 dark:text-teal"
          >
            <span className="relative h-1.5 w-1.5 rounded-full bg-teal animate-pulse" />
            PERSONAL FINANCE, SIMPLIFIED
          </motion.span>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 text-4xl font-bold tracking-tight text-navy dark:text-white sm:text-5xl lg:text-6xl text-balance"
          >
            Take control of your money.
            <br />
            <span className="relative">See the full picture.</span>
          </motion.h1>

          {/* Supporting text */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 mx-auto max-w-2xl text-lg text-navy/60 dark:text-white/60 sm:text-xl"
          >
            Track income and expenses, plan budgets, manage bills, build savings goals,
            monitor investments, and understand your finances from one clear dashboard.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <Link
              href="/signup"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-teal px-6 py-3 text-base font-semibold text-white transition-all hover:bg-teal/90 hover:shadow-lg hover:shadow-teal/25 active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
              )}
            >
              Get Started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="#features"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-navy/15 bg-white/60 px-6 py-3 text-base font-semibold text-navy transition-all hover:bg-black/5 dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
              )}
            >
              Explore Features
            </Link>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-4 sm:gap-6"
          >
            {TRUST_BADGES.map(({ icon: Icon, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-2.5 text-sm text-navy/50 dark:text-white/50"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal/10 text-teal dark:bg-teal/20">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="text-left">
                  <p className="font-medium text-navy dark:text-white">{label}</p>
                  <p className="text-xs text-navy/40 dark:text-white/40">{desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Dashboard Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          className="mt-16 relative"
        >
          <DashboardMockup data={DASHBOARD_MOCK_DATA} />
        </motion.div>

        {/* Install App prompt for PWA */}
        {(canInstall && !isInstalled) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="mt-10 text-center"
          >
            <button
              type="button"
              onClick={onInstallClick}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition-all hover:bg-navy-dark",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-navy-dark"
              )}
              aria-label="Install Penny Pilot as an app"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </span>
              Install App
            </button>
            <p className="mt-2 text-xs text-navy/40 dark:text-white/40">
              Works offline · Gets updates automatically · No app store required
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function DashboardMockup({ data }: { data: typeof DASHBOARD_MOCK_DATA }) {
  return (
    <div className="mx-auto max-w-5xl rounded-2xl border border-black/5 bg-white/60 shadow-2xl dark:border-white/10 dark:bg-navy-dark/60 overflow-hidden">
      {/* Mock browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-rose-400" />
          <div className="h-3 w-3 rounded-full bg-amber-400" />
          <div className="h-3 w-3 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 text-center text-xs text-navy/40 dark:text-white/40 font-mono">app.pennypilot.pro/dashboard</div>
      </div>

      <div className="p-6 sm:p-8">
        {/* Top KPIs row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          <MockKpiCard label="Net Worth" value={data.netWorth} trend="+12.4%" trendPositive icon="💎" />
          <MockKpiCard label="Monthly Income" value={data.income} trend="+8.2%" trendPositive icon="📈" />
          <MockKpiCard label="Monthly Expenses" value={data.expense} trend="-3.1%" trendPositive icon="📉" />
          <MockKpiCard label="Monthly Savings" value={data.savings} trend="+24.7%" trendPositive icon="💰" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Income vs Expense mini chart */}
          <div className="lg:col-span-2 rounded-xl border border-black/5 bg-white/40 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-medium text-navy dark:text-white mb-3">Income vs Expenses (6 months)</p>
            <MockAreaChart />
          </div>

          {/* Financial Health Gauge */}
          <div className="rounded-xl border border-black/5 bg-white/40 p-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-sm font-medium text-navy dark:text-white mb-3 text-center">Financial Health</p>
            <MockHealthGauge score={data.financialHealth} />
          </div>
        </div>

        {/* Bottom metrics row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MockMetricCard label="Savings Rate" value={data.savingsRate} icon="🎯" />
          <MockMetricCard label="Budget Usage" value={data.budgetUsage} icon="📊" />
          <MockMetricCard label="Emergency Fund" value={data.emergencyFund} icon="🛡️" />
          <MockMetricCard label="Investment Growth" value="+₹2.1K" icon="📈" />
        </div>
      </div>
    </div>
  );
}

function MockKpiCard({ label, value, trend, trendPositive, icon }: { label: string; value: string; trend: string; trendPositive: boolean; icon: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/40 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-navy/50 dark:text-white/50">{label}</p>
          <p className="mt-1 text-xl font-bold text-navy dark:text-white">{value}</p>
        </div>
        <span className="text-2xl" aria-hidden="true">{icon}</span>
      </div>
      <p className={cn("mt-2 text-xs font-medium", trendPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
        {trend} vs last month
      </p>
    </div>
  );
}

function MockMetricCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-xl border border-black/5 bg-white/40 p-4 dark:border-white/10 dark:bg-white/5 text-center">
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <p className="mt-2 text-sm font-medium text-navy dark:text-white">{label}</p>
      <p className="mt-1 text-lg font-bold text-navy dark:text-white">{value}</p>
    </div>
  );
}

function MockAreaChart() {
  const points = [
    { x: 0, y1: 0.75, y2: 0.45 },
    { x: 1, y1: 0.68, y2: 0.52 },
    { x: 2, y1: 0.82, y2: 0.38 },
    { x: 3, y1: 0.71, y2: 0.48 },
    { x: 4, y1: 0.88, y2: 0.41 },
    { x: 5, y1: 0.78, y2: 0.44 },
  ];
  const width = 100;
  const height = 100;
  const stepX = width / (points.length - 1);

  const incomePath = points.map((p, i) => `${i * stepX} ${height - p.y1 * height * 0.85}`).join(" ");
  const expensePath = points.map((p, i) => `${i * stepX} ${height - p.y2 * height * 0.85}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" aria-hidden="true">
      <defs>
        <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.05} />
        </linearGradient>
        <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.05} />
        </linearGradient>
      </defs>
      <path
        d={`M${incomePath} L${width} ${height} L0 ${height} Z`}
        fill="url(#incomeGrad)"
      />
      <path
        d={`M${expensePath} L${width} ${height} L0 ${height} Z`}
        fill="url(#expenseGrad)"
      />
      <path d={`M${incomePath}`} stroke="#06B6D4" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${expensePath}`} stroke="#F43F5E" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MockHealthGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 60;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  
  const getColor = () => {
    if (clamped >= 75) return "#10B981";
    if (clamped >= 50) return "#F59E0B";
    return "#F43F5E";
  };
  
  const color = getColor();
  const label = clamped >= 75 ? "Thriving" : clamped >= 50 ? "Fair" : "Critical";

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.15)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
        />
      </svg>
      <div className="mt-3 text-center">
        <p className="text-3xl font-extrabold text-navy dark:text-white" style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}>
          {clamped}
        </p>
        <p className="text-xs font-semibold" style={{ color: color }}>{label}</p>
      </div>
    </div>
  );
}