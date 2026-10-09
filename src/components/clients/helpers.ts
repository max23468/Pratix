import { clientKindLabels } from "@/lib/labels";

export const clientiSortKeys = ["name", "kind", "principals", "created_at"] as const;

export const clientKindFilters = ["all", ...Object.keys(clientKindLabels)] as const;
