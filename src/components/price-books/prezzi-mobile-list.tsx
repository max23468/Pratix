import { type PrezziListBodyProps } from "@/components/price-books/types";
import { Card } from "@/components/ui/card";
import { PrezziEmptyState } from "@/components/price-books/prezzi-empty-state";
import { PriceBookMobileCard } from "@/components/price-books/price-book-mobile-card";
import { emptyPriceBookCounts } from "@/components/price-books/helpers";

export function PrezziMobileList({
  isLoading,
  rows,
  hasSearch,
  principalNameById,
  countsByBook,
}: PrezziListBodyProps) {
  if (isLoading) {
    return <Card className="p-4 text-center text-sm text-muted-foreground">Caricamento…</Card>;
  }
  if (rows.length === 0) {
    return (
      <Card className="p-4">
        <PrezziEmptyState hasSearch={hasSearch} />
      </Card>
    );
  }
  return rows.map((book) => (
    <PriceBookMobileCard
      key={book.id}
      book={book}
      counts={countsByBook[book.id] ?? emptyPriceBookCounts}
      principalName={principalNameById.get(book.principal_id) ?? "—"}
    />
  ));
}
