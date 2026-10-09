import { counterpartyKindLabels } from "@/lib/labels";

export const contropartiSortKeys = ["name", "kind", "subjects", "notes", "updated_at"] as const;

export const counterpartyKindFilters = ["all", ...Object.keys(counterpartyKindLabels)] as const;
