export type DashboardStatsData = {
  casesWithoutActivities: number;
  casesToComplete: number;
  toInvoiceCount: number;
  toInvoiceAmount: number;
  draftInvoiceCount: number;
  invoicesToCollectAmount: number;
  overdueInvoiceCount: number;
  expenseWithoutAttachmentCount: number;
};

export type StatsGroupProps = {
  data?: DashboardStatsData;
  isLoading: boolean;
};
