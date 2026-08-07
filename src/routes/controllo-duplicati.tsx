import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, Clock, ExternalLink, GitMerge, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SummaryCard } from "@/components/duplicates/summary-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  canMergeDuplicateEntity,
  DUPLICATE_SNOOZE_OPTIONS,
  displayDuplicateEntity,
  type DuplicateCandidate,
  type DuplicateEntityType,
  type DuplicateRecord,
  type DuplicateSnoozeInterval,
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
  { value: "activity", label: "Attività" },
  { value: "counterparty_subject", label: "Soggetti" },
  { value: "cross_entity", label: "Tipi diversi" },
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

  const {
    data: duplicateScan,
    isFetching: isDuplicateScanFetching,
    isLoading: isDuplicateScanLoading,
    refetch: refetchDuplicateScan,
  } = useQuery({
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
      snoozeInterval?: DuplicateSnoozeInterval;
      keepRecordId?: string | null;
    }) =>
      readServerResult(
        await resolveDuplicate({
          data: {
            entityType: input.candidate.entityType,
            leftRecordId: input.candidate.left.id,
            rightRecordId: input.candidate.right.id,
            action: input.action,
            snoozeInterval: input.snoozeInterval ?? null,
            keepRecordId: input.keepRecordId ?? null,
          },
          headers: await getAuthHeaders(),
        }),
      ),
    onSuccess: (_, variables) => {
      const messages = {
        snooze: `Controllo rimandato per ${snoozeOptionLabel(
          variables.snoozeInterval ?? "24h",
        ).toLowerCase()}`,
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
    const open = (duplicateScan?.openCandidates ?? []).filter(
      (candidate) => candidate.status === "open",
    );
    const snoozed = (duplicateScan?.openCandidates ?? []).filter(
      (candidate) => candidate.status === "snoozed",
    );
    const resolved = duplicateScan?.resolvedCandidates ?? [];
    if (filter === "resolved") return resolved;
    if (filter === "snoozed") return snoozed;
    const source = open;
    if (filter === "all") return source;
    return source.filter((candidate) => candidate.entityType === filter);
  }, [duplicateScan, filter]);

  const openCount =
    duplicateScan?.openCandidates.filter((candidate) => candidate.status === "open").length ?? 0;
  const snoozedCount =
    duplicateScan?.openCandidates.filter((candidate) => candidate.status === "snoozed").length ?? 0;
  const resolvedCount = duplicateScan?.resolvedCandidates.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Controllo duplicati"
        description="Rivedi anagrafiche, Pratiche, Attività e sospetti tra tipi diversi che potrebbero riferirsi allo stesso dato."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => refetchDuplicateScan()}
            disabled={isDuplicateScanFetching}
          >
            <RefreshCcw className="mr-2 size-4" />
            {isDuplicateScanFetching ? "Controllo…" : "Ricontrolla"}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard title="Da verificare" value={openCount} />
        <SummaryCard title="Rimandati" value={snoozedCount} />
        <SummaryCard title="Risolti" value={resolvedCount} />
        <SummaryCard
          title="Copertura"
          value="7"
          description="Anagrafiche, Pratiche, Attività, Soggetti e Tipi diversi"
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
        {isDuplicateScanLoading ? (
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
          candidates.map((candidate) =>
            renderDuplicateCandidateCard({
              key: `${candidate.entityType}-${candidate.left.id}-${candidate.right.id}-${candidate.status}`,
              candidate,
              onOpen: () => {
                setSelected(candidate);
                setMergeKeepId(
                  canMergeDuplicateEntity(candidate.entityType) ? candidate.left.id : null,
                );
              },
              onDismiss: () => resolveMutation.mutate({ candidate, action: "dismiss" }),
              onSnooze: (snoozeInterval) =>
                resolveMutation.mutate({ candidate, action: "snooze", snoozeInterval }),
              disabled: resolveMutation.isPending,
            }),
          )
        )}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        {selected && (
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Confronto {displayDuplicateEntity(selected.entityType)}</DialogTitle>
              <DialogDescription>{selected.reasons.join(" · ")}</DialogDescription>
            </DialogHeader>
            {!canMergeDuplicateEntity(selected.entityType) && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Questo sospetto richiede verifica manuale: puoi aprire i record, rimandare il
                controllo o segnarlo come non duplicato.
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {[selected.left, selected.right].map((record) =>
                renderRecordPanel({
                  key: record.id,
                  record,
                  selected: canMergeDuplicateEntity(selected.entityType)
                    ? mergeKeepId === record.id
                    : undefined,
                  onSelect: canMergeDuplicateEntity(selected.entityType)
                    ? () => setMergeKeepId(record.id)
                    : undefined,
                }),
              )}
            </div>
            <DialogFooter className="gap-2">
              {selected.status !== "dismissed" && selected.status !== "merged" && (
                <>
                  <SnoozeMenu
                    disabled={resolveMutation.isPending}
                    onSnooze={(snoozeInterval) =>
                      resolveMutation.mutate({
                        candidate: selected,
                        action: "snooze",
                        snoozeInterval,
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      resolveMutation.mutate({ candidate: selected, action: "dismiss" })
                    }
                    disabled={resolveMutation.isPending}
                  >
                    <Check className="mr-1 size-4" />
                    Non duplicato
                  </Button>
                  {canMergeDuplicateEntity(selected.entityType) && (
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
                  )}
                </>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function renderDuplicateCandidateCard({
  key,
  candidate,
  onOpen,
  onDismiss,
  onSnooze,
  disabled,
}: {
  key: string;
  candidate: DuplicateCandidate;
  onOpen: () => void;
  onDismiss: () => void;
  onSnooze: (snoozeInterval: DuplicateSnoozeInterval) => void;
  disabled: boolean;
}) {
  const snoozedUntilLabel = formatSnoozedUntil(candidate.snoozedUntil);

  return (
    <Card key={key}>
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
          {candidate.status === "snoozed" && snoozedUntilLabel && (
            <div className="text-sm text-muted-foreground">
              Torna da verificare il {snoozedUntilLabel}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onOpen}>
            Apri confronto
          </Button>
          {candidate.status !== "dismissed" && candidate.status !== "merged" && (
            <>
              <SnoozeMenu disabled={disabled} onSnooze={onSnooze} />
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

function SnoozeMenu({
  disabled,
  onSnooze,
}: {
  disabled: boolean;
  onSnooze: (snoozeInterval: DuplicateSnoozeInterval) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          <Clock className="mr-1 size-4" />
          Rimanda
          <ChevronDown className="ml-1 size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Promemoria</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DUPLICATE_SNOOZE_OPTIONS.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => onSnooze(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function snoozeOptionLabel(value: DuplicateSnoozeInterval) {
  return (
    DUPLICATE_SNOOZE_OPTIONS.find((option) => option.value === value)?.label ??
    DUPLICATE_SNOOZE_OPTIONS[1].label
  );
}

const snoozedUntilFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatSnoozedUntil(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return snoozedUntilFormatter.format(date);
}

function renderRecordPanel({
  key,
  record,
  selected,
  onSelect,
}: {
  key: string;
  record: DuplicateRecord;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <div key={key} className="space-y-3 rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{record.label}</div>
          {record.subtitle && (
            <div className="text-xs text-muted-foreground">{record.subtitle}</div>
          )}
        </div>
        {onSelect && (
          <Button
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            onClick={onSelect}
          >
            Mantieni
          </Button>
        )}
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
