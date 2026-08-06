import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ActivityAttachmentFields({
  file,
  name,
  type,
  notes,
  onFileChange,
  onNameChange,
  onTypeChange,
  onNotesChange,
}: {
  file: File | null;
  name: string;
  type: string;
  notes: string;
  onFileChange: (file: File | null) => void;
  onNameChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="attachment">Allegato</Label>
          <Input
            id="attachment"
            type="file"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="attachment_name">Nome descrittivo</Label>
          <Input
            id="attachment_name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Es. Ricevuta contributo unificato"
            disabled={!file}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="attachment_type">Tipo documento</Label>
          <Input
            id="attachment_type"
            value={type}
            onChange={(event) => onTypeChange(event.target.value)}
            placeholder="Es. giustificativo spesa"
            disabled={!file}
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="attachment_notes">Note allegato</Label>
          <Textarea
            id="attachment_notes"
            rows={2}
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder="Es. importo anticipato per iscrizione a ruolo"
            disabled={!file}
          />
        </div>
      </div>
    </div>
  );
}
