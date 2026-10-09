import {
  type PracticeListRow,
  type PraticheView,
  type PracticeActivitySummary,
  type PracticeWorkflowRow,
  type PraticheSortKey,
} from "@/components/practices/types";
import { type TableSort } from "@/lib/table-sorting";
import { PracticeMobileList } from "@/components/practices/practice-mobile-list";
import { PracticeTable } from "@/components/practices/practice-table";

export function PracticeResults({
  isLoading,
  rows,
  q,
  view,
  activitySummaryByCase,
  workflowByCase,
  sort,
  onSort,
  onOpen,
}: {
  isLoading: boolean;
  rows: PracticeListRow[];
  q: string;
  view: PraticheView;
  activitySummaryByCase: Record<string, PracticeActivitySummary>;
  workflowByCase: Record<string, PracticeWorkflowRow>;
  sort: TableSort<PraticheSortKey>;
  onSort: (columnKey: PraticheSortKey) => void;
  onOpen: (caseId: string) => void;
}) {
  const bodyProps = {
    isLoading,
    rows,
    hasFilters: !!q || view !== "open",
    activitySummaryByCase,
  };
  return (
    <>
      <div className="space-y-3 md:hidden">
        <PracticeMobileList {...bodyProps} workflowByCase={workflowByCase} />
      </div>
      <PracticeTable {...bodyProps} sort={sort} onSort={onSort} onOpen={onOpen} />
    </>
  );
}
