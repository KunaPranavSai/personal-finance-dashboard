"use client";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SessionList } from "@/components/security/SessionList";
import { Monitor } from "lucide-react";

export default function AdminSessionsPage() {
  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6">
      <AdminPageHeader icon={Monitor} title="Sessions" description="Where your administrator account is signed in" />
      <div className="pp-mobile dark mx-auto w-full max-w-3xl" style={{ minHeight: 0, background: "transparent" }}>
        <SessionList />
      </div>
    </main>
  );
}
