"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { passwordProblem, passwordRuleHint } from "@/lib/zodHelpers";

/** The administrator's minimum password length (public setting). Defaults to 8 until it loads or if the call fails. */
export function usePasswordPolicy() {
  const q = useQuery({
    queryKey: ["password-policy"],
    queryFn: () => api.get<{ passwordMinLength?: number }>("/api/public/settings"),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const min = q.data?.passwordMinLength ?? 8;
  return { min, hint: passwordRuleHint(min), problem: (pw: string) => passwordProblem(pw, min) };
}
