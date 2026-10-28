"use client";

import { useCallback, useState } from "react";

// Single-series trend over time (one chart per measure; never two y-axes). 2px line, markers with
// a surface ring, hairline grid, only the latest value labeled, a crosshair tooltip on hover, touch
// and keyboard focus (arrow keys), and a table with the same numbers.

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

const COLORS = { series: "#2a78d6", text: "#0b0b0b", secondary: "#52514e", grid: "#e1e0d9", axis: "#c3c2b7", surface: "#ffffff" };
const HEIGHT = 200;
const TOP = 16;
const BOTTOM = 28;
const RIGHT = 14;
const DAY_MS = 86_400_000;
const ALL_MARKERS_UP_TO = 20;

const time = (iso: string) => Date.parse(`${iso}T12:00:00`);
const shortDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function TrendChart({
  title,
  subtitle,
  caption,
  points,
  yMin,
  yMax,
  yTicks,
  tickLabel = (v) => String(v),
  format = (v) => String(v),
  xDomain,
  gapDays,
  valueHeader = "Valor",
  endLabel = true,
}: {
  title: string;
  subtitle?: string;
  caption?: string;
  points: TrendPoint[];
  yMin: number;
  yMax: number;
  yTicks: number[];
  tickLabel?: (value: number) => string; // axis ticks and the label on the latest point
  format?: (value: number) => string; // tooltip and table
  xDomain?: [string, string];
  gapDays?: number; // break the line when two records are further apart than this
  valueHeader?: string;
  endLabel?: boolean; // label the latest value (off when the axis already names every level)
}) {
  const [width, setWidth] = useState(560);
  const [active, setActive] = useState<number | null>(null);
  const box = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length === 0) return null;

  const left = Math.max(...yTicks.map((t) => tickLabel(t).length)) * 7 + 14;
  const innerW = width - left - RIGHT;
  const innerH = HEIGHT - TOP - BOTTOM;
  const t0 = time(xDomain?.[0] ?? sorted[0].date);
  const t1 = time(xDomain?.[1] ?? sorted[sorted.length - 1].date);
  const x = (iso: string) => left + (t1 === t0 ? innerW / 2 : ((time(iso) - t0) / (t1 - t0)) * innerW);
  const y = (v: number) => TOP + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const coords = sorted.map((p) => ({ ...p, cx: x(p.date), cy: y(p.value) }));
  const last = coords[coords.length - 1];
  const current = active !== null ? coords[active] : null;

  // Segments of the line: a new one starts after a gap longer than `gapDays`.
  const segments: (typeof coords)[] = [];
  coords.forEach((c, i) => {
    const gap = i > 0 && gapDays !== undefined && (time(c.date) - time(coords[i - 1].date)) / DAY_MS > gapDays;
    if (i === 0 || gap) segments.push([c]);
    else segments[segments.length - 1].push(c);
  });
  const isolated = new Set(segments.filter((s) => s.length === 1).map((s) => s[0].date));
  const showMarker = (i: number) => coords.length <= ALL_MARKERS_UP_TO || i === coords.length - 1 || i === active || isolated.has(coords[i].date);
  const endAbove = last.cy - 12 > TOP + 4;
  const ticksX = xDomain ? [xDomain[0], xDomain[1]] : coords.length > 1 ? [coords[0].date, last.date] : [last.date];

  function nearest(clientX: number, svg: SVGSVGElement) {
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.cx - px) < Math.abs(coords[best].cx - px)) best = i;
    });
    return best;
  }

  function onKey(event: React.KeyboardEvent) {
    const index = active ?? coords.length - 1;
    const next = ({ ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: coords.length - 1 } as Record<string, number>)[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(Math.min(coords.length - 1, Math.max(0, next)));
  }

  const summary = `${title}: ${sorted.length} ${sorted.length === 1 ? "registro" : "registros"}, de ${shortDate(sorted[0].date)} a ${shortDate(last.date)}. Último: ${format(last.value)}. Use as setas para percorrer.`;

  return (
    <figure className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-4">
      <figcaption>
        <span className="block font-semibold text-slate-900">{title}</span>
        {subtitle && <span className="block text-sm text-slate-600">{subtitle}</span>}
      </figcaption>
      <div ref={box} className="relative mt-3">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={onKey}
          onFocus={() => setActive((a) => a ?? coords.length - 1)}
          onBlur={() => setActive(null)}
          className="block h-auto w-full rounded focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
          style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
        >
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={left} x2={left + innerW} y1={y(tick)} y2={y(tick)} stroke={COLORS.grid} strokeWidth={1} />
              <text x={left - 8} y={y(tick)} dy="0.32em" textAnchor="end" fontSize={12} fill={COLORS.secondary} style={{ fontVariantNumeric: "tabular-nums" }}>
                {tickLabel(tick)}
              </text>
            </g>
          ))}
          <line x1={left} x2={left + innerW} y1={TOP + innerH} y2={TOP + innerH} stroke={COLORS.axis} strokeWidth={1} />
          {ticksX.map((iso, i) => (
            <text key={iso} x={x(iso)} y={HEIGHT - 8} textAnchor={ticksX.length === 1 ? "middle" : i === 0 ? "start" : "end"} fontSize={12} fill={COLORS.secondary}>
              {shortDate(iso)}
            </text>
          ))}
          {current && <line x1={current.cx} x2={current.cx} y1={TOP} y2={TOP + innerH} stroke={COLORS.axis} strokeWidth={1} />}
          {segments
            .filter((s) => s.length > 1)
            .map((s) => (
              <polyline key={s[0].date} points={s.map((c) => `${c.cx},${c.cy}`).join(" ")} fill="none" stroke={COLORS.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
          {coords.map((c, i) =>
            showMarker(i) ? <circle key={c.date} cx={c.cx} cy={c.cy} r={i === active ? 6 : 4} fill={COLORS.series} stroke={COLORS.surface} strokeWidth={2} /> : null,
          )}
          {endLabel && (
            <text
              x={last.cx + (coords.length === 1 ? 0 : -4)}
              y={endAbove ? last.cy - 12 : last.cy + 20}
              textAnchor={coords.length === 1 ? "middle" : "end"}
              fontSize={13}
              fontWeight={600}
              fill={COLORS.text}
              stroke={COLORS.surface}
              strokeWidth={4}
              paintOrder="stroke"
            >
              {tickLabel(last.value)}
            </text>
          )}
          <rect
            x={left - 12}
            y={TOP}
            width={innerW + 24}
            height={innerH}
            fill="transparent"
            onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.ownerSVGElement!))}
            onPointerDown={(e) => setActive(nearest(e.clientX, e.currentTarget.ownerSVGElement!))}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {current && (
          <div
            className="pointer-events-none absolute rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md print:hidden"
            style={{ left: Math.min(Math.max(current.cx - 70, 0), width - 150), top: Math.max(current.cy - 70, 0), width: 150 }}
          >
            <span className="block font-semibold text-slate-900">{format(current.value)}</span>
            <span className="block text-slate-600">{shortDate(current.date)}</span>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {current ? `${shortDate(current.date)}: ${format(current.value)}` : ""}
        </p>
      </div>
      {caption && <p className="mt-2 text-sm text-slate-600">{caption}</p>}
      <details className="mt-2 text-sm print:hidden">
        <summary className="cursor-pointer py-2 text-slate-700">Ver os números</summary>
        <table className="w-full text-left">
          <thead>
            <tr className="text-slate-600">
              <th className="py-1 font-medium">Data</th>
              <th className="py-1 font-medium">{valueHeader}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.date} className="border-t border-slate-100">
                <td className="py-1" style={{ fontVariantNumeric: "tabular-nums" }}>{shortDate(p.date)}</td>
                <td className="py-1">{format(p.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
