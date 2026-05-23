CREATE OR REPLACE FUNCTION public.set_invoice_issue_state(
  p_invoice_id uuid,
  p_issued boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_activity_status public.case_activity_status;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessione non valida.';
  END IF;

  IF p_issued THEN
    UPDATE public.invoices
    SET status = 'issued',
        paid_at = null
    WHERE id = p_invoice_id
      AND user_id = v_user_id
      AND status = 'draft'
    RETURNING id INTO v_invoice_id;

    IF v_invoice_id IS NULL THEN
      RAISE EXCEPTION 'Solo le fatture in bozza possono essere emesse';
    END IF;

    v_activity_status := 'invoiced';
  ELSE
    UPDATE public.invoices
    SET status = 'draft',
        paid_at = null
    WHERE id = p_invoice_id
      AND user_id = v_user_id
      AND status IN ('issued', 'overdue')
    RETURNING id INTO v_invoice_id;

    IF v_invoice_id IS NULL THEN
      RAISE EXCEPTION 'Solo le fatture emesse possono tornare in bozza';
    END IF;

    v_activity_status := 'to_invoice';
  END IF;

  UPDATE public.case_activities
  SET status = v_activity_status
  WHERE invoice_id = v_invoice_id
    AND user_id = v_user_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_invoice_issue_state(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_invoice_issue_state(uuid, boolean) TO authenticated;
