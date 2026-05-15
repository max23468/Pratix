import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  buildInvoiceArchive,
  buildInvoiceArchiveFileName,
  buildSingleInvoiceFiles,
  downloadBytes,
  type InvoiceXmlFile,
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
import { generateInvoiceXmlFn } from "@/server/invoices.functions";

type InvoiceListRow = {
  id: string;
  number: string;
  year: number;
  issue_date: string;
  due_date: string | null;
  status: string;
  total_amount: number;
  net_to_pay: number;
  client: ClientDisplayData | null;
  principal: { id: string; business_name: string } | null;
};

type GenerateInvoiceXmlResult = {
  xml: string;
  filename: string;
};

const unwrapServerResult = <T,>(result: T | { data: T }) =>
  "data" in Object(result) ? (result as { data: T }).data : (result as T);

const readServerResult = async <T,>(result: T | { data: T } | Response) => {
  if (result instanceof Response) {
    if (!result.ok) throw new Error(await result.text());
    const contentType = result.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return unwrapServerResult<T>(await result.json());
    }
    throw new Error("Risposta server non valida");
  }
  return unwrapServerResult<T>(result);
};

export const Route = createFileRoute("/fatture/")({
  validateSearch: (search: Record<string, unknown>): InvoicesSearch => ({
    q: parseTextSearch(search.q),
    status: parseFilterValue(search.status, invoiceStatusLabels),
    year: parseYearSearch(search.year),
    from: parseDateSearch(search.from),
    to: parseDateSearch(search.to),
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
      },
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id, number, year, issue_date, due_date, status, total_amount, net_to_pay, client:clients(id, kind, first_name, last_name, business_name), principal:principals(id, business_name)",
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

  const exportZipMutation = useMutation({
    mutationFn: async () => {
      if (filtered.length === 0) throw new Error("Nessuna fattura da esportare");

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessione non valida. Accedi di nuovo.");

      const files = [];
      for (const invoice of filtered) {
        const [pdfData, xmlPayload] = await Promise.all([
          loadInvoicePdfData(invoice.id),
          generateInvoiceXml({
            data: { invoiceId: invoice.id },
            headers: { Authorization: `Bearer ${token}` },
          }).then((result) => readServerResult<GenerateInvoiceXmlResult>(result)),
        ]);

        files.push(
          ...buildSingleInvoiceFiles({
            invoice: pdfData,
            xml: xmlPayload satisfies InvoiceXmlFile,
          }),
        );
      }

      const archive = buildInvoiceArchive(files);
      downloadBytes({
        bytes: archive.bytes,
        fileName: buildInvoiceArchiveFileName({ periodStart, periodEnd }),
        mimeType: archive.mimeType,
      });
      return filtered.length;
    },
    onSuccess: (count) => toast.success(`${count} fatture esportate`),
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
            <Button
              type="button"
              variant="outline"
              onClick={() => exportZipMutation.mutate()}
              disabled={exportZipMutation.isPending || filtered.length === 0}
            >
              <Archive className="mr-2 size-4" />
              {exportZipMutation.isPending ? "Preparazione ZIP…" : "Esporta ZIP PDF + XML"}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Committente</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Caricamento…
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
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
                {filtered.map((i) => {
                  const isOverdue = i.status === "issued" && i.due_date && i.due_date < today;
                  return (
                    <TableRow key={i.id} className="relative cursor-pointer">
                      <TableCell>
                        <Link
                          to="/fatture/$invoiceId"
                          params={{ invoiceId: i.id }}
                          className="font-medium after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                        >
                          {i.number}/{i.year}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(i.issue_date)}</TableCell>
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
