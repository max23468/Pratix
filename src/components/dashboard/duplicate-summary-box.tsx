import { Link } from "@tanstack/react-router";
import { GitCompareArrows } from "lucide-react";
import { DuplicateSummaryMetric } from "@/components/dashboard/duplicate-summary-metric";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DuplicateSummary } from "@/components/dashboard/types";

export function DuplicateSummaryBox({
  summary,
  isLoading,
}: {
  summary?: DuplicateSummary;
  isLoading: boolean;
}) {
  if (!isLoading && !summary) {
    return null;
  }

  const openCount = summary?.openCount ?? 0;
  const highConfidenceCount = summary?.highConfidenceCount ?? 0;
  const hasOpen = openCount > 0;
  const badgeText = isLoading
    ? "Controllo…"
    : hasOpen
      ? `${openCount} da verificare`
      : "Dati in ordine";
  const description = hasOpen
    ? "Ci sono coppie da rivedere prima di creare nuovi dati operativi."
    : "Non risultano potenziali duplicati aperti.";

  return (
    <Card className="mt-4 border-border/70 shadow-soft">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
              hasOpen ? "bg-destructive/10 text-destructive" : "bg-primary/5 text-primary"
            }`}
          >
            <GitCompareArrows className="size-5" strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Controllo duplicati</h2>
              <Badge variant={hasOpen ? "destructive" : "secondary"}>{badgeText}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4 lg:min-w-[30rem]">
          <DuplicateSummaryMetric
            label="Da verificare"
            value={isLoading ? "—" : String(openCount)}
            tone={hasOpen ? "danger" : "default"}
          />
          <DuplicateSummaryMetric
            label="Alta probabilità"
            value={isLoading ? "—" : String(highConfidenceCount)}
            tone={highConfidenceCount > 0 ? "danger" : "default"}
          />
          <DuplicateSummaryMetric
            label="Rimandati"
            value={isLoading ? "—" : String(summary?.snoozedCount ?? 0)}
          />
          <DuplicateSummaryMetric
            label="Risolti"
            value={isLoading ? "—" : String(summary?.resolvedCount ?? 0)}
          />
        </div>

        <Button variant={hasOpen ? "default" : "outline"} asChild className="shrink-0">
          <Link to="/controllo-duplicati">
            <GitCompareArrows className="mr-1 size-4" />
            Apri controllo
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
