"use client";

import { useCategories, useAccounts } from "@/lib/reference";

export function DataInit() {
  useCategories();
  useAccounts();

  return null;
}