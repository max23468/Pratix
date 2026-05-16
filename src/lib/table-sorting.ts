import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type SortDirection = "asc" | "desc";

export type TableSort<Key extends string = string> = {
  key: Key;
  direction: SortDirection;
};

export type SortValue = string | number | boolean | Date | null | undefined;

export type SortValueType = "text" | "number" | "date" | "boolean";

export type SortableColumn<Row, Key extends string> = {
  key: Key;
  label: string;
  valueType?: SortValueType;
  defaultDirection?: SortDirection;
  getValue: (row: Row) => SortValue;
  compare?: (a: Row, b: Row) => number;
};

type TablePreferenceRow = {
  sort_key: string;
  sort_direction: SortDirection;
};

type TablePreferencePayload = {
  user_id: string;
  section: string;
  sort_key: string;
  sort_direction: SortDirection;
};

type TablePreferenceResult<T> = Promise<{
  data: T;
  error: Error | null;
}>;

type TablePreferencesSelect = {
  eq: (column: "user_id" | "section", value: string) => TablePreferencesSelect;
  maybeSingle: () => TablePreferenceResult<TablePreferenceRow | null>;
};

type TablePreferencesTable = {
  select: (columns: "sort_key, sort_direction") => TablePreferencesSelect;
  upsert: (
    payload: TablePreferencePayload,
    options: { onConflict: "user_id,section" },
  ) => Promise<{ error: Error | null }>;
};

type TablePreferencesClient = {
  from: (table: "user_table_preferences") => TablePreferencesTable;
};

type UsePersistentTableSortOptions<Row, Key extends string> = {
  section: string;
  columns: readonly SortableColumn<Row, Key>[];
  defaultSort: TableSort<Key>;
  urlSort?: TableSort<Key>;
  onSortChange: (sort: TableSort<Key>) => void;
};

const textCollator = new Intl.Collator("it", {
  numeric: true,
  sensitivity: "base",
});

const preferencesTable = () =>
  (supabase as unknown as TablePreferencesClient).from("user_table_preferences");

export function parseTableSortKey<Key extends string>(
  value: unknown,
  keys: readonly Key[],
): Key | undefined {
  return typeof value === "string" && keys.includes(value as Key) ? (value as Key) : undefined;
}

export function parseTableSortDirection(value: unknown): SortDirection | undefined {
  return value === "asc" || value === "desc" ? value : undefined;
}

export function sortRows<Row, Key extends string>(
  rows: readonly Row[],
  columns: readonly SortableColumn<Row, Key>[],
  sort: TableSort<Key>,
  fallbackCompare?: (a: Row, b: Row) => number,
) {
  const column = columns.find((item) => item.key === sort.key);
  if (!column) return [...rows];

  return rows
    .map((row, index) => ({ row, index }))
    .toSorted((a, b) => {
      const base = column.compare
        ? column.compare(a.row, b.row)
        : compareValues(column.getValue(a.row), column.getValue(b.row), column.valueType ?? "text");
      const directed = sort.direction === "asc" ? base : -base;
      if (directed !== 0) return directed;

      const fallback = fallbackCompare?.(a.row, b.row) ?? 0;
      if (fallback !== 0) return fallback;
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

export function nextTableSort<Row, Key extends string>(
  current: TableSort<Key>,
  column: SortableColumn<Row, Key>,
): TableSort<Key> {
  if (current.key === column.key) {
    return { key: column.key, direction: current.direction === "asc" ? "desc" : "asc" };
  }

  return { key: column.key, direction: column.defaultDirection ?? "asc" };
}

export function usePersistentTableSort<Row, Key extends string>({
  section,
  columns,
  defaultSort,
  urlSort,
  onSortChange,
}: UsePersistentTableSortOptions<Row, Key>) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = session?.user.id;
  const keys = columns.map((column) => column.key);

  const { data: savedSort } = useQuery({
    enabled: !!userId,
    queryKey: ["table-sort", userId, section],
    queryFn: async () => {
      const { data, error } = await preferencesTable()
        .select("sort_key, sort_direction")
        .eq("user_id", userId!)
        .eq("section", section)
        .maybeSingle();
      if (error) throw error;
      return normalizeSavedSort(data, keys);
    },
  });

  const saveSort = useMutation({
    mutationFn: async (sort: TableSort<Key>) => {
      if (!userId) return;
      const { error } = await preferencesTable().upsert(
        {
          user_id: userId,
          section,
          sort_key: sort.key,
          sort_direction: sort.direction,
        },
        { onConflict: "user_id,section" },
      );
      if (error) throw error;
    },
    onMutate: async (sort) => {
      await queryClient.cancelQueries({ queryKey: ["table-sort", userId, section] });
      queryClient.setQueryData(["table-sort", userId, section], sort);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["table-sort", userId, section] });
    },
  });

  const sort = urlSort ?? savedSort ?? defaultSort;

  return {
    sort,
    setSort: (columnKey: Key) => {
      const column = columns.find((item) => item.key === columnKey);
      if (!column) return;
      const next = nextTableSort(sort, column);
      onSortChange(next);
      saveSort.mutate(next);
    },
  };
}

function normalizeSavedSort<Key extends string>(
  row: TablePreferenceRow | null,
  keys: readonly Key[],
): TableSort<Key> | null {
  if (!row) return null;
  const key = parseTableSortKey(row.sort_key, keys);
  if (!key) return null;
  const direction = parseTableSortDirection(row.sort_direction);
  if (!direction) return null;
  return { key, direction };
}

function compareValues(a: SortValue, b: SortValue, valueType: SortValueType) {
  if (isEmptyValue(a) && isEmptyValue(b)) return 0;
  if (isEmptyValue(a)) return 1;
  if (isEmptyValue(b)) return -1;

  if (valueType === "number") return Number(a) - Number(b);
  if (valueType === "date") return dateValue(a) - dateValue(b);
  if (valueType === "boolean") return Number(a) - Number(b);
  return textCollator.compare(String(a), String(b));
}

function isEmptyValue(value: SortValue) {
  return value === null || value === undefined || value === "";
}

function dateValue(value: Exclude<SortValue, null | undefined>) {
  return value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
}
