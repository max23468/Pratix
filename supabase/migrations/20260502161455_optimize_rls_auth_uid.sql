-- Wrap auth.uid() calls in SELECT so Postgres can cache the value per statement
-- instead of evaluating it once per row in RLS policies.

ALTER POLICY profiles_select_own ON public.profiles
  USING ((select auth.uid()) = id);
ALTER POLICY profiles_insert_own ON public.profiles
  WITH CHECK ((select auth.uid()) = id);
ALTER POLICY profiles_update_own ON public.profiles
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY clients_select_own ON public.clients
  USING ((select auth.uid()) = user_id);
ALTER POLICY clients_insert_own ON public.clients
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY clients_update_own ON public.clients
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY clients_delete_own ON public.clients
  USING ((select auth.uid()) = user_id);

ALTER POLICY cases_select_own ON public.cases
  USING ((select auth.uid()) = user_id);
ALTER POLICY cases_insert_own ON public.cases
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY cases_update_own ON public.cases
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY cases_delete_own ON public.cases
  USING ((select auth.uid()) = user_id);

ALTER POLICY case_deadlines_select_own ON public.case_deadlines
  USING ((select auth.uid()) = user_id);
ALTER POLICY case_deadlines_insert_own ON public.case_deadlines
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY case_deadlines_update_own ON public.case_deadlines
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY case_deadlines_delete_own ON public.case_deadlines
  USING ((select auth.uid()) = user_id);

ALTER POLICY case_status_history_select_own ON public.case_status_history
  USING ((select auth.uid()) = user_id);
ALTER POLICY case_status_history_insert_own ON public.case_status_history
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY expenses_select_own ON public.expenses
  USING ((select auth.uid()) = user_id);
ALTER POLICY expenses_insert_own ON public.expenses
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY expenses_update_own ON public.expenses
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY expenses_delete_own ON public.expenses
  USING ((select auth.uid()) = user_id);

ALTER POLICY invoices_select_own ON public.invoices
  USING ((select auth.uid()) = user_id);
ALTER POLICY invoices_insert_own ON public.invoices
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY invoices_update_own ON public.invoices
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY invoices_delete_own ON public.invoices
  USING ((select auth.uid()) = user_id);

ALTER POLICY invoice_lines_select_own ON public.invoice_lines
  USING ((select auth.uid()) = user_id);
ALTER POLICY invoice_lines_insert_own ON public.invoice_lines
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY invoice_lines_update_own ON public.invoice_lines
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY invoice_lines_delete_own ON public.invoice_lines
  USING ((select auth.uid()) = user_id);
