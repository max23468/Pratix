import { RotateCcw } from "lucide-react";
import type { PriceBookRow } from "@/components/price-book-form";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { priceBookStatusLabels } from "@/lib/labels";
import type { PriceBookStatus } from "@/lib/price-templates";

type PrincipalOption = {
  id: string;
  business_name: string;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
  archived_at: string | null;
};

export function PriceBookConfiguration({
  form,
  principals,
  isEdit,
  hasPreviousBook,
  onFieldChange,
  onPrincipalChange,
  onResetTemplate,
  onCopyPreviousYear,
}: {
  form: PriceBookRow;
  principals: PrincipalOption[];
  isEdit: boolean;
  hasPreviousBook: boolean;
  onFieldChange: <K extends keyof PriceBookRow>(key: K, value: PriceBookRow[K]) => void;
  onPrincipalChange: (principalId: string) => void;
  onResetTemplate: () => void;
  onCopyPreviousYear: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configurazione</CardTitle>
        <CardDescription>
          I prezzi sono annuali e specifici per committente. Il template 2025 vale anche per il
          2026.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="principal_id">Committente</Label>
            <Select value={form.principal_id} onValueChange={onPrincipalChange} disabled={isEdit}>
              <SelectTrigger id="principal_id">
                <SelectValue placeholder="Seleziona committente" />
              </SelectTrigger>
              <SelectContent>
                {principals.map((principal) => (
                  <SelectItem key={principal.id} value={principal.id}>
                    {principal.business_name}
                    {principal.archived_at ? " (archiviato)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="year">Anno</Label>
            <Input
              id="year"
              type="number"
              min="2000"
              max="2100"
              value={form.year}
              onChange={(event) => onFieldChange("year", Number(event.target.value))}
              disabled={isEdit}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="status">Stato</Label>
            <Select
              value={form.status}
              onValueChange={(value) => onFieldChange("status", value as PriceBookStatus)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(priceBookStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="fees_enabled">Compensi</Label>
              <p className="text-xs text-muted-foreground">Abilita le voci imponibili.</p>
            </div>
            <Switch
              id="fees_enabled"
              checked={form.fees_enabled}
              onCheckedChange={(checked) => onFieldChange("fees_enabled", checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="expense_reimbursements_enabled">Rimborsi spese</Label>
              <p className="text-xs text-muted-foreground">Abilita anticipazioni Art. 15.</p>
            </div>
            <Switch
              id="expense_reimbursements_enabled"
              checked={form.expense_reimbursements_enabled}
              onCheckedChange={(checked) =>
                onFieldChange("expense_reimbursements_enabled", checked)
              }
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="valid_from">Valido dal</Label>
            <Input
              id="valid_from"
              type="date"
              value={form.valid_from}
              onChange={(event) => onFieldChange("valid_from", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="valid_to">Valido al</Label>
            <Input
              id="valid_to"
              type="date"
              value={form.valid_to ?? ""}
              onChange={(event) => onFieldChange("valid_to", event.target.value || null)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">Note</Label>
          <Textarea
            id="notes"
            rows={3}
            value={form.notes ?? ""}
            onChange={(event) => onFieldChange("notes", event.target.value)}
          />
        </div>
        {!isEdit && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onResetTemplate}>
              <RotateCcw className="mr-1 size-4" /> Template comune 2025/2026
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCopyPreviousYear}
              disabled={!hasPreviousBook}
            >
              <RotateCcw className="mr-1 size-4" /> Copia anno precedente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
