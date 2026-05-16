const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RoutableRow = {
  id: string;
  public_code?: string | null;
};

export function routeRef(row: RoutableRow) {
  return row.public_code || row.id;
}

export function publicCodeLookup(ref: string) {
  return UUID_PATTERN.test(ref)
    ? { column: "id", value: ref }
    : { column: "public_code", value: ref.toUpperCase() };
}
