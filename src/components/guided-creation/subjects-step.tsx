import { ModeSelect } from "./mode-select";
import { PersonOrCompanyFields } from "./person-or-company-fields";
import type {
  ClientKind,
  ClientRow,
  CounterpartyKind,
  CounterpartyRow,
  GuidedCreationDraft,
  PrincipalRow,
} from "./types";
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
import { Textarea } from "@/components/ui/textarea";
import { clientDisplayName, counterpartyDisplayName } from "@/lib/labels";

export function SubjectsStep({
  draft,
  principals,
  clients,
  counterparties,
  updateDraft,
}: {
  draft: GuidedCreationDraft;
  principals: PrincipalRow[];
  clients: ClientRow[];
  counterparties: CounterpartyRow[];
  updateDraft: <K extends keyof GuidedCreationDraft>(key: K, value: GuidedCreationDraft[K]) => void;
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
