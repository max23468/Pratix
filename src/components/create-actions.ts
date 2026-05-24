import { Briefcase, Building2, FileInput, Receipt, Tags, User, Users } from "lucide-react";
import type { ComponentType } from "react";

export type CreateActionPath =
  | "/pratiche/nuova"
  | "/committenti/nuovo"
  | "/clienti/nuovo"
  | "/controparti/nuova"
  | "/fatture/nuova"
  | "/prezzi/nuovo"
  | "/creazione-guidata";

export type CreateActionId =
  | "new-case"
  | "new-principal"
  | "new-client"
  | "new-counterparty"
  | "new-invoice"
  | "new-prices"
  | "guided-creation";

export type CreateAction = {
  id: CreateActionId;
  to: CreateActionPath;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
};

export const CREATE_ACTIONS: CreateAction[] = [
  {
    id: "new-case",
    to: "/pratiche/nuova",
    icon: Briefcase,
    title: "Nuova pratica",
    description: "Apri una nuova pratica operativa",
  },
  {
    id: "new-principal",
    to: "/committenti/nuovo",
    icon: Building2,
    title: "Nuovo committente",
    description: "Aggiungi chi affida l'incarico",
  },
  {
    id: "new-client",
    to: "/clienti/nuovo",
    icon: User,
    title: "Nuovo cliente",
    description: "Registra una nuova anagrafica",
  },
  {
    id: "new-counterparty",
    to: "/controparti/nuova",
    icon: Users,
    title: "Nuova controparte",
    description: "Crea persona, società o gruppo",
  },
  {
    id: "new-invoice",
    to: "/fatture/nuova",
    icon: Receipt,
    title: "Nuova fattura",
    description: "Prepara un documento da emettere",
  },
  {
    id: "new-prices",
    to: "/prezzi/nuovo",
    icon: Tags,
    title: "Nuovi prezzi",
    description: "Crea un set annuale per committente",
  },
  {
    id: "guided-creation",
    to: "/creazione-guidata",
    icon: FileInput,
    title: "Creazione guidata",
    description: "Trascrivi una pratica passo per passo",
  },
];
