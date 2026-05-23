import { describe, expect, it, vi } from "vitest";
import {
  buildCaseWorkflowQualityChecks,
  buildDebtCollectionWorkflow,
  summarizeCaseOperations,
  type CaseWorkflowActivity,
  type CaseWorkflowInvoice,
  type CaseWorkflowQualityCheck,
} from "./case-workflow";

describe("case workflow", () => {
  it("calcola totali operativi e controlli qualità completi", () => {
    const activities: CaseWorkflowActivity[] = [
      {
        status: "to_invoice",
        kind: "fee",
        amount: 100,
        needs_review: true,
        invoice_id: null,
        activity_attachments: [],
      },
      {
        status: "to_invoice",
        kind: "fee",
        amount: 70,
        needs_review: false,
        invoice_id: "invoice-draft-1",
        activity_attachments: [],
      },
      {
        status: "invoiced",
        kind: "expense_reimbursement",
        amount: 30,
        needs_review: false,
        activity_attachments: ["scontrino.pdf"],
      },
    ];
    const invoices: CaseWorkflowInvoice[] = [
      { status: "draft", due_date: null, total_amount: 30 },
      { status: "paid", due_date: "2026-05-01", total_amount: 20 },
    ];

    const totals = summarizeCaseOperations(activities, invoices);
    const checks = buildCaseWorkflowQualityChecks({
      caseRow: { status: "in_progress" },
      activities,
      invoices,
      totals,
    });

    expect(totals).toMatchObject({
      toInvoice: 100,
      fees: 170,
      reimbursements: 30,
      attachments: 1,
      matured: 200,
      invoiceTotal: 50,
      paidTotal: 20,
      residual: 180,
    });
    expect(checks.map((check) => check.id)).toEqual([
      "missing-principal",
      "missing-client",
      "missing-counterparty",
      "to-invoice",
      "activities-to-review",
      "missing-attachments",
      "draft-invoices",
    ]);
  });

  it("restituisce stato ordinario per pratiche chiuse o già complete", () => {
    const emptyTotals = summarizeCaseOperations([], []);

    expect(
      buildDebtCollectionWorkflow({
        caseRow: { status: "closed" },
        activities: [],
        invoices: [],
        totals: emptyTotals,
        qualityChecks: [],
      }),
    ).toMatchObject({
      stage: "Chiusura e archivio",
      priority: "Ordinaria",
    });

    expect(
      buildDebtCollectionWorkflow({
        caseRow: {
          status: "in_progress",
          principal_id: "principal-1",
          client_id: "client-1",
          counterparty_id: "counterparty-1",
        },
        activities: [{ status: "invoiced", kind: "fee", amount: 50, needs_review: false }],
        invoices: [{ status: "paid", due_date: "2026-05-01", total_amount: 50 }],
        totals: summarizeCaseOperations(
          [{ status: "invoiced", kind: "fee", amount: 50, needs_review: false }],
          [{ status: "paid", due_date: "2026-05-01", total_amount: 50 }],
        ),
        qualityChecks: [{ severity: "ok" }],
      }),
    ).toMatchObject({
      stage: "Pratica sotto controllo",
      priority: "Ordinaria",
    });
  });

  it("distingue impostazione, completamento dati, bozze e monitoraggio incasso", () => {
    const warningWithoutTitle: CaseWorkflowQualityCheck = { severity: "warning" };

    expect(
      buildDebtCollectionWorkflow({
        caseRow: { status: "in_progress" },
        activities: [],
        invoices: [],
        totals: summarizeCaseOperations([], []),
        qualityChecks: [warningWithoutTitle],
      }).priorityInsight?.items,
    ).toEqual(["Dati essenziali incompleti"]);

    expect(
      buildDebtCollectionWorkflow({
        caseRow: { status: "in_progress" },
        activities: [{ status: "invoiced", kind: "fee", amount: 10, needs_review: false }],
        invoices: [],
        totals: summarizeCaseOperations(
          [{ status: "invoiced", kind: "fee", amount: 10, needs_review: false }],
          [],
        ),
        qualityChecks: [{ severity: "warning", title: "Dato mancante" }],
      }),
    ).toMatchObject({
      stage: "Completamento dati",
      priority: "Media",
    });

    expect(
      buildDebtCollectionWorkflow({
        caseRow: { status: "in_progress" },
        activities: [],
        invoices: [{ status: "draft", due_date: null, total_amount: 10 }],
        totals: summarizeCaseOperations(
          [],
          [{ status: "draft", due_date: null, total_amount: 10 }],
        ),
        qualityChecks: [{ severity: "ok" }],
      }),
    ).toMatchObject({
      stage: "Emissione Fattura",
      priority: "Media",
    });
  });

  it("legge scadenze insolute da status e formati data non standard", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 12));

    const invoices: CaseWorkflowInvoice[] = [
      { status: "issued", due_date: "2026-5-09", total_amount: 40 },
      { status: "overdue", due_date: null, total_amount: 60 },
    ];
    const workflow = buildDebtCollectionWorkflow({
      caseRow: { status: "in_progress" },
      activities: [],
      invoices,
      totals: summarizeCaseOperations([], invoices),
      qualityChecks: [{ severity: "ok" }],
    });

    expect(workflow).toMatchObject({
      stage: "Recupero incasso",
      priority: "Alta",
    });
    expect(workflow.reason).toContain("100,00");
    expect(workflow.priorityInsight?.items[0]).toContain("100,00");
    expect(workflow.priorityInsight?.items[1]).toBe("2 Fatture insolute");

    vi.useRealTimers();
  });
});
