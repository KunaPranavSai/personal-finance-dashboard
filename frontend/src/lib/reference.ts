import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { Category, Account, Profile } from "@/types";

export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD", label: "Debit Card" },
  { value: "NET_BANKING", label: "Net Banking" },
  { value: "WALLET", label: "Wallet" },
];

export const ENTRY_TYPES: { value: string; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Income" },
];

export const BILL_TYPES = [
  "EMI", "Subscription", "Utility", "Insurance", "Rent", "Other",
];

export const GOAL_CATEGORIES = [
  "Emergency Fund", "Retirement", "Education", "Travel", "Home", "Vehicle", "Other",
];

export const INVESTMENT_CATEGORIES = [
  "Mutual Funds", "Stocks", "Fixed Deposit", "PPF", "EPF", "NPS", "Real Estate", "Gold", "Bonds", "Other",
];

export const CURRENCIES = [
  { value: "INR", label: "INR (₹)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "JPY", label: "JPY (¥)" },
  { value: "AUD", label: "AUD (A$)" },
  { value: "CAD", label: "CAD (C$)" },
  { value: "SGD", label: "SGD (S$)" },
];

export const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Asia/Shanghai",
  "Asia/Tokyo", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Pacific/Auckland", "Australia/Sydney",
];

export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "bn", label: "Bengali" },
  { value: "te", label: "Telugu" },
  { value: "mr", label: "Marathi" },
  { value: "ta", label: "Tamil" },
  { value: "ur", label: "Urdu" },
  { value: "gu", label: "Gujarati" },
  { value: "kn", label: "Kannada" },
];

export const DATE_FORMATS = [
  { value: "DD-MM-YYYY", label: "DD-MM-YYYY" },
  { value: "MM-DD-YYYY", label: "MM-DD-YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

export const WEEK_START_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
];

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ items: Category[] }>("/api/categories"),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
}

export function useExpenseCategories() {
  const { data, ...rest } = useCategories();
  return {
    data: { items: (data?.items ?? []).filter((c) => c.type === "EXPENSE") },
    ...rest,
  };
}

export function useIncomeCategories() {
  const { data, ...rest } = useCategories();
  return {
    data: { items: (data?.items ?? []).filter((c) => c.type === "INCOME") },
    ...rest,
  };
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<{ items: Account[] }>("/api/accounts"),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<Profile>("/api/profile"),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<Record<string, unknown>>("/api/settings"),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ items: { id: string; type: string; title: string; message: string; read: boolean; createdAt: string }[] }>("/api/notifications"),
    staleTime: 15000,
    refetchInterval: 30000,
    refetchOnWindowFocus: false,
  });
}