import { Plus } from "lucide-react";
import { ActivityEditor } from "./activity-editor";
import type { ActivityDraft, ImportDraft, PriceOption } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ActivitiesStep({
  draft,
  priceOptions,
  updateActivity,
  addActivity,
  removeActivity,
}: {
  draft: ImportDraft;
  priceOptions: PriceOption[];
  updateActivity: <K extends keyof ActivityDraft>(
    localId: string,
    key: K,
    value: ActivityDraft[K],
  ) => void;
  addActivity: () => void;
  removeActivity: (localId: string) => void;
}) {
  const canAddActivities = draft.principalMode === "existing" && Boolean(draft.principalId);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Attività storiche</CardTitle>
            <CardDescription>
              Aggiungi compensi e rimborsi spese già presenti nell'archivio.
            </CardDescription>
          </div>
          <Button type="button" size="sm" onClick={addActivity} disabled={!canAddActivities}>
            <Plus className="mr-1 size-4" /> Aggiungi attività
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canAddActivities ? (
          <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            Per inserire attività nel wizard seleziona un committente esistente con Prezzi
            configurati. Se il committente è nuovo, importa prima la pratica e poi configura i
            Prezzi.
          </p>
        ) : priceOptions.length === 0 ? (
          <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            Nessuna voce prezzo trovata per questo committente. Puoi importare la pratica senza
            attività e completarle dopo dalla sezione Attività.
          </p>
        ) : null}

        {draft.activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna attività storica inserita.</p>
        ) : (
          <div className="space-y-4">
            {draft.activities.map((activity, index) => (
              <ActivityEditor
                key={activity.localId}
                index={index}
                activity={activity}
                priceOptions={priceOptions}
                updateActivity={updateActivity}
                removeActivity={removeActivity}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
