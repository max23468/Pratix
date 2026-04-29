import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type Props = {
  caseId?: string;
  trigger?: React.ReactNode;
  allowCasePicker?: boolean;
};

export function DeadlineDialog({ caseId, trigger, allowCasePicker = false }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCaseId, setSelectedCaseId] = useState<string>(caseId ?? "");

  useEffect(() => {
    if (caseId) setSelectedCaseId(caseId);
  }, [caseId]);

  const { data: cases } = useQuery({
    enabled: open && allowCasePicker,
    queryKey: ["cases-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_number, title")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!description.trim()) throw new Error("Inserisci una descrizione");
      const targetCaseId = caseId ?? selectedCaseId;
      if (!targetCaseId) throw new Error("Seleziona una pratica");
      const { error } = await supabase.from("case_deadlines").insert({
        user_id: user.id,
        case_id: targetCaseId,
        description: description.trim(),
        due_date: dueDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scadenza creata");
      qc.invalidateQueries({ queryKey: ["case-deadlines"] });
      qc.invalidateQueries({ queryKey: ["deadlines-global"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setDescription("");
      setDueDate(new Date().toISOString().slice(0, 10));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nuova scadenza
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuova scadenza</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {allowCasePicker && !caseId && (
            <div className="space-y-2">
              <Label htmlFor="case">Pratica</Label>
              <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                <SelectTrigger id="case">
                  <SelectValue placeholder="Seleziona una pratica" />
                </SelectTrigger>
                <SelectContent>
                  {(cases ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_number} · {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="desc">Descrizione</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="es. Deposito memoria 183"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvataggio…" : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
