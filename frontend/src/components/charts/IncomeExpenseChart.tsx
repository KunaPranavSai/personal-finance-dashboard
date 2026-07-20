"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { formatCompactCurrency } from "@/lib/format";
import { LineChart as LineChartIcon } from "lucide-react";

interface Point {
  month: string;
  income: number;
  expense: number;
}

export function IncomeExpenseChart({ data }: { data: Point[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs Expense</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState icon={LineChartIcon} title="No Data Available" description="Add transactions to see this trend." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground)" strokeOpacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} />
              <YAxis tickFormatter={(v) => formatCompactCurrency(v)} tick={{ fontSize: 12, fill: "var(--foreground)", fillOpacity: 0.6 }} axisLine={{ stroke: "var(--foreground)", strokeOpacity: 0.15 }} tickLine={false} width={70} />
              <Tooltip formatter={(v: number) => formatCompactCurrency(v)} />
              <Legend wrapperStyle={{ color: "var(--foreground)", fontSize: 12, opacity: 0.8 }} />
              <Line type="monotone" dataKey="income" stroke="#0EA5A5" strokeWidth={2} dot={false} name="Income" />
              <Line type="monotone" dataKey="expense" stroke="#C0392B" strokeWidth={2} dot={false} name="Expense" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
