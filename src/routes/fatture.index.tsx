import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileDown, FileText, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { MobileSortSelect } from "@/components/mobile-sort-select";
import { PageHeader } from "@/components/page-header";
import { SortableTableHead } from "@/components/sortable-table-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableEmptyState } from "@/components/table-empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
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
  invoiceStatusVariant,
  type ClientDisplayData,
} from "@/lib/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { invoicePeriodLabel } from "@/lib/invoice-period";
import { routeRef } from "@/lib/public-route-code";
import { readServerResult } from "@/lib/server-functions";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";
import {
  parseTableSortDirection,
  parseTableSortKey,
  sortRows,
  usePersistentTableSort,
  type SortableColumn,
  type TableSort,
} from "@/lib/table-sorting";
import { generateInvoiceXmlFn } from "@/server/invoices.functions";

type InvoiceListRow = {
  id: string;
  public_code: string;
  number: string;
  year: number;
  issue_date: string;
  due_date: string | null;
  status: string;
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

type FattureSortKey = (typeof fattureSortKeys)[number];

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
    label: "Trimestre",
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

export const Route = createFileRoute("/fatture/")({
  validateSearch: (search: Record<string, unknown>): InvoicesSearch => ({
    q: parseTextSearch(search.q),
    status: parseFilterValue(search.status, invoiceStatusLabels),
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
  status?: string;
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
          "id, public_code, number, year, issue_date, due_date, status, total_amount, net_to_pay, billing_run:billing_runs(period_start, period_end), client:clients(id, kind, first_name, last_name, business_name), principal:principals(id, business_name)",
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
      if (status !== "all" && i.status !== status) return false;
      if (year !== "all" && String(i.year) !== year) return false;
      if (periodStart && i.issue_date < periodStart) return false;
      if (periodEnd && i.issue_date > periodEnd) return false;
      if (!q) return true;
      const name = (
        i.principal?.business_name || clientDisplayName(i.client as ClientDisplayData)
      ).toLowerCase();
      return i.number.toLowerCase().includes(q) || name.includes(q);
    });
  }, [data, periodEnd, periodStart, search, status, year]);

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
        taxable_expenses: Number(invoice.taxable_expenses),
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
            bytes: invoicePdfBytes(pdfData),
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

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Totale documenti</div>
            <div className="text-2xl font-semibold">{formatCurrency(totals.total)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Netto a pagare</div>
            <div className="text-2xl font-semibold">{formatCurrency(totals.net)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Incassato (pagate)</div>
            <div className="text-2xl font-semibold">{formatCurrency(totals.paid)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cerca per numero o committente"
                value={search}
                onChange={(event) =>
                  updateSearch({
                    q: event.target.value,
                    status,
                    year,
                    from: periodStart,
                    to: periodEnd,
                  })
                }
                className="pl-9"
              />
            </div>
            <Select
              value={status}
              onValueChange={(value) =>
                updateSearch({ q: search, status: value, year, from: periodStart, to: periodEnd })
              }
            >
              <SelectTrigger aria-label="Filtra fatture per stato" className="sm:w-44">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
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
          </div>

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
                onClick={() => exportPdfMutation.mutate()}
                disabled={exportPdfMutation.isPending || filtered.length === 0}
              >
                <FileText className="mr-2 size-4" />
                {exportPdfMutation.isPending ? "Preparazione PDF…" : "Esporta PDF"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => exportXmlMutation.mutate()}
                disabled={exportXmlMutation.isPending || filtered.length === 0}
              >
                <FileDown className="mr-2 size-4" />
                {exportXmlMutation.isPending ? "Preparazione XML…" : "Esporta XML"}
              </Button>
            </div>
          </div>

          <div className="md:hidden">
            <MobileSortSelect columns={fattureColumns} sort={sort} onSort={setSort} />
          </div>

          <div className="space-y-3 md:hidden">
            {isLoading ? (
              <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>
            ) : sorted.length === 0 ? (
              <Card className="p-4">
                <TableEmptyState
                  title={hasInvoiceFilters ? "Nessuna fattura trovata" : "Nessuna fattura"}
                  description={
                    hasInvoiceFilters
                      ? "Modifica ricerca, stato, anno o periodo per ampliare i risultati."
                      : "Crea una fattura partendo dalle attività da fatturare."
                  }
                  action={
                    !hasInvoiceFilters ? (
                      <Button size="sm" asChild>
                        <Link to="/fatture/nuova">Nuova fattura</Link>
                      </Button>
                    ) : undefined
                  }
                />
              </Card>
            ) : (
              sorted.map((i) => {
                const isOverdue = i.status === "issued" && i.due_date && i.due_date < today;
                const billedName =
                  i.principal?.business_name || clientDisplayName(i.client as ClientDisplayData);
                return (
                  <Link
                    key={i.id}
                    to="/fatture/$invoiceId"
                    params={{ invoiceId: routeRef(i) }}
                    className="block rounded-md border border-border bg-card p-4 shadow-soft transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          Fattura {i.number}/{i.year}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{billedName}</p>
                      </div>
                      <Badge
                        variant={
                          isOverdue ? "destructive" : invoiceStatusVariant[i.status] || "outline"
                        }
                        className="shrink-0"
                      >
                        {isOverdue ? "Scaduta" : invoiceStatusLabels[i.status] || i.status}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt>Data</dt>
                        <dd className="text-right">{formatDate(i.issue_date)}</dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt>Trimestre</dt>
                        <dd className="text-right">{invoicePeriodLabel(i.billing_run)}</dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt>Scadenza</dt>
                        <dd
                          className={
                            isOverdue ? "text-right font-medium text-destructive" : "text-right"
                          }
                        >
                          {formatDate(i.due_date)}
                        </dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt>Totale</dt>
                        <dd className="text-right">{formatCurrency(Number(i.total_amount))}</dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-3">
                        <dt>Netto</dt>
                        <dd className="text-right font-medium text-foreground">
                          {formatCurrency(Number(i.net_to_pay))}
                        </dd>
                      </div>
                    </dl>
                  </Link>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    columnKey="number"
                    label="Numero"
                    sort={sort}
                    onSort={setSort}
                  />
                  <SortableTableHead
                    columnKey="issue_date"
                    label="Data"
                    sort={sort}
                    onSort={setSort}
                  />
                  <SortableTableHead
                    columnKey="period"
                    label="Trimestre"
                    sort={sort}
                    onSort={setSort}
                  />
                  <SortableTableHead
                    columnKey="principal"
                    label="Committente"
                    sort={sort}
                    onSort={setSort}
                  />
                  <SortableTableHead
                    columnKey="due_date"
                    label="Scadenza"
                    sort={sort}
                    onSort={setSort}
                  />
                  <SortableTableHead
                    columnKey="status"
                    label="Stato"
                    sort={sort}
                    onSort={setSort}
                  />
                  <SortableTableHead
                    columnKey="total_amount"
                    label="Totale"
                    sort={sort}
                    onSort={setSort}
                    align="right"
                    className="text-right"
                  />
                  <SortableTableHead
                    columnKey="net_to_pay"
                    label="Netto"
                    sort={sort}
                    onSort={setSort}
                    align="right"
                    className="text-right"
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Caricamento…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      <TableEmptyState
                        title={hasInvoiceFilters ? "Nessuna fattura trovata" : "Nessuna fattura"}
                        description={
                          hasInvoiceFilters
                            ? "Modifica ricerca, stato, anno o periodo per ampliare i risultati."
                            : "Crea una fattura partendo dalle attività da fatturare."
                        }
                        action={
                          !hasInvoiceFilters ? (
                            <Button size="sm" asChild>
                              <Link to="/fatture/nuova">Nuova fattura</Link>
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
                {sorted.map((i) => {
                  const isOverdue = i.status === "issued" && i.due_date && i.due_date < today;
                  return (
                    <TableRow
                      key={i.id}
                      className="cursor-pointer"
                      role="link"
                      tabIndex={0}
                      aria-label={`Apri fattura ${i.number}/${i.year}`}
                      onClick={(event) =>
                        handleClickableTableRowClick(event, () => openInvoice(routeRef(i)))
                      }
                      onKeyDown={(event) =>
                        handleClickableTableRowKeyDown(event, () => openInvoice(routeRef(i)))
                      }
                    >
                      <TableCell>
                        <Link
                          to="/fatture/$invoiceId"
                          params={{ invoiceId: routeRef(i) }}
                          className="font-medium hover:underline"
                        >
                          {i.number}/{i.year}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(i.issue_date)}</TableCell>
                      <TableCell>{invoicePeriodLabel(i.billing_run)}</TableCell>
                      <TableCell>
                        {i.principal?.business_name ||
                          clientDisplayName(i.client as ClientDisplayData)}
                      </TableCell>
                      <TableCell className={isOverdue ? "font-medium text-destructive" : ""}>
                        {formatDate(i.due_date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            isOverdue ? "destructive" : invoiceStatusVariant[i.status] || "outline"
                          }
                        >
                          {isOverdue ? "Scaduta" : invoiceStatusLabels[i.status] || i.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(Number(i.total_amount))}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(i.net_to_pay))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
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

function parseFilterValue(value: unknown, labels: Record<string, string>) {
  if (typeof value !== "string") return undefined;
  return value in labels ? value : undefined;
}

function parseYearSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  return /^\d{4}$/.test(value) ? value : undefined;
}

function parseDateSearch(value: unknown) {
  if (typeof value !== "string") return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}
