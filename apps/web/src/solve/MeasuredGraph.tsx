import { fmtMs } from "./solve";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface Series {
  key: string;
  label: string;
  color: string;
  points: { n: number; steps?: number; ms: number }[];
  dashed?: boolean;
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/**
 * Measured work against n on log-log axes: on these, O(n) is a straight line
 * at 45°, O(n²) twice as steep, and O(2ⁿ) bends upwards.
 */
export default function MeasuredGraph({ series, metric }: { series: Series[]; metric: "steps" | "ms" }) {
  const rows = new Map<number, Record<string, number>>();
  for (const s of series)
    for (const p of s.points) {
      const v = metric === "steps" ? p.steps : p.ms;
      if (v === undefined || v <= 0) continue;
      const row = rows.get(p.n) ?? { n: p.n };
      row[s.key] = v;
      rows.set(p.n, row);
    }
  const data = [...rows.values()].sort((a, b) => a.n - b.n);
  if (!data.length) return null;
  return (
    <div className="measured-graph">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 14, bottom: 8, left: 4 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="n" type="number" scale="log" domain={["dataMin", "dataMax"]} stroke="var(--muted)" tick={{ fontSize: 12 }} tickFormatter={(v: number) => compact.format(v)} allowDataOverflow />
          <YAxis
            type="number"
            scale="log"
            domain={["dataMin", "dataMax"]}
            stroke="var(--muted)"
            tick={{ fontSize: 12 }}
            width={52}
            tickFormatter={(v: number) => (metric === "ms" ? fmtMs(v) : compact.format(v))}
            allowDataOverflow
          />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10 }}
            labelFormatter={(n) => `n = ${Number(n).toLocaleString()}`}
            formatter={(v) => (typeof v === "number" ? (metric === "ms" ? fmtMs(v) : `${Math.round(v).toLocaleString()} steps`) : v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls isAnimationActive={false} strokeDasharray={s.dashed ? "5 4" : undefined} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
