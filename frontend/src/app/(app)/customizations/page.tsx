"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { api } from "@/lib/api";
import { Category } from "@/types";
import { Landmark, CreditCard, Tags, Plus, Pencil, Trash2, Banknote } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const nameSchema = z.object({ name: z.string().min(1, "Name is required").max(50) });
type NameForm = z.infer<typeof nameSchema>;

const TABS = [
  { id: "accounts", label: "Wallets", icon: Landmark },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "payment-methods", label: "Money Sources", icon: CreditCard },
] as const;

function CustomizationsContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(
    (searchParams.get("tab") as (typeof TABS)[number]["id"]) ?? "accounts"
  );

  return (
    <>
      <Topbar title="Customizations" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex gap-2 border-b border-black/5 dark:border-white/10">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t.id ? "border-b-2 border-teal text-teal" : "text-navy/50 hover:text-navy dark:text-white/50"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </div>

          {tab === "accounts" && (
            <EntityManager
              title="Wallets"
              queryKey="accounts"
              apiPath="/api/accounts"
              itemLabel="wallet"
              addLabel="Add Wallet"
              icon={Banknote}
              emptyTitle="No wallets yet"
              emptyDescription="Create your first wallet to start tracking expenses and income against it."
            />
          )}

          {tab === "categories" && <CategoriesManager />}

          {tab === "payment-methods" && (
            <EntityManager
              title="Money Sources"
              queryKey="payment-methods"
              apiPath="/api/payment-methods"
              itemLabel="money source"
              addLabel="Add Money Source"
              icon={CreditCard}
              emptyTitle="No money sources yet"
              emptyDescription="Create money sources like Cash, UPI, or Credit Card to tag your expenses and income."
            />
          )}
        </div>
      </main>
    </>
  );
}

export default function CustomizationsPage() {
  return (
    <Suspense>
      <CustomizationsContent />
    </Suspense>
  );
}

interface NamedEntity {
  id: string;
  name: string;
}

function EntityManager({
  title,
  queryKey,
  apiPath,
  itemLabel,
  addLabel,
  icon: Icon,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  queryKey: string;
  apiPath: string;
  itemLabel: string;
  addLabel: string;
  icon: typeof Landmark;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<NamedEntity | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => api.get<{ items: NamedEntity[] }>(apiPath),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey] });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post<NamedEntity>(apiPath, { name }),
    onSuccess: () => { invalidate(); setShowModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<NamedEntity>(`${apiPath}/${id}`, { name }),
    onSuccess: () => { invalidate(); setShowModal(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`${apiPath}/${id}`),
    onSuccess: invalidate,
  });

  const items = data?.items ?? [];

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-navy/50 dark:text-white/50">{items.length} {itemLabel}(s)</p>
        <Button size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>
          <Plus className="h-4 w-4" /> {addLabel}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} action={<Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> {addLabel}</Button>} />
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-black/5 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10">
                      <Icon className="h-4 w-4 text-teal" />
                    </div>
                    <span className="text-sm font-medium text-navy dark:text-white">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditing(item); setShowModal(true); }}
                      className="rounded-lg p-1.5 text-navy/40 hover:bg-black/5 dark:text-white/40 dark:hover:bg-white/10"
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete "${item.name}"?`)) deleteMutation.mutate(item.id); }}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      aria-label={`Delete ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {deleteMutation.isError && (
            <p className="mt-3 text-xs text-red-600">{(deleteMutation.error as Error)?.message ?? "Failed to delete"}</p>
          )}
        </CardContent>
      </Card>

      {showModal && (
        <NameFormModal
          title={editing ? `Edit ${itemLabel}` : `New ${itemLabel}`}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={(name) => editing ? updateMutation.mutate({ id: editing.id, name }) : createMutation.mutate(name)}
          isPending={createMutation.isPending || updateMutation.isPending}
          error={(createMutation.error ?? updateMutation.error) as Error | null}
        />
      )}
    </>
  );
}

function NameFormModal({ title, editing, onClose, onSave, isPending, error }: {
  title: string;
  editing: NamedEntity | null;
  onClose: () => void;
  onSave: (name: string) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: editing?.name ?? "" },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <FocusTrap active={true}>
      <div className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-xl dark:bg-navy-dark" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy dark:text-white">{title}</h2>
        <form onSubmit={handleSubmit((d) => onSave(d.name))} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Name</label>
            <input {...register("name")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          {error && <p className="text-xs text-red-600">{error.message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : editing ? "Save" : "Create"}</Button>
          </div>
        </form>
      </div>
      </FocusTrap>
    </div>
  );
}

const categorySchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  type: z.enum(["INCOME", "EXPENSE"]),
});
type CategoryForm = z.infer<typeof categorySchema>;

const subcategorySchema = z.object({ name: z.string().min(1, "Name is required").max(50) });
type SubcategoryForm = z.infer<typeof subcategorySchema>;

function CategoriesManager() {
  const queryClient = useQueryClient();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [subcategoryTarget, setSubcategoryTarget] = useState<Category | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<{ items: Category[] }>("/api/categories"),
  });

  const createCategory = useMutation({
    mutationFn: (values: CategoryForm) => api.post<Category>("/api/categories", values),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); setShowCategoryModal(false); },
  });

  const createSubcategory = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      api.post(`/api/categories/${categoryId}/subcategories`, { name }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categories"] }); setSubcategoryTarget(null); },
  });

  const items = data?.items ?? [];

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-navy/50 dark:text-white/50">{items.length} categorie(s)</p>
        <Button size="sm" onClick={() => setShowCategoryModal(true)}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={Tags} title="No categories yet" description="Create categories to organize your transactions." action={<Button onClick={() => setShowCategoryModal(true)}><Plus className="h-4 w-4" /> Add Category</Button>} />
          ) : (
            <div className="space-y-3">
              {items.map((c) => (
                <div key={c.id} className="rounded-lg border border-black/5 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-navy dark:text-white">{c.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.type === "INCOME" ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-500"}`}>
                        {c.type}
                      </span>
                    </div>
                    <button
                      onClick={() => setSubcategoryTarget(c)}
                      className="text-xs font-medium text-teal hover:underline"
                    >
                      + Add subcategory
                    </button>
                  </div>
                  {c.subcategories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.subcategories.map((s) => (
                        <span key={s.id} className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-navy/70 dark:bg-white/5 dark:text-white/70">{s.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showCategoryModal && (
        <CategoryFormModal
          onClose={() => setShowCategoryModal(false)}
          onSave={(values) => createCategory.mutate(values)}
          isPending={createCategory.isPending}
          error={createCategory.error as Error | null}
        />
      )}

      {subcategoryTarget && (
        <SubcategoryFormModal
          category={subcategoryTarget}
          onClose={() => setSubcategoryTarget(null)}
          onSave={(name) => createSubcategory.mutate({ categoryId: subcategoryTarget.id, name })}
          isPending={createSubcategory.isPending}
          error={createSubcategory.error as Error | null}
        />
      )}
    </>
  );
}

function CategoryFormModal({ onClose, onSave, isPending, error }: {
  onClose: () => void;
  onSave: (values: CategoryForm) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
    defaultValues: { type: "EXPENSE" },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="New category" onClick={onClose}>
      <FocusTrap active={true}>
      <div className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-xl dark:bg-navy-dark" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy dark:text-white">New Category</h2>
        <form onSubmit={handleSubmit(onSave)} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Name</label>
            <input {...register("name")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Type</label>
            <select {...register("type")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-dark dark:text-white">
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error.message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Create"}</Button>
          </div>
        </form>
      </div>
      </FocusTrap>
    </div>
  );
}

function SubcategoryFormModal({ category, onClose, onSave, isPending, error }: {
  category: Category;
  onClose: () => void;
  onSave: (name: string) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const { register, handleSubmit, formState: { errors } } = useForm<SubcategoryForm>({
    resolver: zodResolver(subcategorySchema),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`New subcategory under ${category.name}`} onClick={onClose}>
      <FocusTrap active={true}>
      <div className="w-full max-w-sm rounded-xl2 bg-white p-6 shadow-xl dark:bg-navy-dark" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy dark:text-white">Add Subcategory to &ldquo;{category.name}&rdquo;</h2>
        <form onSubmit={handleSubmit((d) => onSave(d.name))} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-navy/60 dark:text-white/60">Name</label>
            <input {...register("name")} className="mt-1 w-full rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" autoFocus />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>
          {error && <p className="text-xs text-red-600">{error.message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving..." : "Add"}</Button>
          </div>
        </form>
      </div>
      </FocusTrap>
    </div>
  );
}
