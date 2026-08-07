export type UntypedResponse<T> = {
  data: T | null;
  error: Error | null;
};

export type UntypedQuery<T = unknown> = PromiseLike<UntypedResponse<T>> & {
  select: (columns?: string) => UntypedQuery<T>;
  insert: (values: unknown) => UntypedQuery<T>;
  upsert: (values: unknown, options?: Record<string, unknown>) => UntypedQuery<T>;
  update: (values: unknown) => UntypedQuery<T>;
  delete: () => UntypedQuery<T>;
  eq: (column: string, value: unknown) => UntypedQuery<T>;
  in: (column: string, values: unknown[]) => UntypedQuery<T>;
  is: (column: string, value: unknown) => UntypedQuery<T>;
  order: (column: string, options?: Record<string, unknown>) => UntypedQuery<T>;
  limit: (count: number) => UntypedQuery<T>;
  single: () => PromiseLike<UntypedResponse<T>>;
  maybeSingle: () => PromiseLike<UntypedResponse<T>>;
};

export type UntypedSupabase = {
  from: <T = unknown>(table: string) => UntypedQuery<T>;
};

export const asDuplicateDb = (client: unknown) => client as UntypedSupabase;
