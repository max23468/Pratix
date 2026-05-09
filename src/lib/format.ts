/** Utility di formattazione condivise. */

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

const mediumDateFormatter = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" });

export const formatCurrency = (value: number | null | undefined): string => {
  const n = typeof value === "number" ? value : 0;
  return euroFormatter.format(n);
};

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return mediumDateFormatter.format(d);
};

export const formatDateInput = (value: string | Date | null | undefined): string => {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};
