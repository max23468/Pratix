import { AlertTriangle, CheckCircle2, WalletCards } from "lucide-react";
import { SummaryTile } from "@/components/summary-tile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { summarizeCaseOperations, type CaseWorkflowQualityCheck } from "@/lib/case-workflow";

export function CaseOperationsSummary({
  totals,
  qualityChecks,
}: {
  totals: ReturnType<typeof summarizeCaseOperations>;
  qualityChecks: CaseWorkflowQualityCheck[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-2">
            <WalletCards className="mt-1 size-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Scheda economica</CardTitle>
              <CardDescription>
                Compensi, rimborsi spese, fatturato, incassato e residuo operativo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryTile label="Compensi" value={formatCurrency(totals.fees)} />
          <SummaryTile label="Rimborsi spese" value={formatCurrency(totals.reimbursements)} />
          <SummaryTile label="Maturato" value={formatCurrency(totals.matured)} />
          <SummaryTile label="Da fatturare" value={formatCurrency(totals.toInvoice)} tone="gold" />
          <SummaryTile label="Fatturato" value={formatCurrency(totals.invoiceTotal)} />
          <SummaryTile label="Incassato" value={formatCurrency(totals.paidTotal)} />
          <SummaryTile label="Residuo" value={formatCurrency(totals.residual)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Controlli qualità dati</CardTitle>
          <CardDescription>Avvisi sulle informazioni operative da completare.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {qualityChecks.map((check) => (
            <div
              key={check.id}
              className="flex items-start gap-2 rounded-md border border-border p-3"
            >
              {check.severity === "ok" ? (
                <CheckCircle2 className="mt-0.5 size-4 text-muted-foreground" />
              ) : (
                <AlertTriangle className="mt-0.5 size-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">{check.title}</p>
                <p className="text-sm text-muted-foreground">{check.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
