import { type PrezziListBodyProps } from "@/components/price-books/types";
import { PrezziTableMessage } from "@/components/price-books/prezzi-table-message";
import { PriceBookTableRow } from "@/components/price-books/price-book-table-row";
import { emptyPriceBookCounts } from "@/components/price-books/helpers";
import { routeRef } from "@/lib/public-route-code";

export function PrezziTableBody({
  isLoading,
  rows,
  hasSearch,
  principalNameById,
  countsByBook,
  onOpen,
}: PrezziListBodyProps & { onOpen: (priceBookId: string) => void }) {
  if (isLoading) return <PrezziTableMessage>Caricamento…</PrezziTableMessage>;
  if (rows.length === 0) {
    return (
      <PrezziTableMessage>
        {hasSearch ? "Nessun risultato." : "Nessun prezzo. Crea il primo set annuale."}
      </PrezziTableMessage>
    );
  }
  return rows.map((book) => (
    <PriceBookTableRow
      key={book.id}
      book={book}
      counts={countsByBook[book.id] ?? emptyPriceBookCounts}
      principalName={principalNameById.get(book.principal_id) ?? "—"}
      onOpen={() => onOpen(routeRef(book))}
    />
  ));
}
