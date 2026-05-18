import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CaseForm } from "@/components/case-form";
import { CaseActivitiesTab } from "@/components/case-activities";
import { CaseOperationsPanel } from "@/components/case-operations-panel";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import {
  caseStatusLabels,
  caseStatusVariant,
  clientDisplayName,
  counterpartyDisplayName,
} from "@/lib/labels";
import { publicCodeLookup } from "@/lib/public-route-code";

export const Route = createFileRoute("/pratiche/$caseId")({
  head: () => ({
    meta: [
      { title: "Pratica · Pratix" },
      { name: "description", content: "Dettaglio pratica con dati e voci fatturabili." },
      { property: "og:title", content: "Pratica · Pratix" },
      { property: "og:description", content: "Dettaglio pratica con dati e voci fatturabili." },
    ],
  }),
  component: () => (
    <AppLayout>
      <CaseDetail />
    </AppLayout>
  ),
});

function CaseDetail() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();

  const { data: caseRow, isLoading } = useQuery({
    queryKey: ["case", caseId],
    queryFn: async () => {
      const lookup = publicCodeLookup(caseId);
      const { data, error } = await supabase
        .from("cases")
        .select(
          "*, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)",
        )
        .eq(lookup.column, lookup.value)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  }
  if (!caseRow) {
    return (
      <>
        <PageHeader title="Pratica non trovata" />
        <Link to="/pratiche">
          <Button size="sm" variant="outline">
            <ArrowLeft className="mr-1 size-4" /> Torna alle pratiche
          </Button>
        </Link>
      </>
    );
  }

  const clientName = caseRow.clients ? clientDisplayName(caseRow.clients) : "—";
  const principalName = caseRow.principals?.business_name ?? "—";
  const counterpartyName = caseRow.counterparties
    ? counterpartyDisplayName(caseRow.counterparties)
    : "—";

  return (
    <>
      <PageHeader
        title={caseRow.title}
        titleAccessory={
          <Badge variant={caseStatusVariant[caseRow.status] ?? "outline"}>
            {caseStatusLabels[caseRow.status] ?? caseRow.status}
          </Badge>
        }
        description={`Pratica ${caseRow.practice_number} · ${principalName} · ${clientName} · ${counterpartyName}`}
        actions={
          <>
            <Link to="/pratiche/nuova">
              <Button size="sm">
                <Plus className="mr-1 size-4" /> Nuova pratica
              </Button>
            </Link>
            <Link to="/pratiche">
              <Button size="sm" variant="outline">
                <ArrowLeft className="mr-1 size-4" /> Torna alle pratiche
              </Button>
            </Link>
          </>
        }
      />

      <CaseOperationsPanel
        caseRow={caseRow}
        detailsSlot={
          <CaseForm
            initial={caseRow}
            onSaved={() => navigate({ to: "/pratiche" })}
            onCancel={() => navigate({ to: "/pratiche" })}
          />
        }
      />

      <Tabs defaultValue="activities" className="mt-6">
        <TabsList>
          <TabsTrigger value="activities">Attività</TabsTrigger>
          <TabsTrigger value="transfers">Cessioni credito</TabsTrigger>
          <TabsTrigger value="history">Storico stati</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="mt-4">
          <CaseActivitiesTab caseRow={caseRow} />
        </TabsContent>

        <TabsContent value="transfers" className="mt-4">
          <CreditTransfersTab caseId={caseRow.id} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab caseId={caseRow.id} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function HistoryTab({ caseId }: { caseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["case-history", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_status_history")
        .select("*")
        .eq("case_id", caseId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Storico stati</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : data && data.length > 0 ? (
          <ul className="space-y-3">
            {data.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {h.previous_status && (
                    <>
                      <Badge variant="outline">
                        {caseStatusLabels[h.previous_status] ?? h.previous_status}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                    </>
                  )}
                  <Badge variant={caseStatusVariant[h.new_status] ?? "outline"}>
                    {caseStatusLabels[h.new_status] ?? h.new_status}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(h.changed_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nessun cambio di stato registrato.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CreditTransfersTab({ caseId }: { caseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["case-credit-transfers", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_credit_transfers")
        .select(
          "*, previous_client:clients!case_credit_transfers_previous_client_owner_fkey(kind, first_name, last_name, business_name), new_client:clients!case_credit_transfers_new_client_owner_fkey(kind, first_name, last_name, business_name)",
        )
        .eq("case_id", caseId)
        .order("transferred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cessioni credito</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : data && data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente precedente</TableHead>
                <TableHead>Cliente corrente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell className="text-sm">{formatDate(transfer.transferred_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {transfer.previous_client ? clientDisplayName(transfer.previous_client) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {transfer.new_client ? clientDisplayName(transfer.new_client) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna cessione registrata.</p>
        )}
      </CardContent>
    </Card>
  );
}
