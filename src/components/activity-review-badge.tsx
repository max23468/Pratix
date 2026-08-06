import { Badge } from "@/components/ui/badge";

export function ActivityReviewBadge({ needsReview }: { needsReview?: boolean | null }) {
  if (!needsReview) return null;
  return (
    <Badge variant="secondary" className="w-fit">
      Da verificare
    </Badge>
  );
}
