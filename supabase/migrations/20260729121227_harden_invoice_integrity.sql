CREATE UNIQUE INDEX IF NOT EXISTS invoice_lines_case_activity_unique
  ON public.invoice_lines (case_activity_id)
  WHERE case_activity_id IS NOT NULL;

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_client_id_fkey,
  DROP CONSTRAINT IF EXISTS cases_client_owner_fkey,
  ADD CONSTRAINT cases_client_owner_fkey
  FOREIGN KEY (client_id, user_id)
  REFERENCES public.clients(id, user_id)
  ON DELETE SET NULL (client_id);

ALTER TABLE public.case_status_history
  DROP CONSTRAINT IF EXISTS case_status_history_case_id_fkey,
  DROP CONSTRAINT IF EXISTS case_status_history_case_owner_fkey,
  ADD CONSTRAINT case_status_history_case_owner_fkey
  FOREIGN KEY (case_id, user_id)
  REFERENCES public.cases(id, user_id)
  ON DELETE CASCADE;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_client_id_fkey,
  DROP CONSTRAINT IF EXISTS invoices_client_owner_fkey,
  DROP CONSTRAINT IF EXISTS invoices_case_id_fkey,
  DROP CONSTRAINT IF EXISTS invoices_case_owner_fkey,
  ADD CONSTRAINT invoices_client_owner_fkey
  FOREIGN KEY (client_id, user_id)
  REFERENCES public.clients(id, user_id)
  ON DELETE RESTRICT,
  ADD CONSTRAINT invoices_case_owner_fkey
  FOREIGN KEY (case_id, user_id)
  REFERENCES public.cases(id, user_id)
  ON DELETE SET NULL (case_id);

ALTER TABLE public.invoice_lines
  DROP CONSTRAINT IF EXISTS invoice_lines_invoice_id_fkey,
  DROP CONSTRAINT IF EXISTS invoice_lines_invoice_owner_fkey,
  ADD CONSTRAINT invoice_lines_invoice_owner_fkey
  FOREIGN KEY (invoice_id, user_id)
  REFERENCES public.invoices(id, user_id)
  ON DELETE CASCADE;
