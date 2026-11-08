import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { parseBigO, sampleCurves } from "@dsa-atlas/complexity";
import { APPROACH_LABELS, type Approach } from "@dsa-atlas/shared";

const KIND_COLOR = { brute: "#f87171", better: "#fbbf24", optimal: "#34d399" } as const;
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Rounds up to 1, 2 or 5 × a power of ten so the axis gets clean ticks. */
function niceMax(x: number) {
  const p = 10 ** Math.floor(Math.log10(Math.max(x, 1)));
  return ([1, 2, 5, 10].find((m) => m * p >= x) ?? 10) * p;
}

const REFERENCE ={ "O(1)": "O(1)", "O(log n)": "O(log n)", "O(n)": "O(n)", "O(n log n)": "O(n log n)", "O(n²)": "O(n^2)" };

/** Time-complexity curves for every approach, with optional reference classes behind them. */
export default function ComplexityGraph({ approaches }: { approaches: Approach[] }) {
  const [maxN, setMaxN] = useState(30);
  const [refs, setRefs] = useState(false);

  const series: Record<string, string> = {};
  const colors: Record<string, string> = {};
  for (const a of approaches) {
    const key = `${APPROACH_LABELS[a.kind]} ${a.time}`;
    series[key] = a.time;
    colors[key] = KIND_COLOR[a.kind];
  }
  if (refs) for (const [label, expr] of Object.entries(REFERENCE)) if (!(label in series)) series[label] = expr;

  const unknown = approaches.filter((a) => !parseBigO(a.time));
  const data = sampleCurves(series, maxN, 40);
  const top = Math.max(1, ...approaches.map((a) => parseBigO(a.time)?.(maxN) ?? 0));

  return (
    <div className="graph">
      <div className="graph-controls">
        <label>
          n up to <strong>{maxN}</strong>
          <input type="range" min={5} max={200} step={5} value={maxN} onChange={(e) => setMaxN(Number(e.target.value))} />
        </label>
        <label className="check">
          <input type="checkbox" checked={refs} onChange={(e) => setRefs(e.target.checked)} /> Reference curves
        </label>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="n" stroke="var(--muted)" tick={{ fontSize: 12 }} />
          <YAxis
            stroke="var(--muted)"
            tick={{ fontSize: 12 }}
            domain={[0, niceMax(Math.min(top * 1.1, 10_000))]}
            allowDataOverflow
            width={48}
            tickFormatter={(v: number) => compact.format(v)}
          />
          <Tooltip
            contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8 }}
            labelFormatter={(n) => `n = ${n}`}
            formatter={(v) => (typeof v === "number" ? Math.round(v).toLocaleString() : v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {Object.keys(series).map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              dot={false}
              stroke={colors[key] ?? "var(--muted)"}
              strokeWidth={colors[key] ? 2.5 : 1}
              strokeDasharray={colors[key] ? undefined : "4 4"}
              isAnimationActive
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      {unknown.length > 0 && (
        <p className="muted small">
          Can't plot {unknown.map((a) => `"${a.time}"`).join(", ")}. Use forms like O(n), O(n log n), O(n^2), O(2^n), O(n!).
        </p>
      )}
    </div>
  );
}
