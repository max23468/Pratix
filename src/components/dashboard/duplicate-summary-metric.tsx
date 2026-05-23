export function DuplicateSummaryMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-md border border-border/70 p-3">
      <p className="text-[11px] leading-snug font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg leading-tight font-semibold tabular-nums ${
          tone === "danger" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
