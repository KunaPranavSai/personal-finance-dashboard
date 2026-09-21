"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileShell } from "@/components/mobile/MobileShell";
import { EntityManagerCard } from "@/components/mobile/EntityManagerCard";
import { Landmark } from "lucide-react";

export default function AccountsRedirectPage() {
  const router = useRouter();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    router.replace("/customizations?tab=accounts");
  }, [router, isMobile]);

  if (isMobile) {
    return (
      <MobileShell title="Manage">
        <div className="ppm-page-title">
          <h2>Wallets</h2>
          <p>Wallets, categories &amp; money sources</p>
        </div>
        <EntityManagerCard
          queryKey="accounts" apiPath="/api/accounts" localCollection="accounts" itemLabel="wallet" addLabel="Add Wallet" icon={<Landmark size={18} />}
          emptyTitle="No wallets yet" emptyDescription="Create your first wallet to start tracking expenses and income against it."
        />
      </MobileShell>
    );
  }

  return null;
}
