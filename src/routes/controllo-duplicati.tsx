import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, ExternalLink, GitMerge, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  displayDuplicateEntity,
  type DuplicateCandidate,
  type DuplicateEntityType,
  type DuplicateRecord,
} from "@/lib/duplicate-matching";
import { getAuthHeaders, readServerResult } from "@/lib/server-functions";
import {
  resolveDuplicateCandidateFn,
  scanDuplicateCandidatesFn,
} from "@/server/duplicates.functions";
import { confidenceLabel, resolvedStatusLabel } from "@/server/duplicates.logic";

type ScanResult = {
  openCandidates: DuplicateCandidate[];
  resolvedCandidates: DuplicateCandidate[];
};

type DuplicateFilter = "all" | DuplicateEntityType | "snoozed" | "resolved";

const filters: Array<{ value: DuplicateFilter; label: string }> = [
  { value: "all", label: "Tutti" },
  { value: "principal", label: "Committenti" },
  { value: "client", label: "Clienti" },
  { value: "counterparty", label: "Controparti" },
  { value: "case", label: "Pratiche" },
  { value: "snoozed", label: "Rimandati" },
  { value: "resolved", label: "Risolti" },
];

export const Route = createFileRoute("/controllo-duplicati")({
  head: () => ({
    meta: [
      { title: "Controllo duplicati · Pratix" },
      {
        name: "description",
        content: "Rivedi e risolvi potenziali duplicati su dati operativi.",
      },
      { property: "og:title", content: "Controllo duplicati · Pratix" },
      {
        property: "og:description",
        content: "Rivedi e risolvi potenziali duplicati su dati operativi.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <DuplicateControlPage />
    </AppLayout>
  ),
});

function DuplicateControlPage() {
  const scanDuplicates = useServerFn(scanDuplicateCandidatesFn);
  const resolveDuplicate = useServerFn(resolveDuplicateCandidateFn);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<DuplicateFilter>("all");
  const [selected, setSelected] = useState<DuplicateCandidate | null>(null);
  const [mergeKeepId, setMergeKeepId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["duplicate-candidates"],
    queryFn: async () =>
      readServerResult<ScanResult>(
        await scanDuplicates({
          headers: await getAuthHeaders(),
        }),
      ),
  });

  const resolveMutation = useMutation({
    mutationFn: async (input: {
      candidate: DuplicateCandidate;
      action: "snooze" | "dismiss" | "merge";
      keepRecordId?: string | null;
    }) =>
      readServerResult(
        await resolveDuplicate({
          data: {
            reviewId: input.candidate.reviewId,
            entityType: input.candidate.entityType,
            leftRecordId: input.candidate.left.id,
            rightRecordId: input.candidate.right.id,
            action: input.action,
            keepRecordId: input.keepRecordId ?? null,
          },
          headers: await getAuthHeaders(),
        }),
      ),
    onSuccess: (_, variables) => {
      const messages = {
        snooze: "Controllo rimandato",
        dismiss: "Coppia segnata come non duplicata",
        merge: "Record uniti",
      };
      toast.success(messages[variables.action]);
      setSelected(null);
      setMergeKeepId(null);
      qc.invalidateQueries({ queryKey: ["duplicate-candidates"] });
      qc.invalidateQueries({ queryKey: ["principals"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["counterparties"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const candidates = useMemo(() => {
    const open = (query.data?.openCandidates ?? []).filter(
      (candidate) => candidate.status === "open",
    );
    const snoozed = (query.data?.openCandidates ?? []).filter(
      (candidate) => candidate.status === "snoozed",
    );
    const resolved = query.data?.resolvedCandidates ?? [];
    if (filter === "resolved") return resolved;
    if (filter === "snoozed") return snoozed;
    const source = open;
    if (filter === "all") return source;
    return source.filter((candidate) => candidate.entityType === filter);
  }, [filter, query.data]);

  const openCount =
    query.data?.openCandidates.filter((candidate) => candidate.status === "open").length ?? 0;
  const snoozedCount =
    query.data?.openCandidates.filter((candidate) => candidate.status === "snoozed").length ?? 0;
  const resolvedCount = query.data?.resolvedCandidates.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controllo duplicati"
        description="Rivedi Committenti, Clienti, Controparti e Pratiche che potrebbero riferirsi allo stesso dato."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCcw className="mr-2 size-4" />
            {query.isFetching ? "Controllo…" : "Ricontrolla"}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard title="Da verificare" value={openCount} />
        <SummaryCard title="Rimandati" value={snoozedCount} />
        <SummaryCard title="Risolti" value={resolvedCount} />
        <SummaryCard
          title="Copertura"
          value="4"
          description="Committenti, Clienti, Controparti, Pratiche"
        />
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Filtro controllo duplicati">
        {filters.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={filter === item.value ? "default" : "outline"}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {query.isLoading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Controllo duplicati in corso…
            </CardContent>
          </Card>
        ) : candidates.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Nessun potenziale duplicato in questa vista.
            </CardContent>
          </Card>
        ) : (
          candidates.map((candidate) => (
            <DuplicateCandidateCard
              key={`${candidate.entityType}-${candidate.left.id}-${candidate.right.id}-${candidate.status}`}
              candidate={candidate}
              onOpen={() => {
                setSelected(candidate);
                setMergeKeepId(candidate.left.id);
              }}
              onDismiss={() => resolveMutation.mutate({ candidate, action: "dismiss" })}
              onSnooze={() => resolveMutation.mutate({ candidate, action: "snooze" })}
              disabled={resolveMutation.isPending}
            />
          ))
        )}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Confronto {displayDuplicateEntity(selected.entityType)}</DialogTitle>
              <DialogDescription>{selected.reasons.join(" · ")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-2">
              {[selected.left, selected.right].map((record) => (
                <RecordPanel
                  key={record.id}
                  record={record}
                  selected={mergeKeepId === record.id}
                  onSelect={() => setMergeKeepId(record.id)}
                />
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => resolveMutation.mutate({ candidate: selected, action: "snooze" })}
                disabled={resolveMutation.isPending}
              >
                <Clock className="mr-1 size-4" />
                Rimanda
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => resolveMutation.mutate({ candidate: selected, action: "dismiss" })}
                disabled={resolveMutation.isPending}
              >
                <Check className="mr-1 size-4" />
                Non duplicato
              </Button>
              <Button
                type="button"
                onClick={() =>
                  resolveMutation.mutate({
                    candidate: selected,
                    action: "merge",
                    keepRecordId: mergeKeepId,
                  })
                }
                disabled={resolveMutation.isPending || !mergeKeepId}
              >
                <GitMerge className="mr-1 size-4" />
                Unisci
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number | string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
      </CardContent>
    </Card>
  );
}

function DuplicateCandidateCard({
  candidate,
  onOpen,
  onDismiss,
  onSnooze,
  disabled,
}: {
  candidate: DuplicateCandidate;
  onOpen: () => void;
  onDismiss: () => void;
  onSnooze: () => void;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{displayDuplicateEntity(candidate.entityType)}</Badge>
            <Badge variant={candidate.confidence === "high" ? "default" : "secondary"}>
              Probabilità {confidenceLabel(candidate.confidence).toLowerCase()}
            </Badge>
            <Badge variant={candidate.status === "open" ? "outline" : "secondary"}>
              {resolvedStatusLabel(candidate.status)}
            </Badge>
          </div>
          <div className="font-medium">
            {candidate.left.label} / {candidate.right.label}
          </div>
          <div className="text-sm text-muted-foreground">{candidate.reasons.join(" · ")}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onOpen}>
            Apri confronto
          </Button>
          {candidate.status !== "dismissed" && candidate.status !== "merged" && (
            <>
              <Button type="button" variant="outline" onClick={onSnooze} disabled={disabled}>
                Rimanda
              </Button>
              <Button type="button" variant="outline" onClick={onDismiss} disabled={disabled}>
                Non duplicato
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecordPanel({
  record,
  selected,
  onSelect,
}: {
  record: DuplicateRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{record.label}</div>
          {record.subtitle && (
            <div className="text-xs text-muted-foreground">{record.subtitle}</div>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant={selected ? "default" : "outline"}
          onClick={onSelect}
        >
          Mantieni
        </Button>
      </div>
      <div className="space-y-2 text-sm">
        {Object.entries(record.fields ?? {}).map(([key, value]) => (
          <div key={key} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-2">
            <span className="text-muted-foreground">{key}</span>
            <span className="min-w-0 break-words">{value || "—"}</span>
          </div>
        ))}
      </div>
      {record.href && (
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to={record.href as never}>
            <ExternalLink className="mr-1 size-4" />
            Apri scheda
          </Link>
        </Button>
      )}
    </div>
  );
}
