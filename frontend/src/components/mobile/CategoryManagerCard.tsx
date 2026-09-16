"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MobileSheet } from "./MobileSheet";
import { LoadingCard, EmptyCard } from "./MobileStates";
import type { Category } from "@/types";

type EntryType = "INCOME" | "EXPENSE";

/**
 * Mobile equivalent of the desktop `CategoriesManager`. The backend only
 * exposes CREATE for categories/subcategories (POST /api/categories,
 * POST /api/categories/:id/subcategories) — there is no rename or delete
 * route, so this screen deliberately offers none, matching the desktop
 * page's own read-mostly behavior instead of inventing destructive actions
 * the API can't perform.
 */
export function CategoryManagerCard() {
  const queryClient = useQueryClient();
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<EntryType>("EXPENSE");
  const [subcategoryTarget, setSubcategoryTarget] = useState<Category | null>(null);
  const [subName, setSubName] = useState("");
  const categoryNameRef = useRef<HTMLInputElement>(null);
  const subNameRef = useRef<HTMLInputElement>(null);

  // Focus each sheet's input only once it's actually opened — MobileSheet
  // keeps its children mounted while closed, so bare `autoFocus` would fire
  // (and pop the keyboard) on page load instead of on open.
  useEffect(() => {
    if (categorySheetOpen) categoryNameRef.current?.focus();
  }, [categorySheetOpen]);
  useEffect(() => {
    if (subcategoryTarget) subNameRef.current?.focus();
  }, [subcategoryTarget]);

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ items: Category[] }>("/api/categories"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: "all" });

  const createCategory = useMutation({
    mutationFn: (values: { name: string; type: EntryType }) => api.post<Category>("/api/categories", values),
    onSuccess: () => { invalidate(); setCategorySheetOpen(false); setNewName(""); },
  });

  const createSubcategory = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) => api.post(`/api/categories/${categoryId}/subcategories`, { name }),
    onSuccess: () => { invalidate(); setSubcategoryTarget(null); setSubName(""); },
  });

  const items = data?.items ?? [];

  return (
    <>
      <div className="ppm-page-title" style={{ padding: "0 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>{items.length} categorie(s)</p>
        <button type="button" className="ppm-link-btn" onClick={() => setCategorySheetOpen(true)}>+ Add Category</button>
      </div>

      {isLoading && <LoadingCard lines={3} />}
      {!isLoading && items.length === 0 && <EmptyCard icon="🏷️" title="No categories yet" subtitle="Create categories to organize your transactions." />}
      {!isLoading && items.length > 0 && items.map((c) => (
        <div className="ppm-card" key={c.id} style={{ marginBottom: 10 }}>
          <div className="ppm-budget-head">
            <span className="name">{c.name}</span>
            <span className={`ppm-status ${c.type === "INCOME" ? "under" : "near"}`}>{c.type === "INCOME" ? "Income" : "Expense"}</span>
          </div>
          {c.subcategories.length > 0 && (
            <div className="ppm-filters" style={{ marginBottom: 0 }}>
              {c.subcategories.map((s) => <span className="ppm-chip" key={s.id} style={{ cursor: "default" }}>{s.name}</span>)}
            </div>
          )}
          <button type="button" className="ppm-link-btn" style={{ marginTop: 10 }} onClick={() => setSubcategoryTarget(c)}>+ Add subcategory</button>
        </div>
      ))}

      <MobileSheet open={categorySheetOpen} onClose={() => setCategorySheetOpen(false)} title="New Category">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (newName.trim()) createCategory.mutate({ name: newName.trim(), type: newType }); }}>
          <div className="ppm-type-toggle">
            <button type="button" className={newType === "EXPENSE" ? "on" : ""} onClick={() => setNewType("EXPENSE")}>Expense</button>
            <button type="button" className={newType === "INCOME" ? "on" : ""} onClick={() => setNewType("INCOME")}>Income</button>
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-cat-name">Name<span className="req">*</span></label>
            <input id="ppm-cat-name" ref={categoryNameRef} value={newName} maxLength={50} onChange={(e) => setNewName(e.target.value)} />
          </div>
          {createCategory.isError && <div className="err" style={{ marginBottom: 10 }}>{(createCategory.error as Error)?.message}</div>}
          <div className="ppm-sheet-actions">
            <button type="submit" className="ppm-sheet-submit" disabled={createCategory.isPending}>{createCategory.isPending ? "Saving…" : "Add Category"}</button>
            <button type="button" className="ppm-sheet-cancel" onClick={() => setCategorySheetOpen(false)} disabled={createCategory.isPending}>Cancel</button>
          </div>
        </form>
      </MobileSheet>

      <MobileSheet open={Boolean(subcategoryTarget)} onClose={() => setSubcategoryTarget(null)} title={`Add subcategory to ${subcategoryTarget?.name ?? ""}`}>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (subcategoryTarget && subName.trim()) createSubcategory.mutate({ categoryId: subcategoryTarget.id, name: subName.trim() }); }}>
          <div className="ppm-field">
            <label htmlFor="ppm-subcat-name">Name<span className="req">*</span></label>
            <input id="ppm-subcat-name" ref={subNameRef} value={subName} maxLength={50} onChange={(e) => setSubName(e.target.value)} />
          </div>
          {createSubcategory.isError && <div className="err" style={{ marginBottom: 10 }}>{(createSubcategory.error as Error)?.message}</div>}
          <div className="ppm-sheet-actions">
            <button type="submit" className="ppm-sheet-submit" disabled={createSubcategory.isPending}>{createSubcategory.isPending ? "Saving…" : "Add Subcategory"}</button>
            <button type="button" className="ppm-sheet-cancel" onClick={() => setSubcategoryTarget(null)} disabled={createSubcategory.isPending}>Cancel</button>
          </div>
        </form>
      </MobileSheet>
    </>
  );
}
