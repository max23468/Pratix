import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { PageState } from "@/components/page-state";
import { PriceBookForm } from "@/components/price-book-form";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { publicCodeLookup } from "@/lib/public-route-code";

export const Route = createFileRoute("/prezzi/$priceBookId")({
  head: () => ({
    meta: [
      { title: "Prezzi · Pratix" },
      { name: "description", content: "Dettaglio prezzi annuali." },
      { property: "og:title", content: "Prezzi · Pratix" },
      { property: "og:description", content: "Dettaglio prezzi annuali." },
    ],
  }),
  component: () => (
    <AppLayout>
      <PriceBookDetail />
    </AppLayout>
  ),
});

function PriceBookDetail() {
  const { priceBookId } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["price-book", priceBookId],
    queryFn: async () => {
      const lookup = publicCodeLookup(priceBookId);
      const { data: priceBook, error: priceBookError } = await supabase
        .from("price_books")
        .select("*")
        .eq(lookup.column, lookup.value)
        .maybeSingle();
      if (priceBookError) throw priceBookError;
      if (!priceBook) return { priceBook, items: [] };

      const [{ data: items, error: itemsError }, { data: usageRows, error: usageError }] =
        await Promise.all([
          supabase
            .from("price_items")
            .select("*")
            .eq("price_book_id", priceBook.id)
            .order("sort_order", { ascending: true }),
          supabase
            .from("case_activities")
            .select("price_item_id")
            .eq("price_book_id", priceBook.id),
        ]);

      if (itemsError) throw itemsError;
      if (usageError) throw usageError;

      const usageByItem = (usageRows ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.price_item_id] = (acc[row.price_item_id] ?? 0) + 1;
        return acc;
      }, {});

      return {
        priceBook,
        items: (items ?? []).map((item) => ({
          ...item,
          usedCount: usageByItem[item.id] ?? 0,
        })),
      };
    },
  });

  if (isLoading) {
    return <PageState variant="loading" title="Caricamento prezzi…" />;
  }

  if (!data?.priceBook) {
    return (
      <PageState
        variant="not-found"
        title="Prezzi non trovati"
        description="Il set prezzi non esiste o non è più disponibile."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link to="/prezzi">
              <ArrowLeft className="mr-1 size-4" /> Torna ai prezzi
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={`Prezzi ${data.priceBook.year}`}
        description="Modifica voci, abilitazioni e stato annuale."
        actions={
          <>
            <Link to="/prezzi/nuovo">
              <Button size="sm">
                <Plus className="mr-1 size-4" /> Nuovi prezzi
              </Button>
            </Link>
            <Link to="/prezzi">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1 size-4" /> Torna ai prezzi
              </Button>
            </Link>
          </>
        }
      />
      <PriceBookForm
        initial={data.priceBook}
        initialItems={data.items}
        onSaved={() => navigate({ to: "/prezzi" })}
        onCancel={() => navigate({ to: "/prezzi" })}
      />
    </>
  );
}
