import { type InvoiceRecord } from "@/components/invoice-detail/types";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";

export function EditDraftButton({ invoice }: { invoice: InvoiceRecord }) {
  return (
    <Button asChild className="w-full justify-start">
      <Link to="/fatture/nuova" search={{ bozza: invoice.public_code ?? invoice.id }}>
        <Pencil className="mr-2 size-4" /> Modifica bozza
      </Link>
    </Button>
  );
}
