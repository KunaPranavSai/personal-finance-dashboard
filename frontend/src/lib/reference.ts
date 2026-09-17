import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { getStorageMode, getStorageProvider } from "./storage";
import { Category, Account, PaymentMethodType, Profile } from "@/types";

// Domain types don't declare createdAt/updatedAt (the backend adds them at
// the API boundary), but every StorageProvider record has them.
type Stored<T> = T & { createdAt: string; updatedAt: string; [key: string]: unknown };

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

// Local-mode ("This Device Only") reads/writes go straight to IndexedDB via
// the StorageProvider abstraction instead of the Drive-backed REST API —
// Master Implementation Plan Phase 0. Drive mode is completely unchanged.
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider()
            .list<Stored<Category>>("categories")
            .then((items) => ({ items }))
        : api.get<{ items: Category[] }>("/api/categories"),
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
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider()
            .list<Stored<Account>>("accounts")
            .then((items) => ({ items }))
        : api.get<{ items: Account[] }>("/api/accounts"),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["payment-methods"],
    queryFn: () =>
      getStorageMode() === "local"
        ? getStorageProvider()
            .list<Stored<PaymentMethodType>>("paymentMethods")
            .then((items) => ({ items }))
        : api.get<{ items: PaymentMethodType[] }>("/api/payment-methods"),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

function newLocalId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Local-mode create/update helpers for the reference-data lists (Categories,
 * Accounts/Wallets, Payment Method Types/Money Sources) — same throw-on-
 * failure convention as lib/services/transactionsService.ts's
 * createLocalTransaction, so callers can keep using
 * `(mutation.error as Error)?.message` regardless of storage mode. */
export async function createLocalCategory(values: { name: string; type: string }): Promise<Category> {
  const outcome = await getStorageProvider().create<Stored<Category>>("categories", { ...values, subcategories: [] } as never);
  if (outcome.status !== "success") throw new Error(outcome.message);
  return outcome.data;
}

export async function createLocalSubcategory(categoryId: string, name: string): Promise<Category> {
  const provider = getStorageProvider();
  const existing = await provider.get<Stored<Category>>("categories", categoryId);
  if (!existing) throw new Error("Category not found");
  const subcategory = { id: newLocalId(), name, categoryId };
  const outcome = await provider.update<Stored<Category>>("categories", categoryId, { subcategories: [...(existing.subcategories ?? []), subcategory] } as never);
  if (outcome.status !== "success") throw new Error(outcome.message);
  return outcome.data;
}

export async function createLocalAccount(name: string): Promise<Account> {
  const outcome = await getStorageProvider().create<Stored<Account>>("accounts", { name } as never);
  if (outcome.status !== "success") throw new Error(outcome.message);
  return outcome.data;
}

export async function updateLocalAccount(id: string, name: string): Promise<Account> {
  const outcome = await getStorageProvider().update<Stored<Account>>("accounts", id, { name } as never);
  if (outcome.status !== "success") throw new Error(outcome.message);
  return outcome.data;
}

export async function createLocalPaymentMethod(name: string): Promise<PaymentMethodType> {
  const outcome = await getStorageProvider().create<Stored<PaymentMethodType>>("paymentMethods", { name } as never);
  if (outcome.status !== "success") throw new Error(outcome.message);
  return outcome.data;
}

export async function updateLocalPaymentMethod(id: string, name: string): Promise<PaymentMethodType> {
  const outcome = await getStorageProvider().update<Stored<PaymentMethodType>>("paymentMethods", id, { name } as never);
  if (outcome.status !== "success") throw new Error(outcome.message);
  return outcome.data;
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