// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { supabase, query, maybeSingle } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const query = {
    select: vi.fn(() => query),
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle,
  };
  return {
    query,
    maybeSingle,
    supabase: { from: vi.fn(() => query) },
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase }));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
  }),
}));

import { APP_VERSION } from "./version";
import { useUnreadChangelog } from "./use-unread-changelog";

function Wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function Probe() {
  const changelog = useUnreadChangelog();
  return (
    <div>
      <span>{changelog.isLoading ? "caricamento" : changelog.hasUnread ? "nuovo" : "letto"}</span>
      <span>{changelog.currentVersion}</span>
      <button type="button" onClick={changelog.markAsRead}>
        segna letto
      </button>
    </div>
  );
}

function IdentityProbe({ onStableIdentity }: { onStableIdentity: (stable: boolean) => void }) {
  const changelog = useUnreadChangelog();
  const firstMarkAsRead = useRef(changelog.markAsRead);

  useEffect(() => {
    if (!changelog.isLoading) {
      onStableIdentity(firstMarkAsRead.current === changelog.markAsRead);
    }
  }, [changelog.isLoading, changelog.markAsRead, onStableIdentity]);

  return <span>{changelog.isLoading ? "caricamento" : "pronto"}</span>;
}

describe("useUnreadChangelog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("legge la versione vista e marca il changelog come letto", async () => {
    maybeSingle.mockResolvedValue({
      data: { last_seen_changelog_version: "0.1.0" },
      error: null,
    });

    render(<Probe />, { wrapper: Wrapper });

    await screen.findByText("nuovo");
    expect(screen.getByText(APP_VERSION)).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "segna letto" }));

    await waitFor(() =>
      expect(query.update).toHaveBeenCalledWith({ last_seen_changelog_version: APP_VERSION }),
    );
  });

  it("mantiene stabile il callback markAsRead fra i render", async () => {
    maybeSingle.mockResolvedValue({
      data: { last_seen_changelog_version: "0.1.0" },
      error: null,
    });
    const onStableIdentity = vi.fn();

    render(<IdentityProbe onStableIdentity={onStableIdentity} />, { wrapper: Wrapper });

    await screen.findByText("pronto");

    await waitFor(() => expect(onStableIdentity).toHaveBeenLastCalledWith(true));
    expect(onStableIdentity).not.toHaveBeenCalledWith(false);
  });
});
