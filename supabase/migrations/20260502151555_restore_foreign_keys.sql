DO $$
DECLARE
  constraint_def record;
BEGIN
  FOR constraint_def IN
    SELECT *
    FROM (VALUES
      (
        'profiles_id_fkey',
        'public.profiles',
        'ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE'
      ),
      (
        'clients_user_id_fkey',
        'public.clients',
        'ALTER TABLE public.clients ADD CONSTRAINT clients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
      ),
      (
        'cases_user_id_fkey',
        'public.cases',
        'ALTER TABLE public.cases ADD CONSTRAINT cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
      ),
      (
        'cases_client_id_fkey',
        'public.cases',
        'ALTER TABLE public.cases ADD CONSTRAINT cases_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL'
      ),
      (
        'case_status_history_case_id_fkey',
        'public.case_status_history',
        'ALTER TABLE public.case_status_history ADD CONSTRAINT case_status_history_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE'
      ),
      (
        'case_status_history_user_id_fkey',
        'public.case_status_history',
        'ALTER TABLE public.case_status_history ADD CONSTRAINT case_status_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
      ),
      (
        'case_deadlines_case_id_fkey',
        'public.case_deadlines',
        'ALTER TABLE public.case_deadlines ADD CONSTRAINT case_deadlines_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE'
      ),
      (
        'case_deadlines_user_id_fkey',
        'public.case_deadlines',
        'ALTER TABLE public.case_deadlines ADD CONSTRAINT case_deadlines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
      ),
      (
        'expenses_case_id_fkey',
        'public.expenses',
        'ALTER TABLE public.expenses ADD CONSTRAINT expenses_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE'
      ),
      (
        'expenses_user_id_fkey',
        'public.expenses',
        'ALTER TABLE public.expenses ADD CONSTRAINT expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
      ),
      (
        'invoices_user_id_fkey',
        'public.invoices',
        'ALTER TABLE public.invoices ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
      ),
      (
        'invoices_client_id_fkey',
        'public.invoices',
        'ALTER TABLE public.invoices ADD CONSTRAINT invoices_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT'
      ),
      (
        'invoices_case_id_fkey',
        'public.invoices',
        'ALTER TABLE public.invoices ADD CONSTRAINT invoices_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL'
      ),
      (
        'expenses_invoice_fk',
        'public.expenses',
        'ALTER TABLE public.expenses ADD CONSTRAINT expenses_invoice_fk FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL'
      ),
      (
        'invoice_lines_invoice_id_fkey',
        'public.invoice_lines',
        'ALTER TABLE public.invoice_lines ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE'
      ),
      (
        'invoice_lines_user_id_fkey',
        'public.invoice_lines',
        'ALTER TABLE public.invoice_lines ADD CONSTRAINT invoice_lines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'
      )
    ) AS constraints_to_add(name, table_name, statement_sql)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = constraint_def.name
        AND conrelid = constraint_def.table_name::regclass
    ) THEN
      EXECUTE constraint_def.statement_sql;
    END IF;
  END LOOP;
END $$;
