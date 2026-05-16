// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCaseTimelineItems } from "../lib/case-timeline";
import { buildDebtCollectionWorkflow, summarizeCaseOperations } from "../lib/case-workflow";
import { CaseTimeline, WorkflowPriorityBadge } from "./case-operations-panel";

describe("case operations timeline", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("ordina eventi pratica, attività, allegati, fatture e storico", () => {
    const timeline = buildCaseTimelineItems({
      caseRow: {
        id: "case-1",
        opened_at: "2026-05-01",
        title: "Recupero credito Beta",
        status: "in_progress",
      },
      activities: [
        {
          id: "activity-1",
          activity_date: "2026-05-03",
          kind: "fee",
          status: "to_invoice",
          description: "Udienza",
          quantity: 1,
          unit_price: 120,
          amount: 120,
          notes: null,
          case_activity_hearings: [
            { id: "hearing-2", hearing_date: "2026-05-20", position: 2 },
            { id: "hearing-1", hearing_date: "2026-05-10", position: 1 },
          ],
          activity_attachments: [{ id: "attachment-1", display_name: "Verbale.pdf" }],
        },
      ] as never,
      invoices: [
        {
          id: "invoice-1",
          number: "TST1",
          year: 2026,
          issue_date: "2026-05-05",
          due_date: "2026-06-05",
          paid_at: null,
          status: "draft",
          total_amount: 150,
          notes: null,
        },
      ] as never,
      history: [
        {
          id: "history-1",
          previous_status: "open",
          new_status: "in_progress",
          changed_at: "2026-05-04",
          note: null,
        },
      ] as never,
      transfers: [] as never,
    });

    expect(timeline.map((item) => item.id)).toEqual([
      "invoice-invoice-1",
      "history-history-1",
      "activity-activity-1",
      "attachment-attachment-1",
      "case-opened-case-1",
    ]);

    const html = renderToString(<CaseTimeline timeline={timeline} />);
    expect(html).toContain("Timeline pratica");
    expect(html).toContain("Fattura TST1/2026");
    expect(html).toContain("Udienza");
    expect(html).toContain("Verbale.pdf");
    expect(html).toContain("In corso");
  });

  it("rende cliccabili le Attività della timeline quando è disponibile l'azione di modifica", async () => {
    const onEditActivity = vi.fn();
    render(
      <CaseTimeline
        timeline={[
          {
            id: "activity-activity-1",
            activityId: "activity-1",
            date: "2026-05-03",
            title: "Udienza",
            description: "Compenso / Onorario",
            meta: "Da fatturare",
            amount: 120,
          },
          {
            id: "invoice-invoice-1",
            date: "2026-05-05",
            title: "Fattura TST1/2026",
            description: "Scadenza 05/06/2026",
            meta: "Bozza",
            amount: 150,
          },
        ]}
        onEditActivity={onEditActivity}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Modifica attività Udienza" }));

    expect(onEditActivity).toHaveBeenCalledWith("activity-1");
    expect(screen.queryByRole("button", { name: /Fattura TST1/ })).toBeNull();
  });

  it("assegna priorità alta alle Attività maturate da fatturare", () => {
    const activities = [
      {
        id: "activity-1",
        activity_date: "2026-05-03",
        kind: "fee",
        status: "to_invoice",
        description: "Udienza",
        quantity: 1,
        unit_price: 120,
        amount: 120,
        notes: null,
        case_activity_hearings: [],
        activity_attachments: [{ id: "attachment-1", display_name: "Verbale.pdf" }],
      },
    ] as never;
    const invoices = [] as never;
    const workflow = buildDebtCollectionWorkflow({
      caseRow: {
        status: "in_progress",
      },
      activities,
      invoices,
      totals: summarizeCaseOperations(activities, invoices),
      qualityChecks: [{ severity: "ok" }],
    });

    expect(workflow).toMatchObject({
      stage: "Preparazione Fattura",
      priority: "Alta",
      action: "Prepara la Fattura per le Attività maturate.",
      priorityInsight: {
        description:
          "Pratix richiede intervento perché ci sono Attività maturate non ancora collegate a una Fattura.",
        items: expect.arrayContaining(["1 Attività maturata non fatturata"]),
        nextStep: "Prepara la Fattura per le Attività maturate.",
      },
    });
  });

  it("spiega quali dati iniziali rendono alta la priorità", () => {
    const activities = [] as never;
    const invoices = [] as never;
    const workflow = buildDebtCollectionWorkflow({
      caseRow: {
        status: "in_progress",
      },
      activities,
      invoices,
      totals: summarizeCaseOperations(activities, invoices),
      qualityChecks: [
        {
          severity: "warning",
          id: "missing-principal",
          title: "Committente mancante",
          description: "Completa il soggetto fatturato.",
        },
        {
          severity: "warning",
          id: "missing-activities",
          title: "Nessuna Attività",
          description: "Registra almeno una voce.",
        },
      ],
    });

    expect(workflow).toMatchObject({
      stage: "Impostazione pratica",
      priority: "Alta",
      priorityInsight: {
        description:
          "Pratix richiede intervento perché la pratica è ancora in impostazione e non ha una base operativa completa.",
        items: ["Committente mancante", "Nessuna Attività"],
        nextStep: "Completa soggetti e prima Attività.",
      },
    });
  });

  it("spiega quali Fatture rendono alta la priorità di recupero incasso", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 12));

    const activities = [] as never;
    const invoices = [
      {
        id: "invoice-1",
        number: "TST1",
        year: 2026,
        issue_date: "2026-05-01",
        due_date: "2026-05-09",
        paid_at: null,
        status: "issued",
        total_amount: 150,
        notes: null,
      },
    ] as never;
    const workflow = buildDebtCollectionWorkflow({
      caseRow: {
        status: "in_progress",
      },
      activities,
      invoices,
      totals: summarizeCaseOperations(activities, invoices),
      qualityChecks: [{ severity: "ok" }],
    });

    expect(workflow).toMatchObject({
      stage: "Recupero incasso",
      priority: "Alta",
      priorityInsight: {
        description:
          "Pratix richiede intervento perché ci sono Fatture scadute o già segnate come insolute.",
        items: expect.arrayContaining(["1 Fattura insoluta"]),
        nextStep: "Sollecita il pagamento delle Fatture insolute.",
      },
    });
  });

  it("mostra il badge Richiede intervento con overlay esplicativo", async () => {
    render(
      <WorkflowPriorityBadge
        workflow={{
          stage: "Preparazione Fattura",
          priority: "Alta",
          priorityVariant: "destructive",
          action: "Prepara la Fattura per le Attività maturate.",
          reason: "120,00 € sono da fatturare.",
          priorityInsight: {
            title: "Perché richiede intervento",
            description:
              "Pratix richiede intervento perché ci sono Attività maturate non ancora collegate a una Fattura.",
            items: ["120,00 € da fatturare", "1 Attività maturata non fatturata"],
            nextStep: "Prepara la Fattura per le Attività maturate.",
          },
        }}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Mostra perché questa pratica richiede intervento",
    });
    expect(screen.getByText("Richiede intervento")).toBeTruthy();

    await userEvent.click(trigger);

    expect(await screen.findByText("Perché richiede intervento")).toBeTruthy();
    expect(screen.getByText("120,00 € da fatturare")).toBeTruthy();
    expect(screen.getByText("1 Attività maturata non fatturata")).toBeTruthy();
    expect(screen.getByText("Azione consigliata")).toBeTruthy();
  });

  it("mostra le etichette operative per le priorità non alte", () => {
    const { rerender } = render(
      <WorkflowPriorityBadge
        workflow={{
          stage: "Monitoraggio incasso",
          priority: "Media",
          priorityVariant: "outline",
          action: "Controlla scadenze e incassi delle Fatture emesse.",
          reason: "150,00 € risultano da incassare.",
        }}
      />,
    );

    expect(screen.getByText("Da monitorare")).toBeTruthy();

    rerender(
      <WorkflowPriorityBadge
        workflow={{
          stage: "Pratica sotto controllo",
          priority: "Ordinaria",
          priorityVariant: "secondary",
          action: "Mantieni aggiornate Attività e Fatture.",
          reason: "Non ci sono avvisi operativi immediati.",
        }}
      />,
    );

    expect(screen.getByText("Regolare")).toBeTruthy();
  });

  it("non anticipa lo stato insoluto nel giorno di scadenza della Fattura", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 9, 12));

    const activities = [] as never;
    const invoices = [
      {
        id: "invoice-1",
        number: "TST1",
        year: 2026,
        issue_date: "2026-05-01",
        due_date: "2026-05-09",
        paid_at: null,
        status: "issued",
        total_amount: 150,
        notes: null,
      },
    ] as never;
    const workflow = buildDebtCollectionWorkflow({
      caseRow: {
        status: "in_progress",
      },
      activities,
      invoices,
      totals: summarizeCaseOperations(activities, invoices),
      qualityChecks: [{ severity: "ok" }],
    });

    expect(workflow).toMatchObject({
      stage: "Monitoraggio incasso",
      priority: "Media",
    });
  });

  it("valuta la scadenza Fattura come data locale anche con timestamp ISO", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 9, 23, 30));

    const activities = [] as never;
    const invoices = [
      {
        id: "invoice-1",
        number: "TST1",
        year: 2026,
        issue_date: "2026-05-01",
        due_date: "2026-05-09T00:00:00.000Z",
        paid_at: null,
        status: "issued",
        total_amount: 150,
        notes: null,
      },
    ] as never;
    const workflow = buildDebtCollectionWorkflow({
      caseRow: {
        status: "in_progress",
      },
      activities,
      invoices,
      totals: summarizeCaseOperations(activities, invoices),
      qualityChecks: [{ severity: "ok" }],
    });

    expect(workflow).toMatchObject({
      stage: "Monitoraggio incasso",
      priority: "Media",
    });
  });
});
