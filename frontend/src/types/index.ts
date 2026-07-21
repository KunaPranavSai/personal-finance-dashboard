export type EntryType = "INCOME" | "EXPENSE";
export type FixedVariable = "FIXED" | "VARIABLE";
export type Essentiality = "ESSENTIAL" | "NON_ESSENTIAL";
export type BudgetPeriod = "MONTHLY" | "QUARTERLY" | "YEARLY";
export type BudgetStatus = "UNDER_BUDGET" | "NEAR_LIMIT" | "OVER_BUDGET";

export interface Category {
  id: string;
  name: string;
  type: EntryType;
  subcategories: Subcategory[];
}

export interface Subcategory {
  id: string;
  name: string;
  categoryId: string;
}

export interface Account {
  id: string;
  name: string;
}

export interface PaymentMethodType {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: EntryType;
  category: Category;
  categoryId: string;
  subcategory?: Subcategory | null;
  subcategoryId?: string | null;
  merchant?: string | null;
  account?: Account | null;
  accountId?: string | null;
  paymentMethodType?: PaymentMethodType | null;
  paymentMethodTypeId?: string | null;
  location?: string | null;
  tags: string[];
  notes?: string | null;
  recurring: boolean;
  fixedVariable?: FixedVariable | null;
  essentiality?: Essentiality | null;
  attachmentUrl?: string | null;
}

export interface Budget {
  id: string;
  category: Category;
  categoryId: string;
  period: BudgetPeriod;
  periodKey: string;
  amount: number;
  actual: number;
  remaining: number;
  utilizationPct: number;
  variance: number;
  status: BudgetStatus;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface DashboardSummary {
  kpis: {
    totalIncome: number;
    totalExpenses: number;
    totalSavings: number;
    netWorth: number;
    budgetUtilizationPct: number;
    savingsRatePct: number;
    financialHealthScore: number;
    emergencyFundProgressPct: number;
    investmentGrowth: number;
    highestSpendingCategory: string | null;
    largestExpense: number;
    avgDailySpending: number;
    avgTransactionAmount: number;
    transactionCount: number;
    cashFlow: number;
    monthlyBalance: number;
    currentMonth: { income: number; expense: number };
    changeVsPrevMonth: { income: number; expense: number };
  };
  upcomingBills: Bill[];
  goalCount: number;
}

export interface Investment {
  id: string;
  instrument: string;
  category: string;
  investedAmount: number;
  currentValue: number;
  purchaseDate: string;
  monthlyContribution: number;
  annualReturnPct: number;
  platform?: string | null;
  notes?: string | null;
  isAutoSync: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: string;
  name: string;
  type: string;
  dueDate: string;
  amount: number;
  paidAmount: number;
  autoPay: boolean;
  interestRate?: number | null;
  tenureMonths?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsSummary {
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  savingsRate: number;
  monthlyTrend: { month: string; income: number; expense: number; savings: number }[];
}

export interface AnalyticsSummary {
  totalTransactions: number;
  averageTransaction: number;
  averageMonthlyVolume: number;
  categoryBreakdown: { category: string; total: number; count: number }[];
  incomeCategoryBreakdown: { category: string; total: number; count: number }[];
  monthlyTrend: { month: string; income: number; expense: number; count: number }[];
  paymentMethodBreakdown: { method: string; total: number; count: number }[];
}

export interface ReportItem {
  month: string;
  income: number;
  expense: number;
  count: number;
}

export interface Notification {
  id: string;
  type: "budget_alert" | "bill_due" | "goal_progress" | "insight";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  occupation: string;
  monthlyIncome: number;
  country: string;
  state: string;
  city: string;
  currency: string;
  timezone: string;
  language: string;
  theme: "light" | "dark";
  financialGoal: string;
  riskAppetite: string;
  investmentExperience: string;
  emergencyFundTarget: number;
  bio: string;
  avatar: string | null;
  dateFormat: string;
  weekStartsOn: "monday" | "sunday";
  notifications: {
    email: boolean;
    push: boolean;
    budgetAlerts: boolean;
    billReminders: boolean;
    goalUpdates: boolean;
    insights: boolean;
  };
  financialPreferences: {
    savingsGoal: number;
    emergencyFundMonths: number;
    riskTolerance: string;
    budgetMethod: string;
  };
}

export interface AppSettings {
  applicationName: string;
  defaultDashboard: string;
  startupPreferences: string;
  dateFormat: string;
  weekStartsOn: string;
  timeFormat: string;
  currency: string;
  currencySymbol: string;
  numberFormat: string;
  theme: string;
  language: string;
  timezone: string;
  firstDayOfWeek: string;
  notifications: {
    email: boolean;
    push: boolean;
    budgetAlerts: boolean;
    billReminders: boolean;
    goalUpdates: boolean;
    insights: boolean;
    reminderFrequency: string;
  };
  security: {
    twoFactorEnabled: boolean;
    sessionTimeout: number;
    autoLock: number;
    changePassword: boolean;
  };
  export: {
    defaultFormat: string;
    includeAttachments: boolean;
  };
  backup: {
    autoBackup: boolean;
    backupFrequency: string;
  };
  privacy: {
    shareAnonymousData: boolean;
    showInSuggestions: boolean;
    analytics: boolean;
    crashReporting: boolean;
    tracking: boolean;
  };
  preferences: {
    compactMode: boolean;
    showTips: boolean;
    confirmBeforeDelete: boolean;
    defaultTransactionType: string;
    defaultCharts: string;
    defaultFilters: string;
  };
}
