import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { caseStatusLabels, caseStatusVariant } from "@/lib/labels";

export function HistoryTab({ caseId }: { caseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["case-history", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_status_history")
        .select("*")
        .eq("case_id", caseId)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Storico stati</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : data && data.length > 0 ? (
          <ul className="space-y-3">
            {data.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {h.previous_status && (
                    <>
                      <Badge variant="outline">
                        {caseStatusLabels[h.previous_status] ?? h.previous_status}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                    </>
                  )}
                  <Badge variant={caseStatusVariant[h.new_status] ?? "outline"}>
                    {caseStatusLabels[h.new_status] ?? h.new_status}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(h.changed_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nessun cambio di stato registrato.</p>
        )}
      </CardContent>
    </Card>
  );
}
