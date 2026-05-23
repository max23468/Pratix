import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { clientDisplayName } from "@/lib/labels";

export function CreditTransfersTab({ caseId }: { caseId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["case-credit-transfers", caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_credit_transfers")
        .select(
          "*, previous_client:clients!case_credit_transfers_previous_client_owner_fkey(kind, first_name, last_name, business_name), new_client:clients!case_credit_transfers_new_client_owner_fkey(kind, first_name, last_name, business_name)",
        )
        .eq("case_id", caseId)
        .order("transferred_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cessioni credito</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : data && data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente precedente</TableHead>
                <TableHead>Cliente corrente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell className="text-sm">{formatDate(transfer.transferred_at)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {transfer.previous_client ? clientDisplayName(transfer.previous_client) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {transfer.new_client ? clientDisplayName(transfer.new_client) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna cessione registrata.</p>
        )}
      </CardContent>
    </Card>
  );
}
