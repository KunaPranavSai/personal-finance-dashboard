"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileShell } from "@/components/mobile/MobileShell";
import { HUB_FAMILIES } from "@/lib/moreHub";

export default function MoreFamilyPage({ params }: { params: Promise<{ family: string }> }) {
  const { family } = use(params);
  const f = HUB_FAMILIES.find((x) => x.slug === family);
  if (!f) notFound();

  return (
    <MobileShell title={f.label}>
      <div className="ppm-page-title">
        <h2>{f.label}</h2>
        <p>{f.desc}</p>
      </div>
      <div className="ppm-hub">
        {f.items.map((it) => (
          <Link key={it.href + it.label} href={it.href} className="ppm-card ppm-hub-card">
            <div className="ppm-info">
              <div className="ppm-name">{it.label}</div>
              <div className="ppm-meta">{it.desc}</div>
            </div>
            <span className="ppm-chev" aria-hidden="true">›</span>
          </Link>
        ))}
      </div>
    </MobileShell>
  );
}
