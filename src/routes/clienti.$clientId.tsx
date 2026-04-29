import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ClientForm } from "@/components/client-form";
import { supabase } from "@/integrations/supabase/client";
import { clientDisplayName } from "@/lib/labels";

export const Route = createFileRoute("/clienti/$clientId")({
  head: () => ({
    meta: [
      { title: "Cliente — Pratix" },
      { name: "description", content: "Dettaglio cliente." },
      { property: "og:title", content: "Cliente — Pratix" },
      { property: "og:description", content: "Dettaglio cliente." },
    ],
  }),
  component: () => (
    <AppLayout>
      <ClientDetail />
    </AppLayout>
  ),
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Cliente non trovato" />
        <Link to="/clienti">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Torna ai clienti
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={clientDisplayName(data)}
        description="Modifica i dati del cliente."
        actions={
          <Link to="/clienti">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> Indietro
            </Button>
          </Link>
        }
      />
      <ClientForm
        initial={data}
        onSaved={() => navigate({ to: "/clienti" })}
        onCancel={() => navigate({ to: "/clienti" })}
      />
    </>
  );
}
