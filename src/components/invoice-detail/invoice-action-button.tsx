import { type ActionMutation } from "@/components/invoice-detail/types";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvoiceActionButton({
  mutation,
  icon: Icon,
  children,
}: {
  mutation: ActionMutation;
  icon: typeof Send;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      className="w-full justify-start"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      <Icon className="mr-2 size-4" /> {children}
    </Button>
  );
}
