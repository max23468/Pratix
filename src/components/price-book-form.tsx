import { useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { PriceBookConfiguration } from "@/components/price-book-configuration";
import { PriceItemsEditor } from "@/components/price-items-editor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { priceBookStatusLabels, priceItemKindLabels } from "@/lib/labels";
import { routeRef } from "@/lib/public-route-code";
import { getAuthHeaders, readServerResult } from "@/lib/server-functions";
import { useSubmitLock } from "@/lib/submit-lock";
import {
  createTemplateItems,
  defaultValidFrom,
  defaultValidTo,
  type PriceBookStatus,
  type PriceItemKind,
} from "@/lib/price-templates";
import { savePriceBookFn } from "@/server/price-books.functions";

export type PriceBookRow = {
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

export type PriceItemDraft = {
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

const currentYear = () => new Date().getFullYear();

const emptyBook = (year = currentYear()): PriceBookRow => ({
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
  const savePriceBook = useServerFn(savePriceBookFn);
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<PriceBookRow>({
    ...emptyBook(initial?.year ?? currentYear()),
    ...(initial ?? {}),
  });
  const [items, setItems] = useState<PriceItemDraft[]>(
    initialItems.length > 0 ? initialItems : createTemplateItems(),
  );
  const [initialItemIds] = useState(
    () => new Set(initialItems.flatMap((item) => (item.id ? [item.id] : []))),
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
      const currentItemIds = new Set(normalizedItems.flatMap((item) => (item.id ? [item.id] : [])));
      const deletedItemIds = [...initialItemIds].filter((id) => !currentItemIds.has(id));
      return readServerResult(
        await savePriceBook({
          data: {
            id: isEdit ? initial?.id : null,
            principal_id: form.principal_id,
            year: Number(form.year),
            status: form.status,
            fees_enabled: form.fees_enabled,
            expense_reimbursements_enabled: form.expense_reimbursements_enabled,
            valid_from: form.valid_from,
            valid_to: form.valid_to || null,
            notes: form.notes?.trim() || null,
            items: normalizedItems,
            deleted_item_ids: deletedItemIds,
          },
          headers: await getAuthHeaders(),
        }),
      );
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
      <PriceBookConfiguration
        form={form}
        principals={principals}
        isEdit={isEdit}
        hasPreviousBook={Boolean(previousBook)}
        onFieldChange={setField}
        onPrincipalChange={(value) => {
          const selectedPrincipal = principals.find((principal) => principal.id === value);
          markDirty();
          setForm((current) => ({
            ...current,
            principal_id: value,
            fees_enabled: isEdit
              ? current.fees_enabled
              : (selectedPrincipal?.fees_enabled ?? current.fees_enabled),
            expense_reimbursements_enabled: isEdit
              ? current.expense_reimbursements_enabled
              : (selectedPrincipal?.expense_reimbursements_enabled ??
                current.expense_reimbursements_enabled),
          }));
        }}
        onResetTemplate={resetTemplate}
        onCopyPreviousYear={copyPreviousYear}
      />

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
