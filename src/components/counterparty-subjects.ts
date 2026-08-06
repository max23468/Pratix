export type SubjectKind = "individual" | "company";
export type SubjectRow = {
  id?: string;
  kind: SubjectKind;
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  notes: string | null;
  position: number;
};
export type SubjectDraft = SubjectRow & { clientKey: string };

export const emptySubject = (position: number): SubjectDraft => ({
  clientKey: crypto.randomUUID(),
  kind: "individual",
  first_name: "",
  last_name: "",
  business_name: "",
  notes: "",
  position,
});
