import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { InvoiceListFilters } from "@/components/invoice-list-filters";
import { InvoiceListResults } from "@/components/invoice-list-results";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { PageHeader } from "@/components/page-header";
import { SummaryTile } from "@/components/summary-tile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  archiveBytes,
  downloadBytes,
  invoicePdfBytes,
  invoicePdfFileName,
  invoiceXmlBytes,
} from "@/lib/invoice-file-exports";
import type { InvoiceLineKind } from "@/lib/invoice-calc";
import type { InvoicePdfData } from "@/lib/invoice-pdf";
import {
  clientDisplayName,
  invoiceStatusLabels,
  type ClientDisplayData,
  type InvoiceStatus,
} from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import { readServerResult } from "@/lib/server-functions";
import {
  parseTableSortDirection,
  parseTableSortKey,
  sortRows,
  usePersistentTableSort,
  type SortableColumn,
  type TableSort,
} from "@/lib/table-sorting";
import { generateInvoiceXmlFn } from "@/server/invoices-export.functions";

export type InvoiceListRow = {
  id: string;
  public_code: string;
  number: string;
  year: number;
  issue_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  total_amount: number;
  net_to_pay: number;
  billing_run: { period_start: string; period_end: string } | null;
  client: ClientDisplayData | null;
  principal: { id: string; business_name: string } | null;
};

type GenerateInvoiceXmlResult = {
  xml: string;
  filename: string;
};

const ZIP_MIME_TYPE = "application/zip";

const fattureSortKeys = [
  "number",
  "issue_date",
  "period",
  "principal",
  "due_date",
  "status",
  "total_amount",
  "net_to_pay",
] as const;

export type FattureSortKey = (typeof fattureSortKeys)[number];

const fattureDefaultSort: TableSort<FattureSortKey> = { key: "issue_date", direction: "desc" };

const fattureColumns: readonly SortableColumn<InvoiceListRow, FattureSortKey>[] = [
  { key: "number", label: "Numero", getValue: (invoice) => `${invoice.number}/${invoice.year}` },
  {
    key: "issue_date",
    label: "Data",
    valueType: "date",
    defaultDirection: "desc",
    getValue: (invoice) => invoice.issue_date,
  },
  {
    key: "period",
    label: "Periodo",
    valueType: "date",
    defaultDirection: "desc",
    getValue: (invoice) => invoice.billing_run?.period_start ?? "",
  },
  {
    key: "principal",
    label: "Committente",
    getValue: (invoice) =>
      invoice.principal?.business_name || clientDisplayName(invoice.client as ClientDisplayData),
  },
  {
    key: "due_date",
    label: "Scadenza",
    valueType: "date",
    defaultDirection: "desc",
    getValue: (invoice) => invoice.due_date,
  },
  {
    key: "status",
    label: "Stato",
    getValue: (invoice) => invoiceStatusLabels[invoice.status] ?? invoice.status,
  },
  {
    key: "total_amount",
    label: "Totale",
    valueType: "number",
    defaultDirection: "desc",
    getValue: (invoice) => invoice.total_amount,
  },
  {
    key: "net_to_pay",
    label: "Netto",
    valueType: "number",
    defaultDirection: "desc",
    getValue: (invoice) => invoice.net_to_pay,
  },
];

const invoiceStatusFilterLabels = {
  ...invoiceStatusLabels,
  to_collect: "Da incassare",
  expired: "Scadute",
};

export type InvoiceStatusFilter = keyof typeof invoiceStatusFilterLabels | "all";

export const Route = createFileRoute("/fatture/")({
  validateSearch: (search: Record<string, unknown>): InvoicesSearch => ({
    q: parseTextSearch(search.q),
    status: parseFilterValue(search.status, invoiceStatusFilterLabels),
    year: parseYearSearch(search.year),
    from: parseDateSearch(search.from),
    to: parseDateSearch(search.to),
    sort: parseTableSortKey(search.sort, fattureSortKeys),
    dir: parseTableSortDirection(search.dir),
  }),
  head: () => ({
    meta: [
      { title: "Fatture · Pratix" },
      { name: "description", content: "Elenco fatture emesse." },
      { property: "og:title", content: "Fatture · Pratix" },
      { property: "og:description", content: "Elenco fatture emesse." },
    ],
  }),
  component: InvoicesIndex,
});

type InvoicesSearch = {
  q?: string;
  status?: InvoiceStatusFilter;
  year?: string;
  from?: string;
  to?: string;
  sort?: FattureSortKey;
  dir?: "asc" | "desc";
};

function InvoicesIndex() {
  const { user } = useAuth();
  const generateInvoiceXml = useServerFn(generateInvoiceXmlFn);
  const navigate = Route.useNavigate();
  const routeSearch = Route.useSearch();
  const search = routeSearch.q ?? "";
  const status = routeSearch.status ?? "all";
  const year = routeSearch.year ?? "all";
  const periodStart = routeSearch.from ?? "";
  const periodEnd = routeSearch.to ?? "";
  const urlSort =
    routeSearch.sort && routeSearch.dir
      ? { key: routeSearch.sort, direction: routeSearch.dir }
      : undefined;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const hasInvoiceFilters = Boolean(
    search.trim() || status !== "all" || year !== "all" || periodStart || periodEnd,
  );

  const updateSearch = (next: InvoicesSearch) =>
    navigate({
      search: {
        q: next.q?.trim() ? next.q : undefined,
        status: next.status && next.status !== "all" ? next.status : undefined,
        year: next.year && next.year !== "all" ? next.year : undefined,
        from: next.from || undefined,
        to: next.to || undefined,
        sort: next.sort ?? routeSearch.sort,
        dir: next.dir ?? routeSearch.dir,
      },
      replace: true,
    });

  const openInvoice = (invoiceId: string) =>
    navigate({ to: "/fatture/$invoiceId", params: { invoiceId } });

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, public_code, number, year, issue_date, due_date, status, total_amount, net_to_pay, billing_run:billing_runs!invoices_billing_run_owner_fkey(period_start, period_end), client:clients(id, kind, first_name, last_name, business_name), principal:principals(id, business_name)",
        )
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data || []) as InvoiceListRow[];
    },
  });

  const years = useMemo(() => {
    const set = new Set<number>();
    (data || []).forEach((i) => set.add(i.year));
    return Array.from(set).sort((a, b) => b - a);
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((i) => {
      const isExpired =
        i.status === "overdue" || (i.status === "issued" && i.due_date && i.due_date < today);
      if (status === "to_collect" && i.status !== "issued" && i.status !== "overdue") {
        return false;
      }
      if (status === "expired" && !isExpired) return false;
      if (
        status !== "all" &&
        status !== "to_collect" &&
        status !== "expired" &&
        i.status !== status
      ) {
        return false;
      }
      if (year !== "all" && String(i.year) !== year) return false;
      if (periodStart && i.issue_date < periodStart) return false;
      if (periodEnd && i.issue_date > periodEnd) return false;
      if (!q) return true;
      const name = (
        i.principal?.business_name || clientDisplayName(i.client as ClientDisplayData)
      ).toLowerCase();
      return i.number.toLowerCase().includes(q) || name.includes(q);
    });
  }, [data, periodEnd, periodStart, search, status, today, year]);

  const { sort, setSort } = usePersistentTableSort({
    section: "fatture",
    columns: fattureColumns,
    defaultSort: fattureDefaultSort,
    urlSort,
    onSortChange: (next) =>
      updateSearch({
        q: search,
        status,
        year,
        from: periodStart,
        to: periodEnd,
        sort: next.key,
        dir: next.direction,
      }),
  });

  const sorted = useMemo(() => sortRows(filtered, fattureColumns, sort), [filtered, sort]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, i) => {
        acc.total += Number(i.total_amount);
        acc.net += Number(i.net_to_pay);
        if (i.status === "paid") acc.paid += Number(i.total_amount);
        return acc;
      },
      { total: 0, net: 0, paid: 0 },
    );
  }, [filtered]);

  const loadInvoicePdfData = async (invoiceId: string): Promise<InvoicePdfData> => {
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();
    if (error) throw error;

    const [{ data: lines }, { data: principal }, { data: client }, { data: profile }] =
      await Promise.all([
        supabase
          .from("invoice_lines")
          .select("*")
          .eq("invoice_id", invoiceId)
          .order("position", { ascending: true }),
        invoice.principal_id
          ? supabase.from("principals").select("*").eq("id", invoice.principal_id).single()
          : Promise.resolve({ data: null }),
        supabase.from("clients").select("*").eq("id", invoice.client_id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", user!.id).single(),
      ]);

    const billedParty = principal
      ? {
          kind: "company",
          business_name: principal.business_name,
          first_name: null,
          last_name: null,
          tax_code: principal.tax_code,
          vat_number: principal.vat_number,
          address_street: principal.address_street,
          address_zip: principal.address_zip,
          address_city: principal.address_city,
          address_province: principal.address_province,
        }
      : client;

    return {
      invoice: {
        number: invoice.number,
        year: invoice.year,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        notes: invoice.notes,
        taxable_fees: Number(invoice.taxable_fees),
        art15_expenses: Number(invoice.art15_expenses),
        general_expenses_amount: Number(invoice.general_expenses_amount),
        cassa_amount: Number(invoice.cassa_amount),
        vat_amount: Number(invoice.vat_amount),
        withholding_amount: Number(invoice.withholding_amount),
        stamp_amount: Number(invoice.stamp_amount),
        total_amount: Number(invoice.total_amount),
        net_to_pay: Number(invoice.net_to_pay),
        cassa_rate: Number(invoice.cassa_rate),
        vat_rate: Number(invoice.vat_rate),
        withholding_rate: Number(invoice.withholding_rate),
        apply_withholding: invoice.apply_withholding,
      },
      lines: (lines ?? []).map((line) => ({
        kind: line.kind as InvoiceLineKind,
        description: line.description,
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
        amount: Number(line.amount),
      })),
      client: billedParty as InvoicePdfData["client"],
      profile: profile as InvoicePdfData["profile"],
    };
  };

  const exportPdfMutation = useMutation({
    mutationFn: async () => {
      if (filtered.length === 0) throw new Error("Nessuna fattura da esportare");

      const files = await Promise.all(
        filtered.map(async (invoice) => {
          const pdfData = await loadInvoicePdfData(invoice.id);
          return {
            bytes: await invoicePdfBytes(pdfData),
            fileName: invoicePdfFileName(pdfData.invoice),
          };
        }),
      );

      downloadBytes({
        bytes: archiveBytes(files),
        fileName: `fatture-pdf-${new Date().toISOString().slice(0, 10)}.zip`,
        mimeType: ZIP_MIME_TYPE,
      });

      return filtered.length;
    },
    onSuccess: (count) => toast.success(`${count} PDF esportati`),
    onError: (err: Error) => toast.error(err.message),
  });

  const exportXmlMutation = useMutation({
    mutationFn: async () => {
      if (filtered.length === 0) throw new Error("Nessuna fattura da esportare");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessione non valida. Accedi di nuovo.");

      const files = await Promise.all(
        filtered.map(async (invoice) => {
          const xmlPayload = await generateInvoiceXml({
            data: { invoiceId: invoice.id },
            headers: { Authorization: `Bearer ${token}` },
          }).then((result) => readServerResult<GenerateInvoiceXmlResult>(result));
          return {
            bytes: invoiceXmlBytes(xmlPayload.xml),
            fileName: xmlPayload.filename,
          };
        }),
      );

      downloadBytes({
        bytes: archiveBytes(files),
        fileName: `fatture-xml-${new Date().toISOString().slice(0, 10)}.zip`,
        mimeType: ZIP_MIME_TYPE,
      });

      return filtered.length;
    },
    onSuccess: (count) => toast.success(`${count} XML esportati`),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AppLayout>
      <PageHeader
        title="Fatture"
        description="Emetti, traccia e scarica le fatture in PDF e XML SdI."
        actions={
          <Button asChild>
            <Link to="/fatture/nuova">
              <Plus className="mr-2 size-4" /> Nuova fattura
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Totale documenti" value={formatCurrency(totals.total)} />
        <SummaryTile label="Netto a pagare" value={formatCurrency(totals.net)} tone="gold" />
        <SummaryTile label="Incassato (pagate)" value={formatCurrency(totals.paid)} />
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <InvoiceListFilters
            q={search}
            status={status}
            year={year}
            from={periodStart}
            to={periodEnd}
            years={years}
            updateSearch={updateSearch}
            onExportPdf={() => exportPdfMutation.mutate()}
            onExportXml={() => exportXmlMutation.mutate()}
            exportPdfPending={exportPdfMutation.isPending}
            exportXmlPending={exportXmlMutation.isPending}
            isEmpty={filtered.length === 0}
          />
          <div className="md:hidden">
            <MobileSortSelect columns={fattureColumns} sort={sort} onSort={setSort} />
          </div>

          <InvoiceListResults
            rows={sorted}
            isLoading={isLoading}
            hasInvoiceFilters={hasInvoiceFilters}
            today={today}
            sort={sort}
            onSort={setSort}
            onOpen={openInvoice}
          />
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function parseTextSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, 120);
  return normalized || undefined;
}

function parseFilterValue<T extends Record<string, string>>(value: unknown, labels: T) {
  if (typeof value !== "string") return undefined;
  return value in labels ? (value as keyof T) : undefined;
}

function parseYearSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  return /^\d{4}$/.test(value) ? value : undefined;
}

function parseDateSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}
