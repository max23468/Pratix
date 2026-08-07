CREATE OR REPLACE FUNCTION public.save_billing_invoice(
  p_request_id uuid,
  p_invoice_id uuid,
  p_principal_id uuid,
  p_period_start date,
  p_period_end date,
  p_issue_date date,
  p_due_date date,
  p_status public.invoice_status,
  p_include_general_expenses boolean,
  p_general_expenses_rate numeric,
  p_compensation_total numeric,
  p_general_expenses_amount numeric,
  p_cassa_rate numeric,
  p_cassa_base_amount numeric,
  p_cassa_amount numeric,
  p_reimbursements_total numeric,
  p_vat_rate numeric,
  p_withholding_rate numeric,
  p_apply_withholding boolean,
  p_vat_amount numeric,
  p_withholding_amount numeric,
  p_stamp_amount numeric,
  p_total_amount numeric,
  p_net_to_pay numeric,
  p_payment_method text,
  p_notes text,
  p_client_id uuid,
  p_case_id uuid,
  p_postponed_until date,
  p_lines jsonb,
  p_items jsonb,
  p_exports jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_billing_run_id uuid;
  v_public_code text;
  v_number text;
  v_year integer;
  v_prefix text;
  v_next_number integer;
  v_item_count integer;
  v_new_run boolean := p_invoice_id IS NULL;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'request id is required';
  END IF;
  IF p_status NOT IN ('draft', 'issued') THEN
    RAISE EXCEPTION 'invalid invoice status';
  END IF;
  IF p_period_end < p_period_start THEN
    RAISE EXCEPTION 'invalid billing period';
  END IF;
  IF jsonb_typeof(p_lines) <> 'array'
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_typeof(p_exports) <> 'array' THEN
    RAISE EXCEPTION 'invalid billing payload';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'at least one billing item is required';
  END IF;

  IF v_new_run THEN
    SELECT i.id, i.billing_run_id, i.public_code, i.number, i.year
      INTO v_invoice_id, v_billing_run_id, v_public_code, v_number, v_year
    FROM public.billing_runs br
    JOIN public.invoices i
      ON i.id = br.invoice_id
     AND i.user_id = br.user_id
    WHERE br.user_id = v_user_id
      AND br.request_id = p_request_id;

    IF v_invoice_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'invoiceId', v_invoice_id,
        'invoiceRef', v_public_code,
        'billingRunId', v_billing_run_id,
        'number', v_number,
        'year', v_year,
        'exports', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', be.id,
            'kind', be.kind,
            'file_name', be.file_name,
            'storage_path', be.storage_path,
            'storage_status', be.storage_status
          ) ORDER BY be.kind), '[]'::jsonb)
          FROM public.billing_exports be
          WHERE be.billing_run_id = v_billing_run_id
            AND be.user_id = v_user_id
        )
      );
    END IF;
  ELSE
    SELECT i.id, i.billing_run_id, i.public_code, i.number, i.year
      INTO v_invoice_id, v_billing_run_id, v_public_code, v_number, v_year
    FROM public.invoices i
    WHERE i.id = p_invoice_id
      AND i.user_id = v_user_id
      AND i.status = 'draft'
    FOR UPDATE;

    IF v_invoice_id IS NULL OR v_billing_run_id IS NULL THEN
      RAISE EXCEPTION 'draft invoice not found';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.principals p
    WHERE p.id = p_principal_id
      AND p.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'principal not found';
  END IF;

  SELECT count(*)
    INTO v_item_count
  FROM (
    SELECT DISTINCT item.activity_id
    FROM jsonb_to_recordset(p_items) AS item(activity_id uuid, status public.billing_run_item_status)
  ) requested;

  IF v_item_count <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION 'duplicate billing activities';
  END IF;

  PERFORM ca.id
  FROM public.case_activities ca
  JOIN jsonb_to_recordset(p_items)
    AS item(activity_id uuid, status public.billing_run_item_status)
    ON item.activity_id = ca.id
  WHERE ca.user_id = v_user_id
    AND ca.principal_id = p_principal_id
  FOR UPDATE;

  IF NOT FOUND OR (
    SELECT count(*)
    FROM public.case_activities ca
    JOIN jsonb_to_recordset(p_items)
      AS item(activity_id uuid, status public.billing_run_item_status)
      ON item.activity_id = ca.id
    WHERE ca.user_id = v_user_id
      AND ca.principal_id = p_principal_id
  ) <> v_item_count THEN
    RAISE EXCEPTION 'one or more activities are unavailable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_items)
      AS item(activity_id uuid, status public.billing_run_item_status)
    WHERE item.status = 'included'
  ) THEN
    RAISE EXCEPTION 'at least one included activity is required';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.case_activities ca
    JOIN jsonb_to_recordset(p_items)
      AS item(activity_id uuid, status public.billing_run_item_status)
      ON item.activity_id = ca.id
    WHERE item.status = 'included'
      AND NOT (
        (ca.status = 'to_invoice' AND ca.invoice_id IS NULL)
        OR (NOT v_new_run AND ca.invoice_id = v_invoice_id)
      )
  ) THEN
    RAISE EXCEPTION 'one or more included activities are already invoiced';
  END IF;

  IF v_new_run THEN
    INSERT INTO public.billing_runs (
      user_id, principal_id, period_start, period_end, status,
      include_general_expenses, general_expenses_rate, compensation_total,
      general_expenses_amount, cassa_rate, cassa_base_amount, cassa_amount,
      reimbursements_total, notes, request_id
    ) VALUES (
      v_user_id, p_principal_id, p_period_start, p_period_end, 'finalized',
      p_include_general_expenses, p_general_expenses_rate, p_compensation_total,
      p_general_expenses_amount, p_cassa_rate, p_cassa_base_amount, p_cassa_amount,
      p_reimbursements_total, nullif(btrim(p_notes), ''), p_request_id
    )
    ON CONFLICT (user_id, request_id) WHERE request_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_billing_run_id;

    IF v_billing_run_id IS NULL THEN
      SELECT i.id, i.billing_run_id, i.public_code, i.number, i.year
        INTO v_invoice_id, v_billing_run_id, v_public_code, v_number, v_year
      FROM public.billing_runs br
      JOIN public.invoices i
        ON i.id = br.invoice_id
       AND i.user_id = br.user_id
      WHERE br.user_id = v_user_id
        AND br.request_id = p_request_id;

      IF v_invoice_id IS NULL THEN
        RAISE EXCEPTION 'billing request is already in progress';
      END IF;

      RETURN jsonb_build_object(
        'invoiceId', v_invoice_id,
        'invoiceRef', v_public_code,
        'billingRunId', v_billing_run_id,
        'number', v_number,
        'year', v_year,
        'exports', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'id', be.id,
            'kind', be.kind,
            'file_name', be.file_name,
            'storage_path', be.storage_path,
            'storage_status', be.storage_status
          ) ORDER BY be.kind), '[]'::jsonb)
          FROM public.billing_exports be
          WHERE be.billing_run_id = v_billing_run_id
            AND be.user_id = v_user_id
        )
      );
    END IF;

    SELECT invoice_year, invoice_next_number, coalesce(invoice_number_prefix, '')
      INTO v_year, v_next_number, v_prefix
    FROM public.profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF v_year IS NULL THEN
      RAISE EXCEPTION 'profile required for invoice numbering';
    END IF;
    IF v_year <> extract(year FROM current_date)::integer THEN
      v_year := extract(year FROM current_date)::integer;
      v_next_number := 1;
    END IF;
    v_number := v_prefix || v_next_number::text;

    UPDATE public.profiles
    SET invoice_year = v_year,
        invoice_next_number = v_next_number + 1
    WHERE id = v_user_id;

    INSERT INTO public.invoices (
      user_id, client_id, case_id, principal_id, billing_run_id, number, year,
      issue_date, due_date, status, cassa_rate, vat_rate, withholding_rate,
      apply_withholding, taxable_fees, art15_expenses, general_expenses_amount,
      general_expenses_rate, include_general_expenses, cassa_base_amount,
      cassa_amount, vat_amount, withholding_amount, stamp_amount, total_amount,
      net_to_pay, payment_method, notes
    ) VALUES (
      v_user_id, p_client_id, p_case_id, p_principal_id, v_billing_run_id,
      v_number, v_year, p_issue_date, p_due_date, p_status, p_cassa_rate,
      p_vat_rate, p_withholding_rate, p_apply_withholding, p_compensation_total,
      p_reimbursements_total, p_general_expenses_amount, p_general_expenses_rate,
      p_include_general_expenses, p_cassa_base_amount, p_cassa_amount, p_vat_amount,
      p_withholding_amount, p_stamp_amount, p_total_amount, p_net_to_pay,
      nullif(btrim(p_payment_method), ''), nullif(btrim(p_notes), '')
    )
    RETURNING id, public_code INTO v_invoice_id, v_public_code;
  ELSE
    UPDATE public.case_activities
    SET status = 'to_invoice', invoice_id = NULL
    WHERE user_id = v_user_id
      AND invoice_id = v_invoice_id;

    UPDATE public.billing_runs
    SET request_id = p_request_id,
        principal_id = p_principal_id,
        period_start = p_period_start,
        period_end = p_period_end,
        status = 'finalized',
        include_general_expenses = p_include_general_expenses,
        general_expenses_rate = p_general_expenses_rate,
        compensation_total = p_compensation_total,
        general_expenses_amount = p_general_expenses_amount,
        cassa_rate = p_cassa_rate,
        cassa_base_amount = p_cassa_base_amount,
        cassa_amount = p_cassa_amount,
        reimbursements_total = p_reimbursements_total,
        notes = nullif(btrim(p_notes), '')
    WHERE id = v_billing_run_id
      AND user_id = v_user_id;

    UPDATE public.invoices
    SET client_id = p_client_id,
        case_id = p_case_id,
        principal_id = p_principal_id,
        issue_date = p_issue_date,
        due_date = p_due_date,
        status = p_status,
        paid_at = NULL,
        cassa_rate = p_cassa_rate,
        vat_rate = p_vat_rate,
        withholding_rate = p_withholding_rate,
        apply_withholding = p_apply_withholding,
        taxable_fees = p_compensation_total,
        art15_expenses = p_reimbursements_total,
        general_expenses_amount = p_general_expenses_amount,
        general_expenses_rate = p_general_expenses_rate,
        include_general_expenses = p_include_general_expenses,
        cassa_base_amount = p_cassa_base_amount,
        cassa_amount = p_cassa_amount,
        vat_amount = p_vat_amount,
        withholding_amount = p_withholding_amount,
        stamp_amount = p_stamp_amount,
        total_amount = p_total_amount,
        net_to_pay = p_net_to_pay,
        payment_method = nullif(btrim(p_payment_method), ''),
        notes = nullif(btrim(p_notes), '')
    WHERE id = v_invoice_id
      AND user_id = v_user_id;

    DELETE FROM public.invoice_lines
    WHERE invoice_id = v_invoice_id
      AND user_id = v_user_id;
  END IF;

  UPDATE public.case_activities ca
  SET postponed_until = p_postponed_until,
      postponed_count = CASE
        WHEN previous.status = 'postponed' THEN ca.postponed_count
        ELSE ca.postponed_count + 1
      END
  FROM jsonb_to_recordset(p_items)
    AS item(activity_id uuid, status public.billing_run_item_status, notes text)
  LEFT JOIN public.billing_run_items previous
    ON previous.billing_run_id = v_billing_run_id
   AND previous.activity_id = item.activity_id
  WHERE ca.id = item.activity_id
    AND ca.user_id = v_user_id
    AND item.status = 'postponed';

  DELETE FROM public.billing_run_items
  WHERE billing_run_id = v_billing_run_id
    AND user_id = v_user_id;

  INSERT INTO public.billing_run_items (user_id, billing_run_id, activity_id, status, notes)
  SELECT v_user_id, v_billing_run_id, item.activity_id, item.status,
         nullif(btrim(item.notes), '')
  FROM jsonb_to_recordset(p_items)
    AS item(activity_id uuid, status public.billing_run_item_status, notes text);

  INSERT INTO public.invoice_lines (
    user_id, invoice_id, position, case_activity_id, practice_number,
    client_name, counterparty_name, activity_date, kind, description,
    quantity, unit_price, amount
  )
  SELECT v_user_id, v_invoice_id, line.position, line.case_activity_id,
         line.practice_number, line.client_name, line.counterparty_name,
         line.activity_date, line.kind, line.description, line.quantity,
         line.unit_price, line.amount
  FROM jsonb_to_recordset(p_lines) AS line(
    position integer,
    case_activity_id uuid,
    practice_number integer,
    client_name text,
    counterparty_name text,
    activity_date date,
    kind public.invoice_line_kind,
    description text,
    quantity numeric,
    unit_price numeric,
    amount numeric
  );

  UPDATE public.case_activities ca
  SET status = CASE WHEN p_status = 'issued' THEN 'invoiced'::public.case_activity_status
                    ELSE 'to_invoice'::public.case_activity_status END,
      invoice_id = v_invoice_id,
      postponed_until = NULL
  FROM jsonb_to_recordset(p_items)
    AS item(activity_id uuid, status public.billing_run_item_status)
  WHERE ca.id = item.activity_id
    AND ca.user_id = v_user_id
    AND item.status = 'included';

  INSERT INTO public.billing_exports (
    user_id, billing_run_id, invoice_id, kind, storage_path, file_name,
    mime_type, size_bytes, storage_status
  )
  SELECT v_user_id, v_billing_run_id, v_invoice_id, export.kind,
         coalesce(existing.storage_path, export.storage_path), export.file_name,
         export.mime_type, export.size_bytes, 'pending'
  FROM jsonb_to_recordset(p_exports) AS export(
    kind public.billing_export_kind,
    storage_path text,
    file_name text,
    mime_type text,
    size_bytes bigint
  )
  LEFT JOIN public.billing_exports existing
    ON existing.billing_run_id = v_billing_run_id
   AND existing.kind = export.kind
  ON CONFLICT (billing_run_id, kind) DO UPDATE
  SET invoice_id = excluded.invoice_id,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      size_bytes = excluded.size_bytes,
      storage_status = 'pending',
      generated_at = now();

  UPDATE public.billing_runs
  SET invoice_id = v_invoice_id
  WHERE id = v_billing_run_id
    AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'invoiceId', v_invoice_id,
    'invoiceRef', v_public_code,
    'billingRunId', v_billing_run_id,
    'number', v_number,
    'year', v_year,
    'exports', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', be.id,
        'kind', be.kind,
        'file_name', be.file_name,
        'storage_path', be.storage_path,
        'storage_status', be.storage_status
      ) ORDER BY be.kind), '[]'::jsonb)
      FROM public.billing_exports be
      WHERE be.billing_run_id = v_billing_run_id
        AND be.user_id = v_user_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_billing_invoice(
  uuid, uuid, uuid, date, date, date, date, public.invoice_status,
  boolean, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, boolean, numeric, numeric, numeric, numeric, numeric,
  text, text, uuid, uuid, date, jsonb, jsonb, jsonb
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_billing_invoice(
  uuid, uuid, uuid, date, date, date, date, public.invoice_status,
  boolean, numeric, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, boolean, numeric, numeric, numeric, numeric, numeric,
  text, text, uuid, uuid, date, jsonb, jsonb, jsonb
) TO authenticated;

