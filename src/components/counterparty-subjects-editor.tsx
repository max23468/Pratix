import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { clientKindLabels } from "@/lib/labels";
import {
  emptySubject,
  type SubjectDraft,
  type SubjectKind,
  type SubjectRow,
} from "@/components/counterparty-subjects";

export function CounterpartySubjectsEditor({
  subjects,
  setSubjects,
  markDirty,
  onUpdate,
}: {
  subjects: SubjectDraft[];
  setSubjects: Dispatch<SetStateAction<SubjectDraft[]>>;
  markDirty: () => void;
  onUpdate: <K extends keyof SubjectRow>(index: number, key: K, value: SubjectRow[K]) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Soggetti della controparte</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              markDirty();
              setSubjects((current) => [...current, emptySubject(current.length)]);
            }}
          >
            <Plus className="mr-1 size-4" /> Soggetto
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {subjects.map((subject, index) => (
          <div key={subject.clientKey} className="rounded-md border border-border p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Soggetto {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  markDirty();
                  setSubjects((current) =>
                    current.length === 1
                      ? [emptySubject(0)]
                      : current.filter((_, currentIndex) => currentIndex !== index),
                  );
                }}
              >
                <Trash2 className="mr-1 size-4" /> Rimuovi
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`subject_kind_${index}`}>Tipo</Label>
                <Select
                  value={subject.kind}
                  onValueChange={(value) => onUpdate(index, "kind", value as SubjectKind)}
                >
                  <SelectTrigger id={`subject_kind_${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(clientKindLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {subject.kind === "company" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`subject_business_${index}`}>Ragione sociale</Label>
                  <Input
                    id={`subject_business_${index}`}
                    value={subject.business_name ?? ""}
                    onChange={(event) => onUpdate(index, "business_name", event.target.value)}
                    placeholder="Es. Debitore S.r.l."
                  />
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`subject_last_${index}`}>Cognome</Label>
                    <Input
                      id={`subject_last_${index}`}
                      value={subject.last_name ?? ""}
                      onChange={(event) => onUpdate(index, "last_name", event.target.value)}
                      placeholder="Es. Rossi"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`subject_first_${index}`}>Nome</Label>
                    <Input
                      id={`subject_first_${index}`}
                      value={subject.first_name ?? ""}
                      onChange={(event) => onUpdate(index, "first_name", event.target.value)}
                      placeholder="Es. Anna"
                    />
                  </div>
                </>
              )}
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor={`subject_notes_${index}`}>Note</Label>
                <Textarea
                  id={`subject_notes_${index}`}
                  rows={2}
                  value={subject.notes ?? ""}
                  onChange={(event) => onUpdate(index, "notes", event.target.value)}
                  placeholder="Es. ruolo del soggetto nella controparte"
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
