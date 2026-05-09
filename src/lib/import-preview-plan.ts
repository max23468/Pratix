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
      existingCaseId?: string | null;
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
    const previousRow = firstRowByPracticeNumber.get(practiceNumber);

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

    const existingPractice = existingByPracticeNumber.get(practiceNumber);
    if (existingPractice) {
      return {
        ...row,
        normalized: {
          ...row.normalized,
          practice: {
            ...row.normalized.practice,
            existingCaseId: existingPractice.id,
          },
        },
        warnings: [
          ...row.warnings,
          `Pratica ${practiceNumber} già presente: verrà aggiornata senza duplicare le Attività già registrate.`,
        ],
        importPlan: {
          action: "update",
          label: "Da aggiornare",
          detail: existingPractice.title
            ? `Aggiorna: ${existingPractice.title}`
            : "Aggiorna la pratica già presente in archivio.",
        } satisfies ImportPreviewPlan,
      };
    }

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
