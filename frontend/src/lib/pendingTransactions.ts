"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { getQueueOwner, getQueuedMutations, onQueueChange, type QueuedMutation } from "./offlineQueue";
import { onFlushResult } from "./offlineSync";

/**
 * Transactions that are saved on this device but not yet confirmed by Google Drive, as the UI needs to show them.
 *
 * They are always shown SEPARATELY from confirmed records (a strip with a state badge), never merged into the confirmed
 * list, so a pending entry can't be mistaken for a Drive-confirmed one and totals/charts (which come from Drive) are not
 * silently changed. When Drive confirms a create, the server's id is remembered for a short time ("confirmed, list is
 * refreshing"); the row disappears as soon as the refreshed list contains that id, so it is never shown twice.
 */
export type PendingState = "syncing" | "waiting" | "retrying" | "refused" | "confirming";

export interface PendingRow {
  key: string;
  outboxId: string;
  mode: "create" | "edit";
  /** edits: the confirmed record this edit applies to */
  targetId?: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  amount: number;
  date: string;
  state: PendingState;
  reason?: string;
  /** creates only, once Drive confirmed */
  serverId?: string;
  /** the full entry as the user submitted it (re-used to open the edit form on top of pending values) */
  body: Record<string, unknown>;
}

const TX_PATH = /^\/api\/transactions(?:\/([^/?#]+))?$/;

export function rowOf(item: QueuedMutation, offline = false): PendingRow | null {
  if (item.entity !== "income" && item.entity !== "expense") return null;
  const m = TX_PATH.exec(item.path);
  if (!m) return null;
  const b = (item.body ?? {}) as Record<string, unknown>;
  const state: PendingState = item.status === "rejected" ? "refused" : offline ? "waiting" : item.lastError ? "retrying" : "syncing";
  return {
    key: item.id,
    outboxId: item.id,
    mode: m[1] ? "edit" : "create",
    targetId: m[1],
    type: item.entity === "income" ? "INCOME" : "EXPENSE",
    description: typeof b.description === "string" ? b.description : "",
    amount: Number(b.amount) || 0,
    date: typeof b.date === "string" ? b.date : item.createdAt,
    state,
    reason: item.lastError,
    serverId: item.serverId,
    body: b,
  };
}

/** Rows to display: drop a "confirming" create once the refreshed list already contains it (no duplicates). */
export function visibleRows(rows: PendingRow[], knownServerIds: Iterable<string>): PendingRow[] {
  const known = new Set(knownServerIds);
  return rows.filter((r) => !(r.state === "confirming" && r.serverId && known.has(r.serverId)));
}

// ─── "Drive confirmed, list not refreshed yet" memory (process-wide, short-lived) ─────────────────────────────────
const CONFIRMING_MS = 20_000;
const confirming = new Map<string, { row: PendingRow; owner: string | undefined; until: number }>();
const confirmingListeners = new Set<() => void>();
/** Test hook: forget remembered confirmations. */
export const _resetConfirming = () => confirming.clear();
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  onFlushResult((r) => {
    for (const i of r.synced) {
      const row = rowOf(i);
      if (row && row.mode === "create" && i.serverId) confirming.set(i.id, { row: { ...row, state: "confirming", serverId: i.serverId }, owner: i.owner, until: Date.now() + CONFIRMING_MS });
    }
    confirmingListeners.forEach((cb) => cb());
  });
}

export function usePendingTransactions(knownServerIds: string[] = []): PendingRow[] {
  wire();
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [items, setItems] = useState<QueuedMutation[]>([]);
  const [tick, setTick] = useState(0);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const read = () => void getQueuedMutations().then(setItems).catch(() => {});
    read();
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const un1 = onQueueChange(read);
    const bump = () => setTick((t) => t + 1);
    confirmingListeners.add(bump);
    const timer = setInterval(bump, 5000); // expires "confirming" rows even if nothing else changes
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      un1();
      confirmingListeners.delete(bump);
      clearInterval(timer);
    };
  }, []);

  const knownKey = knownServerIds.join("|");
  return useMemo(() => {
    const now = Date.now();
    for (const [k, v] of confirming) if (v.until < now) confirming.delete(k);
    const own = items.filter((i) => uid && i.owner === uid).map((i) => rowOf(i, offline)).filter((r): r is PendingRow => r !== null);
    const done = [...confirming.values()].filter((v) => uid && v.owner === uid).map((v) => v.row); // never another account's entries
    return visibleRows([...own, ...done], knownKey ? knownKey.split("|") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, offline, uid, knownKey, tick]);
}

/** How many entries of this account are not confirmed by Drive yet (pending or refused). Used by the logout guard. */
export async function countUnsynced(uid: string | null): Promise<number> {
  if (!uid) return 0;
  return (await getQueuedMutations()).filter((i) => i.owner === uid).length;
}

/**
 * The values of the newest edit of this transaction that Drive hasn't confirmed yet (or null). An edit form opened on a
 * transaction with a pending edit must start from THOSE values: starting from the stale confirmed record would let a
 * second edit silently overwrite the first one's changes.
 */
export async function pendingEditBody(transactionId: string): Promise<Record<string, unknown> | null> {
  const owner = getQueueOwner();
  if (!owner) return null;
  const mine = (await getQueuedMutations()).filter((i) => i.owner === owner && i.status !== "rejected" && i.method === "PATCH" && i.path === `/api/transactions/${transactionId}`);
  return (mine.at(-1)?.body as Record<string, unknown> | undefined) ?? null;
}
