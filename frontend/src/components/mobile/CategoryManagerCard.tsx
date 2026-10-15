"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import { ConfirmSheet } from "./ConfirmSheet";
import { useCategories, createLocalCategory, createLocalSubcategory } from "@/lib/reference";
import { MobileSheet } from "./MobileSheet";
import { LoadingCard, EmptyCard } from "./MobileStates";
import { Tag } from "lucide-react";
import type { Category } from "@/types";

type EntryType = "INCOME" | "EXPENSE";

/**
 * Mobile equivalent of the desktop `CategoriesManager`: create, add subcategory, and delete. A category that
 * transactions or budgets still use cannot be deleted (server and device-only alike); the sheet shows what to
 * reassign instead of failing silently.
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

  const { data, isLoading } = useCategories();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: "all" });

  const createCategory = useMutation({
    mutationFn: (values: { name: string; type: EntryType }) =>
      getStorageMode() === "local" ? createLocalCategory(values) : api.post<Category>("/api/categories", values),
    onSuccess: () => { invalidate(); setCategorySheetOpen(false); setNewName(""); },
  });

  const createSubcategory = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      getStorageMode() === "local" ? createLocalSubcategory(categoryId, name) : api.post(`/api/categories/${categoryId}/subcategories`, { name }),
    onSuccess: () => { invalidate(); setSubcategoryTarget(null); setSubName(""); },
  });

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      if (getStorageMode() === "local") {
        const outcome = await getStorageProvider().remove("categories", id);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return api.delete(`/api/categories/${id}`);
    },
    onSuccess: () => { invalidate(); setDeleteTarget(null); },
  });

  const items = data?.items ?? [];

  return (
    <>
      <div className="ppm-page-title" style={{ padding: "0 0 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 13, color: "var(--ppm-text-dim)" }}>{items.length} categorie(s)</p>
        <button type="button" className="ppm-link-btn" onClick={() => setCategorySheetOpen(true)}>+ Add Category</button>
      </div>

      {isLoading && <LoadingCard lines={3} />}
      {!isLoading && items.length === 0 && <EmptyCard icon={<Tag size={22} />} title="No categories yet" subtitle="Create categories to organize your transactions." />}
      {!isLoading && items.length > 0 && items.map((c) => (
        <div className="ppm-card" key={c.id} style={{ marginBottom: 10 }}>
          <div className="ppm-budget-head">
            <span className="name">{c.name}</span>
            <span className={`ppm-status ${c.type === "INCOME" ? "under" : "near"}`}>{c.type === "INCOME" ? "Income" : "Expense"}</span>
          </div>
          {(c.subcategories ?? []).length > 0 && (
            <div className="ppm-filters" style={{ marginBottom: 0 }}>
              {(c.subcategories ?? []).map((s) => <span className="ppm-chip" key={s.id} style={{ cursor: "default" }}>{s.name}</span>)}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <button type="button" className="ppm-link-btn" onClick={() => setSubcategoryTarget(c)}>+ Add subcategory</button>
            <button type="button" className="ppm-link-btn" style={{ color: "var(--ppm-critical)" }} onClick={() => { deleteCategory.reset(); setDeleteTarget(c); }}>Delete</button>
          </div>
        </div>
      ))}

      <ConfirmSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteCategory.mutate(deleteTarget.id)}
        title="Delete category"
        message={`Delete "${deleteTarget?.name ?? ""}"? It can only be deleted if no transactions or budgets use it.`}
        isPending={deleteCategory.isPending}
        errorMessage={deleteCategory.isError ? (deleteCategory.error as Error).message : null}
      />

      <MobileSheet open={categorySheetOpen} onClose={() => setCategorySheetOpen(false)} title="New Category">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (newName.trim()) createCategory.mutate({ name: newName.trim(), type: newType }); }}>
          <div className="ppm-type-toggle">
            <button type="button" className={newType === "EXPENSE" ? "on" : ""} onClick={() => setNewType("EXPENSE")}>Expense</button>
            <button type="button" className={newType === "INCOME" ? "on" : ""} onClick={() => setNewType("INCOME")}>Income</button>
          </div>
          <div className="ppm-field">
            <label htmlFor="ppm-cat-name">Name</label>
            <input id="ppm-cat-name" ref={categoryNameRef} value={newName} maxLength={50} onChange={(e) => setNewName(e.target.value)} />
          </div>
          {createCategory.isError && <div role="alert" className="err" style={{ marginBottom: 10 }}>{(createCategory.error as Error)?.message}</div>}
          <div className="ppm-sheet-actions">
            <button type="submit" className="ppm-sheet-submit" disabled={createCategory.isPending}>{createCategory.isPending ? "Saving…" : "Add Category"}</button>
            <button type="button" className="ppm-sheet-cancel" onClick={() => setCategorySheetOpen(false)} disabled={createCategory.isPending}>Cancel</button>
          </div>
        </form>
      </MobileSheet>

      <MobileSheet open={Boolean(subcategoryTarget)} onClose={() => setSubcategoryTarget(null)} title={`Add subcategory to ${subcategoryTarget?.name ?? ""}`}>
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); if (subcategoryTarget && subName.trim()) createSubcategory.mutate({ categoryId: subcategoryTarget.id, name: subName.trim() }); }}>
          <div className="ppm-field">
            <label htmlFor="ppm-subcat-name">Name</label>
            <input id="ppm-subcat-name" ref={subNameRef} value={subName} maxLength={50} onChange={(e) => setSubName(e.target.value)} />
          </div>
          {createSubcategory.isError && <div role="alert" className="err" style={{ marginBottom: 10 }}>{(createSubcategory.error as Error)?.message}</div>}
          <div className="ppm-sheet-actions">
            <button type="submit" className="ppm-sheet-submit" disabled={createSubcategory.isPending}>{createSubcategory.isPending ? "Saving…" : "Add Subcategory"}</button>
            <button type="button" className="ppm-sheet-cancel" onClick={() => setSubcategoryTarget(null)} disabled={createSubcategory.isPending}>Cancel</button>
          </div>
        </form>
      </MobileSheet>
    </>
  );
}
