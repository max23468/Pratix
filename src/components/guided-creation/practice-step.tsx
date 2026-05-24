import type { CaseStatus, GuidedCreationDraft } from "./types";
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
import { caseStatusLabels } from "@/lib/labels";

export function PracticeStep({
  draft,
  updateDraft,
}: {
  draft: GuidedCreationDraft;
  updateDraft: <K extends keyof GuidedCreationDraft>(key: K, value: GuidedCreationDraft[K]) => void;
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
