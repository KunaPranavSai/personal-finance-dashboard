const currencyLocaleMap: Record<string, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
  AUD: "en-AU",
  CAD: "en-CA",
  SGD: "en-SG",
};

export function formatCurrency(amount: number, currency = "INR"): string {
  if (amount == null || Number.isNaN(Number(amount))) return `${currency === "INR" ? "₹" : "$"}0`;
  const locale = currencyLocaleMap[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
}

export function formatCurrencyDecimals(amount: number, currency = "INR"): string {
  if (amount == null || Number.isNaN(Number(amount))) return `${currency === "INR" ? "₹" : "$"}0.00`;
  const locale = currencyLocaleMap[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function formatCompactCurrency(amount: number, currency = "INR"): string {
  const abs = Math.abs(amount);
  const symbol = currency === "INR" ? "₹" : "$";
  if (abs >= 1_00_00_000) return `${symbol}${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${symbol}${(amount / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${symbol}${(amount / 1_000).toFixed(1)} K`;
  return formatCurrency(amount, currency);
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDateIN(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatDateCustom(date: string | Date, format: string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  const yyyy = String(d.getFullYear());
  return format
    .replace("DD", dd)
    .replace("MM", mm)
    .replace("YYYY", yyyy)
    .replace("YY", yy);
}

export function financialYearOf(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `FY ${startYear}-${endYearShort}`;
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
