export function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={strong ? "flex justify-between font-semibold" : "flex justify-between text-sm"}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
