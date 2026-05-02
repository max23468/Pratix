CREATE INDEX IF NOT EXISTS idx_case_status_history_user
  ON public.case_status_history (user_id);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_user
  ON public.invoice_lines (user_id);
