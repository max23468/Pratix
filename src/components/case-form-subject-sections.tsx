import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DuplicateWarningPanel } from "@/components/duplicate-warning-panel";
import { CounterpartySelect, PrincipalSelect } from "@/components/debt-collection-selects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clientDisplayName, clientKindLabels, counterpartyKindLabels } from "@/lib/labels";
import type {
  CaseFormController,
  ClientKind,
  ClientOption,
  CounterpartyKind,
} from "@/components/case-form";

export function CasePrincipalClientFields({ controller }: { controller: CaseFormController }) {
  const {
    form,
    upd,
    quickPrincipalOpen,
    setQuickPrincipalOpen,
    quickPrincipal,
    resetQuickPrincipal,
    updateQuickPrincipal,
    quickPrincipalDuplicates,
    setQuickPrincipalDuplicates,
    quickPrincipalOverrideRef,
    quickPrincipalLock,
    createQuickPrincipalMutation,
    availableClients,
    quickClientOpen,
    setQuickClientOpen,
    quickClient,
    resetQuickClient,
    updateQuickClient,
    quickClientDuplicates,
    setQuickClientDuplicates,
    quickClientOverrideRef,
    quickClientLock,
    createQuickClientMutation,
    linkExistingClientToSelectedPrincipal,
  } = controller;
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="principal_id">Committente</Label>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <PrincipalSelect
              id="principal_id"
              value={form.principal_id}
              onValueChange={(value) => {
                upd("principal_id", value);
                upd("client_id", null);
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuickPrincipalOpen((open) => !open)}
          >
            <Plus className="mr-1 size-4" /> Nuovo
          </Button>
        </div>
        {quickPrincipalOpen ? (
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quick_principal_name">Nome committente</Label>
              <Input
                id="quick_principal_name"
                value={quickPrincipal.business_name}
                onChange={(event) => updateQuickPrincipal("business_name", event.target.value)}
                placeholder="Es. Banca Alfa S.p.A."
              />
            </div>
            <DuplicateWarningPanel
              candidates={quickPrincipalDuplicates}
              onUseExisting={(record) => {
                upd("principal_id", record.id);
                upd("client_id", null);
                resetQuickPrincipal();
                setQuickPrincipalDuplicates([]);
                setQuickPrincipalOpen(false);
              }}
              onCreateAnyway={() => {
                quickPrincipalOverrideRef.current = true;
                setQuickPrincipalDuplicates([]);
                if (quickPrincipalLock.acquire()) createQuickPrincipalMutation.mutate();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetQuickPrincipal();
                  setQuickPrincipalOpen(false);
                }}
              >
                Annulla
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (quickPrincipalLock.acquire()) createQuickPrincipalMutation.mutate();
                }}
                disabled={createQuickPrincipalMutation.isPending}
              >
                {createQuickPrincipalMutation.isPending ? "Creazione…" : "Crea"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="client_id">Cliente</Label>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Select
              value={form.client_id ?? ""}
              onValueChange={(value) => {
                if (value) upd("client_id", value);
              }}
              disabled={!form.principal_id}
            >
              <SelectTrigger id="client_id">
                <SelectValue
                  placeholder={
                    form.principal_id ? "Seleziona cliente" : "Prima scegli il committente"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {clientDisplayName(client)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setQuickClientOpen((open) => !open)}
            disabled={!form.principal_id}
          >
            <Plus className="mr-1 size-4" /> Nuovo
          </Button>
        </div>
        {form.principal_id && availableClients.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nessun cliente collegato a questo committente.
          </p>
        ) : null}
        {quickClientOpen ? (
          <div className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="quick_client_kind">Tipo cliente</Label>
              <Select
                value={quickClient.kind}
                onValueChange={(value) => updateQuickClient("kind", value as ClientKind)}
              >
                <SelectTrigger id="quick_client_kind">
                  <SelectValue placeholder="Seleziona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(clientKindLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {quickClient.kind === "individual" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="quick_client_last_name">Cognome</Label>
                  <Input
                    id="quick_client_last_name"
                    value={quickClient.last_name}
                    onChange={(event) => updateQuickClient("last_name", event.target.value)}
                    placeholder="Es. Rossi"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="quick_client_first_name">Nome</Label>
                  <Input
                    id="quick_client_first_name"
                    value={quickClient.first_name}
                    onChange={(event) => updateQuickClient("first_name", event.target.value)}
                    placeholder="Es. Anna"
                  />
                </div>
              </div>
            ) : null}
            {quickClient.kind === "company" ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="quick_client_business_name">Ragione sociale</Label>
                <Input
                  id="quick_client_business_name"
                  value={quickClient.business_name}
                  onChange={(event) => updateQuickClient("business_name", event.target.value)}
                  placeholder="Es. Alfa S.r.l."
                />
              </div>
            ) : null}
            <DuplicateWarningPanel
              candidates={quickClientDuplicates}
              onUseExisting={(record) => {
                const kind: ClientKind = quickClient.kind === "company" ? "company" : "individual";
                const client = {
                  id: record.id,
                  kind,
                  first_name: kind === "individual" ? quickClient.first_name || null : null,
                  last_name: kind === "individual" ? quickClient.last_name || null : null,
                  business_name:
                    kind === "company" ? quickClient.business_name || record.label : null,
                } satisfies ClientOption;
                linkExistingClientToSelectedPrincipal(client).catch((error: Error) =>
                  toast.error(error.message),
                );
              }}
              onCreateAnyway={() => {
                quickClientOverrideRef.current = true;
                setQuickClientDuplicates([]);
                if (quickClientLock.acquire()) createQuickClientMutation.mutate();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetQuickClient();
                  setQuickClientOpen(false);
                }}
              >
                Annulla
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (quickClientLock.acquire()) createQuickClientMutation.mutate();
                }}
                disabled={createQuickClientMutation.isPending}
              >
                {createQuickClientMutation.isPending ? "Creazione…" : "Crea"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function CaseCounterpartyField({ controller }: { controller: CaseFormController }) {
  const {
    form,
    upd,
    quickCreatedCounterparties,
    quickCounterpartyOpen,
    setQuickCounterpartyOpen,
    quickCounterparty,
    resetQuickCounterparty,
    quickCounterpartyLock,
    updateQuickCounterparty,
    updateQuickCounterpartySubject,
    addQuickCounterpartySubject,
    removeQuickCounterpartySubject,
    quickCounterpartyDuplicates,
    setQuickCounterpartyDuplicates,
    quickCounterpartyOverrideRef,
    createQuickCounterpartyMutation,
  } = controller;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="counterparty_id">Controparte</Label>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <CounterpartySelect
            id="counterparty_id"
            value={form.counterparty_id}
            onValueChange={(value) => upd("counterparty_id", value)}
            additionalOptions={quickCreatedCounterparties}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setQuickCounterpartyOpen((open) => !open)}
        >
          <Plus className="mr-1 size-4" /> Nuova
        </Button>
      </div>
      {quickCounterpartyOpen ? (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="quick_counterparty_kind">Tipo controparte</Label>
            <Select
              value={quickCounterparty.kind}
              onValueChange={(value) => updateQuickCounterparty("kind", value as CounterpartyKind)}
            >
              <SelectTrigger id="quick_counterparty_kind">
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(counterpartyKindLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {quickCounterparty.kind === "individual" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="quick_counterparty_last_name">Cognome</Label>
                <Input
                  id="quick_counterparty_last_name"
                  value={quickCounterparty.last_name}
                  onChange={(event) => updateQuickCounterparty("last_name", event.target.value)}
                  placeholder="Es. Rossi"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="quick_counterparty_first_name">Nome</Label>
                <Input
                  id="quick_counterparty_first_name"
                  value={quickCounterparty.first_name}
                  onChange={(event) => updateQuickCounterparty("first_name", event.target.value)}
                  placeholder="Es. Anna"
                />
              </div>
            </div>
          ) : null}
          {quickCounterparty.kind && quickCounterparty.kind !== "individual" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="quick_counterparty_business_name">
                {quickCounterparty.kind === "group"
                  ? "Nome controparte composta"
                  : "Ragione sociale"}
              </Label>
              <Input
                id="quick_counterparty_business_name"
                value={quickCounterparty.business_name}
                onChange={(event) => updateQuickCounterparty("business_name", event.target.value)}
                placeholder={
                  quickCounterparty.kind === "group"
                    ? "Es. Debitori collegati"
                    : "Es. Debitore S.r.l."
                }
              />
            </div>
          ) : null}
          {quickCounterparty.kind === "group" ? (
            <div className="flex flex-col gap-3 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Soggetti della controparte</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addQuickCounterpartySubject}
                >
                  <Plus className="mr-1 size-4" /> Soggetto
                </Button>
              </div>
              {quickCounterparty.subjects.map((subject, index) => (
                <div key={subject.localId} className="rounded-md border border-border p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Soggetto {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuickCounterpartySubject(index)}
                    >
                      <Trash2 className="mr-1 size-4" /> Rimuovi
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`quick_counterparty_subject_kind_${index}`}>Tipo</Label>
                      <Select
                        value={subject.kind}
                        onValueChange={(value) =>
                          updateQuickCounterpartySubject(index, "kind", value as ClientKind)
                        }
                      >
                        <SelectTrigger id={`quick_counterparty_subject_kind_${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(clientKindLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {subject.kind === "company" ? (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor={`quick_counterparty_subject_business_${index}`}>
                          Ragione sociale
                        </Label>
                        <Input
                          id={`quick_counterparty_subject_business_${index}`}
                          value={subject.business_name}
                          onChange={(event) =>
                            updateQuickCounterpartySubject(
                              index,
                              "business_name",
                              event.target.value,
                            )
                          }
                          placeholder="Es. Debitore S.r.l."
                        />
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`quick_counterparty_subject_last_${index}`}>
                            Cognome
                          </Label>
                          <Input
                            id={`quick_counterparty_subject_last_${index}`}
                            value={subject.last_name}
                            onChange={(event) =>
                              updateQuickCounterpartySubject(index, "last_name", event.target.value)
                            }
                            placeholder="Es. Rossi"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor={`quick_counterparty_subject_first_${index}`}>Nome</Label>
                          <Input
                            id={`quick_counterparty_subject_first_${index}`}
                            value={subject.first_name}
                            onChange={(event) =>
                              updateQuickCounterpartySubject(
                                index,
                                "first_name",
                                event.target.value,
                              )
                            }
                            placeholder="Es. Anna"
                          />
                        </div>
                      </>
                    )}
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <Label htmlFor={`quick_counterparty_subject_notes_${index}`}>Note</Label>
                      <Textarea
                        id={`quick_counterparty_subject_notes_${index}`}
                        rows={2}
                        value={subject.notes}
                        onChange={(event) =>
                          updateQuickCounterpartySubject(index, "notes", event.target.value)
                        }
                        placeholder="Es. ruolo del soggetto nella controparte"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <DuplicateWarningPanel
            candidates={quickCounterpartyDuplicates}
            onUseExisting={(record) => {
              upd("counterparty_id", record.id);
              resetQuickCounterparty();
              setQuickCounterpartyDuplicates([]);
              setQuickCounterpartyOpen(false);
            }}
            onCreateAnyway={() => {
              quickCounterpartyOverrideRef.current = true;
              setQuickCounterpartyDuplicates([]);
              if (quickCounterpartyLock.acquire()) createQuickCounterpartyMutation.mutate();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetQuickCounterparty();
                setQuickCounterpartyOpen(false);
              }}
            >
              Annulla
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (quickCounterpartyLock.acquire()) createQuickCounterpartyMutation.mutate();
              }}
              disabled={createQuickCounterpartyMutation.isPending}
            >
              {createQuickCounterpartyMutation.isPending ? "Creazione…" : "Crea"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
