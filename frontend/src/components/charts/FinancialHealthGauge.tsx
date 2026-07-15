"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";

function scoreColor(score: number) {
  if (score >= 80) return "#1E8449"; // Excellent
  if (score >= 60) return "#0EA5A5"; // Good
  if (score >= 40) return "#F1C40F"; // Fair
  return "#C0392B"; // Poor
}

function scoreLabel(score: number) {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

export function FinancialHealthGauge({ score }: { score: number }) {
  const color = scoreColor(score);
  const data = [
    { name: "score", value: score },
    { name: "remaining", value: 100 - score },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial Health Score</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div className="relative h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={85}
                cornerRadius={6}
              >
                <Cell fill={color} />
                <Cell fill="#E9ECEF" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
            <span className="text-2xl font-bold text-navy dark:text-white">{score}</span>
            <span className="text-xs font-medium" style={{ color }}>
              {scoreLabel(score)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
