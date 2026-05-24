import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { CounterpartyForm } from "@/components/counterparty-form";
import { PageHeader } from "@/components/page-header";
import { PageState } from "@/components/page-state";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { counterpartyDisplayName } from "@/lib/labels";
import { publicCodeLookup } from "@/lib/public-route-code";

export const Route = createFileRoute("/controparti/$counterpartyId")({
  head: () => ({
    meta: [
      { title: "Controparte · Pratix" },
      { name: "description", content: "Dettaglio controparte." },
      { property: "og:title", content: "Controparte · Pratix" },
      { property: "og:description", content: "Dettaglio controparte." },
    ],
  }),
  component: () => (
    <AppLayout>
      <CounterpartyDetail />
    </AppLayout>
  ),
});

function CounterpartyDetail() {
  const { counterpartyId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["counterparty", counterpartyId],
    queryFn: async () => {
      const lookup = publicCodeLookup(counterpartyId);
      const { data: counterparty, error: counterpartyError } = await supabase
        .from("counterparties")
        .select("*")
        .eq(lookup.column, lookup.value)
        .maybeSingle();
      if (counterpartyError) throw counterpartyError;

      if (!counterparty) return { counterparty, subjects: [] };

      const { data: subjects, error: subjectsError } = await supabase
        .from("counterparty_subjects")
        .select("*")
        .eq("counterparty_id", counterparty.id)
        .order("position", { ascending: true });
      if (subjectsError) throw subjectsError;

      return { counterparty, subjects: subjects ?? [] };
    },
  });

  if (isLoading) {
    return <PageState variant="loading" title="Caricamento controparte…" />;
  }

  if (!data?.counterparty) {
    return (
      <PageState
        variant="not-found"
        title="Controparte non trovata"
        description="La controparte non esiste o non è più disponibile."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/controparti">
              <ArrowLeft className="mr-1 size-4" /> Torna alle controparti
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={counterpartyDisplayName(data.counterparty)}
        description="Modifica anagrafica e soggetti collegati."
        actions={
          <>
            <Link to="/controparti/nuova">
              <Button size="sm">
                <Plus className="mr-1 size-4" /> Nuova controparte
              </Button>
            </Link>
            <Link to="/controparti">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1 size-4" /> Torna alle controparti
              </Button>
            </Link>
          </>
        }
      />
      <CounterpartyForm
        initial={data.counterparty}
        initialSubjects={data.subjects}
        onSaved={() => navigate({ to: "/controparti" })}
        onCancel={() => navigate({ to: "/controparti" })}
      />
    </>
  );
}
