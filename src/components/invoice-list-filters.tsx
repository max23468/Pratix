import { FileDown, FileText } from "lucide-react";
import { ListToolbar } from "@/components/list-toolbar";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invoiceStatusLabels } from "@/lib/labels";
import type { InvoiceStatusFilter } from "@/routes/fatture.index";

type Values = { q: string; status: InvoiceStatusFilter; year: string; from: string; to: string };
type Props = Values & {
  years: number[];
  updateSearch: (values: Values) => void;
  onExportPdf: () => void;
  onExportXml: () => void;
  exportPdfPending: boolean;
  exportXmlPending: boolean;
  isEmpty: boolean;
};

export function InvoiceListFilters({
  q: search,
  status,
  year,
  from: periodStart,
  to: periodEnd,
  years,
  updateSearch,
  onExportPdf,
  onExportXml,
  exportPdfPending,
  exportXmlPending,
  isEmpty,
}: Props) {
  return (
    <>
      <ListToolbar className="mb-0 gap-3 sm:flex-row sm:items-center">
        <SearchInput
          placeholder="Cerca per numero o committente"
          value={search}
          onChange={(value) =>
            updateSearch({
              q: value,
              status,
              year,
              from: periodStart,
              to: periodEnd,
            })
          }
          className="max-w-none"
        />
        <Select
          value={status}
          onValueChange={(value) =>
            updateSearch({
              q: search,
              status: value as InvoiceStatusFilter,
              year,
              from: periodStart,
              to: periodEnd,
            })
          }
        >
          <SelectTrigger aria-label="Filtra fatture per stato" className="sm:w-44">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="to_collect">Da incassare</SelectItem>
            <SelectItem value="expired">Scadute</SelectItem>
            {Object.entries(invoiceStatusLabels).map(([k, l]) => (
              <SelectItem key={k} value={k}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={year}
          onValueChange={(value) =>
            updateSearch({ q: search, status, year: value, from: periodStart, to: periodEnd })
          }
        >
          <SelectTrigger aria-label="Filtra fatture per anno" className="sm:w-32">
            <SelectValue placeholder="Anno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ListToolbar>

      <div className="flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="invoice-period-start"
            >
              Da data fattura
            </label>
            <Input
              id="invoice-period-start"
              type="date"
              value={periodStart}
              onChange={(event) =>
                updateSearch({
                  q: search,
                  status,
                  year,
                  from: event.target.value,
                  to: periodEnd,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-xs font-medium text-muted-foreground"
              htmlFor="invoice-period-end"
            >
              A data fattura
            </label>
            <Input
              id="invoice-period-end"
              type="date"
              value={periodEnd}
              onChange={(event) =>
                updateSearch({
                  q: search,
                  status,
                  year,
                  from: periodStart,
                  to: event.target.value,
                })
              }
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onExportPdf()}
            disabled={exportPdfPending || isEmpty}
          >
            <FileText className="mr-2 size-4" />
            {exportPdfPending ? "Preparazione PDF…" : "Esporta PDF"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onExportXml()}
            disabled={exportXmlPending || isEmpty}
          >
            <FileDown className="mr-2 size-4" />
            {exportXmlPending ? "Preparazione XML…" : "Esporta XML"}
          </Button>
        </div>
      </div>
    </>
  );
}
