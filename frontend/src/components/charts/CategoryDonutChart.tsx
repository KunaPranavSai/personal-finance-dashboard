"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { formatCompactCurrency } from "@/lib/format";
import { PieChart as PieChartIcon } from "lucide-react";

const COLORS = ["#0EA5A5", "#1F2A44", "#F1C40F", "#E67E22", "#7D3C98", "#2471A3", "#C0392B", "#1E8449"];

interface Slice {
  category: string;
  total: number;
}

export function CategoryDonutChart({ data }: { data: Slice[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Category-wise Expense</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState icon={PieChartIcon} title="No Data Available" description="Add expenses to see the category breakdown." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={data} dataKey="total" nameKey="category" innerRadius={60} outerRadius={95} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCompactCurrency(v)} />
              <Legend wrapperStyle={{ color: "var(--foreground)", fontSize: 12, opacity: 0.8 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
