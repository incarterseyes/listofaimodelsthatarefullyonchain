import type { ModelEntry } from "./types";

export function formatModelDate({ year, month }: Pick<ModelEntry, "year" | "month">): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
