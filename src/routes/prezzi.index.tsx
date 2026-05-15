import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { AppLayout } from "@/components/app-layout";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { priceBookStatusLabels, priceBookStatusVariant } from "@/lib/labels";
import {
  handleClickableTableRowClick,
  handleClickableTableRowKeyDown,
} from "@/lib/table-row-navigation";

export const Route = createFileRoute("/prezzi/")({
  head: () => ({
    meta: [
      { title: "Prezzi · Pratix" },
      {
        name: "description",
        content: "Gestisci i prezzi annuali dei committenti.",
      },
      { property: "og:title", content: "Prezzi · Pratix" },
      {
        property: "og:description",
        content: "Gestisci i prezzi annuali dei committenti.",
      },
    ],
  }),
  component: () => (
    <AppLayout>
      <PrezziList />
    </AppLayout>
  ),
});

function PrezziList() {
  const navigate = Route.useNavigate();
  const [q, setQ] = useState("");

  const { data: priceBooks = [], isLoading } = useQuery({
    queryKey: ["price-books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_books")
        .select(
          "id, principal_id, year, status, fees_enabled, expense_reimbursements_enabled, valid_from, valid_to, updated_at",
        )
        .order("year", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: principals = [] } = useQuery({
    queryKey: ["principals", "price-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name")
        .order("business_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: priceItems = [] } = useQuery({
    queryKey: ["price-items", "counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_items")
        .select("price_book_id, kind, is_enabled");
      if (error) throw error;
      return data ?? [];
    },
  });

  const principalNameById = useMemo(
    () => new Map(principals.map((principal) => [principal.id, principal.business_name])),
    [principals],
  );

  const countsByBook = useMemo(() => {
    return priceItems.reduce<Record<string, { fees: number; expenses: number; enabled: number }>>(
      (acc, item) => {
        const current = acc[item.price_book_id] ?? { fees: 0, expenses: 0, enabled: 0 };
        if (item.kind === "fee") current.fees += 1;
        if (item.kind === "expense_reimbursement") current.expenses += 1;
        if (item.is_enabled) current.enabled += 1;
        acc[item.price_book_id] = current;
        return acc;
      },
      {},
    );
  }, [priceItems]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return priceBooks;
    return priceBooks.filter((book) => {
      const principalName = principalNameById.get(book.principal_id)?.toLowerCase() ?? "";
      return (
        principalName.includes(term) ||
        String(book.year).includes(term) ||
        priceBookStatusLabels[book.status].toLowerCase().includes(term)
      );
    });
  }, [priceBooks, principalNameById, q]);

  const openPriceBook = (priceBookId: string) =>
    navigate({ to: "/prezzi/$priceBookId", params: { priceBookId } });

  return (
    <>
      <PageHeader
        title="Prezzi"
        description="Voci annuali per committente: compensi e rimborsi spese."
        actions={
          <Link to="/prezzi/nuovo">
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Nuovi prezzi
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca per committente, anno o stato…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Committente</TableHead>
              <TableHead>Anno</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Regole</TableHead>
              <TableHead>Voci</TableHead>
              <TableHead>Validità</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Caricamento…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {q ? "Nessun risultato." : "Nessun prezzo. Crea il primo set annuale."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((book) => {
                const counts = countsByBook[book.id] ?? { fees: 0, expenses: 0, enabled: 0 };
                const principalName = principalNameById.get(book.principal_id) ?? "—";
                return (
                  <TableRow
                    key={book.id}
                    className="cursor-pointer"
                    role="link"
                    tabIndex={0}
                    aria-label={`Apri prezzi ${principalName} ${book.year}`}
                    onClick={(event) =>
                      handleClickableTableRowClick(event, () => openPriceBook(book.id))
                    }
                    onKeyDown={(event) =>
                      handleClickableTableRowKeyDown(event, () => openPriceBook(book.id))
                    }
                  >
                    <TableCell>
                      <Link
                        to="/prezzi/$priceBookId"
                        params={{ priceBookId: book.id }}
                        className="font-medium hover:underline"
                      >
                        {principalName}
                      </Link>
                    </TableCell>
                    <TableCell>{book.year}</TableCell>
                    <TableCell>
                      <Badge variant={priceBookStatusVariant[book.status]}>
                        {priceBookStatusLabels[book.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {rulesLabel(book)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {counts.fees} compensi, {counts.expenses} rimborsi
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {book.valid_from} → {book.valid_to ?? "senza fine"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function rulesLabel(book: { fees_enabled: boolean; expense_reimbursements_enabled: boolean }) {
  if (book.fees_enabled && book.expense_reimbursements_enabled) return "Compensi e rimborsi";
  if (book.fees_enabled) return "Solo compensi";
  if (book.expense_reimbursements_enabled) return "Solo rimborsi";
  return "Nessuna regola";
}
