import { type PriceBookListRow, type PriceBookCounts } from "@/components/price-books/types";
import { Link } from "@tanstack/react-router";
import { routeRef } from "@/lib/public-route-code";
import { mobileListCardLinkClassName } from "@/components/mobile-list-card";
import { MobileListCardHeader } from "@/components/mobile-list-card-header";
import { Badge } from "@/components/ui/badge";
import { priceBookStatusVariant, priceBookStatusLabels } from "@/lib/labels";
import { MobileListCardDetails } from "@/components/mobile-list-card-details";
import { rulesLabel } from "@/components/price-books/helpers";

export function PriceBookMobileCard({
  book,
  counts,
  principalName,
}: {
  book: PriceBookListRow;
  counts: PriceBookCounts;
  principalName: string;
}) {
  return (
    <Link
      to="/prezzi/$priceBookId"
      params={{ priceBookId: routeRef(book) }}
      className={mobileListCardLinkClassName}
    >
      <MobileListCardHeader
        title={principalName}
        subtitle={`Anno ${book.year}`}
        badge={
          <Badge variant={priceBookStatusVariant[book.status]}>
            {priceBookStatusLabels[book.status]}
          </Badge>
        }
      />
      <MobileListCardDetails
        rows={[
          { label: "Regole", value: rulesLabel(book) },
          {
            label: "Voci",
            value: `${counts.fees} compensi, ${counts.expenses} rimborsi`,
          },
          {
            label: "Validità",
            value: `${book.valid_from} → ${book.valid_to ?? "senza fine"}`,
          },
        ]}
      />
    </Link>
  );
}
