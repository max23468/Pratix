import { RefreshCcw, Trash2 } from "lucide-react";
import {
  CaseCounterpartyField,
  CasePrincipalClientFields,
} from "@/components/case-form-subject-sections";
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
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { caseStatusLabels } from "@/lib/labels";
import type { CaseFormController } from "@/components/case-form";

export function CaseDetailsSection({ controller }: { controller: CaseFormController }) {
  const { form, isEdit, upd, useNextPracticeNumber } = controller;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dati pratica</CardTitle>
        <CardDescription>
          La pratica nasce dall'incrocio fra committente, cliente e controparte.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <CasePrincipalClientFields controller={controller} />
          <CaseCounterpartyField controller={controller} />
        </div>

        <div className="max-w-sm">
          <div className="flex flex-col gap-2">
            <Label htmlFor="practice_number">Numero pratica</Label>
            <div className="flex gap-2">
              <Input
                id="practice_number"
                type="number"
                min="1"
                step="1"
                value={form.practice_number ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  upd("practice_number", value === "" ? null : Number(value));
                }}
                placeholder="Es. 157"
              />
              {!isEdit && (
                <Button type="button" variant="outline" onClick={useNextPracticeNumber}>
                  <RefreshCcw className="mr-1 size-4" /> Prossimo
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Stato pratica</Label>
            <Select value={form.status} onValueChange={(value) => upd("status", value)}>
              <SelectTrigger id="status">
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="opened_at">Data apertura</Label>
            <Input
              id="opened_at"
              type="date"
              value={form.opened_at}
              onChange={(event) => upd("opened_at", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="closed_at">Data chiusura</Label>
            <Input
              id="closed_at"
              type="date"
              value={form.closed_at ?? ""}
              onChange={(event) => upd("closed_at", event.target.value || null)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CaseReferencesSection({ controller }: { controller: CaseFormController }) {
  const { form, upd } = controller;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Riferimenti</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="authority">Autorità giudiziaria</Label>
            <Input
              id="authority"
              value={form.authority ?? ""}
              onChange={(event) => upd("authority", event.target.value)}
              placeholder="Es. Tribunale di Milano"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rg_number">N. R.G.</Label>
            <Input
              id="rg_number"
              value={form.rg_number ?? ""}
              onChange={(event) => upd("rg_number", event.target.value)}
              placeholder="Es. 1234/2026"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Note</Label>
          <Textarea
            id="notes"
            rows={4}
            value={form.notes ?? ""}
            onChange={(event) => upd("notes", event.target.value)}
            placeholder="Es. stato trattativa, prossima attività o dettaglio del credito"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function CaseFormActions({
  controller,
  onCancel,
}: {
  controller: CaseFormController;
  onCancel: () => void;
}) {
  const { deleteMutation, isEdit, saveMutation } = controller;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        {isEdit && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Trash2 className="mr-1 size-4" /> Elimina
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare la pratica?</AlertDialogTitle>
                <AlertDialogDescription>
                  L'eliminazione riguarda anche voci fatturabili, allegati e storico stati
                  associati. L'azione non può essere annullata.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                  Elimina
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </div>
  );
}
