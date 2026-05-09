export type ImportPreviewPlan = {
  action: "create" | "update" | "ignore";
  label: string;
  detail: string;
};

export type ExistingImportPractice = {
  id: string;
  practice_number: number;
  title: string | null;
};

export type ImportPlanCandidate = {
  rowNumber: number;
  normalized: {
    practice: {
      practiceNumber: number;
    };
  } | null;
  errors: string[];
  warnings: string[];
};

export function applyImportPreviewPlan<T extends ImportPlanCandidate>(
  rows: T[],
  existingPractices: ExistingImportPractice[],
) {
  const existingByPracticeNumber = new Map(
    existingPractices.map((practice) => [practice.practice_number, practice]),
  );
  const firstRowByPracticeNumber = new Map<number, number>();

  return rows.map((row) => {
    if (!row.normalized) {
      return {
        ...row,
        importPlan: {
          action: "ignore",
          label: "Ignorata",
          detail: "La riga contiene errori da correggere.",
        } satisfies ImportPreviewPlan,
      };
    }

    const practiceNumber = row.normalized.practice.practiceNumber;
    const existingPractice = existingByPracticeNumber.get(practiceNumber);
    const previousRow = firstRowByPracticeNumber.get(practiceNumber);

    if (existingPractice) {
      return {
        ...row,
        normalized: null,
        errors: [
          ...row.errors,
          `Pratica ${practiceNumber} già presente: aggiorna la pratica esistente o cambia numero prima di importare.`,
        ],
        importPlan: {
          action: "update",
          label: "Da aggiornare",
          detail: existingPractice.title
            ? `Già presente: ${existingPractice.title}`
            : "Pratica già presente in archivio.",
        } satisfies ImportPreviewPlan,
      };
    }

    if (previousRow) {
      return {
        ...row,
        normalized: null,
        errors: [
          ...row.errors,
          `Pratica ${practiceNumber} duplicata nel file: usa una sola riga per lo stesso numero pratica.`,
        ],
        importPlan: {
          action: "ignore",
          label: "Ignorata",
          detail: `Duplicata della riga ${previousRow}.`,
        } satisfies ImportPreviewPlan,
      };
    }

    firstRowByPracticeNumber.set(practiceNumber, row.rowNumber);
    return {
      ...row,
      importPlan: {
        action: "create",
        label: row.warnings.length > 0 ? "Da creare con avvisi" : "Da creare",
        detail: "Nuova pratica pronta per lo staging.",
      } satisfies ImportPreviewPlan,
    };
  });
}

export function summarizeImportPreviewPlan(rows: Array<{ importPlan: ImportPreviewPlan }>) {
  return rows.reduce(
    (summary, row) => {
      summary[row.importPlan.action] += 1;
      return summary;
    },
    { create: 0, update: 0, ignore: 0 },
  );
}
