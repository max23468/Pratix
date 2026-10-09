import { formatCurrency } from "@/lib/format";

export function countValue(isLoading: boolean, count: number | undefined) {
  return isLoading ? "—" : String(count ?? 0);
}

export function currencyValue(isLoading: boolean, amount: number | undefined) {
  return isLoading ? "—" : formatCurrency(amount ?? 0);
}

export function alertTone(count: number | undefined) {
  return count !== undefined && count > 0 ? "danger" : "default";
}
