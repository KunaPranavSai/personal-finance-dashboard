"use client";

/**
 * Penny Pilot Admin design system. Everything admin pages need lives here so screens look and behave the same:
 * buttons, fields, switches, tabs, panels, badges, tables with pagination, modals/drawers/confirmations, and the
 * loading / empty / error states. Styles are in styles/admin.css (scoped to .ad-root).
 * Admin pages must import from here and never from the user-app component folders.
 */
import Link from "next/link";
import {
  ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes,
  forwardRef, useCallback, useEffect, useId, useRef, useState,
} from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Info, Loader2, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/format";

/* ─────────────── Page header ─────────────── */
export function PageHeader({ title, description, actions, crumbs }: {
  title: string; description?: ReactNode; actions?: ReactNode; crumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="ad-pagehead">
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav className="ad-crumb" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={c.label} className="inline-flex items-center gap-1.5">
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 && <ChevronRight size={12} aria-hidden="true" />}
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ─────────────── Button ─────────────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost"; size?: "md" | "sm"; loading?: boolean; icon?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "default", size = "md", loading, icon, className, children, disabled, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={cn("ad-btn", variant !== "default" && variant, size === "sm" && "sm", icon && "icon", className)} {...rest}>
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

/* ─────────────── Fields ─────────────── */
interface FieldShell { label: string; hint?: ReactNode; error?: string | null; hideLabel?: boolean }
function Shell({ id, label, hint, error, hideLabel, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={cn("ad-label", hideLabel && "ad-sr")}>{label}</label>
      {children}
      {error ? <p id={`${id}-err`} className="ad-err" role="alert">{error}</p> : hint ? <p id={`${id}-hint`} className="ad-hint">{hint}</p> : null}
    </div>
  );
}
const describe = (id: string, error?: string | null, hint?: ReactNode) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldShell>(function TextField(
  { label, hint, error, hideLabel, className, id: idProp, ...rest }, ref,
) {
  const auto = useId(); const id = idProp ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input ref={ref} id={id} className={cn("ad-input", className)} aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest} />
    </Shell>
  );
});

export function SelectField({ label, hint, error, hideLabel, className, id: idProp, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & FieldShell) {
  const auto = useId(); const id = idProp ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <select id={id} className={cn("ad-select", className)} aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest}>{children}</select>
    </Shell>
  );
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldShell>(function TextAreaField(
  { label, hint, error, hideLabel, className, id: idProp, ...rest }, ref,
) {
  const auto = useId(); const id = idProp ?? auto;
  return (
    <Shell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <textarea ref={ref} id={id} className={cn("ad-textarea", className)} aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest} />
    </Shell>
  );
});

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <span className="ad-switch-hit">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="ad-switch" onClick={() => onChange(!checked)} />
    </span>
  );
}

/* ─────────────── Tabs ─────────────── */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (n === null) return;
    e.preventDefault();
    const next = tabs[(n + tabs.length) % tabs.length];
    onChange(next.id);
    (e.currentTarget.parentElement?.querySelector(`[data-tab="${next.id}"]`) as HTMLElement | null)?.focus();
  };
  return (
    <div className="ad-tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.id} type="button" role="tab" data-tab={t.id} id={`tab-${t.id}`} aria-selected={value === t.id} aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1} className="ad-tab" onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)}>{t.label}</button>
      ))}
    </div>
  );
}
export const TabPanel = ({ id, active, children }: { id: string; active: boolean; children: ReactNode }) =>
  active ? <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`}>{children}</div> : null;

/* ─────────────── Panel, Stat ─────────────── */
export function Panel({ title, actions, children, padded = true, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; padded?: boolean; className?: string }) {
  return (
    <section className={cn("ad-panel", className)}>
      {(title || actions) && <div className="ad-panel-h"><h2>{title}</h2>{actions}</div>}
      <div className={padded ? "ad-panel-b" : undefined}>{children}</div>
    </section>
  );
}

const TONE: Record<string, string> = { green: "var(--ad-green)", amber: "var(--ad-amber)", red: "var(--ad-red)", accent: "var(--ad-accent)", blue: "var(--ad-blue)" };
export function Stat({ label, value, hint, href, icon: Icon, tone }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; icon?: LucideIcon; tone?: keyof typeof TONE }) {
  const body = (
    <>
      <div className="l">{Icon && <Icon size={14} aria-hidden="true" style={{ color: tone ? TONE[tone] : undefined }} />}{label}</div>
      <div className="v" style={tone ? { color: TONE[tone] } : undefined}>{value}</div>
      {hint && <div className="h">{hint}</div>}
    </>
  );
  return href ? <Link href={href} className="ad-panel ad-stat">{body}</Link> : <div className="ad-panel ad-stat">{body}</div>;
}

/* ─────────────── Badges: only statuses the backend really has ─────────────── */
type Tone = "green" | "amber" | "red" | "blue" | "accent" | "";
const BADGES: Record<string, Record<string, [string, Tone]>> = {
  status: { ACTIVE: ["Active", "green"], SUSPENDED: ["Suspended", "red"] },
  role: { SUPER_ADMIN: ["Super Admin", "accent"], ADMIN: ["Admin", "blue"], USER: ["User", ""] },
  account: { verified: ["Verified", "green"], explorer: ["Explorer", "amber"] },
  migration: {
    NEW_USER: ["New user", ""], DRIVE_SETUP_REQUIRED: ["Drive setup needed", "amber"], MIGRATION_REQUIRED: ["Migration required", "amber"],
    MIGRATION_IN_PROGRESS: ["In progress", "blue"], MIGRATION_COMPLETED: ["Completed", "green"], MIGRATION_FAILED: ["Failed", "red"],
  },
  email: { sent: ["Sent", "green"], failed: ["Failed", "red"], skipped: ["Skipped", ""], on: ["On", "green"], off: ["Off", ""], locked: ["Always on", "blue"] },
  health: { ok: ["Healthy", "green"], configured: ["Configured", "green"], error: ["Issue", "red"], missing: ["Not configured", "red"], unknown: ["Unknown", ""] },
};
export function StatusBadge({ kind, value }: { kind: keyof typeof BADGES; value: string | null | undefined }) {
  if (!value) return <span className="ad-faint">—</span>;
  const [label, tone] = BADGES[kind]?.[value] ?? [value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()), ""];
  return <span className={cn("ad-badge", tone)}>{label}</span>;
}
export const Badge = ({ tone = "", children }: { tone?: Tone; children: ReactNode }) => <span className={cn("ad-badge", tone)}>{children}</span>;

/* ─────────────── Feedback states ─────────────── */
export function Alert({ tone = "info", children, title }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode; title?: string }) {
  const Icon = tone === "info" || tone === "success" ? Info : AlertTriangle;
  return (
    <div className={cn("ad-alert", tone !== "info" && tone)} role={tone === "error" ? "alert" : "status"}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{title && <strong className="block">{title}</strong>}{children}</div>
    </div>
  );
}
export const Skeleton = ({ h = 16, w = "100%", className }: { h?: number; w?: number | string; className?: string }) =>
  <div className={cn("ad-skel", className)} style={{ height: h, width: w }} aria-hidden="true" />;

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} h={20} className="mb-3" />)}
    </div>
  );
}
export function EmptyState({ icon: Icon = Info, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="ad-empty">
      <Icon size={28} className="mx-auto opacity-60" aria-hidden="true" />
      <h3>{title}</h3>
      {description && <p className="m-0">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
export function ErrorState({ message = "Something went wrong loading this.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="ad-empty" role="alert">
      <AlertTriangle size={28} className="mx-auto" style={{ color: "var(--ad-red)" }} aria-hidden="true" />
      <h3>Couldn&apos;t load</h3>
      <p className="m-0">{message}</p>
      {onRetry && <div className="mt-3"><Button size="sm" onClick={onRetry}>Try again</Button></div>}
    </div>
  );
}

/* ─────────────── Modal / Drawer / Confirm ─────────────── */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Accessible dialog: role=dialog, aria-modal, labelled, focus trapped, Escape closes, focus returns, page scroll locked. */
export function Modal({ open, onClose, title, description, children, footer, variant = "dialog", wide, dismissable = true }: {
  open: boolean; onClose: () => void; title: string; description?: ReactNode; children?: ReactNode; footer?: ReactNode;
  variant?: "dialog" | "drawer"; wide?: boolean; dismissable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId(); const descId = useId();
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = ref.current;
    const items = () => Array.from(el?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (el?.querySelector<HTMLElement>("[data-autofocus]") ?? items().find((n) => !n.hasAttribute("data-close")) ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== "Tab") return;
      const f = items();
      if (f.length === 0) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); document.body.style.overflow = prevOverflow; prev?.focus?.(); };
  }, [open, dismissable]);

  if (!open) return null;
  return (
    <div className={cn("ad-overlay", variant === "drawer" && "drawer")} onMouseDown={(e) => { if (dismissable && e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} tabIndex={-1} className={cn("ad-dialog", wide && "wide")}>
        <div className="ad-dialog-h">
          <div className="min-w-0">
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descId} className="ad-muted m-0 mt-1 text-[13px]">{description}</p>}
          </div>
          {dismissable && <Button variant="ghost" size="sm" icon data-close onClick={onClose} aria-label="Close dialog"><X size={18} aria-hidden="true" /></Button>}
        </div>
        {children && <div className="ad-dialog-b">{children}</div>}
        {footer && <div className="ad-dialog-f">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Confirmation for any destructive or privileged action. The button carries an explicit label ("Delete user", never
 * "OK"), names the target, and can require typing a phrase first. `onConfirm` must call a real endpoint; a thrown
 * error is shown inside the dialog and the dialog stays open.
 */
export function ConfirmDialog({ open, onClose, title, description, target, confirmLabel, danger, typeToConfirm, onConfirm, children }: {
  open: boolean; onClose: () => void; title: string; description: ReactNode; target?: string; confirmLabel: string; danger?: boolean;
  typeToConfirm?: string; onConfirm: () => Promise<unknown>; children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  useEffect(() => { if (open) { setBusy(false); setErr(null); setTyped(""); } }, [open]);
  const run = useCallback(async () => {
    setBusy(true); setErr(null);
    try { await onConfirm(); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : "That didn't work. Please try again."); } finally { setBusy(false); }
  }, [onConfirm, onClose]);
  const blocked = Boolean(typeToConfirm) && typed !== typeToConfirm;
  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title={title} dismissable={!busy}
      footer={<>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} loading={busy} disabled={blocked} onClick={run}>{confirmLabel}</Button>
      </>}>
      <p className="m-0 ad-muted">{description}</p>
      {target && <p className="mt-3 mb-0 rounded-lg px-3 py-2" style={{ background: "var(--ad-surface-2)" }}><span className="ad-faint">Target: </span><strong className="break-all">{target}</strong></p>}
      {children && <div className="mt-3">{children}</div>}
      {typeToConfirm && <div className="mt-3"><TextField label={`Type "${typeToConfirm}" to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" data-autofocus /></div>}
      {err && <div className="mt-3"><Alert tone="error">{err}</Alert></div>}
    </Modal>
  );
}

/* ─────────────── DataTable + Pagination ─────────────── */
export interface Column<T> {
  key: string; header: string; render: (row: T) => ReactNode; sortKey?: string; primary?: boolean; hideLabelOnCard?: boolean; align?: "right";
}
export interface SortState { sort: string; dir: "asc" | "desc" }

export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, empty, onRowClick, sort, onSort, caption }: {
  columns: Column<T>[]; rows: T[] | undefined; rowKey: (r: T) => string; loading?: boolean; error?: string | null; onRetry?: () => void;
  empty?: ReactNode; onRowClick?: (r: T) => void; sort?: SortState; onSort?: (key: string) => void; caption: string;
}) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading && !rows) return <SkeletonRows />;
  if (!rows || rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return (
    <div className="ad-tablewrap" aria-busy={loading || undefined} style={loading ? { opacity: 0.6 } : undefined}>
      <table className="ad-table">
        <caption className="ad-sr">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort && c.sortKey === sort.sort;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined} style={c.align ? { textAlign: c.align } : undefined}>
                  {c.sortKey && onSort ? (
                    <button type="button" onClick={() => onSort(c.sortKey!)}>
                      {c.header}{active && (sort!.dir === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} data-click={onRowClick ? "true" : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.hideLabelOnCard || c.primary ? undefined : c.header} data-primary={c.primary ? "true" : undefined} style={c.align ? { textAlign: c.align } : undefined}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPage, noun = "results" }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="ad-pager" aria-label="Pagination">
      <span aria-live="polite">{total === 0 ? `No ${noun}` : `${from}–${to} of ${total} ${noun}`}</span>
      <span className="inline-flex items-center gap-2">
        <Button size="sm" icon onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /></Button>
        <span>Page {page} of {pages}</span>
        <Button size="sm" icon onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page"><ChevronRight size={16} aria-hidden="true" /></Button>
      </span>
    </nav>
  );
}

/** Debounces a fast-changing value (search boxes) so a request isn't fired per keystroke. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/* ─────────────── Action menu (row "..." menus) ─────────────── */
export interface MenuAction { label: string; onSelect?: () => void; href?: string; danger?: boolean; disabled?: boolean; hint?: string }
export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    wrap.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); btn.current?.focus(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(wrap.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };
  return (
    <div ref={wrap} className="relative inline-block" onKeyDown={onKey} onClick={(e) => e.stopPropagation()}>
      <Button ref={btn} size="sm" icon variant="ghost" aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>⋯</span>
      </Button>
      {open && (
        <div role="menu" aria-label={label} className="ad-panel" style={{ position: "absolute", right: 0, top: "100%", zIndex: 50, minWidth: 210, padding: 6, boxShadow: "var(--ad-shadow)" }}>
          {actions.map((a) => {
            const cls = cn("ad-btn ghost", a.danger && "danger");
            const style = { width: "100%", justifyContent: "flex-start", border: 0 } as const;
            return a.href && !a.disabled ? (
              <Link key={a.label} role="menuitem" href={a.href} className={cls} style={style} onClick={() => setOpen(false)}>{a.label}</Link>
            ) : (
              <button key={a.label} type="button" role="menuitem" aria-disabled={a.disabled || undefined} title={a.hint} className={cls} style={{ ...style, opacity: a.disabled ? 0.45 : 1, cursor: a.disabled ? "not-allowed" : "pointer" }}
                onClick={() => { if (a.disabled) return; setOpen(false); a.onSelect?.(); }}>{a.label}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────── Password field with show / hide ─────────────── */
export const PasswordField = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & FieldShell>(function PasswordField(
  { label, hint, error, hideLabel, className, id: idProp, ...rest }, ref,
) {
  const auto = useId(); const id = idProp ?? auto;
  const [shown, setShown] = useState(false);
  return (
    <Shell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <div className="relative">
        <input ref={ref} id={id} type={shown ? "text" : "password"} className={cn("ad-input", className)} style={{ paddingRight: 64 }} aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest} />
        <button type="button" className="ad-btn ghost sm" style={{ position: "absolute", right: 2, top: 2 }} aria-pressed={shown} onClick={() => setShown((s) => !s)}>{shown ? "Hide" : "Show"}</button>
      </div>
    </Shell>
  );
});
