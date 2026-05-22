import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileInput,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { routeRef } from "@/lib/public-route-code";
import { useSubmitLock } from "@/lib/submit-lock";
import {
  caseActivityStatusLabels,
  caseStatusLabels,
  clientDisplayName,
  compareClients,
  compareCounterparties,
  counterpartyDisplayName,
  counterpartyKindLabels,
  priceItemKindLabels,
} from "@/lib/labels";
import { buildActivityAttachmentStoragePath, PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";

export const Route = createFileRoute("/creazione-guidata")({
  head: () => ({
    meta: [
      { title: "Creazione guidata · Pratix" },
      {
        name: "description",
        content: "Crea pratiche da archivio cartaceo con procedura manuale, anteprima e conferma.",
      },
      { property: "og:title", content: "Creazione guidata · Pratix" },
      {
        property: "og:description",
        content: "Crea pratiche da archivio cartaceo con procedura manuale, anteprima e conferma.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <ImportArchive />
    </AppLayout>
  ),
});

type ExistingMode = "existing" | "new";
type ClientKind = "individual" | "company";
type CounterpartyKind = "individual" | "company" | "group";
type ActivityStatus = "to_invoice" | "invoiced";
type CaseStatus = "open" | "in_progress" | "suspended" | "closed" | "archived";

type PrincipalRow = {
  id: string;
  business_name: string;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
};

type ClientRow = {
  id: string;
  kind: ClientKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
};

type CounterpartyRow = {
  id: string;
  kind: CounterpartyKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
};

type PriceBookRow = {
  id: string;
  principal_id: string;
  year: number;
  status: string;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
};

type PriceItemRow = {
  id: string;
  price_book_id: string;
  kind: "fee" | "expense_reimbursement";
  code: string;
  name: string;
  invoice_description: string | null;
  unit_price: number | null;
  requires_hearing_dates: boolean;
};

type PriceOption = PriceItemRow & {
  principal_id: string;
  price_book_year: number;
  price_book_status: string;
  book_fees_enabled: boolean;
  book_expense_reimbursements_enabled: boolean;
};

type ActivityDraft = {
  localId: string;
  activityId: string;
  activityDate: string;
  priceItemId: string;
  description: string;
  quantity: number;
  freeAmount: number;
  status: ActivityStatus;
  notes: string;
  hearingDates: string[];
  attachmentFile: File | null;
  attachmentName: string;
  attachmentType: string;
  attachmentNotes: string;
};

type ImportDraft = {
  principalMode: ExistingMode;
  principalId: string;
  principalName: string;
  clientMode: ExistingMode;
  clientId: string;
  clientKind: ClientKind;
  clientFirstName: string;
  clientLastName: string;
  clientBusinessName: string;
  counterpartyMode: ExistingMode;
  counterpartyId: string;
  counterpartyKind: CounterpartyKind;
  counterpartyFirstName: string;
  counterpartyLastName: string;
  counterpartyBusinessName: string;
  counterpartyNotes: string;
  practiceNumber: string;
  title: string;
  status: CaseStatus;
  openedAt: string;
  closedAt: string;
  authority: string;
  rgNumber: string;
  notes: string;
  activities: ActivityDraft[];
};

type StagedImport = {
  importId: string;
  rowId: string;
  status: "valid" | "warning" | "imported";
  normalized: NormalizedImport;
  warnings: string[];
};

type NormalizedImport = {
  principal: {
    mode: ExistingMode;
    id: string | null;
    name: string;
  };
  client: {
    mode: ExistingMode;
    id: string | null;
    kind: ClientKind;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  counterparty: {
    mode: ExistingMode;
    id: string | null;
    kind: CounterpartyKind;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
    notes: string | null;
  };
  practice: {
    practiceNumber: number;
    existingCaseId?: string | null;
    title: string;
    status: CaseStatus;
    openedAt: string;
    closedAt: string | null;
    authority: string | null;
    rgNumber: string | null;
    notes: string | null;
  };
  activities: Array<{
    id: string;
    activityDate: string;
    priceBookId: string;
    priceBookYear: number;
    priceItemId: string;
    kind: "fee" | "expense_reimbursement";
    code: string;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    status: ActivityStatus;
    notes: string | null;
    hearingDates: string[];
  }>;
};

const today = () => new Date().toISOString().slice(0, 10);

const makeActivity = (): ActivityDraft => ({
  localId: crypto.randomUUID(),
  activityId: crypto.randomUUID(),
  activityDate: today(),
  priceItemId: "",
  description: "",
  quantity: 1,
  freeAmount: 0,
  status: "to_invoice",
  notes: "",
  hearingDates: [],
  attachmentFile: null,
  attachmentName: "",
  attachmentType: "",
  attachmentNotes: "",
});

const initialDraft = (): ImportDraft => ({
  principalMode: "existing",
  principalId: "",
  principalName: "",
  clientMode: "existing",
  clientId: "",
  clientKind: "company",
  clientFirstName: "",
  clientLastName: "",
  clientBusinessName: "",
  counterpartyMode: "existing",
  counterpartyId: "",
  counterpartyKind: "company",
  counterpartyFirstName: "",
  counterpartyLastName: "",
  counterpartyBusinessName: "",
  counterpartyNotes: "",
  practiceNumber: "",
  title: "",
  status: "open",
  openedAt: today(),
  closedAt: "",
  authority: "",
  rgNumber: "",
  notes: "",
  activities: [],
});

function ImportArchive() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Creazione guidata"
        description="Trascrivi una pratica da archivio cartaceo con controllo finale prima della conferma."
        actions={
          <Link to="/pratiche">
            <Button size="sm" variant="outline">
              <ArrowLeft className="mr-1 size-4" /> Pratiche
            </Button>
          </Link>
        }
      />

      <ManualImportWizard
        onImported={(caseId) => navigate({ to: "/pratiche/$caseId", params: { caseId } })}
      />
    </>
  );
}

function ManualImportWizard({ onImported }: { onImported: (caseId: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ImportDraft>(() => initialDraft());
  const [staged, setStaged] = useState<StagedImport | null>(null);
  const prepareLock = useSubmitLock();
  const confirmLock = useSubmitLock();

  const { data: principals = [] } = useQuery({
    queryKey: ["principals", "import-archive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name, fees_enabled, expense_reimbursements_enabled")
        .is("archived_at", null)
        .order("business_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PrincipalRow[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", "import-archive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, kind, first_name, last_name, business_name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ClientRow[]).slice().sort(compareClients);
    },
  });

  const { data: counterparties = [] } = useQuery({
    queryKey: ["counterparties", "import-archive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counterparties")
        .select("id, kind, first_name, last_name, business_name");
      if (error) throw error;
      return ((data ?? []) as CounterpartyRow[]).slice().sort(compareCounterparties);
    },
  });

  const principalId = draft.principalMode === "existing" ? draft.principalId : "";

  const { data: priceBooks = [] } = useQuery({
    queryKey: ["price-books", "import-archive", principalId],
    enabled: Boolean(principalId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_books")
        .select("id, principal_id, year, status, fees_enabled, expense_reimbursements_enabled")
        .eq("principal_id", principalId)
        .in("status", ["active", "draft"])
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PriceBookRow[];
    },
  });

  const priceBookIds = useMemo(() => priceBooks.map((book) => book.id), [priceBooks]);

  const { data: priceItems = [] } = useQuery({
    queryKey: ["price-items", "import-archive", priceBookIds],
    enabled: priceBookIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_items")
        .select(
          "id, price_book_id, kind, code, name, invoice_description, unit_price, requires_hearing_dates",
        )
        .in("price_book_id", priceBookIds)
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PriceItemRow[];
    },
  });

  const priceOptions = useMemo(() => {
    const booksById = new Map(priceBooks.map((book) => [book.id, book]));
    return priceItems
      .map((item) => {
        const book = booksById.get(item.price_book_id);
        if (!book) return null;
        return {
          ...item,
          principal_id: book.principal_id,
          price_book_year: book.year,
          price_book_status: book.status,
          book_fees_enabled: book.fees_enabled,
          book_expense_reimbursements_enabled: book.expense_reimbursements_enabled,
        };
      })
      .filter((item): item is PriceOption => Boolean(item))
      .filter((item) =>
        item.kind === "fee" ? item.book_fees_enabled : item.book_expense_reimbursements_enabled,
      );
  }, [priceBooks, priceItems]);

  const updateDraft = <K extends keyof ImportDraft>(key: K, value: ImportDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setStaged(null);
  };

  const updateActivity = <K extends keyof ActivityDraft>(
    localId: string,
    key: K,
    value: ActivityDraft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      activities: current.activities.map((activity) =>
        activity.localId === localId ? { ...activity, [key]: value } : activity,
      ),
    }));
    setStaged(null);
  };

  const addActivity = () => {
    setDraft((current) => ({ ...current, activities: [...current.activities, makeActivity()] }));
    setStaged(null);
  };

  const removeActivity = (localId: string) => {
    setDraft((current) => ({
      ...current,
      activities: current.activities.filter((activity) => activity.localId !== localId),
    }));
    setStaged(null);
  };

  const prepared = useMemo(
    () => buildNormalizedImport(draft, principals, clients, counterparties, priceOptions),
    [clients, counterparties, draft, priceOptions, principals],
  );

  const prepareMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (prepared.errors.length > 0) throw new Error(prepared.errors[0]);

      const { data: importRow, error: importError } = await supabase
        .from("imports")
        .insert({
          user_id: user.id,
          mode: "manual",
          status: "validated",
          total_rows: 1,
          valid_rows: 1,
          error_rows: 0,
          notes: "Pratica preparata dalla procedura guidata manuale.",
        })
        .select("id")
        .single();
      if (importError) throw importError;

      const { data: row, error: rowError } = await supabase
        .from("import_rows")
        .insert({
          user_id: user.id,
          import_id: importRow.id,
          row_number: 1,
          status: prepared.warnings.length > 0 ? "warning" : "valid",
          raw_data: serializeImportDraft(draft) as unknown as Json,
          normalized_data: prepared.normalized as unknown as Json,
          warning_messages: prepared.warnings,
        })
        .select("id")
        .single();
      if (rowError) throw rowError;

      return { importId: importRow.id, rowId: row.id };
    },
    onSuccess: (row) => {
      setStaged({
        ...row,
        status: prepared.warnings.length > 0 ? "warning" : "valid",
        normalized: prepared.normalized,
        warnings: prepared.warnings,
      });
      setStep(3);
      toast.success("Anteprima pronta");
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: prepareLock.release,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!staged) throw new Error("Prepara prima l'anteprima");
      if (staged.status === "imported") throw new Error("Questa riga è già stata importata.");
      const caseId = await applyImportRow(staged.rowId);
      const attachmentErrors = await uploadImportActivityAttachments(
        user.id,
        prepared.normalized.activities,
        draft.activities,
      );
      return { caseId, attachmentErrors };
    },
    onSuccess: async ({ caseId, attachmentErrors }) => {
      if (attachmentErrors.length > 0) {
        toast.error(`Pratica importata, ${attachmentErrors.length} allegati non caricati.`);
      } else {
        toast.success("Pratica importata");
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["imports"] }),
        qc.invalidateQueries({ queryKey: ["cases"] }),
        qc.invalidateQueries({ queryKey: ["activities"] }),
        qc.invalidateQueries({ queryKey: ["principals"] }),
        qc.invalidateQueries({ queryKey: ["clients"] }),
        qc.invalidateQueries({ queryKey: ["counterparties"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setStaged((current) => (current ? { ...current, status: "imported" } : current));
      onImported(caseId);
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: confirmLock.release,
  });

  const steps = ["Soggetti", "Pratica", "Attività", "Riepilogo"];

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (step < 3) setStep((current) => current + 1);
        else if (!staged) {
          if (prepareLock.acquire()) prepareMutation.mutate();
        } else if (confirmLock.acquire()) {
          confirmMutation.mutate();
        }
      }}
      className="space-y-4"
    >
      <div className="grid gap-2 md:grid-cols-4">
        {steps.map((label, index) => (
          <button
            key={label}
            type="button"
            className={`rounded-md border border-border px-3 py-2 text-left text-sm ${
              step === index ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => setStep(index)}
          >
            <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full border border-border text-xs">
              {index + 1}
            </span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <SubjectsStep
          draft={draft}
          principals={principals}
          clients={clients}
          counterparties={counterparties}
          updateDraft={updateDraft}
        />
      ) : null}

      {step === 1 ? <PracticeStep draft={draft} updateDraft={updateDraft} /> : null}

      {step === 2 ? (
        <ActivitiesStep
          draft={draft}
          priceOptions={priceOptions}
          updateActivity={updateActivity}
          addActivity={addActivity}
          removeActivity={removeActivity}
        />
      ) : null}

      {step === 3 ? (
        <ReviewStep prepared={prepared} staged={staged} isPreparing={prepareMutation.isPending} />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0 || prepareMutation.isPending || confirmMutation.isPending}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          <ArrowLeft className="mr-1 size-4" /> Indietro
        </Button>
        <div className="flex gap-2">
          {step < 3 ? (
            <Button type="submit">
              Avanti <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : staged ? (
            <Button
              type="submit"
              disabled={
                confirmMutation.isPending ||
                prepared.errors.length > 0 ||
                staged.status === "imported"
              }
            >
              <CheckCircle2 className="mr-1 size-4" />
              {staged.status === "imported"
                ? "Import completato"
                : confirmMutation.isPending
                  ? "Importazione…"
                  : "Conferma import"}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={prepareMutation.isPending || prepared.errors.length > 0}
            >
              <FileInput className="mr-1 size-4" />
              {prepareMutation.isPending ? "Preparazione…" : "Prepara anteprima"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function SubjectsStep({
  draft,
  principals,
  clients,
  counterparties,
  updateDraft,
}: {
  draft: ImportDraft;
  principals: PrincipalRow[];
  clients: ClientRow[];
  counterparties: CounterpartyRow[];
  updateDraft: <K extends keyof ImportDraft>(key: K, value: ImportDraft[K]) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Committente</CardTitle>
          <CardDescription>
            Scegli un committente esistente o inseriscine uno nuovo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ModeSelect
            id="principal_mode"
            value={draft.principalMode}
            onValueChange={(value) => {
              updateDraft("principalMode", value);
              updateDraft("principalId", "");
            }}
            existingLabel="Esistente"
            newLabel="Nuovo"
          />
          {draft.principalMode === "existing" ? (
            <Select
              value={draft.principalId}
              onValueChange={(value) => updateDraft("principalId", value)}
            >
              <SelectTrigger aria-label="Seleziona committente esistente">
                <SelectValue placeholder="Seleziona committente" />
              </SelectTrigger>
              <SelectContent>
                {principals.map((principal) => (
                  <SelectItem key={principal.id} value={principal.id}>
                    {principal.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="principal_name">Ragione sociale</Label>
              <Input
                id="principal_name"
                value={draft.principalName}
                onChange={(event) => updateDraft("principalName", event.target.value)}
                placeholder="Es. Banca Alfa S.p.A."
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cliente</CardTitle>
          <CardDescription>Il cliente verrà collegato al committente in conferma.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ModeSelect
            id="client_mode"
            value={draft.clientMode}
            onValueChange={(value) => {
              updateDraft("clientMode", value);
              updateDraft("clientId", "");
            }}
            existingLabel="Esistente"
            newLabel="Nuovo"
          />
          {draft.clientMode === "existing" ? (
            <Select
              value={draft.clientId}
              onValueChange={(value) => updateDraft("clientId", value)}
            >
              <SelectTrigger aria-label="Seleziona cliente esistente">
                <SelectValue placeholder="Seleziona cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {clientDisplayName(client)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <PersonOrCompanyFields
              kind={draft.clientKind}
              firstName={draft.clientFirstName}
              lastName={draft.clientLastName}
              businessName={draft.clientBusinessName}
              kindLabel="Tipo cliente"
              companyPlaceholder="Es. Alfa S.r.l."
              onKindChange={(value) => updateDraft("clientKind", value as ClientKind)}
              onFirstNameChange={(value) => updateDraft("clientFirstName", value)}
              onLastNameChange={(value) => updateDraft("clientLastName", value)}
              onBusinessNameChange={(value) => updateDraft("clientBusinessName", value)}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Controparte</CardTitle>
          <CardDescription>
            Per gruppi composti puoi usare il nome generico e le note.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ModeSelect
            id="counterparty_mode"
            value={draft.counterpartyMode}
            onValueChange={(value) => {
              updateDraft("counterpartyMode", value);
              updateDraft("counterpartyId", "");
            }}
            existingLabel="Esistente"
            newLabel="Nuova"
          />
          {draft.counterpartyMode === "existing" ? (
            <Select
              value={draft.counterpartyId}
              onValueChange={(value) => updateDraft("counterpartyId", value)}
            >
              <SelectTrigger aria-label="Seleziona controparte esistente">
                <SelectValue placeholder="Seleziona controparte" />
              </SelectTrigger>
              <SelectContent>
                {counterparties.map((counterparty) => (
                  <SelectItem key={counterparty.id} value={counterparty.id}>
                    {counterpartyDisplayName(counterparty)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <PersonOrCompanyFields
                kind={draft.counterpartyKind}
                firstName={draft.counterpartyFirstName}
                lastName={draft.counterpartyLastName}
                businessName={draft.counterpartyBusinessName}
                kindLabel="Tipo controparte"
                includeGroup
                companyPlaceholder="Es. Debitore S.r.l."
                groupPlaceholder="Es. Debitori collegati"
                onKindChange={(value) => updateDraft("counterpartyKind", value as CounterpartyKind)}
                onFirstNameChange={(value) => updateDraft("counterpartyFirstName", value)}
                onLastNameChange={(value) => updateDraft("counterpartyLastName", value)}
                onBusinessNameChange={(value) => updateDraft("counterpartyBusinessName", value)}
              />
              <div className="space-y-2">
                <Label htmlFor="counterparty_notes">Note controparte</Label>
                <Textarea
                  id="counterparty_notes"
                  value={draft.counterpartyNotes}
                  onChange={(event) => updateDraft("counterpartyNotes", event.target.value)}
                  rows={3}
                  placeholder="Es. recapiti, ruolo nel credito o note di recupero"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PracticeStep({
  draft,
  updateDraft,
}: {
  draft: ImportDraft;
  updateDraft: <K extends keyof ImportDraft>(key: K, value: ImportDraft[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dati pratica</CardTitle>
        <CardDescription>
          Inserisci il numero come riportato sull'archivio cartaceo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-sm">
          <div className="space-y-2">
            <Label htmlFor="practice_number">Numero pratica</Label>
            <Input
              id="practice_number"
              type="number"
              min="1"
              step="1"
              value={draft.practiceNumber}
              onChange={(event) => updateDraft("practiceNumber", event.target.value)}
              placeholder="Es. 157"
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="practice_status">Stato pratica</Label>
            <Select
              value={draft.status}
              onValueChange={(value) => updateDraft("status", value as CaseStatus)}
            >
              <SelectTrigger id="practice_status" aria-label="Stato pratica">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(caseStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="opened_at">Data apertura</Label>
            <Input
              id="opened_at"
              type="date"
              value={draft.openedAt}
              onChange={(event) => updateDraft("openedAt", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closed_at">Data chiusura</Label>
            <Input
              id="closed_at"
              type="date"
              value={draft.closedAt}
              onChange={(event) => updateDraft("closedAt", event.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="authority">Autorità giudiziaria</Label>
            <Input
              id="authority"
              value={draft.authority}
              onChange={(event) => updateDraft("authority", event.target.value)}
              placeholder="Es. Tribunale di Milano"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rg_number">N. R.G.</Label>
            <Input
              id="rg_number"
              value={draft.rgNumber}
              onChange={(event) => updateDraft("rgNumber", event.target.value)}
              placeholder="Es. 1234/2026"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="practice_notes">Note</Label>
          <Textarea
            id="practice_notes"
            rows={4}
            value={draft.notes}
            onChange={(event) => updateDraft("notes", event.target.value)}
            placeholder="Es. stato trattativa, prossima attività o dettaglio del credito"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivitiesStep({
  draft,
  priceOptions,
  updateActivity,
  addActivity,
  removeActivity,
}: {
  draft: ImportDraft;
  priceOptions: PriceOption[];
  updateActivity: <K extends keyof ActivityDraft>(
    localId: string,
    key: K,
    value: ActivityDraft[K],
  ) => void;
  addActivity: () => void;
  removeActivity: (localId: string) => void;
}) {
  const canAddActivities = draft.principalMode === "existing" && Boolean(draft.principalId);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Attività storiche</CardTitle>
            <CardDescription>
              Aggiungi compensi e rimborsi spese già presenti nell'archivio.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={addActivity} disabled={!canAddActivities}>
            <Plus className="mr-1 size-4" /> Aggiungi attività
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canAddActivities ? (
          <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            Per inserire attività nel wizard seleziona un committente esistente con Prezzi
            configurati. Se il committente è nuovo, importa prima la pratica e poi configura i
            Prezzi.
          </p>
        ) : priceOptions.length === 0 ? (
          <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            Nessuna voce prezzo trovata per questo committente. Puoi importare la pratica senza
            attività e completarle dopo dalla sezione Attività.
          </p>
        ) : null}

        {draft.activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna attività storica inserita.</p>
        ) : (
          <div className="space-y-4">
            {draft.activities.map((activity, index) => (
              <ActivityEditor
                key={activity.localId}
                index={index}
                activity={activity}
                priceOptions={priceOptions}
                updateActivity={updateActivity}
                removeActivity={removeActivity}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityEditor({
  index,
  activity,
  priceOptions,
  updateActivity,
  removeActivity,
}: {
  index: number;
  activity: ActivityDraft;
  priceOptions: PriceOption[];
  updateActivity: <K extends keyof ActivityDraft>(
    localId: string,
    key: K,
    value: ActivityDraft[K],
  ) => void;
  removeActivity: (localId: string) => void;
}) {
  const selectedItem = priceOptions.find((item) => item.id === activity.priceItemId) ?? null;
  const quantity = selectedItem?.requires_hearing_dates
    ? activity.hearingDates.filter(Boolean).length
    : activity.quantity;
  const unitPrice =
    selectedItem?.kind === "expense_reimbursement"
      ? Number(activity.freeAmount || 0)
      : Number(selectedItem?.unit_price ?? 0);
  const amount = quantity * unitPrice;

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Attività {index + 1}</p>
          <p className="text-xs text-muted-foreground">
            {selectedItem ? formatCurrency(amount) : "Seleziona una voce prezzo"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => removeActivity(activity.localId)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Data</Label>
          <Input
            type="date"
            value={activity.activityDate}
            onChange={(event) =>
              updateActivity(activity.localId, "activityDate", event.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Stato</Label>
          <Select
            value={activity.status}
            onValueChange={(value) =>
              updateActivity(activity.localId, "status", value as ActivityStatus)
            }
          >
            <SelectTrigger aria-label={`Stato attività ${activity.localId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(caseActivityStatusLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Prezzo</Label>
          <Select
            value={activity.priceItemId}
            onValueChange={(value) => {
              const item = priceOptions.find((option) => option.id === value);
              updateActivity(activity.localId, "priceItemId", value);
              updateActivity(
                activity.localId,
                "description",
                item?.invoice_description || item?.name || "",
              );
              updateActivity(activity.localId, "quantity", item?.requires_hearing_dates ? 0 : 1);
              updateActivity(activity.localId, "hearingDates", []);
            }}
          >
            <SelectTrigger aria-label={`Prezzo attività ${activity.localId}`}>
              <SelectValue placeholder="Seleziona voce prezzo" />
            </SelectTrigger>
            <SelectContent>
              {priceOptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.price_book_year} · {priceItemKindLabels[item.kind]} · {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Descrizione</Label>
          <Input
            value={activity.description}
            onChange={(event) =>
              updateActivity(activity.localId, "description", event.target.value)
            }
          />
        </div>
        {selectedItem?.requires_hearing_dates ? (
          <HearingDatesEditor activity={activity} updateActivity={updateActivity} />
        ) : (
          <div className="space-y-2">
            <Label>Quantità</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={activity.quantity}
              onChange={(event) =>
                updateActivity(activity.localId, "quantity", Number(event.target.value))
              }
            />
          </div>
        )}
        <div className="space-y-2">
          <Label>
            {selectedItem?.kind === "expense_reimbursement" ? "Importo" : "Prezzo unitario"}
          </Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            disabled={selectedItem?.kind === "fee"}
            onChange={(event) =>
              updateActivity(activity.localId, "freeAmount", Number(event.target.value))
            }
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Note attività</Label>
          <Textarea
            rows={2}
            value={activity.notes}
            onChange={(event) => updateActivity(activity.localId, "notes", event.target.value)}
          />
        </div>
        <div className="space-y-4 rounded-md border border-border p-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <Paperclip className="size-4 text-muted-foreground" />
            <Label htmlFor={`attachment_${activity.localId}`}>Allegato attività</Label>
          </div>
          <Input
            id={`attachment_${activity.localId}`}
            type="file"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              updateActivity(activity.localId, "attachmentFile", nextFile);
              if (nextFile && !activity.attachmentName) {
                updateActivity(activity.localId, "attachmentName", nextFile.name);
              }
            }}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome descrittivo</Label>
              <Input
                value={activity.attachmentName}
                disabled={!activity.attachmentFile}
                onChange={(event) =>
                  updateActivity(activity.localId, "attachmentName", event.target.value)
                }
                placeholder="Es. Ricevuta contributo unificato"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo documento</Label>
              <Input
                value={activity.attachmentType}
                disabled={!activity.attachmentFile}
                placeholder="Es. giustificativo spesa"
                onChange={(event) =>
                  updateActivity(activity.localId, "attachmentType", event.target.value)
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Note allegato</Label>
            <Textarea
              rows={2}
              value={activity.attachmentNotes}
              disabled={!activity.attachmentFile}
              onChange={(event) =>
                updateActivity(activity.localId, "attachmentNotes", event.target.value)
              }
              placeholder="Es. importo anticipato per iscrizione a ruolo"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HearingDatesEditor({
  activity,
  updateActivity,
}: {
  activity: ActivityDraft;
  updateActivity: <K extends keyof ActivityDraft>(
    localId: string,
    key: K,
    value: ActivityDraft[K],
  ) => void;
}) {
  const setCount = (count: number) => {
    const normalized = Math.max(0, count);
    const next = activity.hearingDates.slice(0, normalized);
    while (next.length < normalized) next.push(activity.activityDate);
    updateActivity(activity.localId, "hearingDates", next);
  };

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="max-w-xs space-y-2">
        <Label>Numero udienze</Label>
        <Input
          type="number"
          min="0"
          step="1"
          value={activity.hearingDates.length}
          onChange={(event) => setCount(Number(event.target.value))}
        />
      </div>
      {activity.hearingDates.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {activity.hearingDates.map((date, index) => (
            <div key={index} className="space-y-2">
              <Label>Udienza {index + 1}</Label>
              <Input
                type="date"
                value={date}
                onChange={(event) => {
                  const next = activity.hearingDates.map((current, currentIndex) =>
                    currentIndex === index ? event.target.value : current,
                  );
                  updateActivity(activity.localId, "hearingDates", next);
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReviewStep({
  prepared,
  staged,
  isPreparing,
}: {
  prepared: ReturnType<typeof buildNormalizedImport>;
  staged: StagedImport | null;
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
              <CardTitle className="text-base">Anteprima import</CardTitle>
              <CardDescription>
                Nessun dato operativo viene scritto prima della conferma finale.
              </CardDescription>
            </div>
            {staged?.status === "imported" ? (
              <Badge variant="secondary">Import completato</Badge>
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

function ModeSelect({
  id,
  value,
  onValueChange,
  existingLabel,
  newLabel,
}: {
  id: string;
  value: ExistingMode;
  onValueChange: (value: ExistingMode) => void;
  existingLabel: string;
  newLabel: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onValueChange(next as ExistingMode)}>
      <SelectTrigger
        id={id}
        aria-label={`Scegli tra ${existingLabel.toLowerCase()} e ${newLabel.toLowerCase()}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="existing">{existingLabel}</SelectItem>
        <SelectItem value="new">{newLabel}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PersonOrCompanyFields({
  kind,
  firstName,
  lastName,
  businessName,
  kindLabel,
  includeGroup,
  companyPlaceholder = "Es. Alfa S.r.l.",
  groupPlaceholder = "Es. Debitori collegati",
  onKindChange,
  onFirstNameChange,
  onLastNameChange,
  onBusinessNameChange,
}: {
  kind: ClientKind | CounterpartyKind;
  firstName: string;
  lastName: string;
  businessName: string;
  kindLabel: string;
  includeGroup?: boolean;
  companyPlaceholder?: string;
  groupPlaceholder?: string;
  onKindChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onBusinessNameChange: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{kindLabel}</Label>
        <Select value={kind} onValueChange={onKindChange}>
          <SelectTrigger aria-label={kindLabel}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Persona fisica</SelectItem>
            <SelectItem value="company">Società</SelectItem>
            {includeGroup ? <SelectItem value="group">Composta</SelectItem> : null}
          </SelectContent>
        </Select>
      </div>
      {kind === "individual" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Cognome</Label>
            <Input
              value={lastName}
              onChange={(event) => onLastNameChange(event.target.value)}
              placeholder="Es. Rossi"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={firstName}
              onChange={(event) => onFirstNameChange(event.target.value)}
              placeholder="Es. Anna"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>{kind === "group" ? "Nome gruppo" : "Ragione sociale"}</Label>
          <Input
            value={businessName}
            onChange={(event) => onBusinessNameChange(event.target.value)}
            placeholder={kind === "group" ? groupPlaceholder : companyPlaceholder}
          />
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

function PreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function buildNormalizedImport(
  draft: ImportDraft,
  principals: PrincipalRow[],
  clients: ClientRow[],
  counterparties: CounterpartyRow[],
  priceOptions: PriceOption[],
) {
  const errors: string[] = [];
  const warnings: string[] = [];

  const selectedPrincipal = principals.find((principal) => principal.id === draft.principalId);
  const selectedClient = clients.find((client) => client.id === draft.clientId);
  const selectedCounterparty = counterparties.find(
    (counterparty) => counterparty.id === draft.counterpartyId,
  );

  const practiceNumber = Number(draft.practiceNumber);
  if (!Number.isInteger(practiceNumber) || practiceNumber <= 0) {
    errors.push("Inserisci un numero pratica numerico positivo.");
  }

  if (draft.principalMode === "existing" && !selectedPrincipal) {
    errors.push("Seleziona un committente.");
  }
  if (draft.principalMode === "new" && !draft.principalName.trim()) {
    errors.push("Inserisci la ragione sociale del nuovo committente.");
  }
  if (draft.clientMode === "existing" && !selectedClient) {
    errors.push("Seleziona un cliente.");
  }
  if (draft.clientMode === "new" && !displayDraftClient(draft)) {
    errors.push("Inserisci i dati del nuovo cliente.");
  }
  if (draft.counterpartyMode === "existing" && !selectedCounterparty) {
    errors.push("Seleziona una controparte.");
  }
  if (draft.counterpartyMode === "new" && !displayDraftCounterparty(draft)) {
    errors.push("Inserisci i dati della nuova controparte.");
  }

  const activities = draft.activities.map((activity, index) => {
    const item = priceOptions.find((option) => option.id === activity.priceItemId);
    if (!item) {
      errors.push(`Attività ${index + 1}: seleziona una voce prezzo.`);
      return null;
    }
    const quantity = item.requires_hearing_dates
      ? activity.hearingDates.filter(Boolean).length
      : Number(activity.quantity);
    const unitPrice =
      item.kind === "expense_reimbursement"
        ? Number(activity.freeAmount || 0)
        : Number(item.unit_price ?? 0);

    if (!activity.activityDate) errors.push(`Attività ${index + 1}: inserisci la data.`);
    if (!activity.description.trim())
      errors.push(`Attività ${index + 1}: inserisci la descrizione.`);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Attività ${index + 1}: inserisci una quantità positiva.`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      errors.push(`Attività ${index + 1}: inserisci un importo valido.`);
    }
    if (item.requires_hearing_dates && activity.hearingDates.some((date) => !date)) {
      errors.push(`Attività ${index + 1}: completa tutte le date udienza.`);
    }
    const hearingDates = activity.hearingDates.filter(Boolean);

    return {
      id: activity.activityId,
      activityDate: activity.activityDate,
      priceBookId: item.price_book_id,
      priceBookYear: item.price_book_year,
      priceItemId: item.id,
      kind: item.kind,
      code: item.code,
      name: item.name,
      description: activity.description.trim(),
      quantity,
      unitPrice,
      status: activity.status,
      notes: activity.notes.trim() || null,
      hearingDates: item.requires_hearing_dates ? hearingDates : [],
    };
  });

  if (draft.activities.length === 0) {
    warnings.push("La pratica verrà importata senza attività storiche.");
  }
  if (draft.principalMode === "new" && draft.activities.length > 0) {
    warnings.push(
      "Le attività storiche richiedono un committente esistente con Prezzi configurati.",
    );
  }

  const normalized: NormalizedImport = {
    principal: {
      mode: draft.principalMode,
      id: selectedPrincipal?.id ?? null,
      name: selectedPrincipal?.business_name ?? draft.principalName.trim(),
    },
    client: {
      mode: draft.clientMode,
      id: selectedClient?.id ?? null,
      kind: selectedClient?.kind ?? draft.clientKind,
      firstName: selectedClient?.first_name ?? trimOrNull(draft.clientFirstName),
      lastName: selectedClient?.last_name ?? trimOrNull(draft.clientLastName),
      businessName: selectedClient?.business_name ?? trimOrNull(draft.clientBusinessName),
    },
    counterparty: {
      mode: draft.counterpartyMode,
      id: selectedCounterparty?.id ?? null,
      kind: selectedCounterparty?.kind ?? draft.counterpartyKind,
      firstName: selectedCounterparty?.first_name ?? trimOrNull(draft.counterpartyFirstName),
      lastName: selectedCounterparty?.last_name ?? trimOrNull(draft.counterpartyLastName),
      businessName:
        selectedCounterparty?.business_name ?? trimOrNull(draft.counterpartyBusinessName),
      notes: trimOrNull(draft.counterpartyNotes),
    },
    practice: {
      practiceNumber: Number.isFinite(practiceNumber) ? practiceNumber : 0,
      existingCaseId: null,
      title: `Pratica ${draft.practiceNumber || "—"}`,
      status: draft.status,
      openedAt: draft.openedAt || today(),
      closedAt: draft.closedAt || null,
      authority: trimOrNull(draft.authority),
      rgNumber: trimOrNull(draft.rgNumber),
      notes: trimOrNull(draft.notes),
    },
    activities: activities.filter((activity): activity is NormalizedImport["activities"][number] =>
      Boolean(activity),
    ),
  };

  return { normalized, errors, warnings };
}

async function applyImportRow(rowId: string) {
  const { data, error } = await supabase.rpc("apply_import_row", { p_import_row_id: rowId });
  if (error) throw error;
  if (!data) throw new Error("Import non completato.");
  const { data: caseRow, error: caseError } = await supabase
    .from("cases")
    .select("id, public_code")
    .eq("id", data)
    .single();
  if (caseError) throw caseError;
  return routeRef(caseRow);
}

function serializeImportDraft(draft: ImportDraft) {
  return {
    ...draft,
    activities: draft.activities.map((activity) => ({
      ...activity,
      attachmentFile: activity.attachmentFile
        ? {
            name: activity.attachmentFile.name,
            type: activity.attachmentFile.type,
            size: activity.attachmentFile.size,
          }
        : null,
    })),
  };
}

async function uploadImportActivityAttachments(
  userId: string,
  normalizedActivities: NormalizedImport["activities"],
  draftActivities: ActivityDraft[],
) {
  const errors: string[] = [];
  const activitiesById = new Map(normalizedActivities.map((activity) => [activity.id, activity]));

  for (const draftActivity of draftActivities) {
    const file = draftActivity.attachmentFile;
    const normalizedActivity = activitiesById.get(draftActivity.activityId);
    if (!file || !normalizedActivity) continue;

    try {
      const storagePath = buildActivityAttachmentStoragePath(
        userId,
        normalizedActivity.id,
        `${Date.now()}-${file.name}`,
      );
      const { error: uploadError } = await supabase.storage
        .from(PRATIX_DOCUMENTS_BUCKET)
        .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) throw uploadError;

      const { error: attachmentError } = await supabase.from("activity_attachments").insert({
        user_id: userId,
        activity_id: normalizedActivity.id,
        storage_path: storagePath,
        original_file_name: file.name,
        display_name: draftActivity.attachmentName.trim() || file.name,
        document_type: draftActivity.attachmentType.trim() || null,
        mime_type: file.type || null,
        size_bytes: file.size,
        preview_available: file.type.startsWith("image/") || file.type === "application/pdf",
        notes: draftActivity.attachmentNotes.trim() || null,
      });
      if (attachmentError) throw attachmentError;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Errore allegato");
    }
  }

  return errors;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findByName<T>(items: T[], name: string, display: (item: T) => string) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return null;
  return items.find((item) => normalizeText(display(item)) === normalizedName) ?? null;
}

function findCounterpartyByName(counterparties: CounterpartyRow[], name: string) {
  const normalizedName = normalizeText(name);
  if (!normalizedName) return null;

  return (
    counterparties.find((counterparty) =>
      counterpartyImportNames(counterparty).some(
        (counterpartyName) => normalizeText(counterpartyName) === normalizedName,
      ),
    ) ?? null
  );
}

function counterpartyImportNames(counterparty: CounterpartyRow) {
  if (counterparty.kind !== "individual") return [counterpartyDisplayName(counterparty)];
  return [
    counterpartyDisplayName(counterparty),
    [counterparty.first_name, counterparty.last_name].filter(Boolean).join(" "),
  ];
}

function parseDateInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const serial = Number(trimmed.replace(",", "."));
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    return new Date((serial - 25569) * 86400 * 1000).toISOString().slice(0, 10);
  }

  const match = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return "";
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseHearingDates(value: string) {
  return value
    .split(/[;,|]/)
    .map((date) => parseDateInput(date))
    .filter(Boolean);
}

function selectPriceOptionsForPrincipal(
  priceOptions: PriceOption[],
  principalId: string,
  preferredYear: number,
) {
  const principalOptions = priceOptions.filter((option) => option.principal_id === principalId);
  const sameYear = principalOptions.filter((option) => option.price_book_year === preferredYear);
  return sameYear.length > 0 ? sameYear : principalOptions;
}

function findPriceOption(priceOptions: PriceOption[], code: string, name: string) {
  const normalizedCode = normalizeText(code);
  const normalizedName = normalizeText(name);
  if (normalizedCode) {
    const byCode = priceOptions.find((option) => normalizeText(option.code) === normalizedCode);
    if (byCode) return byCode;
  }
  if (!normalizedName) return null;
  return (
    priceOptions.find((option) => normalizeText(option.name) === normalizedName) ??
    priceOptions.find((option) => normalizeText(option.name).includes(normalizedName)) ??
    null
  );
}

function displayDraftClient(draft: ImportDraft) {
  if (draft.clientKind === "company") return draft.clientBusinessName.trim();
  return [draft.clientFirstName, draft.clientLastName].filter(Boolean).join(" ").trim();
}

function displayDraftCounterparty(draft: ImportDraft) {
  if (draft.counterpartyKind === "individual") {
    return [draft.counterpartyLastName, draft.counterpartyFirstName]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return draft.counterpartyBusinessName.trim();
}

function displayNormalizedClient(client: NormalizedImport["client"]) {
  if (client.kind === "company") return client.businessName || "—";
  return [client.firstName, client.lastName].filter(Boolean).join(" ") || "—";
}

function displayNormalizedCounterparty(counterparty: NormalizedImport["counterparty"]) {
  if (counterparty.kind === "individual") {
    return [counterparty.lastName, counterparty.firstName].filter(Boolean).join(" ") || "—";
  }
  return counterparty.businessName || counterpartyKindLabels[counterparty.kind] || "—";
}

function trimOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}
