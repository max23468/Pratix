import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buildCaseTimelineItems } from "@/lib/case-timeline";
import { buildDebtCollectionWorkflow, summarizeCaseOperations } from "@/lib/case-workflow";
import { CaseTimeline } from "./case-operations-panel";

describe("case operations timeline", () => {
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
    });
  });
});
