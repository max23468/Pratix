import { useDeferredValue, useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  FileText,
  FileWarning,
  GitCompareArrows,
  ListChecks,
  Receipt,
  Search,
  User,
  UserRoundSearch,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { CREATE_ACTIONS, type CreateActionId } from "@/components/create-actions";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  clientDisplayName,
  counterpartyDisplayName,
  invoiceStatusLabels,
  priceItemKindLabels,
  type ClientDisplayData,
  type CounterpartyDisplayData,
} from "@/lib/labels";
import { formatCurrency } from "@/lib/format";
import { routeRef } from "@/lib/public-route-code";

type SearchResult =
  | {
      id: string;
      kind: "case";
      title: string;
      subtitle: string;
      caseRef: string;
    }
  | {
      id: string;
      kind: "client";
      title: string;
      subtitle: string;
      clientRef: string;
    }
  | {
      id: string;
      kind: "principal";
      title: string;
      subtitle: string;
      principalRef: string;
    }
  | {
      id: string;
      kind: "counterparty";
      title: string;
      subtitle: string;
      counterpartyRef: string;
    }
  | {
      id: string;
      kind: "activity";
      title: string;
      subtitle: string;
      query: string;
    }
  | {
      id: string;
      kind: "invoice";
      title: string;
      subtitle: string;
      invoiceRef: string;
    };

type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  action:
    | CreateActionId
    | "activities"
    | "overdue-invoices"
    | "missing-attachments"
    | "duplicate-control";
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

const QUICK_ACTIONS: QuickAction[] = [
  ...CREATE_ACTIONS.map((action) => ({
    id: action.id,
    title: action.title,
    subtitle: action.description,
    action: action.id,
    icon: action.icon,
  })),
  {
    id: "activities",
    title: "Attività",
    subtitle: "Controlla compensi e rimborsi",
    action: "activities",
    icon: ListChecks,
  },
  {
    id: "overdue-invoices",
    title: "Fatture scadute",
    subtitle: "Apri le fatture da sollecitare",
    action: "overdue-invoices",
    icon: AlertTriangle,
  },
  {
    id: "missing-attachments",
    title: "Rimborsi senza allegato",
    subtitle: "Controlla le attività da completare",
    action: "missing-attachments",
    icon: FileWarning,
  },
  {
    id: "duplicate-control",
    title: "Controllo duplicati",
    subtitle: "Rivedi dati operativi simili",
    action: "duplicate-control",
    icon: GitCompareArrows,
  },
];

export function GlobalSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const normalizedSearch = deferredSearch.toLowerCase();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isCommand = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      if (isCommand && key === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (!isCommand || !event.shiftKey || isEditable) return;

      if (key === "p") {
        event.preventDefault();
        navigate({ to: "/pratiche/nuova" });
      }
      if (key === "c") {
        event.preventDefault();
        navigate({ to: "/clienti/nuovo" });
      }
      if (key === "f") {
        event.preventDefault();
        navigate({ to: "/fatture/nuova" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const { data: results = [], isFetching } = useQuery({
    enabled: open && !!user,
    queryKey: ["global-search", user?.id, normalizedSearch],
    queryFn: async () => {
      const likeTerm = `%${escapeLikeTerm(normalizedSearch)}%`;
      const hasTerm = normalizedSearch.length > 0;
      const practiceNumber = Number(normalizedSearch);
      const hasPracticeNumber = Number.isInteger(practiceNumber) && practiceNumber > 0;

      const caseQuery = supabase
        .from("cases")
        .select("id, public_code, practice_number, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6);
      const clientQuery = supabase
        .from("clients")
        .select("id, public_code, kind, first_name, last_name, business_name, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      const principalQuery = supabase
        .from("principals")
        .select("id, public_code, business_name, email, pec, vat_number, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      const counterpartyQuery = supabase
        .from("counterparties")
        .select("id, public_code, kind, first_name, last_name, business_name, notes, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6);
      const activityQuery = supabase
        .from("case_activities")
        .select(
          "id, activity_date, kind, status, description, snapshot_price_name, amount, cases(id, public_code, practice_number)",
        )
        .order("activity_date", { ascending: false })
        .limit(6);
      const invoiceQuery = supabase
        .from("invoices")
        .select(
          "id, public_code, number, year, status, total_amount, issue_date, principal:principals(business_name), client:clients(kind, first_name, last_name, business_name)",
        )
        .order("issue_date", { ascending: false })
        .limit(6);

      if (hasTerm) {
        caseQuery.or(
          hasPracticeNumber
            ? `public_code.ilike.${likeTerm},practice_number.eq.${practiceNumber}`
            : `public_code.ilike.${likeTerm}`,
        );
        clientQuery.or(
          `first_name.ilike.${likeTerm},last_name.ilike.${likeTerm},business_name.ilike.${likeTerm}`,
        );
        principalQuery.or(
          `business_name.ilike.${likeTerm},email.ilike.${likeTerm},pec.ilike.${likeTerm},vat_number.ilike.${likeTerm}`,
        );
        counterpartyQuery.or(
          `first_name.ilike.${likeTerm},last_name.ilike.${likeTerm},business_name.ilike.${likeTerm},notes.ilike.${likeTerm}`,
        );
        activityQuery.or(`description.ilike.${likeTerm},snapshot_price_name.ilike.${likeTerm}`);
        invoiceQuery.ilike("number", likeTerm);
      }

      const [casesRes, clientsRes, principalsRes, counterpartiesRes, activitiesRes, invoicesRes] =
        await Promise.all([
          caseQuery,
          clientQuery,
          principalQuery,
          counterpartyQuery,
          activityQuery,
          invoiceQuery,
        ]);

      if (casesRes.error) throw casesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (principalsRes.error) throw principalsRes.error;
      if (counterpartiesRes.error) throw counterpartiesRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      const cases: SearchResult[] = (casesRes.data ?? []).map((item) => ({
        id: `case-${item.id}`,
        kind: "case",
        title: `Pratica ${item.practice_number}`,
        subtitle: "Pratica",
        caseRef: routeRef(item),
      }));

      const clients: SearchResult[] = (clientsRes.data ?? []).map((item) => ({
        id: `client-${item.id}`,
        kind: "client",
        title: clientDisplayName(item),
        subtitle: "Cliente",
        clientRef: routeRef(item),
      }));

      const principals: SearchResult[] = (principalsRes.data ?? []).map((item) => ({
        id: `principal-${item.id}`,
        kind: "principal",
        title: item.business_name,
        subtitle: "Committente",
        principalRef: routeRef(item),
      }));

      const counterparties: SearchResult[] = (counterpartiesRes.data ?? []).map((item) => ({
        id: `counterparty-${item.id}`,
        kind: "counterparty",
        title: counterpartyDisplayName(item as CounterpartyDisplayData),
        subtitle: "Controparte",
        counterpartyRef: routeRef(item),
      }));

      const activities: SearchResult[] = (activitiesRes.data ?? []).map((item) => ({
        id: `activity-${item.id}`,
        kind: "activity",
        title: item.description,
        subtitle: `${priceItemKindLabels[item.kind] ?? item.kind} · ${
          item.cases ? `Pratica ${item.cases.practice_number}` : "Pratica non disponibile"
        } · ${formatCurrency(Number(item.amount))}`,
        query: item.description,
      }));

      const invoices: SearchResult[] = (invoicesRes.data ?? []).map((item) => {
        const billedName =
          item.principal?.business_name || clientDisplayName(item.client as ClientDisplayData);
        return {
          id: `invoice-${item.id}`,
          kind: "invoice",
          title: `Fattura ${item.number}/${item.year}`,
          subtitle: `${billedName} · ${(invoiceStatusLabels as Record<string, string>)[item.status] ?? item.status} · ${formatCurrency(Number(item.total_amount))}`,
          invoiceRef: routeRef(item),
        };
      });

      return [...cases, ...principals, ...clients, ...counterparties, ...activities, ...invoices];
    },
    staleTime: 20_000,
  });

  const groupedResults = useMemo(
    () => ({
      cases: results.filter((result) => result.kind === "case"),
      principals: results.filter((result) => result.kind === "principal"),
      clients: results.filter((result) => result.kind === "client"),
      counterparties: results.filter((result) => result.kind === "counterparty"),
      activities: results.filter((result) => result.kind === "activity"),
      invoices: results.filter((result) => result.kind === "invoice"),
    }),
    [results],
  );

  const runQuickAction = (action: QuickAction["action"]) => {
    setOpen(false);
    const createAction = CREATE_ACTIONS.find((item) => item.id === action);
    if (createAction) {
      navigate({ to: createAction.to });
      return;
    }
    if (action === "activities") navigate({ to: "/attivita" });
    if (action === "overdue-invoices") navigate({ to: "/fatture", search: { status: "expired" } });
    if (action === "missing-attachments") {
      navigate({
        to: "/attivita",
        search: {
          status: "to_invoice",
          kind: "expense_reimbursement",
          attachments: "missing",
        },
      });
    }
    if (action === "duplicate-control") navigate({ to: "/controllo-duplicati" });
  };

  const openResult = (result: SearchResult) => {
    setOpen(false);
    if (result.kind === "case") {
      navigate({ to: "/pratiche/$caseId", params: { caseId: result.caseRef } });
    }
    if (result.kind === "client") {
      navigate({ to: "/clienti/$clientId", params: { clientId: result.clientRef } });
    }
    if (result.kind === "principal") {
      navigate({ to: "/committenti/$principalId", params: { principalId: result.principalRef } });
    }
    if (result.kind === "counterparty") {
      navigate({
        to: "/controparti/$counterpartyId",
        params: { counterpartyId: result.counterpartyRef },
      });
    }
    if (result.kind === "activity") {
      navigate({ to: "/attivita", search: { q: result.query } });
    }
    if (result.kind === "invoice") {
      navigate({ to: "/fatture/$invoiceId", params: { invoiceId: result.invoiceRef } });
    }
  };

  return (
    <>
      <GlobalSearchTriggers onOpen={() => setOpen(true)} />

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Cerca pratiche, committenti, clienti, controparti, attività o fatture"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>{isFetching ? "Ricerca in corso…" : "Nessun risultato."}</CommandEmpty>

          <QuickActionResults onSelect={runQuickAction} />

          {(groupedResults.cases.length > 0 ||
            groupedResults.principals.length > 0 ||
            groupedResults.clients.length > 0 ||
            groupedResults.counterparties.length > 0 ||
            groupedResults.activities.length > 0 ||
            groupedResults.invoices.length > 0) && <CommandSeparator />}

          <SearchResultGroups results={groupedResults} onSelect={openResult} />
        </CommandList>
      </CommandDialog>
    </>
  );
}

function GlobalSearchTriggers({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden h-8 min-w-40 justify-start gap-2 px-2 text-muted-foreground sm:inline-flex"
        onClick={onOpen}
      >
        <Search className="size-4" />
        <span className="text-xs">Ricerca</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 sm:hidden"
        onClick={onOpen}
        aria-label="Apri ricerca"
      >
        <Search className="size-4" />
      </Button>
    </>
  );
}

function QuickActionResults({ onSelect }: { onSelect: (action: QuickAction["action"]) => void }) {
  return (
    <CommandGroup heading="Azioni rapide">
      {QUICK_ACTIONS.map((item) => (
        <CommandItem
          key={item.id}
          value={`${item.title} ${item.subtitle}`}
          onSelect={() => onSelect(item.action)}
        >
          <item.icon className="size-4" strokeWidth={1.7} />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{item.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function SearchResultGroups({
  results,
  onSelect,
}: {
  results: {
    cases: SearchResult[];
    principals: SearchResult[];
    clients: SearchResult[];
    counterparties: SearchResult[];
    activities: SearchResult[];
    invoices: SearchResult[];
  };
  onSelect: (result: SearchResult) => void;
}) {
  return (
    <>
      <ResultGroup
        heading="Pratiche"
        icon={Briefcase}
        results={results.cases}
        onSelect={onSelect}
      />
      <ResultGroup
        heading="Committenti"
        icon={Building2}
        results={results.principals}
        onSelect={onSelect}
      />
      <ResultGroup heading="Clienti" icon={User} results={results.clients} onSelect={onSelect} />
      <ResultGroup
        heading="Controparti"
        icon={UserRoundSearch}
        results={results.counterparties}
        onSelect={onSelect}
      />
      <ResultGroup
        heading="Attività"
        icon={ListChecks}
        results={results.activities}
        onSelect={onSelect}
      />
      <ResultGroup
        heading="Fatture"
        icon={FileText}
        results={results.invoices}
        onSelect={onSelect}
      />
    </>
  );
}

function ResultGroup({
  heading,
  icon: Icon,
  results,
  onSelect,
}: {
  heading: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
}) {
  if (results.length === 0) return null;

  return (
    <CommandGroup heading={heading}>
      {results.map((result) => (
        <CommandItem
          key={result.id}
          value={`${result.title} ${result.subtitle}`}
          onSelect={() => onSelect(result)}
        >
          <Icon className="size-4" strokeWidth={1.7} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{result.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
          </span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function escapeLikeTerm(value: string) {
  return value.replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", " ");
}
