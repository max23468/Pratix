import { describe, expect, it, vi } from "vitest";
import { runSupabaseKeepAlive } from "./api.cron.daily";

describe("cron giornaliero", () => {
  it("esegue una query leggera su Supabase per mantenere attività sul progetto", async () => {
    const limit = vi.fn().mockResolvedValue({ error: null });
    const select = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ select }));

    await expect(runSupabaseKeepAlive({ from })).resolves.toEqual({ ok: true });

    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("id", { head: true });
    expect(limit).toHaveBeenCalledWith(1);
  });

  it("propaga un errore sanitizzato se Supabase non risponde", async () => {
    const limit = vi.fn().mockResolvedValue({
      error: { message: "timeout sul database", code: "57014" },
    });
    const select = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ select }));

    await expect(runSupabaseKeepAlive({ from })).rejects.toThrow(
      "Heartbeat Supabase fallito: 57014",
    );
  });
});
