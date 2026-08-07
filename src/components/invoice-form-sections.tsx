import { FileSpreadsheet, Loader2 } from "lucide-react";
import { ActivityReviewBadge } from "@/components/activity-review-badge";
import type { InvoiceFormController } from "@/components/invoice-form";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { quarterKeyForPeriod } from "@/lib/invoice-period";
import { clientDisplayName, counterpartyDisplayName } from "@/lib/labels";

export function InvoiceBillingDetailsSection({
  controller,
}: {
  controller: InvoiceFormController;
}) {
  const {
    principalId,
    setPrincipalId,
    principals,
    markDirty,
    isEditingDraft,
    periodMode,
    setPeriodMode,
    selectedQuarter,
    displayedQuarterOptions,
    applyQuarter,
    periodStart,
    setPeriodStart,
    periodEnd,
    setPeriodEnd,
    issueDate,
    setIssueDate,
    dueDate,
    setDueDate,
    setGeneralExpensesRate,
    setCassaRate,
    paymentMethod,
    setPaymentMethod,
  } = controller;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Dati fatturazione</CardTitle>
        <CardDescription>
          Estrai le attività da fatturare per committente e periodo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2 md:col-span-2">
          <Label htmlFor="principal_id">Committente</Label>
          <Select
            value={principalId}
            onValueChange={(value) => {
              markDirty();
              const principal = principals.find((item) => item.id === value);
              setPrincipalId(value);
              if (!isEditingDraft && principal) {
                setGeneralExpensesRate(Number(principal.default_general_expenses_rate ?? 10));
                setCassaRate(Number(principal.default_cassa_rate ?? 4));
              }
            }}
          >
            <SelectTrigger id="principal_id">
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
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="period_mode">Periodo fattura</Label>
          <Select
            value={periodMode}
            onValueChange={(value) => {
              markDirty();
              const nextMode = value as typeof periodMode;
              setPeriodMode(nextMode);
              if (nextMode === "quarter") {
                applyQuarter(quarterKeyForPeriod(periodStart, periodEnd) ?? selectedQuarter);
              }
            }}
          >
            <SelectTrigger id="period_mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="custom">Date personalizzate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {periodMode === "quarter" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="period_quarter">Trimestre</Label>
            <Select
              value={selectedQuarter}
              onValueChange={(value) => {
                markDirty();
                applyQuarter(value);
              }}
            >
              <SelectTrigger id="period_quarter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {displayedQuarterOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <>
            <DateField
              id="period_start"
              label="Da"
              value={periodStart}
              onChange={(value) => {
                markDirty();
                setPeriodStart(value);
              }}
            />
            <DateField
              id="period_end"
              label="A"
              value={periodEnd}
              onChange={(value) => {
                markDirty();
                setPeriodEnd(value);
              }}
            />
          </>
        )}
        <DateField
          id="issue_date"
          label="Data fattura"
          value={issueDate}
          onChange={(value) => {
            markDirty();
            setIssueDate(value);
          }}
        />
        <DateField
          id="due_date"
          label="Scadenza"
          value={dueDate}
          onChange={(value) => {
            markDirty();
            setDueDate(value);
          }}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="payment_method">Pagamento</Label>
          <Input
            id="payment_method"
            value={paymentMethod}
            onChange={(event) => {
              markDirty();
              setPaymentMethod(event.target.value);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function InvoiceActivitiesSection({ controller }: { controller: InvoiceFormController }) {
  const { activitiesLoading, activities, selectionForActivities, markDirty, setSelection } =
    controller;

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Attività</CardTitle>
        <CardDescription>
          Le voci incluse entrano in fattura; le rinviate ricompariranno dal periodo successivo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="min-w-0 overflow-x-auto">
          <Table className="block w-full sm:table">
            <TableHeader className="hidden sm:table-header-group">
              <TableRow>
                <TableHead>Stato</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Pratica</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Controparte</TableHead>
                <TableHead>Voce</TableHead>
                <TableHead className="text-right">Totale</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activitiesLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Caricamento…
                  </TableCell>
                </TableRow>
              )}
              {!activitiesLoading && activities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Nessuna attività da fatturare per il periodo selezionato.
                  </TableCell>
                </TableRow>
              )}
              {activities.map((activity) => (
                <TableRow
                  key={activity.id}
                  className="mb-3 block rounded-lg border border-border p-3 last:mb-0 sm:mb-0 sm:table-row sm:rounded-none sm:border-x-0 sm:border-t-0 sm:p-0"
                >
                  <TableCell className="block p-0 pb-3 sm:table-cell sm:p-2">
                    <Select
                      value={selectionForActivities[activity.id] ?? "included"}
                      onValueChange={(value) => {
                        markDirty();
                        setSelection((current) => ({
                          ...current,
                          [activity.id]: value as (typeof selectionForActivities)[string],
                        }));
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-32" aria-label="Stato attività">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="included">Includi</SelectItem>
                        <SelectItem value="postponed">Rinvia</SelectItem>
                        <SelectItem value="excluded">Escludi</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="flex justify-between gap-3 text-sm sm:table-cell">
                    <span className="shrink-0 text-muted-foreground sm:hidden">Data</span>
                    <span className="text-right sm:text-left">
                      {formatDate(activity.activity_date)}
                    </span>
                  </TableCell>
                  <TableCell className="flex justify-between gap-3 text-sm sm:table-cell">
                    <span className="shrink-0 text-muted-foreground sm:hidden">Pratica</span>
                    <span className="min-w-0 break-words text-right sm:text-left">
                      {activity.cases?.practice_number
                        ? `N. ${activity.cases.practice_number}`
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="flex justify-between gap-3 text-sm sm:table-cell">
                    <span className="shrink-0 text-muted-foreground sm:hidden">Cliente</span>
                    <span className="min-w-0 break-words text-right sm:text-left">
                      {activity.clients ? clientDisplayName(activity.clients) : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="flex justify-between gap-3 text-sm sm:table-cell">
                    <span className="shrink-0 text-muted-foreground sm:hidden">Controparte</span>
                    <span className="min-w-0 break-words text-right sm:text-left">
                      {activity.counterparties
                        ? counterpartyDisplayName(activity.counterparties)
                        : "—"}
                    </span>
                  </TableCell>
                  <TableCell className="block text-sm sm:table-cell">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground sm:hidden">Voce</span>
                      <span className="break-words">{activity.description}</span>
                      <ActivityReviewBadge needsReview={activity.needs_review} />
                      <span className="text-xs text-muted-foreground">
                        {activity.kind === "fee" ? "Compenso" : "Rimborso spese"} · Q.tà{" "}
                        {activity.quantity}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="flex justify-between gap-3 text-sm font-medium sm:table-cell sm:text-right">
                    <span className="shrink-0 font-normal text-muted-foreground sm:hidden">
                      Totale
                    </span>
                    <span className="text-right">{formatCurrency(Number(activity.amount))}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function InvoiceNotesSection({ controller }: { controller: InvoiceFormController }) {
  const { notes, setNotes, markDirty } = controller;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Note</CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notes}
          onChange={(event) => {
            markDirty();
            setNotes(event.target.value);
          }}
          placeholder="Es. Attività da fatturare per il periodo indicato"
        />
      </CardContent>
    </Card>
  );
}

export function InvoiceSummarySection({
  controller,
  submitDisabled,
}: {
  controller: InvoiceFormController;
  submitDisabled: boolean;
}) {
  const {
    includeGeneralExpenses,
    setIncludeGeneralExpenses,
    generalExpensesRate,
    setGeneralExpensesRate,
    cassaRate,
    setCassaRate,
    vatRate,
    setVatRate,
    applyWithholding,
    setApplyWithholding,
    withholdingRate,
    setWithholdingRate,
    markDirty,
    totals,
    includedActivities,
    isForfettario,
    pendingInvoiceStatus,
    isEditingDraft,
  } = controller;

  return (
    <div className="min-w-0 space-y-4">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Regole fiscali</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SwitchRow
            label="Spese generali"
            checked={includeGeneralExpenses}
            onCheckedChange={(value) => {
              markDirty();
              setIncludeGeneralExpenses(value);
            }}
          />
          <NumberField
            id="general_expenses_rate"
            label="Percentuale spese generali"
            value={generalExpensesRate}
            onChange={(value) => {
              markDirty();
              setGeneralExpensesRate(value);
            }}
            disabled={!includeGeneralExpenses}
          />
          <NumberField
            id="cassa_rate"
            label="Cassa Forense"
            value={cassaRate}
            onChange={(value) => {
              markDirty();
              setCassaRate(value);
            }}
          />
          <NumberField
            id="vat_rate"
            label="IVA"
            value={vatRate}
            onChange={(value) => {
              markDirty();
              setVatRate(value);
            }}
          />
          <SwitchRow
            label="Ritenuta d'acconto"
            checked={applyWithholding}
            onCheckedChange={(value) => {
              markDirty();
              setApplyWithholding(value);
            }}
          />
          <NumberField
            id="withholding_rate"
            label="Aliquota ritenuta"
            value={withholdingRate}
            onChange={(value) => {
              markDirty();
              setWithholdingRate(value);
            }}
            disabled={!applyWithholding}
          />
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Riepilogo</CardTitle>
          <CardDescription>{includedActivities.length} attività incluse</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SummaryRow label="Compensi" value={totals.taxableFees} />
          {totals.generalExpensesAmount > 0 && (
            <SummaryRow label="Spese generali" value={totals.generalExpensesAmount} />
          )}
          <SummaryRow label="Cassa Forense" value={totals.cassaAmount} />
          {!isForfettario && <SummaryRow label="IVA" value={totals.vatAmount} />}
          <SummaryRow label="Rimborsi Art. 15" value={totals.art15Expenses} />
          {totals.stampAmount > 0 && <SummaryRow label="Bollo" value={totals.stampAmount} />}
          <div className="border-t border-border pt-3">
            <SummaryRow label="Totale documento" value={totals.totalAmount} strong />
            <SummaryRow label="Netto a pagare" value={totals.netToPay} strong />
          </div>
          <div className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="mt-0.5 size-4 shrink-0" />
            <span>La fattura genera anche i rendiconti Excel per compensi e rimborsi.</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="submit"
              name="invoiceStatus"
              value="draft"
              variant="outline"
              className="w-full"
              disabled={submitDisabled}
            >
              {pendingInvoiceStatus === "draft" && <Loader2 className="mr-2 size-4 animate-spin" />}
              Salva bozza
            </Button>
            <Button
              type="submit"
              name="invoiceStatus"
              value="issued"
              className="w-full"
              disabled={submitDisabled}
            >
              {pendingInvoiceStatus === "issued" && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              {isEditingDraft ? "Segna come emessa" : "Crea fattura"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label} (%)</Label>
      <Input
        id={id}
        type="number"
        min="0"
        step="0.01"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div
      className={
        strong ? "flex justify-between text-sm font-semibold" : "flex justify-between text-sm"
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}
