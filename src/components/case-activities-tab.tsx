import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityAttachmentList } from "@/components/activity-attachment-list";
import { ActivityReviewBadge } from "@/components/activity-review-badge";
import { CaseActivityDialog, type CaseActivityDialogActivity } from "@/components/case-activities";
import { SummaryTile } from "@/components/summary-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { CaseActivityContext } from "@/lib/case-activities";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  caseActivityDisplayStatus,
  caseActivityDisplayStatusLabels,
  caseActivityDisplayStatusVariant,
  priceItemKindLabels,
} from "@/lib/labels";
import { PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";

type ActivityRow = CaseActivityDialogActivity;

export function CaseActivitiesTab({ caseRow }: { caseRow: CaseActivityContext }) {
  const qc = useQueryClient();
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["case-activities", caseRow.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_activities")
        .select("*, case_activity_hearings(*), activity_attachments(*)")
        .eq("case_id", caseRow.id)
        .order("activity_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (activity: ActivityRow) => {
      if (activity.invoice_id) throw new Error("La voce è collegata a una fattura");
      const paths = (activity.activity_attachments ?? []).map(
        (attachment) => attachment.storage_path,
      );
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(PRATIX_DOCUMENTS_BUCKET)
          .remove(paths);
        if (storageError) throw storageError;
      }
      const { error } = await supabase.from("case_activities").delete().eq("id", activity.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voce eliminata");
      qc.invalidateQueries({ queryKey: ["case-activities", caseRow.id] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totals = activities.reduce(
    (acc, activity) => {
      if (activity.kind === "fee") acc.fees += Number(activity.amount) || 0;
      else acc.reimbursements += Number(activity.amount) || 0;
      if (activity.status === "to_invoice" && !activity.invoice_id) {
        acc.toInvoice += Number(activity.amount) || 0;
      }
      if (activity.needs_review) acc.needsReview += 1;
      return acc;
    },
    { fees: 0, reimbursements: 0, toInvoice: 0, needsReview: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Attività</CardTitle>
            <CardDescription>Compensi e rimborsi spese collegati alla pratica.</CardDescription>
          </div>
          <CaseActivityDialog caseRow={caseRow} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="Compensi" value={formatCurrency(totals.fees)} />
          <SummaryTile label="Rimborsi spese" value={formatCurrency(totals.reimbursements)} />
          <SummaryTile label="Da fatturare" value={formatCurrency(totals.toInvoice)} tone="gold" />
          <SummaryTile label="Da verificare" value={String(totals.needsReview)} />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna voce fatturabile registrata.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Voce</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Quantità</TableHead>
                <TableHead className="text-right">Prezzo</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead>Allegati</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => {
                const displayStatus = caseActivityDisplayStatus(activity);
                return (
                  <TableRow key={activity.id}>
                    <TableCell className="text-sm">{formatDate(activity.activity_date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{activity.description}</span>
                        <ActivityReviewBadge needsReview={activity.needs_review} />
                        <span className="text-xs text-muted-foreground">
                          {priceItemKindLabels[activity.kind]} · {activity.snapshot_price_name}
                        </span>
                        {activity.case_activity_hearings?.length ? (
                          <span className="text-xs text-muted-foreground">
                            Udienze:{" "}
                            {activity.case_activity_hearings
                              .sort((a, b) => a.position - b.position)
                              .map((hearing) => formatDate(hearing.hearing_date))
                              .join(", ")}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={caseActivityDisplayStatusVariant[displayStatus] ?? "outline"}>
                        {caseActivityDisplayStatusLabels[displayStatus] ?? displayStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">{activity.quantity}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(activity.unit_price)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(activity.amount)}
                    </TableCell>
                    <TableCell>
                      <ActivityAttachmentList attachments={activity.activity_attachments ?? []} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <CaseActivityDialog
                          caseRow={caseRow}
                          activity={activity}
                          trigger={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={Boolean(activity.invoice_id)}
                              aria-label={`Modifica ${activity.description}`}
                              title={
                                activity.invoice_id
                                  ? "Le voci collegate a una Fattura non si modificano"
                                  : "Modifica voce"
                              }
                            >
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={Boolean(activity.invoice_id) || remove.isPending}
                          onClick={() => remove.mutate(activity)}
                          aria-label={`Elimina ${activity.description}`}
                          title={
                            activity.invoice_id
                              ? "Le voci collegate a una Fattura non si eliminano"
                              : "Elimina voce"
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
