import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DuplicateWarningPanel } from "@/components/duplicate-warning-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CaseCounterpartyField,
  CasePrincipalClientFields,
} from "@/components/case-form-subject-sections";
import { supabase } from "@/integrations/supabase/client";
import { withTriggerGeneratedCode } from "@/integrations/supabase/insert-helpers";
import { useAuth } from "@/lib/auth-context";
import { caseStatusLabels, clientDisplayName, compareClients } from "@/lib/labels";
import type { DuplicateCandidate } from "@/lib/duplicate-matching";
import { useUnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { routeRef } from "@/lib/public-route-code";
import { canUseAuthHeaders, getAuthHeaders, readServerResult } from "@/lib/server-functions";
import { useSubmitLock } from "@/lib/submit-lock";
import { findDuplicateCandidatesFn } from "@/server/duplicates.functions";

type CaseRow = {
  id?: string;
  public_code?: string | null;
  principal_id: string | null;
  client_id: string | null;
  counterparty_id: string | null;
  practice_number: number | null;
  status: string;
  authority: string | null;
  rg_number: string | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
};

export type ClientKind = "individual" | "company";
export type CounterpartyKind = "individual" | "company" | "group";

export type ClientOption = {
  id: string;
  kind: ClientKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
};

type PrincipalOption = {
  id: string;
  business_name: string;
  archived_at: string | null;
};

type CounterpartyOption = {
  id: string;
  kind: CounterpartyKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
};

type QuickPrincipalDraft = {
  business_name: string;
};

type QuickClientDraft = {
  kind: ClientKind | "";
  first_name: string;
  last_name: string;
  business_name: string;
};

type QuickCounterpartyDraft = {
  kind: CounterpartyKind | "";
  first_name: string;
  last_name: string;
  business_name: string;
  subjects: QuickCounterpartySubjectDraft[];
};

type QuickCounterpartySubjectDraft = {
  localId: string;
  kind: ClientKind;
  first_name: string;
  last_name: string;
  business_name: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const empty: CaseRow = {
  principal_id: null,
  client_id: null,
  counterparty_id: null,
  practice_number: null,
  status: "open",
  authority: "",
  rg_number: "",
  opened_at: today(),
  closed_at: null,
  notes: "",
};

const emptyQuickPrincipal: QuickPrincipalDraft = {
  business_name: "",
};

const emptyQuickClient: QuickClientDraft = {
  kind: "",
  first_name: "",
  last_name: "",
  business_name: "",
};

const emptyQuickCounterpartySubject = (): QuickCounterpartySubjectDraft => ({
  localId: crypto.randomUUID(),
  kind: "individual",
  first_name: "",
  last_name: "",
  business_name: "",
  notes: "",
});

const emptyQuickCounterparty = (): QuickCounterpartyDraft => ({
  kind: "",
  first_name: "",
  last_name: "",
  business_name: "",
  subjects: [emptyQuickCounterpartySubject()],
});

type Props = {
  initial?: Partial<CaseRow> & { id?: string };
  defaultClientId?: string;
  onSaved: (id: string) => void;
  onCancel: () => void;
};

function useCaseForm({ initial, defaultClientId, onSaved, onCancel }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<CaseRow>({
    ...empty,
    ...(defaultClientId ? { client_id: defaultClientId } : {}),
    ...(initial ?? {}),
  });
  const [quickPrincipalOpen, setQuickPrincipalOpen] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickCounterpartyOpen, setQuickCounterpartyOpen] = useState(false);
  const [quickPrincipal, setQuickPrincipal] = useState<QuickPrincipalDraft>(emptyQuickPrincipal);
  const [quickClient, setQuickClient] = useState<QuickClientDraft>(emptyQuickClient);
  const [quickCounterparty, setQuickCounterparty] = useState<QuickCounterpartyDraft>(() =>
    emptyQuickCounterparty(),
  );
  const [quickCreatedClients, setQuickCreatedClients] = useState<ClientOption[]>([]);
  const [quickCreatedCounterparties, setQuickCreatedCounterparties] = useState<
    CounterpartyOption[]
  >([]);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [quickPrincipalDuplicates, setQuickPrincipalDuplicates] = useState<DuplicateCandidate[]>(
    [],
  );
  const [quickClientDuplicates, setQuickClientDuplicates] = useState<DuplicateCandidate[]>([]);
  const [quickCounterpartyDuplicates, setQuickCounterpartyDuplicates] = useState<
    DuplicateCandidate[]
  >([]);
  const duplicateOverrideRef = useRef(false);
  const quickPrincipalOverrideRef = useRef(false);
  const quickClientOverrideRef = useRef(false);
  const quickCounterpartyOverrideRef = useRef(false);
  const { finishSave, formRef, guardDialog, markDirty } = useUnsavedChangesGuard();
  const saveLock = useSubmitLock();
  const quickPrincipalLock = useSubmitLock();
  const quickClientLock = useSubmitLock();
  const quickCounterpartyLock = useSubmitLock();
  const findDuplicates = useServerFn(findDuplicateCandidatesFn);

  const upd = useCallback(
    <K extends keyof CaseRow>(key: K, value: CaseRow[K]) => {
      markDirty();
      setForm((current) => ({ ...current, [key]: value }));
    },
    [markDirty],
  );
  const updateQuickPrincipal = <K extends keyof QuickPrincipalDraft>(
    key: K,
    value: QuickPrincipalDraft[K],
  ) => {
    markDirty();
    setQuickPrincipal((current) => ({ ...current, [key]: value }));
  };
  const updateQuickClient = <K extends keyof QuickClientDraft>(
    key: K,
    value: QuickClientDraft[K],
  ) => {
    markDirty();
    setQuickClient((current) => ({ ...current, [key]: value }));
  };
  const updateQuickCounterparty = <K extends keyof QuickCounterpartyDraft>(
    key: K,
    value: QuickCounterpartyDraft[K],
  ) => {
    markDirty();
    setQuickCounterparty((current) => ({ ...current, [key]: value }));
  };
  const updateQuickCounterpartySubject = <K extends keyof QuickCounterpartySubjectDraft>(
    index: number,
    key: K,
    value: QuickCounterpartySubjectDraft[K],
  ) => {
    markDirty();
    setQuickCounterparty((current) => ({
      ...current,
      subjects: current.subjects.map((subject, currentIndex) =>
        currentIndex === index ? { ...subject, [key]: value } : subject,
      ),
    }));
  };
  const addQuickCounterpartySubject = () => {
    markDirty();
    setQuickCounterparty((current) => ({
      ...current,
      subjects: [...current.subjects, emptyQuickCounterpartySubject()],
    }));
  };
  const removeQuickCounterpartySubject = (index: number) => {
    markDirty();
    setQuickCounterparty((current) => ({
      ...current,
      subjects:
        current.subjects.length === 1
          ? [emptyQuickCounterpartySubject()]
          : current.subjects.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const normalizedQuickCounterpartySubjects = () =>
    quickCounterparty.subjects.flatMap((subject, position) => {
      const normalized = { ...subject, position };
      const hasName =
        normalized.kind === "company"
          ? normalized.business_name.trim()
          : normalized.first_name.trim() || normalized.last_name.trim();
      return hasName ? [normalized] : [];
    });

  const { data: nextPracticeNumber, refetch: refetchNextPracticeNumber } = useQuery({
    queryKey: ["cases", "next-practice-number"],
    enabled: !isEdit,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_next_practice_number");
      if (error) throw error;
      return data;
    },
  });

  if (!isEdit && !form.practice_number && nextPracticeNumber) {
    setForm((current) => ({
      ...current,
      practice_number: nextPracticeNumber,
    }));
  }

  const { data: clients = [], isFetched: clientsFetched } = useQuery({
    queryKey: ["clients", "case-form"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, kind, first_name, last_name, business_name")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: principalClientIds = [], isFetched: principalClientIdsFetched } = useQuery({
    queryKey: ["principal-clients", "case-form", form.principal_id],
    enabled: Boolean(form.principal_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("principal_clients")
        .select("client_id")
        .eq("principal_id", form.principal_id ?? "");
      if (error) throw error;
      return (data ?? []).map((row) => row.client_id);
    },
  });

  const allClients = useMemo(() => {
    const byId = new Map<string, ClientOption>();
    [...quickCreatedClients, ...clients].forEach((client) => byId.set(client.id, client));
    return Array.from(byId.values()).sort(compareClients);
  }, [clients, quickCreatedClients]);

  const availableClients = useMemo(() => {
    if (!form.principal_id) return allClients;
    const allowed = new Set(principalClientIds);
    return allClients
      .filter((client) => allowed.has(client.id) || client.id === form.client_id)
      .sort(compareClients);
  }, [allClients, form.client_id, form.principal_id, principalClientIds]);

  if (
    clientsFetched &&
    principalClientIdsFetched &&
    form.principal_id &&
    form.client_id &&
    !availableClients.some((client) => client.id === form.client_id)
  ) {
    setForm((current) => ({ ...current, client_id: null }));
  }

  const createQuickPrincipalMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      const businessName = quickPrincipal.business_name.trim();
      if (!businessName) throw new Error("Inserisci il nome del committente");
      if (!quickPrincipalOverrideRef.current && canUseAuthHeaders()) {
        const candidates = await readServerResult<DuplicateCandidate[]>(
          await findDuplicates({
            data: {
              entityType: "principal",
              draft: { business_name: businessName },
            },
            headers: await getAuthHeaders(),
          }),
        );
        if (candidates.length > 0) {
          setQuickPrincipalDuplicates(candidates);
          throw new Error("Controlla i potenziali duplicati prima di creare il committente");
        }
      }

      const payload = {
        user_id: user.id,
        business_name: businessName,
        fees_enabled: true,
        expense_reimbursements_enabled: true,
        default_general_expenses_rate: 10,
        default_cassa_rate: 4,
        address_country: "IT",
      };

      const { data, error } = await supabase
        .from("principals")
        .insert(withTriggerGeneratedCode(payload))
        .select("id")
        .single();
      if (error) throw error;

      return {
        id: data.id,
        business_name: businessName,
        archived_at: null,
      } satisfies PrincipalOption;
    },
    onSuccess: (principal) => {
      qc.setQueryData<PrincipalOption[]>(["principals", "selector"], (current = []) => [
        ...current,
        principal,
      ]);
      qc.invalidateQueries({ queryKey: ["principals"] });
      upd("principal_id", principal.id);
      upd("client_id", null);
      setQuickPrincipal(emptyQuickPrincipal);
      setQuickPrincipalDuplicates([]);
      quickPrincipalOverrideRef.current = false;
      setQuickPrincipalOpen(false);
      toast.success("Committente creato");
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: quickPrincipalLock.release,
  });

  const createQuickClientMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!form.principal_id) throw new Error("Seleziona prima un committente");
      if (!quickClient.kind) throw new Error("Seleziona il tipo cliente");

      const isIndividual = quickClient.kind === "individual";
      const firstName = quickClient.first_name.trim();
      const lastName = quickClient.last_name.trim();
      const businessName = quickClient.business_name.trim();

      if (isIndividual && !firstName && !lastName) throw new Error("Inserisci nome e cognome");
      if (!isIndividual && !businessName) throw new Error("Inserisci la ragione sociale");
      if (!quickClientOverrideRef.current && canUseAuthHeaders()) {
        const candidates = await readServerResult<DuplicateCandidate[]>(
          await findDuplicates({
            data: {
              entityType: "client",
              draft: {
                kind: quickClient.kind,
                first_name: isIndividual ? firstName || null : null,
                last_name: isIndividual ? lastName || null : null,
                business_name: isIndividual ? null : businessName,
              },
            },
            headers: await getAuthHeaders(),
          }),
        );
        if (candidates.length > 0) {
          setQuickClientDuplicates(candidates);
          throw new Error("Controlla i potenziali duplicati prima di creare il cliente");
        }
      }

      const payload = {
        user_id: user.id,
        kind: quickClient.kind,
        first_name: isIndividual ? firstName || null : null,
        last_name: isIndividual ? lastName || null : null,
        business_name: isIndividual ? null : businessName,
      };

      const { data, error } = await supabase
        .from("clients")
        .insert(withTriggerGeneratedCode(payload))
        .select("id")
        .single();
      if (error) throw error;

      const { error: linkError } = await supabase.from("principal_clients").insert({
        user_id: user.id,
        principal_id: form.principal_id,
        client_id: data.id,
        active_from: form.opened_at || today(),
      });
      if (linkError) throw linkError;

      return {
        id: data.id,
        kind: quickClient.kind,
        first_name: payload.first_name,
        last_name: payload.last_name,
        business_name: payload.business_name,
      } satisfies ClientOption;
    },
    onSuccess: (client) => {
      setQuickCreatedClients((current) => [
        client,
        ...current.filter((item) => item.id !== client.id),
      ]);
      qc.setQueryData<ClientOption[]>(["clients", "case-form"], (current = []) => [
        client,
        ...current,
      ]);
      qc.setQueryData<string[]>(
        ["principal-clients", "case-form", form.principal_id],
        (current = []) => Array.from(new Set([...current, client.id])),
      );
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["principal-clients"] });
      upd("client_id", client.id);
      setQuickClient(emptyQuickClient);
      setQuickClientDuplicates([]);
      quickClientOverrideRef.current = false;
      setQuickClientOpen(false);
      toast.success("Cliente creato");
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: quickClientLock.release,
  });

  const linkExistingClientToSelectedPrincipal = async (client: ClientOption) => {
    if (!user) throw new Error("Sessione non valida");
    if (!form.principal_id) throw new Error("Seleziona prima un committente");

    const { error } = await supabase.from("principal_clients").upsert(
      {
        user_id: user.id,
        principal_id: form.principal_id,
        client_id: client.id,
        active_from: form.opened_at || today(),
      },
      { onConflict: "user_id,principal_id,client_id" },
    );
    if (error) throw error;

    setQuickCreatedClients((current) => [
      client,
      ...current.filter((item) => item.id !== client.id),
    ]);
    qc.setQueryData<ClientOption[]>(["clients", "case-form"], (current = []) => [
      client,
      ...current.filter((item) => item.id !== client.id),
    ]);
    qc.setQueryData<string[]>(
      ["principal-clients", "case-form", form.principal_id],
      (current = []) => Array.from(new Set([...current, client.id])),
    );
    qc.invalidateQueries({ queryKey: ["principal-clients"] });
    upd("client_id", client.id);
    setQuickClient(emptyQuickClient);
    setQuickClientDuplicates([]);
    setQuickClientOpen(false);
  };

  const createQuickCounterpartyMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!quickCounterparty.kind) throw new Error("Seleziona il tipo controparte");

      const isIndividual = quickCounterparty.kind === "individual";
      const firstName = quickCounterparty.first_name.trim();
      const lastName = quickCounterparty.last_name.trim();
      const businessName = quickCounterparty.business_name.trim();
      const subjectRows = normalizedQuickCounterpartySubjects();

      if (isIndividual && !firstName && !lastName) throw new Error("Inserisci nome e cognome");
      if (!isIndividual && !businessName) {
        throw new Error("Inserisci la ragione sociale o il nome del gruppo");
      }
      if (!quickCounterpartyOverrideRef.current && canUseAuthHeaders()) {
        const candidates = await readServerResult<DuplicateCandidate[]>(
          await findDuplicates({
            data: {
              entityType: "counterparty",
              draft: {
                kind: quickCounterparty.kind,
                first_name: isIndividual ? firstName || null : null,
                last_name: isIndividual ? lastName || null : null,
                business_name: isIndividual ? null : businessName,
                subjectLabels:
                  quickCounterparty.kind === "group"
                    ? subjectRows.map((subject) =>
                        subject.kind === "company"
                          ? subject.business_name.trim()
                          : [subject.first_name, subject.last_name]
                              .map((value) => value.trim())
                              .filter(Boolean)
                              .join(" "),
                      )
                    : [],
              },
            },
            headers: await getAuthHeaders(),
          }),
        );
        if (candidates.length > 0) {
          setQuickCounterpartyDuplicates(candidates);
          throw new Error("Controlla i potenziali duplicati prima di creare la controparte");
        }
      }

      const payload = {
        user_id: user.id,
        kind: quickCounterparty.kind,
        first_name: isIndividual ? firstName || null : null,
        last_name: isIndividual ? lastName || null : null,
        business_name: isIndividual ? null : businessName,
      };

      const { data, error } = await supabase
        .from("counterparties")
        .insert(withTriggerGeneratedCode(payload))
        .select("id")
        .single();
      if (error) throw error;

      if (quickCounterparty.kind === "group" && subjectRows.length > 0) {
        const { error: subjectsError } = await supabase.from("counterparty_subjects").insert(
          subjectRows.map((subject) => ({
            user_id: user.id,
            counterparty_id: data.id,
            kind: subject.kind,
            first_name: subject.kind === "individual" ? subject.first_name.trim() || null : null,
            last_name: subject.kind === "individual" ? subject.last_name.trim() || null : null,
            business_name: subject.kind === "company" ? subject.business_name.trim() || null : null,
            notes: subject.notes.trim() || null,
            position: subject.position,
          })),
        );
        if (subjectsError) throw subjectsError;
      }

      return {
        id: data.id,
        kind: quickCounterparty.kind,
        first_name: payload.first_name,
        last_name: payload.last_name,
        business_name: payload.business_name,
      } satisfies CounterpartyOption;
    },
    onSuccess: (counterparty) => {
      setQuickCreatedCounterparties((current) => [
        counterparty,
        ...current.filter((item) => item.id !== counterparty.id),
      ]);
      qc.setQueryData<CounterpartyOption[]>(["counterparties", "selector"], (current = []) => [
        counterparty,
        ...current,
      ]);
      qc.invalidateQueries({ queryKey: ["counterparties"] });
      upd("counterparty_id", counterparty.id);
      setQuickCounterparty(emptyQuickCounterparty());
      setQuickCounterpartyDuplicates([]);
      quickCounterpartyOverrideRef.current = false;
      setQuickCounterpartyOpen(false);
      toast.success("Controparte creata");
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: quickCounterpartyLock.release,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessione non valida");
      if (!form.principal_id) throw new Error("Seleziona un committente");
      if (!form.client_id) throw new Error("Seleziona un cliente");
      if (!form.counterparty_id) throw new Error("Seleziona una controparte");

      const practiceNumber = Number(form.practice_number);
      if (!Number.isInteger(practiceNumber) || practiceNumber <= 0) {
        throw new Error("Inserisci un numero pratica numerico positivo");
      }

      if (!isEdit && !duplicateOverrideRef.current && canUseAuthHeaders()) {
        const principal = form.principal_id;
        const client = allClients.find((item) => item.id === form.client_id);
        const candidates = await readServerResult<DuplicateCandidate[]>(
          await findDuplicates({
            data: {
              entityType: "case",
              draft: {
                practice_number: practiceNumber,
                principal_id: principal,
                client_id: form.client_id,
                counterparty_id: form.counterparty_id,
                authority: form.authority?.trim() || null,
                rg_number: form.rg_number?.trim() || null,
                principalName: principal,
                clientName: client ? clientDisplayName(client) : null,
              },
            },
            headers: await getAuthHeaders(),
          }),
        );
        if (candidates.length > 0) {
          setDuplicateCandidates(candidates);
          throw new Error("Controlla i potenziali duplicati prima di creare la pratica");
        }
      }

      const payload = {
        user_id: user.id,
        principal_id: form.principal_id,
        client_id: form.client_id,
        counterparty_id: form.counterparty_id,
        practice_number: practiceNumber,
        status: form.status as "open",
        authority: form.authority?.trim() || null,
        rg_number: form.rg_number?.trim() || null,
        opened_at: form.opened_at || today(),
        closed_at: form.closed_at || null,
        notes: form.notes?.trim() || null,
      };

      if (isEdit && initial?.id) {
        const previousClientId = initial.client_id ?? null;
        const { data, error } = await supabase
          .from("cases")
          .update(payload)
          .eq("id", initial.id)
          .select("id, public_code")
          .single();
        if (error) throw error;

        if (previousClientId && previousClientId !== form.client_id) {
          const { error: transferError } = await supabase.from("case_credit_transfers").insert({
            user_id: user.id,
            case_id: initial.id,
            previous_client_id: previousClientId,
            new_client_id: form.client_id,
            transferred_at: new Date().toISOString(),
            notes: null,
          });
          if (transferError) throw transferError;
        }

        return data as { id: string; public_code: string | null };
      }

      const { data, error } = await supabase
        .from("cases")
        .insert(withTriggerGeneratedCode(payload))
        .select("id, public_code")
        .single();
      if (error) throw error;
      return data as { id: string; public_code: string | null };
    },
    onSuccess: (caseRow) => {
      toast.success(isEdit ? "Pratica aggiornata" : "Pratica creata");
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", caseRow.id] });
      qc.invalidateQueries({ queryKey: ["case-credit-transfers", caseRow.id] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      duplicateOverrideRef.current = false;
      if (finishSave()) return;
      onSaved(routeRef(caseRow));
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: saveLock.release,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!initial?.id) return;
      const { error } = await supabase.from("cases").delete().eq("id", initial.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pratica eliminata");
      qc.invalidateQueries({ queryKey: ["cases"] });
      onCancel();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!saveLock.acquire()) return;
    saveMutation.mutate();
  };

  const useNextPracticeNumber = async () => {
    const result = await refetchNextPracticeNumber();
    const number = result.data ?? nextPracticeNumber;
    if (!number) return;
    upd("practice_number", number);
  };

  const resetQuickPrincipal = () => setQuickPrincipal(emptyQuickPrincipal);
  const resetQuickClient = () => setQuickClient(emptyQuickClient);
  const resetQuickCounterparty = () => setQuickCounterparty(emptyQuickCounterparty());

  return {
    isEdit,
    form,
    upd,
    formRef,
    handleSubmit,
    quickPrincipalOpen,
    setQuickPrincipalOpen,
    quickPrincipal,
    resetQuickPrincipal,
    quickPrincipalLock,
    updateQuickPrincipal,
    quickPrincipalDuplicates,
    setQuickPrincipalDuplicates,
    quickPrincipalOverrideRef,
    createQuickPrincipalMutation,
    availableClients,
    quickClientOpen,
    setQuickClientOpen,
    quickClient,
    resetQuickClient,
    quickClientLock,
    updateQuickClient,
    quickClientDuplicates,
    setQuickClientDuplicates,
    quickClientOverrideRef,
    createQuickClientMutation,
    linkExistingClientToSelectedPrincipal,
    quickCreatedCounterparties,
    quickCounterpartyOpen,
    setQuickCounterpartyOpen,
    quickCounterparty,
    resetQuickCounterparty,
    quickCounterpartyLock,
    updateQuickCounterparty,
    updateQuickCounterpartySubject,
    addQuickCounterpartySubject,
    removeQuickCounterpartySubject,
    quickCounterpartyDuplicates,
    setQuickCounterpartyDuplicates,
    quickCounterpartyOverrideRef,
    createQuickCounterpartyMutation,
    duplicateCandidates,
    setDuplicateCandidates,
    duplicateOverrideRef,
    saveMutation,
    deleteMutation,
    useNextPracticeNumber,
    guardDialog,
    saveLock,
  };
}

export type CaseFormController = ReturnType<typeof useCaseForm>;

export function CaseForm(props: Props) {
  const { onCancel, onSaved } = props;
  const controller = useCaseForm(props);
  const {
    isEdit,
    form,
    upd,
    formRef,
    handleSubmit,
    duplicateCandidates,
    setDuplicateCandidates,
    duplicateOverrideRef,
    saveMutation,
    deleteMutation,
    useNextPracticeNumber,
    guardDialog,
    saveLock,
  } = controller;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dati pratica</CardTitle>
          <CardDescription>
            La pratica nasce dall'incrocio fra committente, cliente e controparte.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <CasePrincipalClientFields controller={controller} />
            <CaseCounterpartyField controller={controller} />
          </div>

          <div className="max-w-sm">
            <div className="flex flex-col gap-2">
              <Label htmlFor="practice_number">Numero pratica</Label>
              <div className="flex gap-2">
                <Input
                  id="practice_number"
                  type="number"
                  min="1"
                  step="1"
                  value={form.practice_number ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    const numericValue = value === "" ? null : Number(value);
                    upd("practice_number", numericValue);
                  }}
                  placeholder="Es. 157"
                />
                {!isEdit && (
                  <Button type="button" variant="outline" onClick={useNextPracticeNumber}>
                    <RefreshCcw className="mr-1 size-4" /> Prossimo
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Stato pratica</Label>
              <Select value={form.status} onValueChange={(value) => upd("status", value)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(caseStatusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="opened_at">Data apertura</Label>
              <Input
                id="opened_at"
                type="date"
                value={form.opened_at}
                onChange={(event) => upd("opened_at", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="closed_at">Data chiusura</Label>
              <Input
                id="closed_at"
                type="date"
                value={form.closed_at ?? ""}
                onChange={(event) => upd("closed_at", event.target.value || null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <DuplicateWarningPanel
        candidates={duplicateCandidates}
        onUseExisting={(record) => onSaved(record.publicCode || record.id)}
        onCreateAnyway={() => {
          duplicateOverrideRef.current = true;
          setDuplicateCandidates([]);
          if (!saveLock.acquire()) return;
          saveMutation.mutate();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riferimenti</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="authority">Autorità giudiziaria</Label>
              <Input
                id="authority"
                value={form.authority ?? ""}
                onChange={(event) => upd("authority", event.target.value)}
                placeholder="Es. Tribunale di Milano"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="rg_number">N. R.G.</Label>
              <Input
                id="rg_number"
                value={form.rg_number ?? ""}
                onChange={(event) => upd("rg_number", event.target.value)}
                placeholder="Es. 1234/2026"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              rows={4}
              value={form.notes ?? ""}
              onChange={(event) => upd("notes", event.target.value)}
              placeholder="Es. stato trattativa, prossima attività o dettaglio del credito"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {isEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Trash2 className="mr-1 size-4" /> Elimina
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare la pratica?</AlertDialogTitle>
                  <AlertDialogDescription>
                    L'eliminazione riguarda anche voci fatturabili, allegati e storico stati
                    associati. L'azione non può essere annullata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annulla
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvataggio…" : "Salva"}
          </Button>
        </div>
      </div>
      {guardDialog}
    </form>
  );
}
