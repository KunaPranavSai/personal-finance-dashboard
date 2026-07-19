"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Image from "next/image";

import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";
import { Profile } from "@/types";
import { User, Pencil, Save, X, ImageIcon, UserCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/components/ui/Toast";
import { CURRENCIES, TIMEZONES, LANGUAGES, useProfile } from "@/lib/reference";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  phone: z.string().max(20, "Phone too long").optional().or(z.literal("")),
  occupation: z.string().max(100).optional().or(z.literal("")),
  monthlyIncome: z.coerce.number().nonnegative("Must be non-negative"),
  country: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  currency: z.string().length(3),
  timezone: z.string().min(1),
  language: z.string().length(2),
  financialGoal: z.string().max(200).optional().or(z.literal("")),
  riskAppetite: z.string().optional(),
  investmentExperience: z.string().optional(),
  emergencyFundTarget: z.coerce.number().nonnegative().optional(),
  bio: z.string().max(500).optional().or(z.literal("")),
  avatar: z.string().nullable().optional(),
  theme: z.enum(["light", "dark"]).optional(),
  dateFormat: z.string().optional(),
  weekStartsOn: z.enum(["monday", "sunday"]).optional(),
  financialPreferences: z.object({
    savingsGoal: z.number().min(0).max(100).optional(),
    emergencyFundMonths: z.number().min(0).optional(),
    riskTolerance: z.string().optional(),
    budgetMethod: z.string().optional(),
  }).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    budgetAlerts: z.boolean().optional(),
    billReminders: z.boolean().optional(),
    goalUpdates: z.boolean().optional(),
    insights: z.boolean().optional(),
  }).optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

const RISK_APPETITE_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];

const INVESTMENT_EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { data: profile, isLoading } = useProfile();

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile ?? {
      name: "", email: "", phone: "", occupation: "", monthlyIncome: 0,
      country: "India", state: "", city: "",
      currency: "INR", timezone: "Asia/Kolkata", language: "en",
      financialGoal: "", riskAppetite: "moderate", investmentExperience: "beginner",
      emergencyFundTarget: 0, bio: "", avatar: null,
      theme: "light", dateFormat: "DD-MM-YYYY", weekStartsOn: "monday",
      financialPreferences: { savingsGoal: 20, emergencyFundMonths: 6, riskTolerance: "moderate", budgetMethod: "envelope" },
      notifications: { email: true, push: true, budgetAlerts: true, billReminders: true, goalUpdates: true, insights: true },
    },
  });

  const avatarUrl = watch("avatar");
  const watchAll = watch();

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<Profile>("/api/profile", data),
    onSuccess: (data) => {
      reset(data as unknown as ProfileForm);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast("Profile updated successfully", "success");
    },
    onError: () => {
      toast("Failed to update profile", "error");
    },
  });

  const onSubmit = handleSubmit((data) => {
    updateMutation.mutate(data as unknown as Record<string, unknown>);
  });

  const handleCancel = () => {
    setEditing(false);
    reset();
    setImageError(false);
  };

  return (
    <>
      <Topbar title="Profile" />
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-3xl">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl2 bg-black/5 dark:bg-white/5" />)}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-6">
              <Card>
                <CardContent className="flex flex-wrap items-center gap-6 pt-6">
                  {editing && avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Profile"
                      className="h-20 w-20 rounded-full object-cover border-2 border-teal/30"
                      width={80}
                      height={80}
                      unoptimized
                      onError={() => setImageError(true)}
                    />
                  ) : profile?.avatar && !imageError ? (
                    <Image
                      src={profile.avatar}
                      alt="Profile"
                      className="h-20 w-20 rounded-full object-cover border-2 border-teal/30"
                      width={80}
                      height={80}
                      unoptimized
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal/10">
                      {editing ? (
                        <ImageIcon className="h-10 w-10 text-teal" />
                      ) : (
                        <User className="h-10 w-10 text-teal" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-navy dark:text-white truncate">{watchAll.name || "User"}</h2>
                    <p className="text-sm text-navy/50 dark:text-white/50 truncate">{watchAll.email || ""}</p>
                    {watchAll.occupation && <p className="text-xs text-navy/40 dark:text-white/40">{watchAll.occupation}</p>}
                  </div>
                  {!editing ? (
                    <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                      <Pencil className="h-4 w-4" /> Edit Profile
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              {editing && (
                <Card>
                  <CardHeader><CardTitle>Profile Image URL</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Image URL</label>
                      <input {...register("avatar")} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/10" placeholder="https://example.com/avatar.jpg" />
                      <p className="mt-1 text-xs text-navy/40 dark:text-white/40">Paste a URL to an image. Preview updates immediately.</p>
                      {errors.avatar && <p className="mt-1 text-xs text-red-500">{errors.avatar.message}</p>}
                    </div>
                    {avatarUrl && !imageError && (
                      <div className="flex items-center gap-3">
                        <Image src={avatarUrl} alt="Preview" className="h-16 w-16 rounded-full object-cover border" width={64} height={64} unoptimized onError={() => setImageError(true)} />
                        <span className="text-xs text-emerald-600">Preview active</span>
                      </div>
                    )}
                    {imageError && avatarUrl && (
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-16 w-16 text-navy/30" />
                        <span className="text-xs text-red-500">Invalid or broken URL — showing fallback</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Full Name *</label>
                      <input {...register("name")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                      {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Email *</label>
                      <input type="email" {...register("email")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                      {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Phone</label>
                      <input {...register("phone")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Occupation</label>
                      <input {...register("occupation")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Monthly Income</label>
                    <input type="number" {...register("monthlyIncome", { valueAsNumber: true })} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Country</label>
                      <input {...register("country")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">State</label>
                      <input {...register("state")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">City</label>
                      <input {...register("city")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Currency</label>
                      <select {...register("currency")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10 dark:bg-navy-dark dark:text-white">
                        {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Timezone</label>
                      <select {...register("timezone")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10 dark:bg-navy-dark dark:text-white">
                        {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Language</label>
                      <select {...register("language")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10 dark:bg-navy-dark dark:text-white">
                        {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Financial Profile</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Financial Goal</label>
                    <input {...register("financialGoal")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" placeholder="e.g. Buy a home, retire early..." />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Risk Appetite</label>
                      <select {...register("riskAppetite")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10 dark:bg-navy-dark dark:text-white">
                        {RISK_APPETITE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Investment Experience</label>
                      <select {...register("investmentExperience")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10 dark:bg-navy-dark dark:text-white">
                        {INVESTMENT_EXPERIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Emergency Fund Target</label>
                    <input type="number" {...register("emergencyFundTarget", { valueAsNumber: true })} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Bio</label>
                    <textarea {...register("bio")} disabled={!editing} rows={3} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" placeholder="Tell us about yourself..." />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Financial Preferences</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Savings Goal (%)</label>
                      <input type="number" {...register("financialPreferences.savingsGoal", { valueAsNumber: true })} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Emergency Fund (months)</label>
                      <input type="number" {...register("financialPreferences.emergencyFundMonths", { valueAsNumber: true })} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Risk Tolerance</label>
                      <select {...register("financialPreferences.riskTolerance")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10 dark:bg-navy-dark dark:text-white">
                        <option value="low">Low</option>
                        <option value="moderate">Moderate</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-navy/50 dark:text-white/50 mb-1">Budget Method</label>
                      <select {...register("financialPreferences.budgetMethod")} disabled={!editing} className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm disabled:opacity-60 dark:border-white/10 dark:bg-navy-dark dark:text-white">
                        <option value="envelope">Envelope</option>
                        <option value="zero-based">Zero-Based</option>
                        <option value="50-30-20">50/30/20</option>
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {editing && (
                <div className="sticky bottom-0 flex justify-end gap-2 bg-white/80 py-3 backdrop-blur dark:bg-navy-dark/80">
                  <Button type="button" variant="ghost" onClick={handleCancel}>
                    <X className="h-4 w-4" /> Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save className="h-4 w-4" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              )}
            </form>
          )}
        </div>
      </main>
    </>
  );
}
