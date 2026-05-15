import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { PrincipalForm } from "@/components/principal-form";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/committenti/$principalId")({
  head: () => ({
    meta: [
      { title: "Committente · Pratix" },
      { name: "description", content: "Dettaglio committente." },
      { property: "og:title", content: "Committente · Pratix" },
      { property: "og:description", content: "Dettaglio committente." },
    ],
  }),
  component: () => (
    <AppLayout>
      <PrincipalDetail />
    </AppLayout>
  ),
});

function PrincipalDetail() {
  const { principalId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["principal", principalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("*")
        .eq("id", principalId)
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
        <PageHeader title="Committente non trovato" />
        <Link to="/committenti">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 size-4" /> Torna ai committenti
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={data.business_name}
        description="Modifica anagrafica e regole economiche."
        actions={
          <>
            <Link to="/committenti/nuovo">
              <Button size="sm">
                <Plus className="mr-1 size-4" /> Nuovo committente
              </Button>
            </Link>
            <Link to="/committenti">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1 size-4" /> Indietro
              </Button>
            </Link>
          </>
        }
      />
      <PrincipalForm
        initial={data}
        onSaved={() => navigate({ to: "/committenti" })}
        onCancel={() => navigate({ to: "/committenti" })}
      />
    </>
  );
}
