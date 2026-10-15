"use client";

import { useTranslations } from "next-intl";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import type { RaceResult } from "@/lib/socket-messages";

type Props = { results: RaceResult[]; userId: string };

// Couleurs des autres coureurs, réutilisées au-delà de 8 ; le joueur garde l'orange de l'accent.
const COLORS = ["#1a5fd0", "#0d9488", "#7c3aed", "#db2777", "#65a30d", "#0891b2", "#ca8a04", "#64748b"];

// Fin de course : MPM de chaque coureur à chaque seconde, tous sur le même graphique (RES-03).
export function WpmChart({ results, userId }: Props) {
  const t = useTranslations("WpmChart");
  const seconds = Math.max(0, ...results.map((result) => result.wpmSeries.length));
  // Une ligne par seconde ; un coureur qui a fini n'a plus de valeur, sa courbe s'arrête là.
  const rows = Array.from({ length: seconds }, (_, index) => ({
    second: index + 1,
    ...Object.fromEntries(results.map((result) => [result.id, result.wpmSeries[index]])),
  }));
  const others = results.filter((result) => result.id !== userId);
  const color = (id: string) =>
    id === userId ? "var(--accent)" : COLORS[others.findIndex((result) => result.id === id) % COLORS.length];

  return (
    <section aria-labelledby="wpm-chart-title" className="mt-5">
      <h2 id="wpm-chart-title" className="text-xl font-semibold">
        {t("title")}
      </h2>
      {seconds === 0 ? (
        <p className="description mt-3">{t("tooShort")}</p>
      ) : (
        <LineChart responsive data={rows} style={{ width: "100%", height: 260, marginTop: 16 }}>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.3} vertical={false} />
          <XAxis
            dataKey="second"
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickFormatter={(second: number) => t("seconds", { value: second })}
            minTickGap={24}
          />
          <YAxis width={36} allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip
            labelFormatter={(second) => t("seconds", { value: Number(second) })}
            formatter={(value) => t("wpmValue", { value: Number(value) })}
            contentStyle={{ background: "var(--surface)", borderColor: "var(--border)" }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {results.map((result) => (
            <Line
              key={result.id}
              dataKey={result.id}
              name={result.username}
              stroke={color(result.id)}
              strokeWidth={result.id === userId ? 3 : 1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      )}
    </section>
  );
}
