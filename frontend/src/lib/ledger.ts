// Unified activity ledger: merges every financial record into one chronological stream.
// Pure and dependency-free so the identical file also runs in the browser for "This Device Only"
// mode (frontend/src/lib/ledger.ts is a byte-for-byte copy — keep the two in sync).

export type LedgerType = "income" | "expense" | "bill" | "budget" | "investment" | "goal" | "saving";
export const LEDGER_TYPES: LedgerType[] = ["income", "expense", "bill", "budget", "investment", "goal", "saving"];

type Rec = { id: string; createdAt?: string; [key: string]: unknown };

export interface LedgerItem {
  id: string;
  type: LedgerType;
  title: string;
  amount: number;
  /** Sort key: the record's own day + the time-of-day it was created. */
  occurredAt: string;
  sourceId: string;
  /** Raw record, so the UI can open the matching edit sheet without another fetch. */
  record: Rec;
}

export interface LedgerSources {
  transactions?: Rec[];
  bills?: Rec[];
  budgets?: Rec[];
  investments?: Rec[];
  goals?: Rec[];
  categories?: Rec[];
}

const DAY_MS = 86400000;

/** Event day taken from `day`, clock time from `createdAt` (date-only fields carry no time). */
function stamp(day: unknown, createdAt: unknown): string {
  const d = new Date(String(day ?? createdAt ?? 0));
  const c = new Date(String(createdAt ?? day ?? 0));
  if (Number.isNaN(d.getTime())) return new Date(0).toISOString();
  if (Number.isNaN(c.getTime())) return d.toISOString();
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Date(dayStart + (((c.getTime() % DAY_MS) + DAY_MS) % DAY_MS)).toISOString();
}

const num = (v: unknown) => Number(v) || 0;

export function buildLedger(src: LedgerSources): LedgerItem[] {
  const catName = new Map((src.categories ?? []).map((c) => [c.id, String(c.name ?? "")]));
  const out: LedgerItem[] = [];
  const add = (type: LedgerType, r: Rec, title: string, amount: number, day: unknown) =>
    out.push({ id: `${type}:${r.id}`, type, title, amount, occurredAt: stamp(day, r.createdAt), sourceId: r.id, record: r });

  for (const t of src.transactions ?? []) add(t.type === "INCOME" ? "income" : "expense", t, String(t.description ?? ""), num(t.amount), t.date);
  for (const b of src.bills ?? []) add("bill", b, String(b.name ?? "Bill"), num(b.amount), b.createdAt);
  for (const b of src.budgets ?? []) add("budget", b, `${catName.get(String(b.categoryId)) || "Category"} budget · ${b.periodKey ?? ""}`.trim(), num(b.amount), b.createdAt);
  for (const i of src.investments ?? []) add("investment", i, String(i.instrument ?? "Investment"), num(i.investedAmount), i.purchaseDate ?? i.createdAt);
  for (const g of src.goals ?? []) add("goal", g, String(g.name ?? "Goal"), num(g.targetAmount), g.createdAt);
  return out.sort((a, b) => (a.occurredAt === b.occurredAt ? (a.id < b.id ? 1 : -1) : a.occurredAt < b.occurredAt ? 1 : -1));
}

export interface LedgerQuery {
  types?: LedgerType[];
  from?: string; // YYYY-MM-DD, inclusive
  to?: string; // YYYY-MM-DD, inclusive
  min?: number;
  max?: number;
  limit?: number;
  cursor?: string | null;
}

export const encodeCursor = (i: LedgerItem) => `${i.occurredAt}|${i.id}`;

/** Filters the (already newest-first) ledger and returns one page plus the cursor for the next. */
export function queryLedger(all: LedgerItem[], q: LedgerQuery): { items: LedgerItem[]; nextCursor: string | null } {
  const limit = Math.min(100, Math.max(1, q.limit ?? 20));
  const types = q.types && q.types.length ? new Set(q.types) : null;
  const fromMs = q.from ? Date.parse(`${q.from}T00:00:00.000Z`) : null;
  const toMs = q.to ? Date.parse(`${q.to}T00:00:00.000Z`) + DAY_MS : null;
  const filtered = all.filter((i) => {
    if (types && !types.has(i.type)) return false;
    const t = Date.parse(i.occurredAt);
    if (fromMs !== null && t < fromMs) return false;
    if (toMs !== null && t >= toMs) return false;
    if (q.min !== undefined && i.amount < q.min) return false;
    if (q.max !== undefined && i.amount > q.max) return false;
    return true;
  });
  let start = 0;
  if (q.cursor) {
    const idx = filtered.findIndex((i) => encodeCursor(i) === q.cursor);
    start = idx >= 0 ? idx + 1 : filtered.findIndex((i) => encodeCursor(i) < q.cursor!);
    if (start < 0) start = filtered.length;
  }
  const items = filtered.slice(start, start + limit);
  const nextCursor = start + limit < filtered.length && items.length ? encodeCursor(items[items.length - 1]) : null;
  return { items, nextCursor };
}

if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
  const rows = buildLedger({
    transactions: [
      { id: "a", type: "INCOME", description: "Salary", amount: 100, date: "2026-09-22", createdAt: "2026-09-22T09:42:00.000Z" },
      { id: "b", type: "EXPENSE", description: "Tea", amount: 10, date: "2026-09-22", createdAt: "2026-09-22T08:15:00.000Z" },
    ],
    bills: [{ id: "c", name: "Rent", amount: 500, createdAt: "2026-09-21T07:30:00.000Z" }],
  });
  console.assert(rows.map((r) => r.sourceId).join() === "a,b,c", "newest first");
  const p1 = queryLedger(rows, { limit: 2 });
  console.assert(p1.items.length === 2 && p1.nextCursor !== null, "first page");
  const p2 = queryLedger(rows, { limit: 2, cursor: p1.nextCursor });
  console.assert(p2.items.length === 1 && p2.nextCursor === null && p2.items[0].sourceId === "c", "append page");
  console.assert(queryLedger(rows, { types: ["bill"] }).items.length === 1, "type filter");
  console.assert(queryLedger(rows, { min: 50 }).items.length === 2, "amount filter");
}
