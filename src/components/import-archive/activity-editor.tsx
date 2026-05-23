import { Paperclip, Trash2 } from "lucide-react";
import { HearingDatesEditor } from "./hearing-dates-editor";
import type { ActivityDraft, ActivityStatus, PriceOption } from "./types";
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
import { formatCurrency } from "@/lib/format";
import { caseActivityStatusLabels, priceItemKindLabels } from "@/lib/labels";

export function ActivityEditor({
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
    ? activity.hearingDates.filter((hearingDate) => Boolean(hearingDate.date)).length
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
