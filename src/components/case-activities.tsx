import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  caseActivityStatusLabels,
  caseActivityStatusVariant,
  priceItemKindLabels,
} from "@/lib/labels";
import { activityCaseLabel, type CaseActivityContext } from "@/lib/case-activities";
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

export type CaseActivityDialogActivity = ActivityRow;

type CaseOption = CaseActivityContext & {
  practice_number: number;
  title: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const caseOptionCollator = new Intl.Collator("it", { numeric: true, sensitivity: "base" });

const caseOptionTitle = (option: CaseOption) => option.title?.trim() || activityCaseLabel(option);

const caseOptionDisplayLabel = (option: CaseOption) => {
  const title = option.title?.trim();
  return title ? `Pratica ${option.practice_number} · ${title}` : activityCaseLabel(option);
};

const caseOptionSearchValue = (option: CaseOption) =>
  [
    caseOptionDisplayLabel(option),
    caseOptionTitle(option),
    activityCaseLabel(option),
    option.principals?.business_name,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");

const compareCaseOptions = (a: CaseOption, b: CaseOption) =>
  caseOptionCollator.compare(caseOptionTitle(a), caseOptionTitle(b)) ||
  caseOptionCollator.compare(activityCaseLabel(a), activityCaseLabel(b));

const currentYearFromDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
};

export function CaseActivitiesTab({ caseRow }: { caseRow: CaseActivityContext }) {
  const qc = useQueryClient();
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["case-activities", caseRow.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_activities")
        .select("*, case_activity_hearings(*), activity_attachments(*)")
        .eq("case_id", caseRow.id)
        .order("activity_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ActivityRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (activity: ActivityRow) => {
      if (activity.invoice_id) throw new Error("La voce è collegata a una fattura");
      const paths = (activity.activity_attachments ?? []).map(
        (attachment) => attachment.storage_path,
      );
      if (paths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(PRATIX_DOCUMENTS_BUCKET)
          .remove(paths);
        if (storageError) throw storageError;
      }
      const { error } = await supabase.from("case_activities").delete().eq("id", activity.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voce eliminata");
      qc.invalidateQueries({ queryKey: ["case-activities", caseRow.id] });
      qc.invalidateQueries({ queryKey: ["activities"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totals = activities.reduce(
    (acc, activity) => {
      if (activity.kind === "fee") acc.fees += Number(activity.amount) || 0;
      else acc.reimbursements += Number(activity.amount) || 0;
      if (activity.status === "to_invoice") acc.toInvoice += Number(activity.amount) || 0;
      return acc;
    },
    { fees: 0, reimbursements: 0, toInvoice: 0 },
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Voci fatturabili</CardTitle>
            <CardDescription>Compensi e rimborsi spese collegati alla pratica.</CardDescription>
          </div>
          <CaseActivityDialog caseRow={caseRow} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <SummaryTile label="Compensi" value={totals.fees} />
          <SummaryTile label="Rimborsi spese" value={totals.reimbursements} />
          <SummaryTile label="Da fatturare" value={totals.toInvoice} />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna voce fatturabile registrata.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Voce</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="text-right">Quantità</TableHead>
                <TableHead className="text-right">Prezzo</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead>Allegati</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="text-sm">{formatDate(activity.activity_date)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{activity.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {priceItemKindLabels[activity.kind]} · {activity.snapshot_price_name}
                      </span>
                      {activity.case_activity_hearings?.length ? (
                        <span className="text-xs text-muted-foreground">
                          Udienze:{" "}
                          {activity.case_activity_hearings
                            .sort((a, b) => a.position - b.position)
                            .map((hearing) => formatDate(hearing.hearing_date))
                            .join(", ")}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={caseActivityStatusVariant[activity.status] ?? "outline"}>
                      {caseActivityStatusLabels[activity.status] ?? activity.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">{activity.quantity}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(activity.unit_price)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(activity.amount)}
                  </TableCell>
                  <TableCell>
                    <AttachmentList attachments={activity.activity_attachments ?? []} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <CaseActivityDialog
                        caseRow={caseRow}
                        activity={activity}
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={Boolean(activity.invoice_id)}
                            aria-label={`Modifica ${activity.description}`}
                            title={
                              activity.invoice_id
                                ? "Le voci collegate a una Fattura non si modificano"
                                : "Modifica voce"
                            }
                          >
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={Boolean(activity.invoice_id) || remove.isPending}
                        onClick={() => remove.mutate(activity)}
                        aria-label={`Elimina ${activity.description}`}
                        title={
                          activity.invoice_id
                            ? "Le voci collegate a una Fattura non si eliminano"
                            : "Elimina voce"
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{formatCurrency(value)}</p>
    </div>
  );
}

function AttachmentList({ attachments }: { attachments: ActivityAttachment[] }) {
  if (attachments.length === 0) {
    return <span className="text-sm text-muted-foreground">Nessun allegato</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center gap-1">
          <Paperclip className="size-3.5 text-muted-foreground" />
          <span className="max-w-36 truncate text-xs">{attachment.display_name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openAttachment(attachment, "preview")}
          >
            <Eye className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => openAttachment(attachment, "download")}
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function CasePicker({
  id,
  options,
  selectedCaseId,
  onSelect,
}: {
  id: string;
  options: CaseOption[];
  selectedCaseId: string;
  onSelect: (caseId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.id === selectedCaseId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Seleziona pratica"
          className="justify-between"
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !selectedOption && "text-muted-foreground",
            )}
          >
            {selectedOption ? caseOptionDisplayLabel(selectedOption) : "Seleziona pratica"}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[60] w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Cerca pratica…" />
          <CommandList>
            <CommandEmpty>Nessuna pratica trovata.</CommandEmpty>
            {options.map((option) => {
              const label = activityCaseLabel(option);
              const title = caseOptionDisplayLabel(option);
              const isSelected = option.id === selectedCaseId;

              return (
                <CommandItem
                  key={option.id}
                  value={caseOptionSearchValue(option)}
                  onSelect={() => {
                    onSelect(option.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{label}</span>
                  </span>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

async function openAttachment(attachment: ActivityAttachment, mode: "preview" | "download") {
  const { data, error } = await supabase.storage
    .from(PRATIX_DOCUMENTS_BUCKET)
    .createSignedUrl(
      attachment.storage_path,
      60,
      mode === "download" ? { download: attachment.display_name } : undefined,
    );

  if (error) {
    toast.error(error.message);
    return;
  }
  if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function CaseActivityDialog({
  caseRow,
  trigger,
  activity,
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: {
  caseRow?: CaseActivityContext;
  trigger?: ReactNode | null;
  activity?: CaseActivityDialogActivity;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(caseRow?.id ?? "");
  const [activityDate, setActivityDate] = useState(() => today());
  const [priceItemId, setPriceItemId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [freeAmount, setFreeAmount] = useState(0);
  const [status, setStatus] = useState<"to_invoice" | "invoiced">("to_invoice");
  const [notes, setNotes] = useState("");
  const [hearingDates, setHearingDates] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentType, setAttachmentType] = useState("");
  const [attachmentNotes, setAttachmentNotes] = useState("");
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
          "id, principal_id, client_id, counterparty_id, practice_number, case_number, title, principals(business_name), clients(kind, first_name, last_name, business_name), counterparties(kind, first_name, last_name, business_name)",
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
  const requiresHearingDates =
    selectedItem?.requires_hearing_dates ?? Boolean(activity?.case_activity_hearings?.length);

  useEffect(() => {
    if (!selectedItem || isEditing) return;
    setDescription(selectedItem.invoice_description || selectedItem.name);
    if (selectedItem.kind === "fee") setQuantity(selectedItem.requires_hearing_dates ? 0 : 1);
    if (selectedItem.kind === "expense_reimbursement") setQuantity(1);
  }, [isEditing, selectedItem]);

  useEffect(() => {
    if (!open) return;
    if (!activity) {
      if (caseRow) setSelectedCaseId(caseRow.id);
      return;
    }
    setSelectedCaseId(activity.case_id);
    setActivityDate(activity.activity_date);
    setPriceItemId(activity.price_item_id);
    setDescription(activity.description);
    setQuantity(Number(activity.quantity) || 1);
    setFreeAmount(Number(activity.unit_price) || 0);
    setStatus(activity.status);
    setNotes(activity.notes ?? "");
    setHearingDates(
      [...(activity.case_activity_hearings ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((hearing) => hearing.hearing_date),
    );
    setFile(null);
    setAttachmentName("");
    setAttachmentType("");
    setAttachmentNotes("");
  }, [activity, caseRow, open]);

  const calculatedQuantity = requiresHearingDates ? hearingDates.length : quantity;
  const unitPrice =
    !isEditing && selectedItem?.kind === "fee" ? Number(selectedItem.unit_price ?? 0) : freeAmount;
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
      if (unitPrice < 0) throw new Error("Inserisci un importo valido");
      if (requiresHearingDates && hearingDates.some((date) => !date)) {
        throw new Error("Completa tutte le date udienza");
      }
      if (requiresHearingDates && new Set(hearingDates).size !== hearingDates.length) {
        throw new Error("Rimuovi le date udienza duplicate");
      }

      if (isEditing) {
        if (!activity) throw new Error("Attività non disponibile");
        const { error, count } = await supabase
          .from("case_activities")
          .update(
            {
              activity_date: activityDate,
              status,
              description: description.trim(),
              quantity: calculatedQuantity,
              unit_price: unitPrice,
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
              hearing_date: hearingDate,
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
          snapshot_price_year: currentPriceBook.year,
          snapshot_price_code: currentItem.code,
          snapshot_price_name: currentItem.name,
          description: description.trim(),
          quantity: calculatedQuantity,
          unit_price: unitPrice,
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
            hearing_date: hearingDate,
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
    setActivityDate(today());
    setPriceItemId("");
    setDescription("");
    setQuantity(1);
    setFreeAmount(0);
    setStatus("to_invoice");
    setNotes("");
    setHearingDates([]);
    setFile(null);
    setAttachmentName("");
    setAttachmentType("");
    setAttachmentNotes("");
    if (!caseRow) setSelectedCaseId("");
  };

  const setDialogOpen = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    if (controlledOpen === undefined) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const setHearingCount = (count: number) => {
    const normalized = Math.max(0, count);
    setHearingDates((current) => {
      if (normalized <= current.length) return current.slice(0, normalized);
      return [...current, ...Array.from({ length: normalized - current.length }, () => "")];
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!saveLock.acquire()) return;
    save.mutate();
  };

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
                  setSelectedCaseId(value);
                  setPriceItemId("");
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
                onChange={(event) => setActivityDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="activity_status">Stato</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
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
              onValueChange={setPriceItemId}
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
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {requiresHearingDates ? (
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
            ) : (
              <div className="flex flex-col gap-2">
                <Label htmlFor="quantity">Quantità</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                  disabled={!isEditing && !selectedItem}
                />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="unit_price">
                {effectiveKind === "expense_reimbursement" ? "Importo" : "Prezzo unitario"}
              </Label>
              <Input
                id="unit_price"
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                disabled={!isEditing && selectedItem?.kind === "fee"}
                onChange={(event) => setFreeAmount(Number(event.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Totale</Label>
              <div className="rounded-md border border-border px-3 py-2 text-sm font-medium">
                {formatCurrency(total)}
              </div>
            </div>
          </div>

          {requiresHearingDates ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {hearingDates.map((date, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Label htmlFor={`hearing_${index}`}>Udienza {index + 1}</Label>
                  <Input
                    id={`hearing_${index}`}
                    type="date"
                    value={date}
                    onChange={(event) =>
                      setHearingDates((current) =>
                        current.map((currentDate, currentIndex) =>
                          currentIndex === index ? event.target.value : currentDate,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <div className="rounded-md border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="attachment">Allegato</Label>
                <Input
                  id="attachment"
                  type="file"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    if (nextFile && !attachmentName) setAttachmentName(nextFile.name);
                  }}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="attachment_name">Nome descrittivo</Label>
                <Input
                  id="attachment_name"
                  value={attachmentName}
                  onChange={(event) => setAttachmentName(event.target.value)}
                  disabled={!file}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="attachment_type">Tipo documento</Label>
                <Input
                  id="attachment_type"
                  value={attachmentType}
                  onChange={(event) => setAttachmentType(event.target.value)}
                  placeholder="Es. giustificativo"
                  disabled={!file}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="attachment_notes">Note allegato</Label>
                <Textarea
                  id="attachment_notes"
                  rows={2}
                  value={attachmentNotes}
                  onChange={(event) => setAttachmentNotes(event.target.value)}
                  disabled={!file}
                />
              </div>
            </div>
          </div>

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
