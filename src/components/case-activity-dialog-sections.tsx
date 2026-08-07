import { ActivityAttachmentFields } from "@/components/activity-attachment-fields";
import { CasePicker } from "@/components/case-picker";
import type { CaseActivityDialogController } from "@/components/case-activities";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn } from "@/lib/utils";

export function ActivityDetailsSection({
  controller,
}: {
  controller: CaseActivityDialogController;
}) {
  const {
    caseRow,
    sortedCaseOptions,
    selectedCaseId,
    setFormField,
    activityDate,
    status,
    priceBook,
    activityYear,
    availablePriceItems,
    priceItemId,
    selectPriceItem,
    description,
    isEditing,
  } = controller;

  return (
    <>
      {!caseRow && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="case_id">Pratica</Label>
          <CasePicker
            id="case_id"
            options={sortedCaseOptions}
            selectedCaseId={selectedCaseId}
            onSelect={(value) => {
              setFormField("selectedCaseId", value);
              setFormField("priceItemId", "");
            }}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity_date">Data</Label>
          <Input
            id="activity_date"
            type="date"
            value={activityDate}
            onChange={(event) => setFormField("activityDate", event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity_status">Stato</Label>
          <Select
            value={status}
            onValueChange={(value) => setFormField("status", value as typeof status)}
          >
            <SelectTrigger id="activity_status">
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
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="price_item_id">Prezzo</Label>
        <Select
          value={priceItemId}
          onValueChange={selectPriceItem}
          disabled={isEditing || !priceBook}
        >
          <SelectTrigger id="price_item_id">
            <SelectValue
              placeholder={
                priceBook ? "Seleziona voce prezzo" : `Nessun prezzo per il ${activityYear}`
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availablePriceItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {priceItemKindLabels[item.kind]} · {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="activity_description">Descrizione</Label>
        <Input
          id="activity_description"
          value={description}
          onChange={(event) => setFormField("description", event.target.value)}
        />
      </div>
    </>
  );
}

export function ActivityAmountSection({
  controller,
}: {
  controller: CaseActivityDialogController;
}) {
  const {
    setFormField,
    isEditing,
    isExpenseReimbursement,
    requiresHearingDates,
    hearingDates,
    setHearingCount,
    quantity,
    selectedItem,
    effectiveKind,
    amountInputValue,
    formatFreeAmountInput,
    total,
  } = controller;

  return (
    <>
      <div className={cn("grid gap-4", isExpenseReimbursement ? "sm:max-w-xs" : "sm:grid-cols-3")}>
        {!isExpenseReimbursement && requiresHearingDates ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="hearing_count">Numero udienze</Label>
            <Input
              id="hearing_count"
              type="number"
              min="0"
              step="1"
              value={hearingDates.length}
              onChange={(event) => setHearingCount(Number(event.target.value))}
            />
          </div>
        ) : !isExpenseReimbursement ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="quantity">Quantità</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setFormField("quantity", Number(event.target.value))}
              disabled={!isEditing && !selectedItem}
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="unit_price">
            {effectiveKind === "expense_reimbursement" ? "Importo" : "Prezzo unitario"}
          </Label>
          <Input
            id="unit_price"
            type="text"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amountInputValue}
            placeholder="0,00"
            disabled={!isEditing && (!selectedItem || selectedItem.kind === "fee")}
            onChange={(event) => setFormField("freeAmountInput", event.target.value)}
            onBlur={formatFreeAmountInput}
          />
        </div>
        {!isExpenseReimbursement ? (
          <div className="flex flex-col gap-2">
            <Label>Totale</Label>
            <div className="rounded-md border border-border px-3 py-2 text-sm font-medium">
              {formatCurrency(total)}
            </div>
          </div>
        ) : null}
      </div>

      {requiresHearingDates ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {hearingDates.map((hearingDate, index) => (
            <div key={hearingDate.id} className="flex flex-col gap-2">
              <Label htmlFor={`hearing_${index}`}>Udienza {index + 1}</Label>
              <Input
                id={`hearing_${index}`}
                type="date"
                value={hearingDate.date}
                onChange={(event) =>
                  setFormField("hearingDates", (current) =>
                    current.map((currentDate, currentIndex) =>
                      currentIndex === index
                        ? { ...currentDate, date: event.target.value }
                        : currentDate,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function ActivityReviewSection({
  controller,
}: {
  controller: CaseActivityDialogController;
}) {
  const {
    setFormField,
    needsReview,
    notes,
    file,
    attachmentName,
    attachmentType,
    attachmentNotes,
  } = controller;

  return (
    <>
      <div className="flex items-start gap-3 rounded-md border border-border p-3">
        <Checkbox
          id="activity_needs_review"
          checked={needsReview}
          onCheckedChange={(checked) => setFormField("needsReview", checked === true)}
        />
        <div className="space-y-1">
          <Label htmlFor="activity_needs_review">Importo da verificare</Label>
          <p className="text-sm text-muted-foreground">
            Usa le note per indicare il motivo del dubbio sull'importo.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Note</Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(event) => setFormField("notes", event.target.value)}
          placeholder={
            needsReview ? "Motivo della verifica, ad esempio tariffa da confermare" : undefined
          }
        />
      </div>

      <ActivityAttachmentFields
        file={file}
        name={attachmentName}
        type={attachmentType}
        notes={attachmentNotes}
        onFileChange={(nextFile) => {
          setFormField("file", nextFile);
          if (nextFile && !attachmentName) setFormField("attachmentName", nextFile.name);
        }}
        onNameChange={(value) => setFormField("attachmentName", value)}
        onTypeChange={(value) => setFormField("attachmentType", value)}
        onNotesChange={(value) => setFormField("attachmentNotes", value)}
      />
    </>
  );
}
