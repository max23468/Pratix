import { Link } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkQueueItem } from "@/components/dashboard/types";

export function WorkQueueCard({
  items,
  isLoading,
}: {
  items: WorkQueueItem[];
  isLoading: boolean;
}) {
  const [firstItem, ...otherItems] = items;

  return (
    <Card className="mt-4 border-border/70 shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Coda di lavoro</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Calcolo delle priorità operative…</p>
        ) : firstItem ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <Link
              to="/pratiche/$caseId"
              params={{ caseId: firstItem.caseRef }}
              className="rounded-md border border-border p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={firstItem.priorityVariant}>{firstItem.priorityLabel}</Badge>
                <span className="text-xs font-medium text-muted-foreground">
                  Pratica {firstItem.practiceNumber} · {firstItem.stage}
                </span>
              </div>
              <h2 className="mt-3 text-base font-semibold text-foreground">{firstItem.action}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{firstItem.reason}</p>
            </Link>

            <div className="space-y-2">
              {otherItems.length > 0 ? (
                otherItems.slice(0, 3).map((item) => (
                  <Link
                    key={item.caseRef}
                    to="/pratiche/$caseId"
                    params={{ caseId: item.caseRef }}
                    className="flex min-w-0 gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Flag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          Pratica {item.practiceNumber}
                        </span>
                        <Badge variant={item.priorityVariant}>{item.priorityLabel}</Badge>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {item.action}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
                  Questa è l'unica priorità operativa rilevata ora.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border p-4">
            <p className="text-sm font-medium">Nessuna pratica richiede intervento immediato.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Puoi continuare da Attività, Fatture o dalla Creazione guidata quando devi registrare
              nuovo lavoro.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
