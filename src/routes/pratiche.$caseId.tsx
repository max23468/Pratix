import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { PageState } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaseForm } from "@/components/case-form";
import { CaseActivitiesTab } from "@/components/case-activities-tab";
import { CaseOperationsPanel, type CaseOperationsCase } from "@/components/case-operations-panel";
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

const caseDetailHeaderActions = (
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
);

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
    return <PageState variant="loading" title="Caricamento pratica…" />;
  }
  if (!caseRow) {
    return (
      <PageState
        variant="not-found"
        title="Pratica non trovata"
        description="La pratica non esiste o non è più disponibile."
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/pratiche">
              <ArrowLeft className="mr-1 size-4" /> Torna alle pratiche
            </Link>
          </Button>
        }
      />
    );
  }

  return <CaseDetailContent caseRow={caseRow} />;
}

function CaseDetailContent({ caseRow }: { caseRow: CaseOperationsCase }) {
  const navigate = useNavigate();
  const clientName = caseRow.clients ? clientDisplayName(caseRow.clients) : "—";
  const principalName = caseRow.principals?.business_name ?? "—";
  const counterpartyName = caseRow.counterparties
    ? counterpartyDisplayName(caseRow.counterparties)
    : "—";
  const titleAccessory = useMemo(
    () => (
      <Badge variant={caseStatusVariant[caseRow.status] ?? "outline"}>
        {caseStatusLabels[caseRow.status] ?? caseRow.status}
      </Badge>
    ),
    [caseRow.status],
  );
  const afterDashboardSlot = useMemo(() => <CaseActivitiesTab caseRow={caseRow} />, [caseRow]);
  const detailsSlot = useMemo(
    () => (
      <CaseForm
        initial={caseRow}
        onSaved={() => navigate({ to: "/pratiche" })}
        onCancel={() => navigate({ to: "/pratiche" })}
      />
    ),
    [caseRow, navigate],
  );

  return (
    <>
      <PageHeader
        title={practiceDisplayName(caseRow)}
        titleAccessory={titleAccessory}
        description={`${principalName} · ${clientName} · ${counterpartyName}`}
        actions={caseDetailHeaderActions}
      />

      <CaseOperationsPanel
        caseRow={caseRow}
        afterDashboardSlot={afterDashboardSlot}
        detailsSlot={detailsSlot}
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
