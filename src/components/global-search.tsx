import { useDeferredValue, useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Briefcase, FileText, ListChecks, Plus, Receipt, Search, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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
import { clientDisplayName, invoiceStatusLabels, type ClientDisplayData } from "@/lib/labels";
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
      kind: "invoice";
      title: string;
      subtitle: string;
      invoiceRef: string;
    };

type QuickAction = {
  id: string;
  title: string;
  subtitle: string;
  action: "new-case" | "new-client" | "new-invoice" | "activities";
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "new-case",
    title: "Nuova pratica",
    subtitle: "Apri il form pratica",
    action: "new-case",
    icon: Briefcase,
  },
  {
    id: "new-client",
    title: "Nuovo cliente",
    subtitle: "Aggiungi anagrafica cliente",
    action: "new-client",
    icon: User,
  },
  {
    id: "new-invoice",
    title: "Nuova fattura",
    subtitle: "Prepara una fattura",
    action: "new-invoice",
    icon: Receipt,
  },
  {
    id: "activities",
    title: "Attività",
    subtitle: "Controlla compensi e rimborsi",
    action: "activities",
    icon: ListChecks,
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

      const caseQuery = supabase
        .from("cases")
        .select("id, public_code, case_number, practice_number, title, updated_at")
        .order("updated_at", { ascending: false })
        .limit(6);
      const clientQuery = supabase
        .from("clients")
        .select("id, public_code, kind, first_name, last_name, business_name, email, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      const invoiceQuery = supabase
        .from("invoices")
        .select(
          "id, public_code, number, year, status, total_amount, issue_date, principal:principals(business_name), client:clients(kind, first_name, last_name, business_name)",
        )
        .order("issue_date", { ascending: false })
        .limit(6);

      if (hasTerm) {
        caseQuery.or(`title.ilike.${likeTerm},case_number.ilike.${likeTerm}`);
        clientQuery.or(
          `first_name.ilike.${likeTerm},last_name.ilike.${likeTerm},business_name.ilike.${likeTerm},email.ilike.${likeTerm}`,
        );
        invoiceQuery.ilike("number", likeTerm);
      }

      const [casesRes, clientsRes, invoicesRes] = await Promise.all([
        caseQuery,
        clientQuery,
        invoiceQuery,
      ]);

      if (casesRes.error) throw casesRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      const cases: SearchResult[] = (casesRes.data ?? []).map((item) => ({
        id: `case-${item.id}`,
        kind: "case",
        title: `Pratica ${item.practice_number}`,
        subtitle: item.title || item.case_number,
        caseRef: routeRef(item),
      }));

      const clients: SearchResult[] = (clientsRes.data ?? []).map((item) => ({
        id: `client-${item.id}`,
        kind: "client",
        title: clientDisplayName(item),
        subtitle: item.email ?? "Cliente",
        clientRef: routeRef(item),
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

      return [...cases, ...clients, ...invoices];
    },
    staleTime: 20_000,
  });

  const groupedResults = useMemo(
    () => ({
      cases: results.filter((result) => result.kind === "case"),
      clients: results.filter((result) => result.kind === "client"),
      invoices: results.filter((result) => result.kind === "invoice"),
    }),
    [results],
  );

  const runQuickAction = (action: QuickAction["action"]) => {
    setOpen(false);
    if (action === "new-case") navigate({ to: "/pratiche/nuova" });
    if (action === "new-client") navigate({ to: "/clienti/nuovo" });
    if (action === "new-invoice") navigate({ to: "/fatture/nuova" });
    if (action === "activities") navigate({ to: "/attivita" });
  };

  const openResult = (result: SearchResult) => {
    setOpen(false);
    if (result.kind === "case") {
      navigate({ to: "/pratiche/$caseId", params: { caseId: result.caseRef } });
    }
    if (result.kind === "client") {
      navigate({ to: "/clienti/$clientId", params: { clientId: result.clientRef } });
    }
    if (result.kind === "invoice") {
      navigate({ to: "/fatture/$invoiceId", params: { invoiceId: result.invoiceRef } });
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden h-8 min-w-40 justify-start gap-2 px-2 text-muted-foreground sm:inline-flex"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        <span className="text-xs">Ricerca</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={() => setOpen(true)}
        aria-label="Apri ricerca"
      >
        <Search className="size-4" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Cerca pratiche, clienti o fatture"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>{isFetching ? "Ricerca in corso…" : "Nessun risultato."}</CommandEmpty>

          <CommandGroup heading="Azioni rapide">
            {QUICK_ACTIONS.map((item) => (
              <CommandItem
                key={item.id}
                value={`${item.title} ${item.subtitle}`}
                onSelect={() => runQuickAction(item.action)}
              >
                <item.icon className="size-4" strokeWidth={1.7} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          {(groupedResults.cases.length > 0 ||
            groupedResults.clients.length > 0 ||
            groupedResults.invoices.length > 0) && <CommandSeparator />}

          <ResultGroup
            heading="Pratiche"
            icon={Briefcase}
            results={groupedResults.cases}
            onSelect={openResult}
          />
          <ResultGroup
            heading="Clienti"
            icon={User}
            results={groupedResults.clients}
            onSelect={openResult}
          />
          <ResultGroup
            heading="Fatture"
            icon={FileText}
            results={groupedResults.invoices}
            onSelect={openResult}
          />
        </CommandList>
      </CommandDialog>
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
