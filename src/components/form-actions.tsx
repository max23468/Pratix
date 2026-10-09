import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function FormActions({
  isEdit,
  isPending,
  onCancel,
  onDelete,
  deleteTitle,
  deleteDescription,
}: {
  isEdit: boolean;
  isPending: boolean;
  onCancel: () => void;
  onDelete: () => void;
  deleteTitle: string;
  deleteDescription: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        {isEdit && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Trash2 className="mr-1 size-4" /> Elimina
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
                <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>Elimina</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </div>
  );
}
