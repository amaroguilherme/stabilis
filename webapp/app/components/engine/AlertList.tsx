import { renderMessage, type Variant } from "@/app/lib/engine/messages";
import type { Alert, KnowledgeBaseData } from "@/app/lib/engine/types";
import type { Labels } from "@/app/lib/kb/labels";
import SourceRefs from "./SourceRefs";

const LEVEL_STYLES: Record<Alert["level"], string> = {
  critical: "border-rose-300 bg-rose-50 text-rose-950",
  warning: "border-amber-300 bg-amber-50 text-amber-950",
  info: "border-slate-200 bg-white text-slate-800",
};

const LEVEL_LABELS: Record<Alert["level"], string> = { critical: "Crítico", warning: "Atenção", info: "Nota" };

export default function AlertList({
  alerts,
  kb,
  labels,
  variant,
  compact = false,
}: {
  alerts: Alert[];
  kb: KnowledgeBaseData;
  labels: Labels;
  variant: Variant;
  compact?: boolean;
}) {
  if (alerts.length === 0) return null;
  return (
    <ul className="space-y-2">
      {alerts.map((alert, i) => (
        <li key={`${alert.origin}-${alert.message.key}-${i}`} className={`rounded-lg border ${compact ? "px-3 py-2" : "px-4 py-3"} ${variant === "plain" ? "text-base" : "text-sm"} ${LEVEL_STYLES[alert.level]}`}>
          {/* role="alert" on an inner element: on the <li> itself it would break the list semantics */}
          <p role={alert.level === "critical" ? "alert" : undefined}>
            <span className="font-semibold">{LEVEL_LABELS[alert.level]}: </span>
            {renderMessage(kb, alert.message, variant)}
          </p>
          <SourceRefs cites={alert.sources} labels={labels} className="mt-1" size={variant === "plain" ? "base" : "xs"} />
        </li>
      ))}
    </ul>
  );
}
