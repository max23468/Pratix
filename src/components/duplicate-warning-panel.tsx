import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  displayDuplicateEntity,
  shouldWarnBeforeCreate,
  type DuplicateCandidate,
  type DuplicateRecord,
} from "@/lib/duplicate-matching";
import { confidenceLabel } from "@/server/duplicates.logic";

type Props = {
  candidates: DuplicateCandidate[];
  onUseExisting?: (record: DuplicateRecord) => void;
  onCreateAnyway?: () => void;
  createAnywayLabel?: string;
};

export function DuplicateWarningPanel({
  candidates,
  onUseExisting,
  onCreateAnyway,
  createAnywayLabel = "Crea comunque",
}: Props) {
  const visible = candidates.filter(shouldWarnBeforeCreate);
  if (visible.length === 0) return null;

  const entity = displayDuplicateEntity(visible[0].entityType).toLowerCase();

  return (
    <Alert>
      <AlertTriangle className="size-4" />
      <AlertTitle>Potrebbe già esistere un {entity} simile</AlertTitle>
      <AlertDescription className="mt-3 space-y-3">
        {visible.slice(0, 3).map((candidate) => (
          <div
            key={`${candidate.entityType}-${candidate.left.id}-${candidate.right.id}`}
            className="rounded-md border border-border bg-background p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-foreground">{candidate.left.label}</div>
                {candidate.left.subtitle && (
                  <div className="text-xs text-muted-foreground">{candidate.left.subtitle}</div>
                )}
              </div>
              <Badge variant={candidate.confidence === "high" ? "default" : "secondary"}>
                Probabilità {confidenceLabel(candidate.confidence).toLowerCase()}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {candidate.reasons.join(" · ")}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {onUseExisting && (
                <Button type="button" size="sm" onClick={() => onUseExisting(candidate.left)}>
                  <Check className="mr-1 size-4" />
                  Usa esistente
                </Button>
              )}
              {candidate.left.href && (
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link to={candidate.left.href as never}>
                    <ExternalLink className="mr-1 size-4" />
                    Apri confronto
                  </Link>
                </Button>
              )}
            </div>
          </div>
        ))}
        {onCreateAnyway && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onCreateAnyway}>
              {createAnywayLabel}
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
