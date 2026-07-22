import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { withTriggerGeneratedCode } from "@/integrations/supabase/insert-helpers";
import type { PriceBookStatus, PriceItemKind } from "@/lib/price-templates";

const priceBookStatuses = new Set<PriceBookStatus>(["draft", "active", "archived"]);
const priceItemKinds = new Set<PriceItemKind>(["fee", "expense_reimbursement"]);

export type SavePriceBookItemInput = {
  id?: string;
  kind: PriceItemKind;
  code: string;
  name: string;
  invoice_description: string | null;
  unit_price: number | null;
  is_enabled: boolean;
  requires_hearing_dates: boolean;
  sort_order: number;
};

export type SavePriceBookInput = {
  id?: string | null;
  principal_id: string;
  year: number;
  status: PriceBookStatus;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  items: SavePriceBookItemInput[];
  deleted_item_ids: string[];
};

type PriceBookResult = { id: string; public_code: string | null };
type PriceBookSupabase = SupabaseClient<Database>;

export const savePriceBookFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validateSavePriceBookInput)
  .handler(async ({ data, context }) => savePriceBook(context.supabase, context.userId, data));

async function savePriceBook(
  supabase: PriceBookSupabase,
  userId: string,
  input: SavePriceBookInput,
) {
  const priceBookPayload = {
    principal_id: input.principal_id,
    year: input.year,
    status: input.status,
    fees_enabled: input.fees_enabled,
    expense_reimbursements_enabled: input.expense_reimbursements_enabled,
    valid_from: input.valid_from,
    valid_to: input.valid_to,
    notes: input.notes,
  };

  const priceBook = input.id
    ? await updatePriceBook(supabase, userId, input.id, priceBookPayload)
    : await createPriceBook(supabase, userId, priceBookPayload);

  await syncPriceItems(supabase, userId, priceBook.id, input.items, input.deleted_item_ids);
  return priceBook;
}

async function createPriceBook(
  supabase: PriceBookSupabase,
  userId: string,
  // `public_code` è generato dal trigger `assign_public_code`, non dal chiamante.
  payload: Omit<Database["public"]["Tables"]["price_books"]["Insert"], "user_id" | "public_code">,
) {
  const { data, error } = await supabase
    .from("price_books")
    .insert(withTriggerGeneratedCode({ ...payload, user_id: userId }))
    .select("id, public_code")
    .single();
  if (error) throw error;
  return data as PriceBookResult;
}

async function updatePriceBook(
  supabase: PriceBookSupabase,
  userId: string,
  id: string,
  payload: Omit<Database["public"]["Tables"]["price_books"]["Update"], "user_id">,
) {
  const { data, error } = await supabase
    .from("price_books")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, public_code")
    .single();
  if (error) throw error;
  return data as PriceBookResult;
}

async function syncPriceItems(
  supabase: PriceBookSupabase,
  userId: string,
  priceBookId: string,
  items: SavePriceBookItemInput[],
  deletedItemIds: string[],
) {
  const { data: usageRows, error: usageError } = await supabase
    .from("case_activities")
    .select("price_item_id")
    .eq("price_book_id", priceBookId)
    .eq("user_id", userId);

  if (usageError) throw usageError;

  const incomingIds = new Set(items.map((item) => item.id).filter(Boolean));
  const usedIds = new Set((usageRows ?? []).map((row) => row.price_item_id).filter(Boolean));
  const deleteIds = [...new Set(deletedItemIds)].filter(
    (id) => !incomingIds.has(id) && !usedIds.has(id),
  );

  if (deleteIds.length > 0) {
    const { error } = await supabase
      .from("price_items")
      .delete()
      .in("id", deleteIds)
      .eq("price_book_id", priceBookId)
      .eq("user_id", userId);
    if (error) throw error;
  }

  const updates = items.filter((item) => item.id);
  for (const item of updates) {
    const { error } = await supabase
      .from("price_items")
      .update(priceItemPayload(item))
      .eq("id", item.id as string)
      .eq("price_book_id", priceBookId)
      .eq("user_id", userId);
    if (error) throw error;
  }

  const inserts = items.filter((item) => !item.id);
  if (inserts.length === 0) return;

  const { error } = await supabase.from("price_items").insert(
    inserts.map((item) => ({
      ...priceItemPayload(item),
      user_id: userId,
      price_book_id: priceBookId,
    })),
  );
  if (error) throw error;
}

function priceItemPayload(item: SavePriceBookItemInput) {
  return {
    kind: item.kind,
    code: item.code,
    name: item.name,
    invoice_description: item.invoice_description,
    unit_price: item.unit_price,
    is_enabled: item.is_enabled,
    requires_hearing_dates: item.requires_hearing_dates,
    sort_order: item.sort_order,
  };
}

function validateSavePriceBookInput(input: SavePriceBookInput) {
  if (!input || typeof input !== "object") throw new Error("Dati prezzi non validi");
  if (input.id != null && typeof input.id !== "string") throw new Error("Prezzi non validi");
  if (!input.principal_id) throw new Error("Seleziona un committente");
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    throw new Error("Inserisci un anno valido");
  }
  if (!priceBookStatuses.has(input.status)) throw new Error("Stato prezzi non valido");
  if (typeof input.fees_enabled !== "boolean")
    throw new Error("Configurazione compensi non valida");
  if (typeof input.expense_reimbursements_enabled !== "boolean") {
    throw new Error("Configurazione rimborsi spese non valida");
  }
  if (!input.valid_from || typeof input.valid_from !== "string") {
    throw new Error("Data di inizio validità non valida");
  }
  if (input.valid_to != null && typeof input.valid_to !== "string") {
    throw new Error("Data di fine validità non valida");
  }
  if (input.notes != null && typeof input.notes !== "string") throw new Error("Note non valide");
  if (!Array.isArray(input.items)) throw new Error("Voci prezzi non valide");
  if (!Array.isArray(input.deleted_item_ids)) throw new Error("Voci rimosse non valide");

  for (const item of input.items) validatePriceItemInput(item);
  for (const id of input.deleted_item_ids) {
    if (typeof id !== "string") throw new Error("Voce rimossa non valida");
  }
  return input;
}

function validatePriceItemInput(item: SavePriceBookItemInput) {
  if (!item || typeof item !== "object") throw new Error("Voce prezzi non valida");
  if (item.id != null && typeof item.id !== "string") throw new Error("Voce prezzi non valida");
  if (!priceItemKinds.has(item.kind)) throw new Error("Tipo voce prezzi non valido");
  if (!item.code?.trim()) throw new Error("Ogni voce deve avere un codice");
  if (!item.name?.trim()) throw new Error("Ogni voce deve avere un nome");
  if (item.invoice_description != null && typeof item.invoice_description !== "string") {
    throw new Error("Descrizione fattura non valida");
  }
  if (item.unit_price != null && (typeof item.unit_price !== "number" || item.unit_price < 0)) {
    throw new Error("Prezzo non valido");
  }
  if (typeof item.is_enabled !== "boolean") throw new Error("Stato voce non valido");
  if (typeof item.requires_hearing_dates !== "boolean") throw new Error("Udienze voce non valide");
  if (!Number.isFinite(item.sort_order)) throw new Error("Ordinamento voce non valido");
}
