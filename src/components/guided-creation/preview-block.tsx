export function PreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
