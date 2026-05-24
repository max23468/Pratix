import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaseForm } from "@/components/case-form";
import { CaseActivitiesTab } from "@/components/case-activities";
import { CaseOperationsPanel } from "@/components/case-operations-panel";
import { CreditTransfersTab } from "@/components/practices/credit-transfers-tab";
import { HistoryTab } from "@/components/practices/case-history-tab";
import { supabase } from "@/integrations/supabase/client";
import {
  caseStatusLabels,
  caseStatusVariant,
  clientDisplayName,
  counterpartyDisplayName,
  practiceDisplayName,
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
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 max-w-full truncate font-display text-[26px] font-semibold tracking-tight text-foreground">
              {practiceDisplayName(caseRow)}
            </h1>
            <Badge variant={caseStatusVariant[caseRow.status] ?? "outline"}>
              {caseStatusLabels[caseRow.status] ?? caseRow.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {principalName} · {clientName} · {counterpartyName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </div>

      <CaseOperationsPanel
        caseRow={caseRow}
        afterDashboardSlot={<CaseActivitiesTab caseRow={caseRow} />}
        detailsSlot={
          <CaseForm
            initial={caseRow}
            onSaved={() => navigate({ to: "/pratiche" })}
            onCancel={() => navigate({ to: "/pratiche" })}
          />
        }
      />

      <Tabs defaultValue="transfers" className="mt-6">
        <TabsList>
          <TabsTrigger value="transfers">Cessioni credito</TabsTrigger>
          <TabsTrigger value="history">Storico stati</TabsTrigger>
        </TabsList>

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
