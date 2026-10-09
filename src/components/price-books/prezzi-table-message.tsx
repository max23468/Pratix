import { TableRow, TableCell } from "@/components/ui/table";

export function PrezziTableMessage({ children }: { children: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}
