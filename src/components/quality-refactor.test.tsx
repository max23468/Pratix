// @vitest-environment jsdom
import { cleanup, render, screen, fireEvent, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, ReactNode } from "react";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: vi.fn() } } }));
import { FormActions } from "./form-actions";
import { PasswordlessAccessCard } from "./passwordless-access-card";
import { SubjectKindField } from "./subject-kind-field";
import { ActivityAttachmentList } from "./activity-attachment-list";
import { DuplicateSummaryBox } from "./dashboard/duplicate-summary-box";
import { InvoiceListResults } from "./invoice-list-results";
import { ActivityEditor } from "./guided-creation/activity-editor";
afterEach(cleanup);
const invoiceProps: ComponentProps<typeof InvoiceListResults> = {
  rows: [],
  isLoading: false,
  hasInvoiceFilters: false,
  today: "2026-10-08",
  sort: { key: "number", direction: "asc" },
  onSort: vi.fn(),
  onOpen: vi.fn(),
};
describe("estrazioni di qualità", () => {
  it("mantiene stati caricamento, lista vuota e filtro fatture", () => {
    const view = render(<InvoiceListResults {...invoiceProps} isLoading />);
    expect(screen.getAllByText("Caricamento…")).toHaveLength(2);
    view.rerender(<InvoiceListResults {...invoiceProps} />);
    expect(screen.getAllByText("Nessuna fattura")).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Nuova fattura" })).toHaveLength(2);
    view.rerender(<InvoiceListResults {...invoiceProps} hasInvoiceFilters />);
    expect(screen.getAllByText("Nessuna fattura trovata")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Nuova fattura" })).toBeNull();
  });
  it("mantiene fattura scaduta, apertura e ordinamento", () => {
    const onOpen = vi.fn();
    const onSort = vi.fn();
    const rows = [
      {
        id: "inv-1",
        public_code: "FAT-1",
        number: "7",
        year: 2026,
        status: "issued",
        issue_date: "2026-10-01",
        due_date: "2026-10-07",
        total_amount: 100,
        net_to_pay: 80,
        principal: { business_name: "Alfa" },
        client: null,
        billing_run: null,
      },
    ] as ComponentProps<typeof InvoiceListResults>["rows"];
    render(<InvoiceListResults {...invoiceProps} rows={rows} onOpen={onOpen} onSort={onSort} />);
    expect(screen.getAllByText("Scaduta")).toHaveLength(2);
    const row = within(screen.getByRole("table")).getByRole("link", {
      name: /7\/2026.*Scaduta/,
    });
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onOpen).toHaveBeenCalledWith("FAT-1");
    fireEvent.click(screen.getByRole("button", { name: /Numero/ }));
    expect(onSort).toHaveBeenCalledWith("number");
  });
  it("mantiene riepilogo duplicati e assenza di dati", () => {
    const view = render(<DuplicateSummaryBox isLoading={false} />);
    expect(view.container.textContent).toBe("");
    view.rerender(
      <DuplicateSummaryBox
        isLoading
        summary={{ openCount: 2, highConfidenceCount: 1, snoozedCount: 3, resolvedCount: 4 }}
      />,
    );
    expect(screen.getByText("Controllo…")).toBeTruthy();
    view.rerender(
      <DuplicateSummaryBox
        isLoading={false}
        summary={{ openCount: 2, highConfidenceCount: 1, snoozedCount: 3, resolvedCount: 4 }}
      />,
    );
    expect(screen.getByText("2 da verificare")).toBeTruthy();
    expect(screen.getByText("Alta probabilità")).toBeTruthy();
  });
  it("nomina i controlli degli allegati", () => {
    render(
      <ActivityAttachmentList
        attachments={[
          {
            id: "a",
            display_name: "Atto.pdf",
            storage_path: "a",
            preview_available: true,
            document_type: null,
            original_file_name: null,
            mime_type: null,
            size_bytes: null,
            notes: null,
          },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Apri Atto.pdf" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scarica Atto.pdf" })).toBeTruthy();
  });
  it("nomina la rimozione attività e conserva il destinatario callback", () => {
    const removeActivity = vi.fn();
    const activity = {
      localId: "local-1",
      activityId: "a",
      activityDate: "2026-10-08",
      priceItemId: "",
      description: "",
      quantity: 1,
      freeAmount: 0,
      status: "to_invoice",
      notes: "",
      hearingDates: [],
      attachmentFile: null,
      attachmentName: "",
      attachmentType: "",
      attachmentNotes: "",
    } as const;
    render(
      <ActivityEditor
        activity={{ ...activity, hearingDates: [] }}
        index={0}
        priceOptions={[]}
        removeActivity={removeActivity}
        updateActivity={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi attività 1" }));
    expect(removeActivity).toHaveBeenCalledWith("local-1");
  });
  it("conserva conferma cancellazione e blocco salvataggio", () => {
    const onDelete = vi.fn();
    const onCancel = vi.fn();
    render(
      <FormActions
        isEdit
        isPending
        onDelete={onDelete}
        onCancel={onCancel}
        deleteTitle="Eliminare pratica?"
        deleteDescription="Non può essere annullato."
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Salvataggio…" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Elimina" }).at(-1)!);
    expect(onDelete).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
  it("conserva contenuto e destinazione del recupero accesso", () => {
    render(
      <PasswordlessAccessCard
        title="Accesso via email"
        description="Usa il codice."
        actionLabel="Vai al login"
      />,
    );
    expect(screen.getByRole("heading", { name: "Accesso via email" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Vai al login" }).getAttribute("href")).toBe("/login");
  });
  it("conserva associazione label al tipo soggetto", () => {
    render(<SubjectKindField id="test_kind" value="individual" onValueChange={vi.fn()} />);
    expect(screen.getByLabelText("Tipo").id).toBe("test_kind");
  });
});
