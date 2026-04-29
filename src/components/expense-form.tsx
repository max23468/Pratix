import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { expenseCategoryLabels } from "@/lib/labels";
import { clientDisplayName } from "@/lib/labels";

type Props = {
  caseId?: string;
  trigger?: React.ReactNode;
  onSaved?: () => void;
};

const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseDialog({ caseId, trigger, onSaved }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    case_id: caseId ?? "",
    expense_date: today(),
    category: "altro",
    description: "",
    amount: 0,
    is_art15: false,
  });

  const { data: cases } = useQuery({
    enabled: open && !caseId,
    queryKey: ["cases", "for-expense"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_number, title, clients(kind, first_name, last_name, business_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!form.case_id) throw new Error("Seleziona una pratica");
      if (!form.description.trim()) throw new Error("Inserisci una descrizione");
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        case_id: form.case_id,
        expense_date: form.expense_date,
        category: form.category as "altro",
        description: form.description.trim(),
        amount: Number(form.amount) || 0,
        is_art15: form.is_art15,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Spesa registrata");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["case-expenses"] });
      setOpen(false);
      setForm({
        case_id: caseId ?? "",
        expense_date: today(),
        category: "altro",
        description: "",
        amount: 0,
        is_art15: false,
      });
      onSaved?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nuova spesa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova spesa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!caseId && (
            <div className="space-y-2">
              <Label htmlFor="case">Pratica</Label>
              <Select
                value={form.case_id}
                onValueChange={(v) => setForm((f) => ({ ...f, case_id: v }))}
              >
                <SelectTrigger id="case">
                  <SelectValue placeholder="Seleziona pratica" />
                </SelectTrigger>
                <SelectContent>
                  {(cases ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.case_number} · {c.title}
                      
                      {c.clients ? ` — ${clientDisplayName(c.clients)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat">Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger id="cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(expenseCategoryLabels).map(([k, l]) => (
                    <SelectItem key={k} value={k}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Descrizione</Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="es. Marca da bollo per ricorso"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Importo (€)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="art15" className="text-sm">Anticipazione Art. 15</Label>
                <p className="text-xs text-muted-foreground">Esclusa da imponibile e IVA</p>
              </div>
              <Switch
                id="art15"
                checked={form.is_art15}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_art15: v }))}
              />
            </div>
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
