// The closed list of anonymous count events (POLICY §19), shared by the browser and /api/metrics.
export const METRIC_EVENTS = [
  "report_printed",
  "report_shared",
  "report_downloaded",
  "evolution_printed",
  "safety_plan_printed",
  "took_to_doctor_yes",
  "took_to_doctor_not_yet",
  "took_to_doctor_no",
  "felt_heard_yes",
  "felt_heard_partly",
  "felt_heard_no",
] as const;
export type MetricEvent = (typeof METRIC_EVENTS)[number];
