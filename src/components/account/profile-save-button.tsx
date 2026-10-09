import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export function ProfileSaveButton({
  isSaving,
  isLoading,
  onSave,
}: {
  isSaving: boolean;
  isLoading: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end">
      <Button onClick={onSave} disabled={isSaving || isLoading}>
        <Save className="mr-2 size-4" />
        {isSaving ? "Salvataggio…" : "Salva profilo"}
      </Button>
    </div>
  );
}
