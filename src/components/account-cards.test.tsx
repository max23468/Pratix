// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { strFromU8, unzipSync } from "fflate";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { deleteAccount, downloadBytes, passkeyState, supabase, tableRows, tableErrors, toast } =
  vi.hoisted(() => ({
    deleteAccount: vi.fn(),
    downloadBytes: vi.fn(),
    passkeyState: {
      supported: true,
      list: [] as Array<{ id: string; friendly_name?: string; created_at: string }>,
    },
    tableRows: {} as Record<string, unknown[]>,
    tableErrors: {} as Record<string, Error | null>,
    toast: { success: vi.fn(), error: vi.fn() },
    supabase: {
      from: vi.fn((table: string) => {
        const builder = {
          select: vi.fn(() => builder),
          order: vi.fn(() => builder),
          range: vi.fn((from: number, to: number) => {
            const error = tableErrors[table];
            if (error) return Promise.resolve({ data: null, error });
            return Promise.resolve({
              data: (tableRows[table] ?? []).slice(from, to + 1),
              error: null,
            });
          }),
        };
        return builder;
      }),
      auth: {
        // Tipo di ritorno esplicito: alcuni test rimpiazzano la sessione con
        // `null` per coprire il caso "sessione assente".
        getSession: vi.fn(
          async (): Promise<{ data: { session: { access_token: string } | null } }> => ({
            data: { session: { access_token: "token-test" } },
          }),
        ),
        updateUser: vi.fn(async () => ({ error: null })),
        registerPasskey: vi.fn(async () => ({ error: null })),
        passkey: {
          list: vi.fn(async () => ({ data: passkeyState.list, error: null })),
          delete: vi.fn(async () => ({ error: null })),
        },
      },
    },
  }));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: () => deleteAccount,
}));

vi.mock("@/server/account.functions", () => ({
  deleteAccountFn: Symbol("deleteAccountFn"),
}));

vi.mock("@/lib/file-downloads", () => ({
  downloadBytes,
}));

vi.mock("@/hooks/use-passkey-supported", () => ({
  usePasskeySupported: () => passkeyState.supported,
}));

vi.mock("@/lib/passkeys", () => ({
  PASSKEYS_ENABLED: true,
  passkeysUnavailableMessage: () =>
    "Le passkey non sono ancora disponibili su questo progetto Supabase. Puoi continuare a usare il link via email.",
}));

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({
    children,
    onClick,
    className,
  }: {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
}));

import { DataExportCard } from "@/components/account/data-export-card";
import { DeleteAccountCard } from "@/components/account/delete-account-card";
import { EmailAccessCard } from "@/components/account/email-access-card";
import { PasskeyAccessCard } from "@/components/account/passkey-access-card";
import { PERSONAL_DATA_TABLES } from "@/lib/personal-data-export";

function renderWithClient(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("account cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passkeyState.supported = true;
    passkeyState.list = [];
    for (const table of PERSONAL_DATA_TABLES) {
      tableRows[table] = [];
      tableErrors[table] = null;
    }
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token-test" } },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("genera export JSON paginando le tabelle personali", async () => {
    tableRows.profiles = Array.from({ length: 1001 }, (_, index) => ({
      id: `profile-${index + 1}`,
      email: `utente-${index + 1}@example.test`,
    }));

    renderWithClient(<DataExportCard />);

    await userEvent.click(screen.getByRole("button", { name: "Scarica JSON" }));

    await waitFor(() => expect(downloadBytes).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Export JSON generato");

    const payload = JSON.parse(strFromU8(downloadBytes.mock.calls[0][0].bytes));
    expect(downloadBytes.mock.calls[0][0]).toMatchObject({
      fileName: expect.stringMatching(/^pratix-export-dati-\d{4}-\d{2}-\d{2}\.json$/),
      mimeType: "application/json;charset=utf-8",
    });
    expect(payload.product).toBe("Pratix");
    expect(payload.tables.profiles).toHaveLength(1001);
  });

  it("genera archivio CSV con manifest e righe esportate", async () => {
    tableRows.principals = [{ id: "principal-1", business_name: "Banca Test" }];

    renderWithClient(<DataExportCard />);

    await userEvent.click(screen.getByRole("button", { name: "Scarica CSV" }));

    await waitFor(() => expect(downloadBytes).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Archivio CSV generato");

    const archive = unzipSync(downloadBytes.mock.calls[0][0].bytes);
    expect(downloadBytes.mock.calls[0][0]).toMatchObject({
      fileName: expect.stringMatching(/^pratix-export-dati-\d{4}-\d{2}-\d{2}\.zip$/),
      mimeType: "application/zip",
    });
    expect(strFromU8(archive["manifest.json"])).toContain('"principals": 1');
    expect(strFromU8(archive["principals.csv"])).toContain("business_name;id");
    expect(strFromU8(archive["principals.csv"])).toContain("Banca Test;principal-1");
  });

  it("aggiorna l'email di accesso normalizzando il valore inserito", async () => {
    renderWithClient(<EmailAccessCard email="avvocato@example.test" />);

    fireEvent.change(screen.getByLabelText("Nuova email"), {
      target: { value: " NUOVA@Example.Test " },
    });
    await userEvent.click(screen.getByRole("button", { name: "Cambia email" }));

    await waitFor(() =>
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ email: "nuova@example.test" }),
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Controlla la nuova email per confermare la modifica",
    );
  });

  it("blocca il cambio email quando coincide con quella attuale", async () => {
    renderWithClient(<EmailAccessCard email="avvocato@example.test" />);

    fireEvent.change(screen.getByLabelText("Nuova email"), {
      target: { value: "AVVOCATO@example.test" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Cambia email" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("La nuova email coincide con quella attuale"),
    );
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("elimina l'account solo dopo conferma esplicita e token valido", async () => {
    deleteAccount.mockResolvedValue({
      data: { deleted: true, removedStorageObjects: 3, storageCleanupCompleted: true },
    });
    const onDeleted = vi.fn(async () => undefined);

    renderWithClient(<DeleteAccountCard email="avvocato@example.test" onDeleted={onDeleted} />);

    const submitButton = screen.getByRole("button", { name: "Elimina account" });
    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Conferma scrivendo ELIMINA"), {
      target: { value: "ELIMINA" },
    });
    expect(
      (screen.getByRole("button", { name: "Elimina account" }) as HTMLButtonElement).disabled,
    ).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: "Elimina definitivamente" }));

    await waitFor(() =>
      expect(deleteAccount).toHaveBeenCalledWith({
        data: { confirmation: "ELIMINA" },
        headers: { Authorization: "Bearer token-test" },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Account eliminato");
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it("mostra errore se l'eliminazione account parte senza sessione", async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    renderWithClient(<DeleteAccountCard email="avvocato@example.test" onDeleted={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Conferma scrivendo ELIMINA"), {
      target: { value: "ELIMINA" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Elimina definitivamente" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Sessione non valida. Accedi di nuovo."),
    );
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("mostra fallback passkey su dispositivi non supportati", async () => {
    passkeyState.supported = false;

    renderWithClient(<PasskeyAccessCard userId="user-1" />);

    expect(
      screen.getByText("Le passkey non sono disponibili su questo dispositivo o browser."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Aggiungi passkey" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("gestisce elenco, rimozione e registrazione passkey", async () => {
    passkeyState.list = [
      {
        id: "pk-1",
        friendly_name: "MacBook",
        created_at: "2026-06-01T10:00:00.000Z",
      },
    ];

    renderWithClient(<PasskeyAccessCard userId="user-1" />);

    expect(await screen.findByText("MacBook")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Rimuovi" }));
    await waitFor(() =>
      expect(supabase.auth.passkey.delete).toHaveBeenCalledWith({ passkeyId: "pk-1" }),
    );
    expect(toast.success).toHaveBeenCalledWith("Passkey rimossa");

    await userEvent.click(screen.getByRole("button", { name: "Aggiungi passkey" }));
    await waitFor(() => expect(supabase.auth.registerPasskey).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Passkey aggiunta");
  });
});
