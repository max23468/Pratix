import { Briefcase, Building2, FileInput, Receipt, Tags, User, Users } from "lucide-react";
import type { ComponentType } from "react";
import type { CaseDebtCollectionWorkflow } from "@/lib/case-workflow";
import type { DuplicateSummaryResult } from "@/server/duplicates.functions";

export type CreateActionPath =
  | "/pratiche/nuova"
  | "/committenti/nuovo"
  | "/clienti/nuovo"
  | "/controparti/nuova"
  | "/fatture/nuova"
  | "/prezzi/nuovo"
  | "/creazione-guidata";

export const CREATE_ACTIONS: Array<{
  to: CreateActionPath;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
}> = [
  {
    to: "/pratiche/nuova",
    icon: Briefcase,
    title: "Nuova pratica",
    description: "Apri una nuova pratica operativa",
  },
  {
    to: "/committenti/nuovo",
    icon: Building2,
    title: "Nuovo committente",
    description: "Aggiungi chi affida l'incarico",
  },
  {
    to: "/clienti/nuovo",
    icon: User,
    title: "Nuovo cliente",
    description: "Registra una nuova anagrafica",
  },
  {
    to: "/controparti/nuova",
    icon: Users,
    title: "Nuova controparte",
    description: "Crea persona, società o gruppo",
  },
  {
    to: "/fatture/nuova",
    icon: Receipt,
    title: "Nuova fattura",
    description: "Prepara un documento da emettere",
  },
  {
    to: "/prezzi/nuovo",
    icon: Tags,
    title: "Nuovi prezzi",
    description: "Crea un set annuale per committente",
  },
  {
    to: "/creazione-guidata",
    icon: FileInput,
    title: "Creazione guidata",
    description: "Trascrivi una pratica passo per passo",
  },
];

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
