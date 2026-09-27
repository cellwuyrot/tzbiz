export const PROJECT_STATUSES = ["IN_PROGRESS", "DONE", "SUPPORT"] as const;

export const STATUS_LABELS: Record<(typeof PROJECT_STATUSES)[number], string> = {
  IN_PROGRESS: "В работе",
  DONE: "Завершён",
  SUPPORT: "На сопровождении",
};

