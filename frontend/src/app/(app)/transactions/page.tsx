"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function TransactionsRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/expenses?${qs}` : "/expenses");
  }, [router, searchParams]);

  return null;
}

export default function TransactionsRedirectPage() {
  return (
    <Suspense>
      <TransactionsRedirectContent />
    </Suspense>
  );
}
