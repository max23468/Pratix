import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { priceBookStatusLabels, priceItemKindLabels } from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import { useSubmitLock } from "@/lib/submit-lock";
import {
  createTemplateItems,
  defaultValidFrom,
  defaultValidTo,
  type PriceBookStatus,
  type PriceItemKind,
} from "@/lib/price-templates";

type PriceBookRow = {
  id?: string;
  public_code?: string | null;
  principal_id: string;
  year: number;
  status: PriceBookStatus;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
};

type PriceItemDraft = {
  id?: string;
  kind: PriceItemKind;
  code: string;
  name: string;
  invoice_description: string | null;
  unit_price: number | null;
  is_enabled: boolean;
  requires_hearing_dates: boolean;
  sort_order: number;
  usedCount?: number;
};

const currentYear = new Date().getFullYear();

const emptyBook = (year = currentYear): PriceBookRow => ({
  principal_id: "",
  year,
  status: "draft",
  fees_enabled: true,
  expense_reimbursements_enabled: true,
  valid_from: defaultValidFrom(year),
  valid_to: defaultValidTo(year),
  notes: "",
});

type Props = {
  initial?: Partial<PriceBookRow> & { id?: string };
  initialItems?: PriceItemDraft[];
  onSaved: (id: string) => void;
  onCancel: () => void;
};

const emptyItems: PriceItemDraft[] = [];

export function PriceBookForm({ initial, initialItems = emptyItems, onSaved, onCancel }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<PriceBookRow>({
    ...emptyBook(initial?.year ?? currentYear),
    ...(initial ?? {}),
  });
  const [items, setItems] = useState<PriceItemDraft[]>(
    initialItems.length > 0 ? initialItems : createTemplateItems(),
  );
  const { finishSave, formRef, guardDialog, markDirty } = useUnsavedChangesGuard();
  const saveLock = useSubmitLock();

  const { data: principals = [] } = useQuery({
    queryKey: ["principals", "price-book-form"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principals")
        .select("id, business_name, fees_enabled, expense_reimbursements_enabled, archived_at")
        .order("business_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: previousBook } = useQuery({
    queryKey: ["price-book", "previous", form.principal_id, form.year],
    enabled: !isEdit && Boolean(form.principal_id && form.year),
    queryFn: async () => {
      const { data: book, error: bookError } = await supabase
        .from("price_books")
        .select("*")
        .eq("principal_id", form.principal_id)
        .eq("year", Number(form.year) - 1)
        .maybeSingle();
      if (bookError) throw bookError;
      if (!book) return null;

      const { data: previousItems, error: itemsError } = await supabase
        .from("price_items")
        .select("*")
        .eq("price_book_id", book.id)
        .order("sort_order", { ascending: true });
      if (itemsError) throw itemsError;

      return { book, items: previousItems ?? [] };
    },
  });

  const selectedPrincipal = principals.find((principal) => principal.id === form.principal_id);

  useEffect(() => {
    if (isEdit || !selectedPrincipal) return;
    setForm((current) => ({
      ...current,
      fees_enabled: selectedPrincipal.fees_enabled,
      expense_reimbursements_enabled: selectedPrincipal.expense_reimbursements_enabled,
    }));
  }, [isEdit, selectedPrincipal]);

  const itemUsage = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, item) => {
      if (item.id && item.usedCount) acc[item.id] = item.usedCount;
      return acc;
    }, {});
  }, [items]);

  const setField = <K extends keyof PriceBookRow>(key: K, value: PriceBookRow[K]) => {
    markDirty();
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "year") {
        const year = Number(value);
        next.valid_from = defaultValidFrom(year);
        next.valid_to = defaultValidTo(year);
      }
      return next;
    });
  };

  const updateItem = <K extends keyof PriceItemDraft>(
    index: number,
    key: K,
    value: PriceItemDraft[K],
  ) => {
    markDirty();
    setItems((current) =>
      current.map((item, currentIndex) => {
        if (currentIndex !== index) return item;
        const next = { ...item, [key]: value };
        if (key === "kind" && value === "expense_reimbursement") next.unit_price = null;
        if (key === "kind" && value === "fee" && next.unit_price === null) next.unit_price = 0;
        return next;
      }),
    );
  };

  const addItem = (kind: PriceItemKind) => {
    markDirty();
    setItems((current) => [
      ...current,
      {
        kind,
        code: `${kind === "fee" ? "COMP" : "RIMB"}_NUOVA_${current.length + 1}`,
        name: "",
        invoice_description: "",
        unit_price: kind === "fee" ? 0 : null,
        is_enabled: true,
        requires_hearing_dates: false,
        sort_order: (current.at(-1)?.sort_order ?? 0) + 10,
      },
    ]);
  };

  const removeItem = (index: number) => {
    const item = items[index];
    if (item.id && itemUsage[item.id] > 0) {
      toast.error("La voce è già usata in una pratica e non può essere eliminata");
      return;
    }
    markDirty();
    setItems((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const resetTemplate = () => {
    markDirty();
    setItems(createTemplateItems());
    toast.success("Template comune 2025/2026 caricato");
  };

  const copyPreviousYear = () => {
    if (!previousBook) {
      toast.error("Nessun anno precedente trovato per questo committente");
      return;
    }

    markDirty();
    setForm((current) => ({
      ...current,
      fees_enabled: previousBook.book.fees_enabled,
      expense_reimbursements_enabled: previousBook.book.expense_reimbursements_enabled,
      notes: previousBook.book.notes,
    }));
    setItems(
      previousBook.items.map((item) => ({
        kind: item.kind,
        code: item.code,
        name: item.name,
        invoice_description: item.invoice_description,
        unit_price: item.unit_price,
        is_enabled: item.is_enabled,
        requires_hearing_dates: item.requires_hearing_dates,
        sort_order: item.sort_order,
      })),
    );
    toast.success(`Prezzi ${Number(form.year) - 1} copiati`);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      validateForm(form, items);

      const normalizedItems = normalizeItems(items);
      const priceBookPayload = {
        user_id: user.id,
        principal_id: form.principal_id,
        year: Number(form.year),
        status: form.status,
        fees_enabled: form.fees_enabled,
        expense_reimbursements_enabled: form.expense_reimbursements_enabled,
        valid_from: form.valid_from,
        valid_to: form.valid_to || null,
        notes: form.notes?.trim() || null,
      };

      const priceBookId =
        isEdit && initial?.id
          ? await updatePriceBook(initial.id, priceBookPayload)
          : await createPriceBook(priceBookPayload);

      await syncPriceItems({
        priceBookId: priceBookId.id,
        userId: user.id,
        initialItems,
        items: normalizedItems,
      });

      return priceBookId;
    },
    onSuccess: (priceBook) => {
      toast.success(isEdit ? "Prezzi aggiornati" : "Prezzi creati");
      qc.invalidateQueries({ queryKey: ["price-books"] });
      qc.invalidateQueries({ queryKey: ["price-book", priceBook.id] });
      if (finishSave()) return;
      onSaved(routeRef(priceBook));
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: saveLock.release,
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!saveLock.acquire()) return;
    saveMutation.mutate();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurazione</CardTitle>
          <CardDescription>
            I prezzi sono annuali e specifici per committente. Il template 2025 vale anche per il
            2026.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label htmlFor="principal_id">Committente</Label>
              <Select
                value={form.principal_id}
                onValueChange={(value) => setField("principal_id", value)}
                disabled={isEdit}
              >
                <SelectTrigger id="principal_id">
                  <SelectValue placeholder="Seleziona committente" />
                </SelectTrigger>
                <SelectContent>
                  {principals.map((principal) => (
                    <SelectItem key={principal.id} value={principal.id}>
                      {principal.business_name}
                      {principal.archived_at ? " (archiviato)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="year">Anno</Label>
              <Input
                id="year"
                type="number"
                min="2000"
                max="2100"
                value={form.year}
                onChange={(event) => setField("year", Number(event.target.value))}
                disabled={isEdit}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Stato</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setField("status", value as PriceBookStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(priceBookStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="fees_enabled">Compensi</Label>
                <p className="text-xs text-muted-foreground">Abilita le voci imponibili.</p>
              </div>
              <Switch
                id="fees_enabled"
                checked={form.fees_enabled}
                onCheckedChange={(checked) => setField("fees_enabled", checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="expense_reimbursements_enabled">Rimborsi spese</Label>
                <p className="text-xs text-muted-foreground">Abilita anticipazioni Art. 15.</p>
              </div>
              <Switch
                id="expense_reimbursements_enabled"
                checked={form.expense_reimbursements_enabled}
                onCheckedChange={(checked) => setField("expense_reimbursements_enabled", checked)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="valid_from">Valido dal</Label>
              <Input
                id="valid_from"
                type="date"
                value={form.valid_from}
                onChange={(event) => setField("valid_from", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="valid_to">Valido al</Label>
              <Input
                id="valid_to"
                type="date"
                value={form.valid_to ?? ""}
                onChange={(event) => setField("valid_to", event.target.value || null)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes ?? ""}
              onChange={(event) => setField("notes", event.target.value)}
            />
          </div>

          {!isEdit && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={resetTemplate}>
                <RotateCcw className="mr-1 size-4" /> Template comune 2025/2026
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyPreviousYear}
                disabled={!previousBook}
              >
                <RotateCcw className="mr-1 size-4" /> Copia anno precedente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <PriceItemsEditor
        title="Compensi"
        description="Ogni importo viene moltiplicato per la quantità nella pratica."
        kind="fee"
        items={items}
        onAdd={addItem}
        onRemove={removeItem}
        onUpdate={updateItem}
      />

      <PriceItemsEditor
        title="Rimborsi spese"
        description="Sono anticipazioni Art. 15: la voce abilita il rimborso, l'importo resta libero."
        kind="expense_reimbursement"
        items={items}
        onAdd={addItem}
        onRemove={removeItem}
        onUpdate={updateItem}
      />

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
      {guardDialog}
    </form>
  );
}

function PriceItemsEditor({
  title,
  description,
  kind,
  items,
  onAdd,
  onRemove,
  onUpdate,
}: {
  title: string;
  description: string;
  kind: PriceItemKind;
  items: PriceItemDraft[];
  onAdd: (kind: PriceItemKind) => void;
  onRemove: (index: number) => void;
  onUpdate: <K extends keyof PriceItemDraft>(
    index: number,
    key: K,
    value: PriceItemDraft[K],
  ) => void;
}) {
  const editorId = useId();
  const sectionItems = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind === kind)
    .sort((a, b) => a.item.sort_order - b.item.sort_order);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onAdd(kind)}>
            <Plus className="mr-1 size-4" /> Voce
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Codice</TableHead>
              <TableHead>Voce</TableHead>
              <TableHead>Prezzo</TableHead>
              <TableHead>Udienze</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sectionItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Nessuna voce.
                </TableCell>
              </TableRow>
            ) : (
              sectionItems.map(({ item, index }) => {
                const enabledSwitchId = `${editorId}-price-item-${item.id ?? `${item.kind}-${index}`}-enabled`;

                return (
                  <TableRow key={item.id ?? `${item.kind}-${index}`}>
                    <TableCell>
                      <Input
                        value={item.code}
                        onChange={(event) =>
                          onUpdate(index, "code", event.target.value.toUpperCase())
                        }
                        className="min-w-40"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex min-w-72 flex-col gap-2">
                        <Input
                          value={item.name}
                          onChange={(event) => onUpdate(index, "name", event.target.value)}
                          placeholder={priceItemKindLabels[item.kind]}
                        />
                        <Input
                          value={item.invoice_description ?? ""}
                          onChange={(event) =>
                            onUpdate(index, "invoice_description", event.target.value)
                          }
                          placeholder="Descrizione in fattura"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.kind === "fee" ? (
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price ?? 0}
                          onChange={(event) =>
                            onUpdate(index, "unit_price", Number(event.target.value))
                          }
                          className="min-w-28"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">Libero</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={item.requires_hearing_dates}
                        onCheckedChange={(checked) =>
                          onUpdate(index, "requires_hearing_dates", checked === true)
                        }
                        disabled={item.kind !== "fee"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Badge variant={item.is_enabled ? "outline" : "secondary"}>
                          {item.is_enabled ? "Abilitata" : "Disabilitata"}
                        </Badge>
                        {item.usedCount ? (
                          <span className="text-xs text-muted-foreground">
                            Usata {item.usedCount} volte
                          </span>
                        ) : null}
                        <label
                          htmlFor={enabledSwitchId}
                          className="flex items-center gap-2 text-xs text-muted-foreground"
                        >
                          <Switch
                            id={enabledSwitchId}
                            checked={item.is_enabled}
                            onCheckedChange={(checked) => onUpdate(index, "is_enabled", checked)}
                          />
                          Visibile
                        </label>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function validateForm(form: PriceBookRow, items: PriceItemDraft[]) {
  if (!form.principal_id) throw new Error("Seleziona un committente");
  if (!form.year || form.year < 2000 || form.year > 2100)
    throw new Error("Inserisci un anno valido");
  if (!form.fees_enabled && !form.expense_reimbursements_enabled) {
    throw new Error("Abilita almeno compensi o rimborsi spese");
  }

  const codes = new Set<string>();
  for (const item of items) {
    const code = item.code.trim();
    if (!code) throw new Error("Ogni voce deve avere un codice");
    if (codes.has(code)) throw new Error(`Codice duplicato: ${code}`);
    codes.add(code);
    if (!item.name.trim()) throw new Error(`Inserisci il nome per ${code}`);
    if (item.kind === "fee" && (item.unit_price === null || item.unit_price < 0)) {
      throw new Error(`Inserisci un prezzo valido per ${code}`);
    }
  }
}

function normalizeItems(items: PriceItemDraft[]) {
  return items.map((item, index) => ({
    ...item,
    code: item.code.trim().toUpperCase(),
    name: item.name.trim(),
    invoice_description: item.invoice_description?.trim() || item.name.trim(),
    unit_price: item.kind === "fee" ? Number(item.unit_price ?? 0) : null,
    requires_hearing_dates: item.kind === "fee" ? item.requires_hearing_dates : false,
    sort_order: index * 10 + 10,
  }));
}

async function createPriceBook(payload: {
  user_id: string;
  principal_id: string;
  year: number;
  status: PriceBookStatus;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
}) {
  const { data, error } = await supabase
    .from("price_books")
    .insert(payload)
    .select("id, public_code")
    .single();
  if (error) throw error;
  return data as { id: string; public_code: string | null };
}

async function updatePriceBook(
  id: string,
  payload: {
    user_id: string;
    principal_id: string;
    year: number;
    status: PriceBookStatus;
    fees_enabled: boolean;
    expense_reimbursements_enabled: boolean;
    valid_from: string;
    valid_to: string | null;
    notes: string | null;
  },
) {
  const { data, error } = await supabase
    .from("price_books")
    .update(payload)
    .eq("id", id)
    .select("id, public_code")
    .single();
  if (error) throw error;
  return data as { id: string; public_code: string | null };
}

async function syncPriceItems({
  priceBookId,
  userId,
  initialItems,
  items,
}: {
  priceBookId: string;
  userId: string;
  initialItems: PriceItemDraft[];
  items: PriceItemDraft[];
}) {
  const currentIds = new Set(items.map((item) => item.id).filter(Boolean));
  const deleteIds = initialItems
    .filter((item) => item.id && !currentIds.has(item.id) && !item.usedCount)
    .map((item) => item.id as string);

  if (deleteIds.length > 0) {
    const { error } = await supabase.from("price_items").delete().in("id", deleteIds);
    if (error) throw error;
  }

  const updates = items.filter((item) => item.id);
  for (const item of updates) {
    const { error } = await supabase
      .from("price_items")
      .update({
        kind: item.kind,
        code: item.code,
        name: item.name,
        invoice_description: item.invoice_description,
        unit_price: item.unit_price,
        is_enabled: item.is_enabled,
        requires_hearing_dates: item.requires_hearing_dates,
        sort_order: item.sort_order,
      })
      .eq("id", item.id as string);
    if (error) throw error;
  }

  const inserts = items.filter((item) => !item.id);
  if (inserts.length === 0) return;

  const { error } = await supabase.from("price_items").insert(
    inserts.map((item) => ({
      user_id: userId,
      price_book_id: priceBookId,
      kind: item.kind,
      code: item.code,
      name: item.name,
      invoice_description: item.invoice_description,
      unit_price: item.unit_price,
      is_enabled: item.is_enabled,
      requires_hearing_dates: item.requires_hearing_dates,
      sort_order: item.sort_order,
    })),
  );
  if (error) throw error;
}
