"use client";

import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

export type ChartPoint = {
  // Date déjà formatée par le serveur, dans la langue du visiteur.
  date: string;
  value: number;
  // Valeur affichée dans l'infobulle (ex. « 95 % »).
  display: string;
};

type Props = {
  title: string;
  points: ChartPoint[];
  color: string;
  max?: number;
};

// Courbe d'une mesure au fil des dernières courses (PROF-4).
export function ProgressionChart({ title, points, color, max }: Props) {
  return (
    <figure className="progression-chart">
      <figcaption>{title}</figcaption>
      <LineChart responsive data={points} style={{ width: "100%", height: 200 }}>
        <CartesianGrid stroke="var(--border)" strokeOpacity={0.3} vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} minTickGap={24} />
        <YAxis
          width={36}
          allowDecimals={false}
          tick={{ fill: "var(--muted)", fontSize: 11 }}
          domain={[
            (dataMin: number) => Math.max(0, Math.floor((dataMin - 5) / 10) * 10),
            (dataMax: number) => max ?? Math.ceil((dataMax + 5) / 10) * 10,
          ]}
        />
        <Tooltip
          formatter={(_value, _name, item) => [item.payload.display, title]}
          contentStyle={{ background: "var(--surface)", borderColor: "var(--border)" }}
          labelStyle={{ color: "var(--foreground)" }}
        />
        <Line
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          dot={{ r: 3, fill: color }}
          isAnimationActive={false}
        />
      </LineChart>
    </figure>
  );
}
