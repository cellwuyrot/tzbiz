export const LEAD_STATUSES = ["NEW", "IN_PROGRESS", "DONE"] as const;

export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUSES)[number], string> = {
  NEW: "Новая",
  IN_PROGRESS: "В работе",
  DONE: "Завершена",
};
