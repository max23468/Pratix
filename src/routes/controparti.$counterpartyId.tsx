import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { CounterpartyForm } from "@/components/counterparty-form";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { counterpartyDisplayName } from "@/lib/labels";

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
      const [
        { data: counterparty, error: counterpartyError },
        { data: subjects, error: subjectsError },
      ] = await Promise.all([
        supabase.from("counterparties").select("*").eq("id", counterpartyId).maybeSingle(),
        supabase
          .from("counterparty_subjects")
          .select("*")
          .eq("counterparty_id", counterpartyId)
          .order("position", { ascending: true }),
      ]);

      if (counterpartyError) throw counterpartyError;
      if (subjectsError) throw subjectsError;

      return { counterparty, subjects: subjects ?? [] };
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  }

  if (!data?.counterparty) {
    return (
      <>
        <PageHeader title="Controparte non trovata" />
        <Link to="/controparti">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 size-4" /> Torna alle controparti
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={counterpartyDisplayName(data.counterparty)}
        description="Modifica anagrafica e soggetti collegati."
        actions={
          <Link to="/controparti">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1 size-4" /> Indietro
            </Button>
          </Link>
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
