import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function PasswordlessAccessCard({
  title,
  description,
  actionLabel,
}: {
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-elevated">
      <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6">
        <Button asChild className="w-full">
          <Link to="/login">{actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
