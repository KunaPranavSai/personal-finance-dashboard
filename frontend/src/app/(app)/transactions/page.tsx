"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsMobile } from "@/lib/DeviceContext";
import { MobileTransactionsView } from "@/components/mobile/MobileTransactionsView";

function TransactionsRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    const qs = searchParams.toString();
    router.replace(qs ? `/expenses?${qs}` : "/expenses");
  }, [router, searchParams, isMobile]);

  if (isMobile) return <MobileTransactionsView initialType="" />;
  return null;
}

export default function TransactionsRedirectPage() {
  return (
    <Suspense>
      <TransactionsRedirectContent />
    </Suspense>
  );
}
