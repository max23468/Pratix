import { PreviewBlock } from "./preview-block";
import { Summary } from "./summary";
import { displayNormalizedClient, displayNormalizedCounterparty } from "./normalization";
import type { PreparedGuidedCreation, StagedGuidedCreation } from "./types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { caseActivityStatusLabels, priceItemKindLabels } from "@/lib/labels";

export function ReviewStep({
  prepared,
  staged,
  isPreparing,
}: {
  prepared: PreparedGuidedCreation;
  staged: StagedGuidedCreation | null;
  isPreparing: boolean;
}) {
  const normalized = prepared.normalized;
  const totals = normalized.activities.reduce(
    (acc, activity) => {
      const amount = activity.quantity * activity.unitPrice;
      if (activity.kind === "fee") acc.fees += amount;
      else acc.reimbursements += amount;
      return acc;
    },
    { fees: 0, reimbursements: 0 },
  );

  return (
    <div className="space-y-4">
      {prepared.errors.length > 0 ? (
        <div className="rounded-md border border-destructive/50 p-3 text-sm text-destructive">
          {prepared.errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {prepared.warnings.length > 0 ? (
        <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
          {prepared.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Anteprima creazione</CardTitle>
              <CardDescription>
                Nessun dato operativo viene scritto prima della conferma finale.
              </CardDescription>
            </div>
            {staged?.status === "imported" ? (
              <Badge variant="secondary">Creazione completata</Badge>
            ) : staged ? (
              <Badge variant="secondary">Anteprima salvata</Badge>
            ) : isPreparing ? (
              <Badge variant="outline">Preparazione</Badge>
            ) : (
              <Badge variant="outline">Da preparare</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Summary label="Pratica" value={String(normalized.practice.practiceNumber || "—")} />
            <Summary label="Compensi" value={formatCurrency(totals.fees)} />
            <Summary label="Rimborsi" value={formatCurrency(totals.reimbursements)} />
            <Summary label="Attività" value={String(normalized.activities.length)} />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-3">
            <PreviewBlock title="Committente" value={normalized.principal.name || "—"} />
            <PreviewBlock value={displayNormalizedClient(normalized.client)} title="Cliente" />
            <PreviewBlock
              value={displayNormalizedCounterparty(normalized.counterparty)}
              title="Controparte"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Attività</p>
            {normalized.activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna attività in anteprima.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Voce</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Quantità</TableHead>
                    <TableHead className="text-right">Totale</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {normalized.activities.map((activity, index) => (
                    <TableRow key={`${activity.priceItemId}-${index}`}>
                      <TableCell>{formatDate(activity.activityDate)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{activity.description}</span>
                          <span className="text-xs text-muted-foreground">
                            {priceItemKindLabels[activity.kind]} · {activity.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{caseActivityStatusLabels[activity.status]}</TableCell>
                      <TableCell className="text-right">{activity.quantity}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(activity.quantity * activity.unitPrice)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
