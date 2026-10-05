"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/AppTopbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/PpCard";
import { Button } from "@/components/ui/PpButton";
import { usePpToast } from "@/components/ui/PpToast";
import { usePpConfirm } from "@/components/ui/PpConfirm";
import { EmptyState } from "@/components/ui/EmptyState";
import { FocusTrap } from "@/components/ui/FocusTrap";
import { api } from "@/lib/api";
import { getStorageMode, getStorageProvider } from "@/lib/storage";
import type { StorageCollection } from "@/lib/storage";
import { useCategories, createLocalCategory, createLocalSubcategory } from "@/lib/reference";
import { Category } from "@/types";
import { Landmark, CreditCard, Tags, Plus, Pencil, Trash2, Banknote } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileShell } from "@/components/mobile/MobileShell";
import { EntityManagerCard } from "@/components/mobile/EntityManagerCard";
import { CategoryManagerCard } from "@/components/mobile/CategoryManagerCard";

const nameSchema = z.object({ name: z.string().min(1, "Name is required").max(50) });
type NameForm = z.infer<typeof nameSchema>;

const TABS = [
  { id: "accounts", label: "Wallets", icon: Landmark },
  { id: "categories", label: "Categories", icon: Tags },
  { id: "payment-methods", label: "Money Sources", icon: CreditCard },
] as const;

function CustomizationsContent() {
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(
    (searchParams.get("tab") as (typeof TABS)[number]["id"]) ?? "accounts"
  );

  if (isMobile) {
    return (
      <MobileShell title="Manage">
        <div className="ppm-page-title">
          <h2>Manage</h2>
          <p>Wallets, categories &amp; money sources</p>
        </div>

        <div className="ppm-filters" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ppm-chip${tab === t.id ? " on" : ""}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "accounts" && (
          <EntityManagerCard
            queryKey="accounts" apiPath="/api/accounts" localCollection="accounts" itemLabel="wallet" addLabel="Add Wallet" icon={<Landmark size={18} />}
            emptyTitle="No wallets yet" emptyDescription="Create your first wallet to start tracking expenses and income against it."
          />
        )}
        {tab === "categories" && <CategoryManagerCard />}
        {tab === "payment-methods" && (
          <EntityManagerCard
            queryKey="payment-methods" apiPath="/api/payment-methods" localCollection="paymentMethods" itemLabel="money source" addLabel="Add Money Source" icon={<CreditCard size={18} />}
            emptyTitle="No money sources yet" emptyDescription="Create money sources like Cash, UPI, or Credit Card to tag your expenses and income."
          />
        )}
      </MobileShell>
    );
  }

  return (
    <>
      <Topbar title="Customizations" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6 2xl:px-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex gap-2 border-b border-pp-border" role="tablist" aria-label="Customization sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`flex min-h-[40px] items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t.id ? "border-b-2 border-pp-accent text-pp-accent" : "text-pp-text-dim hover:text-pp-text/50"
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
              localCollection="accounts"
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
              localCollection="paymentMethods"
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
  [key: string]: unknown;
}

function EntityManager({
  title,
  queryKey,
  apiPath,
  localCollection,
  itemLabel,
  addLabel,
  icon: Icon,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  queryKey: string;
  apiPath: string;
  localCollection: StorageCollection;
  itemLabel: string;
  addLabel: string;
  icon: typeof Landmark;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const queryClient = useQueryClient();
  const ppToast = usePpToast();
  const confirmDialog = usePpConfirm();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<NamedEntity | null>(null);
  const isLocal = getStorageMode() === "local";

  const { data, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () =>
      isLocal
        ? getStorageProvider().list<NamedEntity & { createdAt: string; updatedAt: string }>(localCollection).then((items) => ({ items }))
        : api.get<{ items: NamedEntity[] }>(apiPath),
  });

  // refetchType: "all" — see TransactionFormModal.tsx for why the default (refetch only
  // "active" queries) isn't reliably picking up this query after a mutation in this app shell.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey], refetchType: "all" });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (isLocal) {
        const outcome = await getStorageProvider().create(localCollection, { name });
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return api.post<NamedEntity>(apiPath, { name });
    },
    onMutate: () => ({ handle: ppToast.start(`Saving ${itemLabel}…`) }),
    onSuccess: (_result, _values, context) => { invalidate(); setShowModal(false); context?.handle.success(`${itemLabel} added`); },
    onError: (_err, _values, context) => { context?.handle.error(`Couldn't save ${itemLabel} — try again`); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      if (isLocal) {
        const outcome = await getStorageProvider().update(localCollection, id, { name });
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return api.patch<NamedEntity>(`${apiPath}/${id}`, { name });
    },
    onMutate: () => ({ handle: ppToast.start(`Updating ${itemLabel}…`) }),
    onSuccess: (_result, _values, context) => { invalidate(); setShowModal(false); setEditing(null); context?.handle.success(`${itemLabel} updated`); },
    onError: (_err, _values, context) => { context?.handle.error(`Couldn't update ${itemLabel} — try again`); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (isLocal) {
        const outcome = await getStorageProvider().remove(localCollection, id);
        if (outcome.status !== "success") throw new Error(outcome.message);
        return outcome.data;
      }
      return api.delete(`${apiPath}/${id}`);
    },
    onMutate: () => ({ handle: ppToast.start(`Removing ${itemLabel}…`) }),
    onSuccess: (_data, _id, context) => { invalidate(); context?.handle.success(`${itemLabel} deleted`); },
    onError: (_err, _id, context) => { context?.handle.error(`Couldn't delete ${itemLabel} — try again`); },
  });

  const items = data?.items ?? [];

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-pp-text-dim">{items.length} {itemLabel}(s)</p>
        <Button size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>
          <Plus className="h-4 w-4" /> {addLabel}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-pp-surface-2" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} action={<Button onClick={() => setShowModal(true)}><Plus className="h-4 w-4" /> {addLabel}</Button>} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-pp-border px-4 py-3 ">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pp-accent/10">
                      <Icon className="h-4 w-4 text-pp-accent" />
                    </div>
                    <span className="truncate text-sm font-medium text-pp-text">{item.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => { setEditing(item); setShowModal(true); }}
                      className="rounded-lg p-1.5 text-pp-text-dim hover:bg-pp-surface-2"
                      aria-label={`Edit ${item.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={async () => { if (await confirmDialog({ message: `Delete "${item.name}"?` })) deleteMutation.mutate(item.id); }}
                      className="rounded-lg p-1.5 text-vulcanico hover:bg-vulcanico/10 dark:hover:bg-vulcanico/20"
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
            <p className="mt-3 text-xs text-vulcanico">{(deleteMutation.error as Error)?.message ?? "Failed to delete"}</p>
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
      <div className="w-full max-w-sm rounded-xl2 bg-pp-surface p-6 shadow-xl " onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-pp-text">{title}</h2>
        <form onSubmit={handleSubmit((d) => onSave(d.name))} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-pp-text-dim">Name</label>
            <input {...register("name")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm text-pp-text " autoFocus />
            {errors.name && <p className="mt-1 text-xs text-vulcanico">{errors.name.message}</p>}
          </div>
          {error && <p className="text-xs text-vulcanico">{error.message}</p>}
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
  const ppToast = usePpToast();
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [subcategoryTarget, setSubcategoryTarget] = useState<Category | null>(null);

  const { data, isLoading } = useCategories();

  const createCategory = useMutation({
    mutationFn: (values: CategoryForm) =>
      getStorageMode() === "local" ? createLocalCategory(values) : api.post<Category>("/api/categories", values),
    onMutate: () => ({ handle: ppToast.start("Saving category…") }),
    onSuccess: (_result, _values, context) => {
      queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: "all" });
      setShowCategoryModal(false);
      context?.handle.success("Category added");
    },
    onError: (_err, _values, context) => { context?.handle.error("Couldn't save category — try again"); },
  });

  const createSubcategory = useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: string; name: string }) =>
      getStorageMode() === "local"
        ? createLocalSubcategory(categoryId, name)
        : api.post(`/api/categories/${categoryId}/subcategories`, { name }),
    onMutate: () => ({ handle: ppToast.start("Saving subcategory…") }),
    onSuccess: (_result, _values, context) => {
      queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: "all" });
      setSubcategoryTarget(null);
      context?.handle.success("Subcategory added");
    },
    onError: (_err, _values, context) => { context?.handle.error("Couldn't save subcategory — try again"); },
  });

  const items = data?.items ?? [];

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-pp-text-dim">{items.length} categorie(s)</p>
        <Button size="sm" onClick={() => setShowCategoryModal(true)}>
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-pp-surface-2" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={Tags} title="No categories yet" description="Create categories to organize your transactions." action={<Button onClick={() => setShowCategoryModal(true)}><Plus className="h-4 w-4" /> Add Category</Button>} />
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {items.map((c) => (
                <div key={c.id} className="rounded-lg border border-pp-border px-4 py-3 ">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-pp-text">{c.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.type === "INCOME" ? "bg-mantis/10 text-mantis" : "bg-vulcanico/10 text-vulcanico"}`}>
                        {c.type}
                      </span>
                    </div>
                    <button
                      onClick={() => setSubcategoryTarget(c)}
                      className="text-xs font-medium text-pp-accent hover:underline"
                    >
                      + Add subcategory
                    </button>
                  </div>
                  {c.subcategories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.subcategories.map((s) => (
                        <span key={s.id} className="rounded-full bg-pp-surface-2 px-2 py-0.5 text-xs text-pp-text-dim ">{s.name}</span>
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
      <div className="w-full max-w-sm rounded-xl2 bg-pp-surface p-6 shadow-xl " onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-pp-text">New Category</h2>
        <form onSubmit={handleSubmit(onSave)} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-pp-text-dim">Name</label>
            <input {...register("name")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm text-pp-text " autoFocus />
            {errors.name && <p className="mt-1 text-xs text-vulcanico">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-pp-text-dim">Type</label>
            <select {...register("type")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm ">
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </div>
          {error && <p className="text-xs text-vulcanico">{error.message}</p>}
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
      <div className="w-full max-w-sm rounded-xl2 bg-pp-surface p-6 shadow-xl " onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-pp-text">Add Subcategory to &ldquo;{category.name}&rdquo;</h2>
        <form onSubmit={handleSubmit((d) => onSave(d.name))} className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-pp-text-dim">Name</label>
            <input {...register("name")} className="mt-1 w-full rounded-lg border border-pp-border px-3 py-2 text-sm text-pp-text " autoFocus />
            {errors.name && <p className="mt-1 text-xs text-vulcanico">{errors.name.message}</p>}
          </div>
          {error && <p className="text-xs text-vulcanico">{error.message}</p>}
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
