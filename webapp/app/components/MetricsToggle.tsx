"use client";

import { setMetricsEnabled, useMetricsEnabled } from "@/app/lib/metrics";

// The switch for anonymous counts on the privacy page (POLICY §19).
export default function MetricsToggle() {
  const enabled = useMetricsEnabled();
  if (enabled === null) return null;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <input type="checkbox" checked={enabled} onChange={(e) => setMetricsEnabled(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-indigo-600" />
      <span>
        <span className="font-medium">Enviar contagens anônimas</span>
        <span className="block text-sm text-slate-600">{enabled ? "Ligado neste aparelho." : "Desligado neste aparelho."}</span>
      </span>
    </label>
  );
}
