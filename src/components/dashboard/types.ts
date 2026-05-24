import type { ComponentType } from "react";
import type { CaseDebtCollectionWorkflow } from "@/lib/case-workflow";
import type { DuplicateSummaryResult } from "@/server/duplicates.functions";

export type DashboardStatCardProps = {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  tone?: "default" | "danger" | "gold";
} & (
  | {
      to: "/pratiche";
      search?: { view?: "without_activities" | "to_complete" };
    }
  | {
      to: "/attivita";
      search?: {
        status?: "to_invoice";
        kind?: "expense_reimbursement";
        attachments?: "missing";
        sort?: "amount";
        dir?: "desc";
      };
    }
  | {
      to: "/fatture";
      search?: { status?: "draft" | "to_collect" | "expired" };
    }
);

export type WorkQueueItem = {
  caseRef: string;
  practiceNumber: number;
  updatedAt: string;
  stage: string;
  action: string;
  reason: string;
  priorityLabel: string;
  priorityVariant: CaseDebtCollectionWorkflow["priorityVariant"];
};

export type DuplicateSummary = DuplicateSummaryResult;
