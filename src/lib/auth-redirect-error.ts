const AUTH_REDIRECT_ERROR_KEYS = ["error", "error_code", "error_description"] as const;

type AuthRedirectErrorParams = {
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
};

type HashParams = {
  params: URLSearchParams;
  pathPrefix: string;
};

export type ParsedAuthRedirectError = {
  message: string;
  cleanUrl: string;
};

function parseHashParams(hash: string): HashParams | null {
  const cleanHash = hash.replace(/^#/, "");

  if (!cleanHash) return null;

  const queryStart = cleanHash.indexOf("?");
  const pathPrefix = queryStart >= 0 ? cleanHash.slice(0, queryStart) : "";
  const query = queryStart >= 0 ? cleanHash.slice(queryStart + 1) : cleanHash;

  if (!query.includes("=") && !query.includes("&")) return null;

  return {
    params: new URLSearchParams(query),
    pathPrefix,
  };
}

function getFirstParam(
  searchParams: URLSearchParams,
  hashParams: URLSearchParams | null,
  key: string,
) {
  return searchParams.get(key) ?? hashParams?.get(key) ?? null;
}

function describeAuthRedirectError({
  error,
  errorCode,
  errorDescription,
}: AuthRedirectErrorParams) {
  const details = [error, errorCode, errorDescription].filter(Boolean).join(" ").toLowerCase();

  if (/otp_expired|expired|invalid.*expired|already.*used/.test(details)) {
    return "Il link di accesso è scaduto o è già stato usato. Richiedine uno nuovo dalla pagina di accesso.";
  }

  if (/pkce|code verifier|verifier/.test(details)) {
    return "Il link non può essere completato in questo browser. Richiedine uno nuovo e aprilo nello stesso browser usato per richiederlo.";
  }

  if (/access_denied|invalid_request|invalid request|invalid.*link|invalid.*token/.test(details)) {
    return "Il link di accesso non è valido. Richiedine uno nuovo e usa l'ultimo ricevuto.";
  }

  if (/server_error|temporar|unavailable|timeout/.test(details)) {
    return "Non siamo riusciti a completare l'accesso per un problema temporaneo. Richiedi un nuovo link e riprova tra poco.";
  }

  return "Non siamo riusciti a completare l'accesso con questo link. Richiedine uno nuovo dalla pagina di accesso.";
}

export function readAuthRedirectError(url: string): ParsedAuthRedirectError | null {
  const parsedUrl = new URL(url);
  const hashParams = parseHashParams(parsedUrl.hash);
  const error = getFirstParam(parsedUrl.searchParams, hashParams?.params ?? null, "error");
  const errorCode = getFirstParam(parsedUrl.searchParams, hashParams?.params ?? null, "error_code");
  const errorDescription = getFirstParam(
    parsedUrl.searchParams,
    hashParams?.params ?? null,
    "error_description",
  );

  if (!error && !errorCode && !errorDescription) return null;

  for (const key of AUTH_REDIRECT_ERROR_KEYS) {
    parsedUrl.searchParams.delete(key);
    hashParams?.params.delete(key);
  }

  if (hashParams) {
    const nextHashQuery = hashParams.params.toString();
    parsedUrl.hash = nextHashQuery
      ? `${hashParams.pathPrefix ? `${hashParams.pathPrefix}?` : ""}${nextHashQuery}`
      : hashParams.pathPrefix;
  }

  return {
    message: describeAuthRedirectError({ error, errorCode, errorDescription }),
    cleanUrl: parsedUrl.toString(),
  };
}
