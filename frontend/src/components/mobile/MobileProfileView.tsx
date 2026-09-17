"use client";

import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile/MobileShell";
import { LoadingCard } from "@/components/mobile/MobileStates";
import { api } from "@/lib/api";
import { useProfile, CURRENCIES, TIMEZONES, LANGUAGES } from "@/lib/reference";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { AVATAR_OPTIONS } from "@/lib/avatars";
import type { Profile } from "@/types";

type FormState = Pick<Profile, "name" | "email" | "phone" | "occupation" | "monthlyIncome" | "country" | "state" | "city" | "currency" | "timezone" | "language" | "bio" | "avatar">;

const EMPTY: FormState = { name: "", email: "", phone: "", occupation: "", monthlyIncome: 0, country: "", state: "", city: "", currency: "INR", timezone: "Asia/Kolkata", language: "en", bio: "", avatar: null };

/**
 * Mobile "Profile" screen — a full-screen form (not a bottom sheet, since
 * this is a destination in its own right, same as the desktop /profile
 * page) covering the core identity/financial-context fields via the same
 * PATCH /api/profile the desktop page uses. "avatar" stores a path into the
 * fixed set of bundled avatar images (see @/lib/avatars) rather than an
 * arbitrary URL — there's no file-upload or external avatar service in this
 * app, so the picker below is the only way to change it. The nested
 * financialPreferences/notifications sub-objects (already covered by
 * Settings, linked from More) are not reproduced here.
 */
export function MobileProfileView() {
  const { data: profile, isLoading } = useProfile();
  const { updateUserName } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  useEffect(() => {
    if (profile) setForm({ ...EMPTY, ...profile });
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch<Profile>("/api/profile", data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (data.name) updateUserName(data.name);
      setEditing(false);
      toast("Profile updated", "success");
    },
    onError: () => toast("Failed to update profile", "error"),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const handleCancel = () => {
    if (profile) setForm({ ...EMPTY, ...profile });
    setEditing(false);
  };

  return (
    <MobileShell title="Profile">
      <div className="ppm-page-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Profile</h2>
          <p>Your account &amp; financial context</p>
        </div>
        {!editing && !isLoading && <button type="button" className="ppm-link-btn" onClick={() => setEditing(true)}>Edit</button>}
      </div>

      {isLoading && <LoadingCard lines={6} />}

      {!isLoading && (
        <form onSubmit={handleSubmit}>
          <div className="ppm-card">
            <div className="ppm-section-label">Identity</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              {form.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.avatar} alt="" style={{ width: 56, height: 56, borderRadius: 16, objectFit: "cover", border: "1px solid var(--ppm-border)" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="ppm-avatar">{(form.name || "?").slice(0, 1).toUpperCase()}</div>
              )}
              {!editing && <div style={{ fontWeight: 700 }}>{form.name || "Your Profile"}</div>}
            </div>
            {editing && (
              <div className="ppm-field">
                <label id="ppm-p-avatar-label">Avatar</label>
                <div role="group" aria-labelledby="ppm-p-avatar-label" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                  {AVATAR_OPTIONS.map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => set("avatar", src)}
                      aria-label="Select avatar"
                      aria-pressed={form.avatar === src}
                      style={{
                        padding: 2, borderRadius: "50%", aspectRatio: "1 / 1",
                        border: `2px solid ${form.avatar === src ? "var(--ppm-accent)" : "transparent"}`,
                        background: "none", cursor: "pointer",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="ppm-field">
              <label htmlFor="ppm-p-name">Name<span className="req">*</span></label>
              <input id="ppm-p-name" value={form.name} disabled={!editing} maxLength={100} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="ppm-field">
              <label htmlFor="ppm-p-email">Email<span className="req">*</span></label>
              <input id="ppm-p-email" type="email" value={form.email} disabled={!editing} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="ppm-field-row">
              <div className="ppm-field">
                <label htmlFor="ppm-p-phone">Phone</label>
                <input id="ppm-p-phone" value={form.phone} disabled={!editing} maxLength={20} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div className="ppm-field">
                <label htmlFor="ppm-p-occ">Occupation</label>
                <input id="ppm-p-occ" value={form.occupation} disabled={!editing} maxLength={100} onChange={(e) => set("occupation", e.target.value)} />
              </div>
            </div>
          </div>

          <div className="ppm-card" style={{ marginTop: 14 }}>
            <div className="ppm-section-label">Location</div>
            <div className="ppm-field-row">
              <div className="ppm-field">
                <label htmlFor="ppm-p-country">Country</label>
                <input id="ppm-p-country" value={form.country} disabled={!editing} maxLength={100} onChange={(e) => set("country", e.target.value)} />
              </div>
              <div className="ppm-field">
                <label htmlFor="ppm-p-state">State</label>
                <input id="ppm-p-state" value={form.state} disabled={!editing} maxLength={100} onChange={(e) => set("state", e.target.value)} />
              </div>
            </div>
            <div className="ppm-field">
              <label htmlFor="ppm-p-city">City</label>
              <input id="ppm-p-city" value={form.city} disabled={!editing} maxLength={100} onChange={(e) => set("city", e.target.value)} />
            </div>
          </div>

          <div className="ppm-card" style={{ marginTop: 14 }}>
            <div className="ppm-section-label">Financial Context</div>
            <div className="ppm-field">
              <label htmlFor="ppm-p-income">Monthly Income (₹)</label>
              <input id="ppm-p-income" inputMode="decimal" value={form.monthlyIncome} disabled={!editing} onChange={(e) => set("monthlyIncome", Number(e.target.value) || 0)} />
            </div>
            <div className="ppm-field-row">
              <div className="ppm-field">
                <label htmlFor="ppm-p-currency">Currency</label>
                <select id="ppm-p-currency" value={form.currency} disabled={!editing} onChange={(e) => set("currency", e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="ppm-field">
                <label htmlFor="ppm-p-lang">Language</label>
                <select id="ppm-p-lang" value={form.language} disabled={!editing} onChange={(e) => set("language", e.target.value)}>
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
            <div className="ppm-field">
              <label htmlFor="ppm-p-tz">Timezone</label>
              <select id="ppm-p-tz" value={form.timezone} disabled={!editing} onChange={(e) => set("timezone", e.target.value)}>
                {TIMEZONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="ppm-card" style={{ marginTop: 14 }}>
            <div className="ppm-section-label">Bio</div>
            <div className="ppm-field">
              <textarea aria-label="Bio" value={form.bio} disabled={!editing} maxLength={500} onChange={(e) => set("bio", e.target.value)} placeholder="Tell us a little about your financial journey" />
            </div>
          </div>

          {editing && (
            <div className="ppm-sheet-actions" style={{ position: "static", background: "none", marginTop: 16 }}>
              <button type="submit" className="ppm-sheet-submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save Changes"}
              </button>
              <button type="button" className="ppm-sheet-cancel" onClick={handleCancel} disabled={mutation.isPending}>Cancel</button>
            </div>
          )}
        </form>
      )}
    </MobileShell>
  );
}
