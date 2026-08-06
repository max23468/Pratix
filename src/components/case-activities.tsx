import {
  useMemo,
  useReducer,
  useState,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronsUpDown,
  Download,
  Eye,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ActivityAttachmentList } from "@/components/activity-attachment-list";
import { ActivityReviewBadge } from "@/components/activity-review-badge";
import { ActivityAttachmentFields } from "@/components/activity-attachment-fields";
import { CasePicker } from "@/components/case-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SummaryTile } from "@/components/summary-tile";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  caseActivityDisplayStatus,
  caseActivityDisplayStatusLabels,
  caseActivityDisplayStatusVariant,
  caseActivityStatusLabels,
  practiceDisplayName,
  priceItemKindLabels,
} from "@/lib/labels";
import {
  activityCaseLabel,
  activityCasePartiesLabel,
  type CaseActivityContext,
} from "@/lib/case-activities";
import { buildActivityAttachmentStoragePath, PRATIX_DOCUMENTS_BUCKET } from "@/lib/storage-paths";
import { useSubmitLock } from "@/lib/submit-lock";
import { cn } from "@/lib/utils";

type PriceBookRow = {
  id: string;
  principal_id: string;
  year: number;
  status: string;
  fees_enabled: boolean;
  expense_reimbursements_enabled: boolean;
};

type PriceItemRow = {
  id: string;
  price_book_id: string;
  kind: "fee" | "expense_reimbursement";
  code: string;
  name: string;
  invoice_description: string | null;
  unit_price: number | null;
  is_enabled: boolean;
  requires_hearing_dates: boolean;
  sort_order: number;
};

type ActivityAttachment = {
  id: string;
  storage_path: string;
  display_name: string;
  document_type: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  preview_available: boolean;
};

type ActivityHearing = {
  id: string;
  hearing_date: string;
  position: number;
  notes: string | null;
};

type ActivityRow = {
  id: string;
  case_id: string;
  price_book_id: string;
  price_item_id: string;
  activity_date: string;
  kind: "fee" | "expense_reimbursement";
  status: "to_invoice" | "invoiced";
  needs_review: boolean;
  snapshot_price_year: number;
  snapshot_price_code: string;
  snapshot_price_name: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  invoice_id: string | null;
  notes: string | null;
  case_activity_hearings?: ActivityHearing[];
  activity_attachments?: ActivityAttachment[];
};

type HearingDateDraft = {
  id: string;
  date: string;
};

type ActivityFormState = {
  selectedCaseId: string;
  activityDate: string;
  priceItemId: string;
  description: string;
  quantity: number;
  freeAmountInput: string;
  status: "to_invoice" | "invoiced";
  needsReview: boolean;
  notes: string;
  hearingDates: HearingDateDraft[];
  file: File | null;
  attachmentName: string;
  attachmentType: string;
  attachmentNotes: string;
  loadedFormKey: string | null;
};

export type CaseActivityDialogActivity = ActivityRow;

type CaseOption = CaseActivityContext & {
  practice_number: number;
};

const today = () => new Date().toISOString().slice(0, 10);
const newLocalId = () => crypto.randomUUID();
const newHearingDateDraft = (date: string): HearingDateDraft => ({ id: newLocalId(), date });

const caseOptionCollator = new Intl.Collator("it", { numeric: true, sensitivity: "base" });

const caseOptionDisplayLabel = (option: CaseOption) => practiceDisplayName(option);

const caseOptionSearchValue = (option: CaseOption) =>
  [caseOptionDisplayLabel(option), activityCaseLabel(option), option.principals?.business_name]
    .filter((value): value is string => Boolean(value))
    .join(" ");

const compareCaseOptions = (a: CaseOption, b: CaseOption) =>
  a.practice_number - b.practice_number ||
  caseOptionCollator.compare(activityCaseLabel(a), activityCaseLabel(b));

const currentYearFromDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
};

const formatDecimalInputValue = (value: number) =>
  Number.isFinite(value)
    ? value.toLocaleString("it-IT", {
        useGrouping: false,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "";

const parseDecimalInputValue = (value: string) => {
  const compactValue = value.trim().replace(/\s/g, "");
  if (!compactValue) return null;
  const normalized = compactValue.includes(",")
    ? /^(?:(?:\d+|\d{1,3}(?:\.\d{3})+),\d*|,\d+)$/.test(compactValue)
      ? compactValue.replace(/\./g, "").replace(",", ".")
      : null
    : compactValue;
  if (!normalized) return null;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

type CaseActivityDialogProps = {
  caseRow?: CaseActivityContext;
  trigger?: ReactNode | null;
  activity?: CaseActivityDialogActivity;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
};

function useCaseActivityDialog({
  caseRow,
  trigger,
  activity,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: CaseActivityDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [formState, setFormState] = useReducer(
    (state: ActivityFormState, update: (state: ActivityFormState) => ActivityFormState) =>
      update(state),
    {
      selectedCaseId: caseRow?.id ?? "",
      activityDate: today(),
      priceItemId: "",
      description: "",
      quantity: 1,
      freeAmountInput: "0",
      status: "to_invoice",
      needsReview: false,
      notes: "",
      hearingDates: [],
      file: null,
      attachmentName: "",
      attachmentType: "",
      attachmentNotes: "",
      loadedFormKey: null,
    },
  );
  const setFormField = <K extends keyof ActivityFormState>(
    key: K,
    value: SetStateAction<ActivityFormState[K]>,
  ) =>
    setFormState((state) => ({
      ...state,
      [key]: typeof value === "function" ? value(state[key]) : value,
    }));
  const {
    selectedCaseId,
    activityDate,
    priceItemId,
    description,
    quantity,
    freeAmountInput,
    status,
    needsReview,
    notes,
    hearingDates,
    file,
    attachmentName,
    attachmentType,
    attachmentNotes,
    loadedFormKey,
  } = formState;
  const isEditing = Boolean(activity);
  const open = controlledOpen ?? internalOpen;
  const saveLock = useSubmitLock();

  const activityYear = currentYearFromDate(activityDate);

  const { data: caseOptions = [] } = useQuery({
    queryKey: ["cases", "activity-dialog"],
    enabled: open && !caseRow,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select(
          "id, principal_id, client_id, counterparty_id, practice_number, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CaseOption[];
    },
  });
  const sortedCaseOptions = useMemo(() => [...caseOptions].sort(compareCaseOptions), [caseOptions]);

  const selectedCase =
    caseRow ?? sortedCaseOptions.find((option) => option.id === selectedCaseId) ?? null;

  const { data: priceBooks = [] } = useQuery({
    queryKey: ["price-books", "activity", selectedCase?.principal_id, activityYear],
    enabled: open && Boolean(selectedCase?.principal_id),
    queryFn: async () => {
      let query = supabase
        .from("price_books")
        .select("id, principal_id, year, status, fees_enabled, expense_reimbursements_enabled")
        .eq("principal_id", selectedCase?.principal_id ?? "")
        .eq("year", activityYear);
      if (!isEditing) query = query.in("status", ["active", "draft"]);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PriceBookRow[];
    },
  });

  const priceBook = useMemo(() => {
    if (activity) {
      return priceBooks.find((book) => book.id === activity.price_book_id) ?? priceBooks[0] ?? null;
    }
    return priceBooks.find((book) => book.status === "active") ?? priceBooks[0] ?? null;
  }, [activity, priceBooks]);

  const { data: priceItems = [] } = useQuery({
    queryKey: ["price-items", "activity", priceBook?.id],
    enabled: open && Boolean(priceBook?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_items")
        .select("*")
        .eq("price_book_id", priceBook?.id ?? "")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PriceItemRow[];
    },
  });

  const availablePriceItems = useMemo(() => {
    if (!priceBook) return [];
    return priceItems.filter((item) => {
      if (activity && item.id === activity.price_item_id) return true;
      if (!item.is_enabled) return false;
      if (item.kind === "fee") return priceBook.fees_enabled;
      return priceBook.expense_reimbursements_enabled;
    });
  }, [activity, priceBook, priceItems]);

  const selectedItem = availablePriceItems.find((item) => item.id === priceItemId) ?? null;
  const effectiveKind = selectedItem?.kind ?? activity?.kind;
  const isExpenseReimbursement = effectiveKind === "expense_reimbursement";
  const requiresHearingDates =
    !isExpenseReimbursement &&
    (selectedItem?.requires_hearing_dates ?? Boolean(activity?.case_activity_hearings?.length));

  const formKey = open
    ? activity
      ? `activity:${activity.id}`
      : `new:${caseRow?.id ?? "global"}`
    : null;

  if (formKey && loadedFormKey !== formKey) {
    if (!activity) {
      setFormField("selectedCaseId", caseRow?.id ?? "");
      setFormField("activityDate", today());
      setFormField("priceItemId", "");
      setFormField("description", "");
      setFormField("quantity", 1);
      setFormField("freeAmountInput", "0");
      setFormField("status", "to_invoice");
      setFormField("needsReview", false);
      setFormField("notes", "");
      setFormField("hearingDates", []);
      setFormField("file", null);
      setFormField("attachmentName", "");
      setFormField("attachmentType", "");
      setFormField("attachmentNotes", "");
      setFormField("loadedFormKey", formKey);
    } else {
      setFormField("selectedCaseId", activity.case_id);
      setFormField("activityDate", activity.activity_date);
      setFormField("priceItemId", activity.price_item_id);
      setFormField("description", activity.description);
      setFormField("quantity", Number(activity.quantity) || 1);
      setFormField(
        "freeAmountInput",
        formatDecimalInputValue(
          activity.kind === "expense_reimbursement"
            ? Number(activity.amount) || 0
            : Number(activity.unit_price) || 0,
        ),
      );
      setFormField("status", activity.status);
      setFormField("needsReview", activity.needs_review);
      setFormField("notes", activity.notes ?? "");
      setFormField(
        "hearingDates",
        [...(activity.case_activity_hearings ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((hearing) => ({ id: hearing.id, date: hearing.hearing_date })),
      );
      setFormField("file", null);
      setFormField("attachmentName", "");
      setFormField("attachmentType", "");
      setFormField("attachmentNotes", "");
      setFormField("loadedFormKey", formKey);
    }
  }

  const calculatedQuantity = isExpenseReimbursement
    ? 1
    : requiresHearingDates
      ? hearingDates.length
      : quantity;
  const parsedFreeAmount = parseDecimalInputValue(freeAmountInput);
  const isFixedFeePrice = !isEditing && selectedItem?.kind === "fee";
  const unitPrice = isFixedFeePrice
    ? Number(selectedItem.unit_price ?? 0)
    : (parsedFreeAmount ?? 0);
  const amountInputValue = isFixedFeePrice ? formatDecimalInputValue(unitPrice) : freeAmountInput;
  const total = calculatedQuantity * unitPrice;

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (activity?.invoice_id) throw new Error("La voce è collegata a una fattura");
      if (!selectedCase) throw new Error("Seleziona una pratica");
      if (!selectedCase.principal_id || !selectedCase.client_id) {
        throw new Error("Completa committente e cliente della pratica");
      }
      if (!isEditing && !priceBook) {
        throw new Error(`Nessun prezzo configurato per il ${activityYear}`);
      }
      if (!isEditing && !selectedItem) throw new Error("Seleziona una voce prezzo");
      if (!description.trim()) throw new Error("Inserisci una descrizione");
      if (calculatedQuantity <= 0) throw new Error("Inserisci una quantità positiva");
      const unitPriceForSave = isFixedFeePrice
        ? Number(selectedItem?.unit_price ?? 0)
        : parsedFreeAmount;
      if (unitPriceForSave === null || unitPriceForSave < 0) {
        throw new Error("Inserisci un importo valido");
      }
      if (requiresHearingDates && hearingDates.some((hearingDate) => !hearingDate.date)) {
        throw new Error("Completa tutte le date udienza");
      }

      if (isEditing) {
        if (!activity) throw new Error("Attività non disponibile");
        const { error, count } = await supabase
          .from("case_activities")
          .update(
            {
              activity_date: activityDate,
              status,
              needs_review: needsReview,
              description: description.trim(),
              quantity: calculatedQuantity,
              unit_price: unitPriceForSave,
              notes: notes.trim() || null,
            },
            { count: "exact" },
          )
          .eq("id", activity.id)
          .is("invoice_id", null);
        if (error) throw error;
        if (count !== 1) {
          throw new Error(
            "La voce è stata collegata a una Fattura e non può più essere modificata",
          );
        }

        const { error: deleteHearingsError } = await supabase
          .from("case_activity_hearings")
          .delete()
          .eq("activity_id", activity.id);
        if (deleteHearingsError) throw deleteHearingsError;

        if (requiresHearingDates && hearingDates.length > 0) {
          const { error: hearingsError } = await supabase.from("case_activity_hearings").insert(
            hearingDates.map((hearingDate, index) => ({
              user_id: user.id,
              activity_id: activity.id,
              hearing_date: hearingDate.date,
              position: index + 1,
            })),
          );
          if (hearingsError) throw hearingsError;
        }

        if (file) {
          const storagePath = buildActivityAttachmentStoragePath(
            user.id,
            activity.id,
            `${Date.now()}-${file.name}`,
          );
          const { error: uploadError } = await supabase.storage
            .from(PRATIX_DOCUMENTS_BUCKET)
            .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
          if (uploadError) throw uploadError;

          const { error: attachmentError } = await supabase.from("activity_attachments").insert({
            user_id: user.id,
            activity_id: activity.id,
            storage_path: storagePath,
            original_file_name: file.name,
            display_name: attachmentName.trim() || file.name,
            document_type: attachmentType.trim() || null,
            mime_type: file.type || null,
            size_bytes: file.size,
            preview_available: file.type.startsWith("image/") || file.type === "application/pdf",
            notes: attachmentNotes.trim() || null,
          });
          if (attachmentError) throw attachmentError;
        }
        return;
      }

      const currentPriceBook = priceBook;
      const currentItem = selectedItem;
      if (!currentPriceBook || !currentItem) throw new Error("Seleziona una voce prezzo");

      const { data: createdActivity, error } = await supabase
        .from("case_activities")
        .insert({
          user_id: user.id,
          case_id: selectedCase.id,
          principal_id: selectedCase.principal_id,
          client_id: selectedCase.client_id,
          counterparty_id: selectedCase.counterparty_id,
          price_book_id: currentPriceBook.id,
          price_item_id: currentItem.id,
          activity_date: activityDate,
          kind: currentItem.kind,
          status,
          needs_review: needsReview,
          snapshot_price_year: currentPriceBook.year,
          snapshot_price_code: currentItem.code,
          snapshot_price_name: currentItem.name,
          description: description.trim(),
          quantity: calculatedQuantity,
          unit_price: unitPriceForSave,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (currentItem.requires_hearing_dates) {
        const { error: hearingsError } = await supabase.from("case_activity_hearings").insert(
          hearingDates.map((hearingDate, index) => ({
            user_id: user.id,
            activity_id: createdActivity.id,
            hearing_date: hearingDate.date,
            position: index + 1,
          })),
        );
        if (hearingsError) throw hearingsError;
      }

      if (file) {
        const storagePath = buildActivityAttachmentStoragePath(
          user.id,
          createdActivity.id,
          `${Date.now()}-${file.name}`,
        );
        const { error: uploadError } = await supabase.storage
          .from(PRATIX_DOCUMENTS_BUCKET)
          .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
        if (uploadError) throw uploadError;

        const { error: attachmentError } = await supabase.from("activity_attachments").insert({
          user_id: user.id,
          activity_id: createdActivity.id,
          storage_path: storagePath,
          original_file_name: file.name,
          display_name: attachmentName.trim() || file.name,
          document_type: attachmentType.trim() || null,
          mime_type: file.type || null,
          size_bytes: file.size,
          preview_available: file.type.startsWith("image/") || file.type === "application/pdf",
          notes: attachmentNotes.trim() || null,
        });
        if (attachmentError) throw attachmentError;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? "Voce fatturabile aggiornata" : "Voce fatturabile registrata");
      if (selectedCase) {
        qc.invalidateQueries({ queryKey: ["case-activities", selectedCase.id] });
      }
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      setDialogOpen(false);
      onSaved?.();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: saveLock.release,
  });

  const resetForm = () => {
    setFormField("activityDate", today());
    setFormField("priceItemId", "");
    setFormField("description", "");
    setFormField("quantity", 1);
    setFormField("freeAmountInput", "0");
    setFormField("status", "to_invoice");
    setFormField("needsReview", false);
    setFormField("notes", "");
    setFormField("hearingDates", []);
    setFormField("file", null);
    setFormField("attachmentName", "");
    setFormField("attachmentType", "");
    setFormField("attachmentNotes", "");
    if (!caseRow) setFormField("selectedCaseId", "");
    setFormField("loadedFormKey", null);
  };

  const setDialogOpen = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const setHearingCount = (count: number) => {
    const normalized = Math.max(0, count);
    setFormField("hearingDates", (current) => {
      if (normalized <= current.length) return current.slice(0, normalized);
      return [
        ...current,
        ...Array.from({ length: normalized - current.length }, () =>
          newHearingDateDraft(activityDate),
        ),
      ];
    });
  };

  const selectPriceItem = (value: string) => {
    setFormField("priceItemId", value);
    if (isEditing) return;
    const item = availablePriceItems.find((priceItem) => priceItem.id === value);
    if (!item) return;
    setFormField("description", item.invoice_description || item.name);
    setFormField("quantity", item.kind === "fee" && item.requires_hearing_dates ? 0 : 1);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!saveLock.acquire()) return;
    save.mutate();
  };

  const formatFreeAmountInput = () => {
    const parsed = parseDecimalInputValue(freeAmountInput);
    if (parsed === null) return;
    setFormField("freeAmountInput", formatDecimalInputValue(parsed));
  };

  return {
    open,
    setDialogOpen,
    trigger,
    isEditing,
    handleSubmit,
    caseRow,
    sortedCaseOptions,
    selectedCaseId,
    setFormField,
    activityDate,
    status,
    priceBook,
    activityYear,
    availablePriceItems,
    priceItemId,
    selectPriceItem,
    description,
    isExpenseReimbursement,
    requiresHearingDates,
    hearingDates,
    setHearingCount,
    quantity,
    selectedItem,
    effectiveKind,
    amountInputValue,
    formatFreeAmountInput,
    total,
    needsReview,
    notes,
    file,
    attachmentName,
    attachmentType,
    attachmentNotes,
    save,
  };
}

export function CaseActivityDialog(props: CaseActivityDialogProps) {
  const {
    open,
    setDialogOpen,
    trigger,
    isEditing,
    handleSubmit,
    caseRow,
    sortedCaseOptions,
    selectedCaseId,
    setFormField,
    activityDate,
    status,
    priceBook,
    activityYear,
    availablePriceItems,
    priceItemId,
    selectPriceItem,
    description,
    isExpenseReimbursement,
    requiresHearingDates,
    hearingDates,
    setHearingCount,
    quantity,
    selectedItem,
    effectiveKind,
    amountInputValue,
    formatFreeAmountInput,
    total,
    needsReview,
    notes,
    file,
    attachmentName,
    attachmentType,
    attachmentNotes,
    save,
  } = useCaseActivityDialog(props);

  return (
    <Dialog open={open} onOpenChange={setDialogOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm">
              <Plus className="mr-1 size-4" /> Attività
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Modifica voce fatturabile" : "Nuova voce fatturabile"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!caseRow && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="case_id">Pratica</Label>
              <CasePicker
                id="case_id"
                options={sortedCaseOptions}
                selectedCaseId={selectedCaseId}
                onSelect={(value) => {
                  setFormField("selectedCaseId", value);
                  setFormField("priceItemId", "");
                }}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity_date">Data</Label>
              <Input
                id="activity_date"
                type="date"
                value={activityDate}
                onChange={(event) => setFormField("activityDate", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity_status">Stato</Label>
              <Select
                value={status}
                onValueChange={(value) => setFormField("status", value as typeof status)}
              >
                <SelectTrigger id="activity_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(caseActivityStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="price_item_id">Prezzo</Label>
            <Select
              value={priceItemId}
              onValueChange={selectPriceItem}
              disabled={isEditing || !priceBook}
            >
              <SelectTrigger id="price_item_id">
                <SelectValue
                  placeholder={
                    priceBook ? "Seleziona voce prezzo" : `Nessun prezzo per il ${activityYear}`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availablePriceItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {priceItemKindLabels[item.kind]} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="activity_description">Descrizione</Label>
            <Input
              id="activity_description"
              value={description}
              onChange={(event) => setFormField("description", event.target.value)}
            />
          </div>

          <div
            className={cn("grid gap-4", isExpenseReimbursement ? "sm:max-w-xs" : "sm:grid-cols-3")}
          >
            {!isExpenseReimbursement && requiresHearingDates ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="hearing_count">Numero udienze</Label>
                <Input
                  id="hearing_count"
                  type="number"
                  min="0"
                  step="1"
                  value={hearingDates.length}
                  onChange={(event) => setHearingCount(Number(event.target.value))}
                />
              </div>
            ) : !isExpenseReimbursement ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="quantity">Quantità</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setFormField("quantity", Number(event.target.value))}
                  disabled={!isEditing && !selectedItem}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="unit_price">
                {effectiveKind === "expense_reimbursement" ? "Importo" : "Prezzo unitario"}
              </Label>
              <Input
                id="unit_price"
                type="text"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amountInputValue}
                placeholder="0,00"
                disabled={!isEditing && (!selectedItem || selectedItem.kind === "fee")}
                onChange={(event) => setFormField("freeAmountInput", event.target.value)}
                onBlur={formatFreeAmountInput}
              />
            </div>
            {!isExpenseReimbursement ? (
              <div className="flex flex-col gap-2">
                <Label>Totale</Label>
                <div className="rounded-md border border-border px-3 py-2 text-sm font-medium">
                  {formatCurrency(total)}
                </div>
              </div>
            ) : null}
          </div>

          {requiresHearingDates ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {hearingDates.map((hearingDate, index) => (
                <div key={hearingDate.id} className="flex flex-col gap-2">
                  <Label htmlFor={`hearing_${index}`}>Udienza {index + 1}</Label>
                  <Input
                    id={`hearing_${index}`}
                    type="date"
                    value={hearingDate.date}
                    onChange={(event) =>
                      setFormField("hearingDates", (current) =>
                        current.map((currentDate, currentIndex) =>
                          currentIndex === index
                            ? { ...currentDate, date: event.target.value }
                            : currentDate,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex items-start gap-3 rounded-md border border-border p-3">
            <Checkbox
              id="activity_needs_review"
              checked={needsReview}
              onCheckedChange={(checked) => setFormField("needsReview", checked === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="activity_needs_review">Importo da verificare</Label>
              <p className="text-sm text-muted-foreground">
                Usa le note per indicare il motivo del dubbio sull'importo.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(event) => setFormField("notes", event.target.value)}
              placeholder={
                needsReview ? "Motivo della verifica, ad esempio tariffa da confermare" : undefined
              }
            />
          </div>

          <ActivityAttachmentFields
            file={file}
            name={attachmentName}
            type={attachmentType}
            notes={attachmentNotes}
            onFileChange={(nextFile) => {
              setFormField("file", nextFile);
              if (nextFile && !attachmentName) setFormField("attachmentName", nextFile.name);
            }}
            onNameChange={(value) => setFormField("attachmentName", value)}
            onTypeChange={(value) => setFormField("attachmentType", value)}
            onNotesChange={(value) => setFormField("attachmentNotes", value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Salvataggio…" : isEditing ? "Salva modifiche" : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
