import { useRouter, useRouterState } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const feedback = getErrorFeedback(error, pathname);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <TriangleAlert className="size-8 text-destructive" aria-hidden="true" />
        </div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {feedback.areaLabel}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{feedback.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{feedback.description}</p>
        <p className="mt-3 text-sm text-muted-foreground">{feedback.action}</p>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {feedback.retryLabel}
          </button>
          <a
            href={feedback.recoveryHref}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {feedback.recoveryLabel}
          </a>
        </div>
      </div>
    </div>
  );
}

type ErrorKind = "auth" | "data" | "network" | "not-found" | "permission" | "runtime" | "unknown";

type ErrorFeedback = {
  action: string;
  areaLabel: string;
  description: string;
  recoveryHref: string;
  recoveryLabel: string;
  retryLabel: string;
  title: string;
};

const AREA_BY_ROUTE: Array<[RegExp, string]> = [
  [/^\/dashboard(?:\/|$)/, "Dashboard"],
  [/^\/pratiche(?:\/|$)/, "Pratiche"],
  [/^\/attivita(?:\/|$)/, "Attività"],
  [/^\/fatture(?:\/|$)/, "Fatture"],
  [/^\/committenti(?:\/|$)/, "Committenti"],
  [/^\/clienti(?:\/|$)/, "Clienti"],
  [/^\/controparti(?:\/|$)/, "Controparti"],
  [/^\/prezzi(?:\/|$)/, "Prezzi"],
  [/^\/creazione-guidata(?:\/|$)/, "Creazione guidata"],
  [/^\/controllo-duplicati(?:\/|$)/, "Controllo duplicati"],
  [/^\/impostazioni(?:\/|$)/, "Impostazioni"],
  [/^\/account(?:\/|$)/, "Account"],
  [/^\/novita(?:\/|$)/, "Novità"],
  [/^\/login(?:\/|$)/, "Accesso"],
  [/^\/register(?:\/|$)/, "Registrazione"],
  [/^\/recupera-password(?:\/|$)/, "Recupero password"],
  [/^\/reimposta-password(?:\/|$)/, "Reimposta password"],
  [/^\/privacy(?:\/|$)/, "Privacy"],
  [/^\/termini(?:\/|$)/, "Termini"],
  [/^\/$/, "Home"],
];

function getErrorFeedback(error: Error, pathname: string): ErrorFeedback {
  const areaLabel = getAreaLabel(pathname);
  const kind = classifyError(error);
  const areaPhrases = getAreaPhrases(areaLabel);
  const recovery = getRecoveryAction(kind, pathname);

  switch (kind) {
    case "auth":
      return {
        areaLabel,
        title: "Sessione da aggiornare",
        description: `Pratix non può caricare ${areaPhrases.direct} perché la sessione non risulta valida.`,
        action: "Accedi di nuovo, poi riapri la pagina.",
        retryLabel: "Ricarica sessione",
        ...recovery,
      };
    case "permission":
      return {
        areaLabel,
        title: "Accesso ai dati non autorizzato",
        description: `La pagina ha richiesto dati ${areaPhrases.genitive} che questa sessione non può leggere.`,
        action:
          "Riprova dopo l'accesso. Se il problema resta, serve verificare i permessi dei dati.",
        retryLabel: "Riprova",
        ...recovery,
      };
    case "network":
      return {
        areaLabel,
        title: "Connessione non riuscita",
        description: `Pratix non riesce a raggiungere i servizi necessari per caricare ${areaPhrases.direct}.`,
        action: "Controlla la connessione e riprova tra poco.",
        retryLabel: "Riprova caricamento",
        ...recovery,
      };
    case "data":
      return {
        areaLabel,
        title: "Dati non disponibili",
        description: `I dati richiesti ${areaPhrases.source} non sono disponibili o non sono allineati allo schema atteso.`,
        action: "Riprova. Se l'errore persiste, va controllata la query o il database.",
        retryLabel: "Ricarica dati",
        ...recovery,
      };
    case "not-found":
      return {
        areaLabel,
        title: "Elemento non trovato",
        description: `Il record richiesto ${areaPhrases.in} non esiste più o non è accessibile.`,
        action: "Torna alla sezione e riapri il record dall'elenco.",
        retryLabel: "Riprova",
        ...recovery,
      };
    case "runtime":
      return {
        areaLabel,
        title: "Pagina non caricata",
        description: `Un errore nel codice della pagina ha bloccato il caricamento ${areaPhrases.genitive}.`,
        action: "Ricarica. Se succede ancora, serve una correzione tecnica.",
        retryLabel: "Ricarica pagina",
        ...recovery,
      };
    default:
      return {
        areaLabel,
        title: "Caricamento interrotto",
        description: `Pratix ha interrotto il caricamento ${areaPhrases.genitive}.`,
        action: "Riprova. Se il problema resta, segnala la pagina che stavi aprendo.",
        retryLabel: "Riprova",
        ...recovery,
      };
  }
}

function getAreaLabel(pathname: string) {
  return AREA_BY_ROUTE.find(([pattern]) => pattern.test(pathname))?.[1] ?? "Pagina";
}

function getAreaPhrases(areaLabel: string) {
  if (areaLabel === "Home") {
    return {
      direct: "questa pagina",
      genitive: "di questa pagina",
      in: "in questa pagina",
      source: "da questa pagina",
    };
  }

  return {
    direct: `la sezione ${areaLabel}`,
    genitive: `della sezione ${areaLabel}`,
    in: `nella sezione ${areaLabel}`,
    source: `dalla sezione ${areaLabel}`,
  };
}

function classifyError(error: Error): ErrorKind {
  const text = `${error.name} ${error.message}`.toLocaleLowerCase("it-IT");

  if (matches(text, ["not found", "non trovato", "non trovata", "404"])) return "not-found";
  if (
    matches(text, [
      "401",
      "jwt",
      "sessione",
      "session",
      "token",
      "utente non autenticato",
      "not authenticated",
      "auth",
      "accedi di nuovo",
    ])
  ) {
    return "auth";
  }
  if (matches(text, ["permission denied", "not authorized", "forbidden", "403"])) {
    return "permission";
  }
  if (
    matches(text, [
      "failed to fetch",
      "fetch failed",
      "load failed",
      "network",
      "timeout",
      "connessione",
      "internet",
    ])
  ) {
    return "network";
  }
  if (
    matches(text, [
      "pgrst",
      "postgrest",
      "supabase",
      "database",
      "relation",
      "column",
      "schema",
      "foreign key",
      "duplicate key",
      "invalid input syntax",
      "null value",
      "row-level security",
      "rls",
      "23502",
      "23503",
      "23505",
      "22p02",
    ])
  ) {
    return "data";
  }
  if (
    matches(text, [
      "referenceerror",
      "typeerror",
      "is not defined",
      "cannot read properties",
      "chunkloaderror",
      "dynamically imported module",
    ])
  ) {
    return "runtime";
  }

  return "unknown";
}

function matches(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function getRecoveryAction(kind: ErrorKind, pathname: string) {
  if (kind === "auth" || kind === "permission") {
    return { recoveryHref: "/login", recoveryLabel: "Accedi" };
  }

  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return { recoveryHref: "/", recoveryLabel: "Torna alla home" };
  }

  return { recoveryHref: "/dashboard", recoveryLabel: "Vai alla Dashboard" };
}
