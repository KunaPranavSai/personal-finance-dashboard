import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { toUserMessage } from "./errorMessage";
import { useToast } from "@/components/ui/Toast";

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
type Cache = { items: NotificationItem[] };

/** Labels for every type the server actually creates (security, welcome_tour, info) plus the reserved alert types. */
const LABELS: Record<string, string> = {
  security: "Security",
  welcome_tour: "Getting started",
  info: "Update",
  budget_alert: "Budget alert",
  bill_due: "Bill due",
  goal_progress: "Goal progress",
  insight: "Insight",
};
export const notifLabel = (type: string) => LABELS[type] ?? "Notification";

export type DayBucket = "Today" | "Yesterday" | "Earlier";

export function dayBucket(iso: string, now = new Date()): DayBucket {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((start(now) - start(d)) / 86_400_000);
  return diffDays <= 0 ? "Today" : diffDays === 1 ? "Yesterday" : "Earlier";
}

/** Newest-first input stays newest-first inside each bucket; empty buckets are dropped. */
export function groupByDay(items: NotificationItem[], now = new Date()): { label: DayBucket; items: NotificationItem[] }[] {
  const out: Record<DayBucket, NotificationItem[]> = { Today: [], Yesterday: [], Earlier: [] };
  for (const n of items) out[dayBucket(n.createdAt, now)].push(n);
  return (["Today", "Yesterday", "Earlier"] as DayBucket[]).filter((l) => out[l].length).map((l) => ({ label: l, items: out[l] }));
}

/**
 * Notification mutations. Mark-read / mark-all / delete are reversible UI state, so they are
 * optimistic: snapshot -> apply -> on failure restore the snapshot and say so -> always reconcile
 * with the server afterwards. Clear-all is destructive and bulk, so it waits for confirmation.
 */
export function useNotificationActions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = ["notifications"];

  const optimistic = (apply: (items: NotificationItem[], arg: string | void) => NotificationItem[]) => ({
    onMutate: async (arg: string | void) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Cache>(key);
      if (prev) qc.setQueryData<Cache>(key, { items: apply(prev.items, arg) });
      return { prev };
    },
    onError: (err: unknown, _arg: string | void, ctx?: { prev?: Cache }) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast(`${toUserMessage(err)} Your change was undone.`, "error");
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: key }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}/read`),
    ...optimistic((items, id) => items.map((n) => (n.id === id ? { ...n, read: true } : n))),
  });
  const markAllRead = useMutation({
    mutationFn: () => api.post("/api/notifications/mark-all-read"),
    ...optimistic((items) => items.map((n) => ({ ...n, read: true }))),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/notifications/${id}`),
    ...optimistic((items, id) => items.filter((n) => n.id !== id)),
  });
  const clearAll = useMutation({
    mutationFn: () => api.delete("/api/notifications"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (err) => toast(toUserMessage(err), "error"),
  });

  return { markRead, markAllRead, remove, clearAll };
}
