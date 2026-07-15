"use client";

import { useCallback } from "react";
import { useSettingsContext } from "./SettingsContext";
import { formatCurrency, formatCompactCurrency, formatDateCustom } from "./format";

export function useFormatCurrency() {
  const { settings } = useSettingsContext();
  return useCallback(
    (amount: number) => formatCurrency(amount, settings.currency),
    [settings.currency]
  );
}

export function useFormatCompactCurrency() {
  const { settings } = useSettingsContext();
  return useCallback(
    (amount: number) => formatCompactCurrency(amount, settings.currency),
    [settings.currency]
  );
}

export function useFormatDate() {
  const { settings } = useSettingsContext();
  return useCallback(
    (date: string | Date) => formatDateCustom(date, settings.dateFormat),
    [settings.dateFormat]
  );
}
