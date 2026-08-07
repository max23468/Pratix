-- =============================================================================
-- Pratix — Schema baseline
-- =============================================================================
-- Aggiornato: 2026-05-24 (bonifica residui legacy pre-focus recupero crediti)
-- Sorgente:  introspezione del database di produzione iniziale,
--            integrata con il trigger auth richiesto per il progetto Supabase.
--
-- Cosa è questo file
-- ------------------
-- Snapshot dello schema corrente (solo struttura, ZERO dati). Serve come
-- riferimento leggibile a colpo d'occhio di tabelle, enum, trigger, indici e
-- policy RLS. Lo aggiorniamo manualmente quando applichiamo migrations.
--
-- Cosa NON è
-- ----------
-- - Non è eseguito automaticamente su Supabase: le migrations vere si
--   applicano via Supabase CLI e sono storicizzate in `supabase/migrations/`.
-- - Non contiene oggetti gestiti da Supabase (storage.*, realtime.*). Include
--   solo il trigger su auth.users necessario a creare profiles alla signup.
-- - Non contiene dati: per esportare dati usa Cloud → Database → Tables.
--
-- Convenzioni
-- -----------
-- - Tutti i timestamp `*_at` sono `timestamp with time zone`.
-- - Ogni tabella user-owned ha colonna `user_id uuid` + 4 policy RLS
--   (select/insert/update/delete) su `(select auth.uid()) = user_id`.
-- - `profiles.id` coincide con `auth.users.id` (riempita dal trigger
--   `on_auth_user_created` su `auth.users`).
-- =============================================================================


-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE public.case_status AS ENUM (
  'open', 'in_progress', 'suspended', 'closed', 'archived'
);

CREATE TYPE public.client_kind AS ENUM ('individual', 'company');

CREATE TYPE public.invoice_line_kind AS ENUM (
  'fee', 'expense_art15'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft', 'issued', 'paid', 'overdue'
);

CREATE TYPE public.tax_regime AS ENUM ('ordinario', 'forfettario');

CREATE TYPE public.counterparty_kind AS ENUM ('individual', 'company', 'group');

CREATE TYPE public.price_book_status AS ENUM ('draft', 'active', 'archived');

CREATE TYPE public.price_item_kind AS ENUM ('fee', 'expense_reimbursement');

CREATE TYPE public.case_activity_status AS ENUM ('to_invoice', 'invoiced');

CREATE TYPE public.billing_run_status AS ENUM ('draft', 'finalized', 'cancelled');

CREATE TYPE public.billing_run_item_status AS ENUM ('included', 'postponed', 'excluded');

CREATE TYPE public.billing_export_kind AS ENUM ('fees', 'expenses');

CREATE TYPE public.import_mode AS ENUM ('manual', 'excel');

CREATE TYPE public.import_status AS ENUM ('draft', 'validated', 'imported', 'cancelled');

CREATE TYPE public.import_row_status AS ENUM ('pending', 'valid', 'warning', 'error', 'imported', 'skipped');


-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Riempie `profiles` quando un nuovo utente si registra in `auth.users`.
-- Trigger associato: `on_auth_user_created` su auth.users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- Aggiorna automaticamente updated_at su UPDATE.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Storicizza i cambi di stato di una pratica in case_status_history.
CREATE OR REPLACE FUNCTION public.log_case_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.case_status_history (case_id, user_id, previous_status, new_status)
    VALUES (NEW.id, NEW.user_id, NULL, NEW.status);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.case_status_history (case_id, user_id, previous_status, new_status)
    VALUES (NEW.id, NEW.user_id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

-- Genera o valida il numero pratica numerico.
CREATE OR REPLACE FUNCTION public.assign_case_practice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_number integer;
BEGIN
  IF NEW.practice_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

    SELECT COALESCE(MAX(practice_number), 0) + 1
    INTO next_number
    FROM public.cases
    WHERE user_id = NEW.user_id;

    NEW.practice_number := next_number;
  END IF;

  IF NEW.practice_number <= 0 THEN
    RAISE EXCEPTION 'practice_number must be positive';
  END IF;

  RETURN NEW;
END;
$$;

-- Espone il prossimo numero pratica suggerito all'utente autenticato.
CREATE OR REPLACE FUNCTION public.get_next_practice_number()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  next_number integer;
BEGIN
  current_user_id := (select auth.uid());

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));

  SELECT COALESCE(MAX(practice_number), 0) + 1
  INTO next_number
  FROM public.cases
  WHERE user_id = current_user_id;

  RETURN next_number;
END;
$$;

-- Genera codici pubblici stabili per URL leggibili e non sensibili.
CREATE OR REPLACE FUNCTION public.assign_public_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prefix text;
  counter_column text;
  next_number integer;
BEGIN
  prefix := TG_ARGV[0];
  counter_column := TG_ARGV[1];

  IF prefix IS NULL OR prefix !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'public_code prefix must be two uppercase letters';
  END IF;

  IF counter_column NOT IN (
    'client_public_code_next_number',
    'principal_public_code_next_number',
    'counterparty_public_code_next_number',
    'case_public_code_next_number',
    'price_book_public_code_next_number',
    'invoice_public_code_next_number'
  ) THEN
    RAISE EXCEPTION 'invalid public_code counter column';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.public_code := OLD.public_code;
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('public_code:' || NEW.user_id::text || ':' || prefix, 0));

  EXECUTE format('SELECT %I FROM public.profiles WHERE id = $1 FOR UPDATE', counter_column)
  INTO next_number
  USING NEW.user_id;

  IF next_number IS NULL THEN
    RAISE EXCEPTION 'profile required for public_code generation';
  END IF;

  NEW.public_code := prefix || '-' || lpad(next_number::text, 5, '0');

  EXECUTE format('UPDATE public.profiles SET %I = $2 WHERE id = $1', counter_column)
  USING NEW.user_id, next_number + 1;

  RETURN NEW;
END;
$$;

-- Conferma una riga di Creazione guidata in una singola transazione database.
CREATE OR REPLACE FUNCTION public.apply_import_row(p_import_row_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_import_id uuid;
  v_normalized jsonb;
  v_principal_id uuid;
  v_client_id uuid;
  v_counterparty_id uuid;
  v_case_id uuid;
  v_existing_case_id uuid;
  v_activity_id uuid;
  v_activity jsonb;
  v_hearing_date text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessione non valida.';
  END IF;

  SELECT import_id, normalized_data
    INTO v_import_id, v_normalized
  FROM public.import_rows
  WHERE id = p_import_row_id
    AND user_id = v_user_id
    AND status IN ('valid', 'warning');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Riga di creazione guidata non trovata o non confermabile.';
  END IF;

  IF v_normalized IS NULL OR v_normalized = '{}'::jsonb THEN
    RAISE EXCEPTION 'Riga di creazione guidata senza dati normalizzati.';
  END IF;

  IF v_normalized #>> '{principal,mode}' = 'existing' THEN
    SELECT id INTO v_principal_id
    FROM public.principals
    WHERE id = (v_normalized #>> '{principal,id}')::uuid
      AND user_id = v_user_id;

    IF v_principal_id IS NULL THEN
      RAISE EXCEPTION 'Committente non trovato.';
    END IF;
  ELSE
    INSERT INTO public.principals (
      user_id,
      business_name,
      fees_enabled,
      expense_reimbursements_enabled,
      default_general_expenses_rate,
      default_cassa_rate,
      address_country
    )
    VALUES (
      v_user_id,
      v_normalized #>> '{principal,name}',
      true,
      true,
      10,
      4,
      'IT'
    )
    RETURNING id INTO v_principal_id;
  END IF;

  IF v_normalized #>> '{client,mode}' = 'existing' THEN
    SELECT id INTO v_client_id
    FROM public.clients
    WHERE id = (v_normalized #>> '{client,id}')::uuid
      AND user_id = v_user_id;

    IF v_client_id IS NULL THEN
      RAISE EXCEPTION 'Cliente non trovato.';
    END IF;
  ELSE
    INSERT INTO public.clients (
      user_id,
      kind,
      first_name,
      last_name,
      business_name
    )
    VALUES (
      v_user_id,
      (v_normalized #>> '{client,kind}')::public.client_kind,
      CASE WHEN v_normalized #>> '{client,kind}' = 'individual'
        THEN nullif(v_normalized #>> '{client,firstName}', '') ELSE NULL END,
      CASE WHEN v_normalized #>> '{client,kind}' = 'individual'
        THEN nullif(v_normalized #>> '{client,lastName}', '') ELSE NULL END,
      CASE WHEN v_normalized #>> '{client,kind}' = 'company'
        THEN nullif(v_normalized #>> '{client,businessName}', '') ELSE NULL END
    )
    RETURNING id INTO v_client_id;
  END IF;

  IF v_normalized #>> '{counterparty,mode}' = 'existing' THEN
    SELECT id INTO v_counterparty_id
    FROM public.counterparties
    WHERE id = (v_normalized #>> '{counterparty,id}')::uuid
      AND user_id = v_user_id;

    IF v_counterparty_id IS NULL THEN
      RAISE EXCEPTION 'Controparte non trovata.';
    END IF;
  ELSE
    INSERT INTO public.counterparties (
      user_id,
      kind,
      first_name,
      last_name,
      business_name,
      notes
    )
    VALUES (
      v_user_id,
      (v_normalized #>> '{counterparty,kind}')::public.counterparty_kind,
      CASE WHEN v_normalized #>> '{counterparty,kind}' = 'individual'
        THEN nullif(v_normalized #>> '{counterparty,firstName}', '') ELSE NULL END,
      CASE WHEN v_normalized #>> '{counterparty,kind}' = 'individual'
        THEN nullif(v_normalized #>> '{counterparty,lastName}', '') ELSE NULL END,
      CASE WHEN v_normalized #>> '{counterparty,kind}' <> 'individual'
        THEN nullif(v_normalized #>> '{counterparty,businessName}', '') ELSE NULL END,
      nullif(v_normalized #>> '{counterparty,notes}', '')
    )
    RETURNING id INTO v_counterparty_id;
  END IF;

  INSERT INTO public.principal_clients (user_id, principal_id, client_id, active_from)
  VALUES (v_user_id, v_principal_id, v_client_id, (v_normalized #>> '{practice,openedAt}')::date)
  ON CONFLICT (user_id, principal_id, client_id)
  DO UPDATE SET
    active_from = coalesce(public.principal_clients.active_from, excluded.active_from),
    updated_at = now();

  v_existing_case_id := nullif(v_normalized #>> '{practice,existingCaseId}', '')::uuid;

  IF v_existing_case_id IS NOT NULL THEN
    SELECT id INTO v_case_id
    FROM public.cases
    WHERE id = v_existing_case_id
      AND user_id = v_user_id
      AND practice_number = (v_normalized #>> '{practice,practiceNumber}')::integer;

    IF v_case_id IS NULL THEN
      RAISE EXCEPTION 'Pratica esistente non trovata per aggiornamento.';
    END IF;

    UPDATE public.cases
    SET principal_id = v_principal_id,
        client_id = v_client_id,
        counterparty_id = v_counterparty_id,
        status = (v_normalized #>> '{practice,status}')::public.case_status,
        authority = nullif(v_normalized #>> '{practice,authority}', ''),
        rg_number = nullif(v_normalized #>> '{practice,rgNumber}', ''),
        opened_at = (v_normalized #>> '{practice,openedAt}')::date,
        closed_at = nullif(v_normalized #>> '{practice,closedAt}', '')::date,
        notes = nullif(v_normalized #>> '{practice,notes}', '')
    WHERE id = v_case_id
      AND user_id = v_user_id
    RETURNING id INTO v_case_id;
  ELSE
    INSERT INTO public.cases (
      user_id, principal_id, client_id, counterparty_id, practice_number,
      status, authority, rg_number, opened_at, closed_at, notes
    )
    VALUES (
      v_user_id, v_principal_id, v_client_id, v_counterparty_id,
      (v_normalized #>> '{practice,practiceNumber}')::integer,
      (v_normalized #>> '{practice,status}')::public.case_status,
      nullif(v_normalized #>> '{practice,authority}', ''),
      nullif(v_normalized #>> '{practice,rgNumber}', ''),
      (v_normalized #>> '{practice,openedAt}')::date,
      nullif(v_normalized #>> '{practice,closedAt}', '')::date,
      nullif(v_normalized #>> '{practice,notes}', '')
    )
    RETURNING id INTO v_case_id;
  END IF;

  FOR v_activity IN
    SELECT value FROM jsonb_array_elements(coalesce(v_normalized -> 'activities', '[]'::jsonb))
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.price_books pb
      JOIN public.price_items pi ON pi.price_book_id = pb.id AND pi.user_id = pb.user_id
      WHERE pb.id = (v_activity ->> 'priceBookId')::uuid
        AND pi.id = (v_activity ->> 'priceItemId')::uuid
        AND pb.user_id = v_user_id
        AND pb.principal_id = v_principal_id
        AND pi.kind = (v_activity ->> 'kind')::public.price_item_kind
        AND pi.is_enabled
    ) THEN
      RAISE EXCEPTION 'Voce prezzo non valida per la riga di creazione guidata.';
    END IF;

    v_activity_id := NULL;

    INSERT INTO public.case_activities (
      id, user_id, case_id, principal_id, client_id, counterparty_id, price_book_id,
      price_item_id, activity_date, kind, status, snapshot_price_year, snapshot_price_code,
      snapshot_price_name, description, quantity, unit_price, notes
    )
    SELECT
      coalesce((v_activity ->> 'id')::uuid, gen_random_uuid()),
      v_user_id, v_case_id, v_principal_id, v_client_id, v_counterparty_id,
      (v_activity ->> 'priceBookId')::uuid,
      (v_activity ->> 'priceItemId')::uuid,
      (v_activity ->> 'activityDate')::date,
      (v_activity ->> 'kind')::public.price_item_kind,
      (v_activity ->> 'status')::public.case_activity_status,
      (v_activity ->> 'priceBookYear')::integer,
      v_activity ->> 'code',
      v_activity ->> 'name',
      v_activity ->> 'description',
      (v_activity ->> 'quantity')::numeric,
      (v_activity ->> 'unitPrice')::numeric,
      nullif(v_activity ->> 'notes', '')
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.case_activities ca
      WHERE ca.user_id = v_user_id
        AND ca.case_id = v_case_id
        AND ca.price_item_id = (v_activity ->> 'priceItemId')::uuid
        AND ca.activity_date = (v_activity ->> 'activityDate')::date
        AND ca.description = v_activity ->> 'description'
        AND ca.amount = round((v_activity ->> 'quantity')::numeric * (v_activity ->> 'unitPrice')::numeric, 2)
    )
    RETURNING id INTO v_activity_id;

    IF v_activity_id IS NOT NULL THEN
      FOR v_hearing_date IN
        SELECT value #>> '{}'
        FROM jsonb_array_elements(coalesce(v_activity -> 'hearingDates', '[]'::jsonb))
      LOOP
        INSERT INTO public.case_activity_hearings (user_id, activity_id, hearing_date, position)
        VALUES (
          v_user_id,
          v_activity_id,
          v_hearing_date::date,
          (
            SELECT count(*) + 1
            FROM public.case_activity_hearings
            WHERE activity_id = v_activity_id
              AND user_id = v_user_id
          )
        );
      END LOOP;
    END IF;
  END LOOP;

  UPDATE public.import_rows
  SET status = 'imported',
      applied_case_id = v_case_id,
      updated_at = now()
  WHERE id = p_import_row_id
    AND user_id = v_user_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.import_rows
    WHERE import_id = v_import_id
      AND user_id = v_user_id
      AND status IN ('pending', 'valid', 'warning')
  ) THEN
    UPDATE public.imports
    SET status = 'imported',
        updated_at = now()
    WHERE id = v_import_id
      AND user_id = v_user_id;
  END IF;

  RETURN v_case_id;
END;
$$;

-- Cambia emissione/bozza fattura e stato Attività collegate in modo atomico.
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
  v_invoice_status public.invoice_status;
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
  IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_exports) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid billing payload';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'at least one billing item is required';
  END IF;
  IF jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'at least one invoice line is required';
  END IF;
  IF jsonb_array_length(p_exports) <> 2 OR (
    SELECT count(DISTINCT export.kind)
    FROM jsonb_to_recordset(p_exports) AS export(kind public.billing_export_kind)
  ) <> 2 THEN
    RAISE EXCEPTION 'both billing exports are required';
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
    SELECT i.id, i.billing_run_id, i.public_code, i.number, i.year, i.status
      INTO v_invoice_id, v_billing_run_id, v_public_code, v_number, v_year, v_invoice_status
    FROM public.invoices i
    WHERE i.id = p_invoice_id
      AND i.user_id = v_user_id
    FOR UPDATE;

    IF v_invoice_id IS NULL OR v_billing_run_id IS NULL THEN
      RAISE EXCEPTION 'invoice not found';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.billing_runs br
      WHERE br.id = v_billing_run_id
        AND br.user_id = v_user_id
        AND br.request_id = p_request_id
    ) THEN
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

    IF v_invoice_status <> 'draft' THEN
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
    WHERE item.status IN ('included', 'postponed')
      AND NOT (
        (ca.status = 'to_invoice' AND ca.invoice_id IS NULL)
        OR (NOT v_new_run AND ca.invoice_id = v_invoice_id)
      )
  ) THEN
    RAISE EXCEPTION 'one or more activities are already invoiced';
  END IF;

  IF v_new_run THEN
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
    client_name, counterparty_name, activity_date, hearing_dates, kind, description,
    quantity, unit_price, amount
  )
  SELECT v_user_id, v_invoice_id, line.position, line.case_activity_id,
         line.practice_number, line.client_name, line.counterparty_name,
         line.activity_date, line.hearing_dates, line.kind, line.description, line.quantity,
         line.unit_price, line.amount
  FROM jsonb_to_recordset(p_lines) AS line(
    position integer,
    case_activity_id uuid,
    practice_number integer,
    client_name text,
    counterparty_name text,
    activity_date date,
    hearing_dates date[],
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

-- Unisce i record duplicati e registra la decisione nella stessa transazione.
CREATE OR REPLACE FUNCTION public.merge_duplicate_records(
  p_entity_type text,
  p_left_record_id uuid,
  p_right_record_id uuid,
  p_kept_record_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_merged_record_id uuid;
  v_review_id uuid;
  v_review_status text;
  v_review_kept_record_id uuid;
  v_review_merged_record_id uuid;
  v_review jsonb;
  v_case_public_code text;
  v_case_practice_number integer;
  v_case_principal_id uuid;
  v_case_client_id uuid;
  v_case_counterparty_id uuid;
  v_next_position integer;
  v_target text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_entity_type NOT IN ('principal', 'client', 'counterparty', 'case') THEN
    RAISE EXCEPTION 'duplicate entity cannot be merged';
  END IF;
  IF p_left_record_id IS NULL OR p_right_record_id IS NULL
     OR p_left_record_id = p_right_record_id THEN
    RAISE EXCEPTION 'invalid duplicate pair';
  END IF;
  IF p_kept_record_id NOT IN (p_left_record_id, p_right_record_id) THEN
    RAISE EXCEPTION 'invalid kept record';
  END IF;

  v_merged_record_id := CASE
    WHEN p_kept_record_id = p_left_record_id THEN p_right_record_id
    ELSE p_left_record_id
  END;

  SELECT id, status, kept_record_id, merged_record_id
    INTO v_review_id, v_review_status, v_review_kept_record_id,
         v_review_merged_record_id
  FROM public.duplicate_reviews
  WHERE user_id = v_user_id
    AND entity_type = p_entity_type
    AND left_record_id = least(p_left_record_id, p_right_record_id)
    AND right_record_id = greatest(p_left_record_id, p_right_record_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'duplicate review not found';
  END IF;

  IF v_review_status = 'merged' THEN
    IF v_review_kept_record_id IS DISTINCT FROM p_kept_record_id
       OR v_review_merged_record_id IS DISTINCT FROM v_merged_record_id THEN
      RAISE EXCEPTION 'duplicate review already merged with a different record';
    END IF;

    SELECT to_jsonb(review.*)
      INTO v_review
    FROM public.duplicate_reviews AS review
    WHERE review.id = v_review_id AND review.user_id = v_user_id;
    RETURN v_review;
  END IF;

  IF p_entity_type = 'principal' THEN
    PERFORM id FROM public.principals
    WHERE id = p_kept_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kept principal not found'; END IF;

    PERFORM id FROM public.principals
    WHERE id = v_merged_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'merged principal not found'; END IF;

    UPDATE public.cases
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    UPDATE public.case_activities
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    UPDATE public.invoices
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    UPDATE public.billing_runs
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    DELETE FROM public.principal_clients merged_link
    USING public.principal_clients kept_link
    WHERE merged_link.user_id = v_user_id
      AND merged_link.principal_id = v_merged_record_id
      AND kept_link.user_id = v_user_id
      AND kept_link.principal_id = p_kept_record_id
      AND kept_link.client_id = merged_link.client_id;

    UPDATE public.principal_clients
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    UPDATE public.price_books merged_book
    SET principal_id = p_kept_record_id
    WHERE merged_book.user_id = v_user_id
      AND merged_book.principal_id = v_merged_record_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.price_books kept_book
        WHERE kept_book.user_id = v_user_id
          AND kept_book.principal_id = p_kept_record_id
          AND kept_book.year = merged_book.year
      );

    UPDATE public.principals
    SET archived_at = now()
    WHERE id = v_merged_record_id AND user_id = v_user_id;

  ELSIF p_entity_type = 'client' THEN
    PERFORM id FROM public.clients
    WHERE id = p_kept_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kept client not found'; END IF;

    PERFORM id FROM public.clients
    WHERE id = v_merged_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'merged client not found'; END IF;

    UPDATE public.cases
    SET client_id = p_kept_record_id
    WHERE user_id = v_user_id AND client_id = v_merged_record_id;

    UPDATE public.case_activities
    SET client_id = p_kept_record_id
    WHERE user_id = v_user_id AND client_id = v_merged_record_id;

    UPDATE public.invoices
    SET client_id = p_kept_record_id
    WHERE user_id = v_user_id AND client_id = v_merged_record_id;

    UPDATE public.case_credit_transfers
    SET previous_client_id = p_kept_record_id
    WHERE user_id = v_user_id AND previous_client_id = v_merged_record_id;

    UPDATE public.case_credit_transfers
    SET new_client_id = p_kept_record_id
    WHERE user_id = v_user_id AND new_client_id = v_merged_record_id;

    DELETE FROM public.principal_clients merged_link
    USING public.principal_clients kept_link
    WHERE merged_link.user_id = v_user_id
      AND merged_link.client_id = v_merged_record_id
      AND kept_link.user_id = v_user_id
      AND kept_link.client_id = p_kept_record_id
      AND kept_link.principal_id = merged_link.principal_id;

    UPDATE public.principal_clients
    SET client_id = p_kept_record_id
    WHERE user_id = v_user_id AND client_id = v_merged_record_id;

    DELETE FROM public.clients
    WHERE id = v_merged_record_id
      AND user_id = v_user_id
      AND nullif(btrim(notes), '') IS NULL;

  ELSIF p_entity_type = 'counterparty' THEN
    PERFORM id FROM public.counterparties
    WHERE id = p_kept_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kept counterparty not found'; END IF;

    PERFORM id FROM public.counterparties
    WHERE id = v_merged_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'merged counterparty not found'; END IF;

    UPDATE public.cases
    SET counterparty_id = p_kept_record_id
    WHERE user_id = v_user_id AND counterparty_id = v_merged_record_id;

    SELECT coalesce(max(position), -1) + 1
      INTO v_next_position
    FROM public.counterparty_subjects
    WHERE user_id = v_user_id AND counterparty_id = p_kept_record_id;

    WITH moved_subjects AS (
      SELECT id, row_number() OVER (ORDER BY position, id) - 1 AS offset
      FROM public.counterparty_subjects
      WHERE user_id = v_user_id AND counterparty_id = v_merged_record_id
    )
    UPDATE public.counterparty_subjects subject
    SET counterparty_id = p_kept_record_id,
        position = v_next_position + moved.offset
    FROM moved_subjects moved
    WHERE subject.id = moved.id AND subject.user_id = v_user_id;

    UPDATE public.case_activities
    SET counterparty_id = p_kept_record_id
    WHERE user_id = v_user_id AND counterparty_id = v_merged_record_id;

    DELETE FROM public.counterparties
    WHERE id = v_merged_record_id
      AND user_id = v_user_id
      AND nullif(btrim(notes), '') IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.counterparty_subjects
        WHERE user_id = v_user_id AND counterparty_id = v_merged_record_id
      );

  ELSE
    SELECT public_code, practice_number, principal_id, client_id, counterparty_id
      INTO v_case_public_code, v_case_practice_number, v_case_principal_id,
           v_case_client_id, v_case_counterparty_id
    FROM public.cases
    WHERE id = p_kept_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kept case not found'; END IF;

    PERFORM id FROM public.cases
    WHERE id = v_merged_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'merged case not found'; END IF;

    UPDATE public.case_activities
    SET case_id = p_kept_record_id,
        principal_id = v_case_principal_id,
        client_id = v_case_client_id,
        counterparty_id = v_case_counterparty_id
    WHERE user_id = v_user_id AND case_id = v_merged_record_id;

    UPDATE public.invoices
    SET case_id = p_kept_record_id,
        principal_id = v_case_principal_id,
        client_id = v_case_client_id
    WHERE user_id = v_user_id AND case_id = v_merged_record_id;

    UPDATE public.case_status_history
    SET case_id = p_kept_record_id
    WHERE user_id = v_user_id AND case_id = v_merged_record_id;

    UPDATE public.case_credit_transfers
    SET case_id = p_kept_record_id
    WHERE user_id = v_user_id AND case_id = v_merged_record_id;

    v_target := coalesce(v_case_public_code, v_case_practice_number::text, p_kept_record_id::text);
    UPDATE public.cases
    SET status = 'archived',
        notes = concat_ws(
          E'\n\n',
          nullif(btrim(notes), ''),
          format('Pratica assorbita in %s.', v_target)
        )
    WHERE id = v_merged_record_id AND user_id = v_user_id;
  END IF;

  UPDATE public.duplicate_reviews AS review
  SET status = 'merged',
      kept_record_id = p_kept_record_id,
      merged_record_id = v_merged_record_id,
      snoozed_until = NULL,
      resolved_at = now()
  WHERE id = v_review_id AND user_id = v_user_id
  RETURNING to_jsonb(review.*) INTO v_review;

  RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_duplicate_records(text, uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_records(text, uuid, uuid, uuid)
  TO authenticated;

-- Calcola il totale attività come quantità x prezzo unitario.
CREATE OR REPLACE FUNCTION public.set_case_activity_amount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.amount := round(NEW.quantity * NEW.unit_price, 2);
  RETURN NEW;
END;
$$;


-- ============================================================================
-- TABLES
-- ============================================================================

-- Profilo professionale dell'avvocato (1:1 con auth.users).
CREATE TABLE public.profiles (
  id                          uuid PRIMARY KEY,
  full_name                   text,
  business_name               text,
  email                       text,
  phone                       text,
  pec                         text,
  tax_code                    text,
  vat_number                  text,
  rea                         text,
  bar_association             text,
  address_street              text,
  address_city                text,
  address_zip                 text,
  address_province            text,
  address_country             text DEFAULT 'IT',
  tax_regime                  public.tax_regime NOT NULL DEFAULT 'ordinario',
  cassa_rate                  numeric NOT NULL DEFAULT 4.00,
  vat_rate                    numeric NOT NULL DEFAULT 22.00,
  withholding_rate            numeric NOT NULL DEFAULT 20.00,
  apply_withholding           boolean NOT NULL DEFAULT true,
  include_stamp_duty          boolean NOT NULL DEFAULT false,
  iban                        text,
  bank_name                   text,
  invoice_number_prefix       text,
  invoice_next_number         integer NOT NULL DEFAULT 1,
  invoice_year                integer NOT NULL DEFAULT (EXTRACT(year FROM now()))::integer,
  client_public_code_next_number integer NOT NULL DEFAULT 1,
  principal_public_code_next_number integer NOT NULL DEFAULT 1,
  counterparty_public_code_next_number integer NOT NULL DEFAULT 1,
  case_public_code_next_number integer NOT NULL DEFAULT 1,
  price_book_public_code_next_number integer NOT NULL DEFAULT 1,
  invoice_public_code_next_number integer NOT NULL DEFAULT 1,
  logo_url                    text,
  onboarding_completed        boolean NOT NULL DEFAULT false,
  last_seen_changelog_version text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code      text NOT NULL,
  user_id          uuid NOT NULL,
  kind             public.client_kind NOT NULL DEFAULT 'individual',
  first_name       text,
  last_name        text,
  business_name    text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clients_public_code_format CHECK (public_code ~ '^CL-[0-9]{5}$'),
  UNIQUE (user_id, public_code),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_clients_user ON public.clients (user_id);

CREATE TABLE public.user_table_preferences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  section        text NOT NULL CHECK (length(trim(section)) > 0),
  sort_key       text NOT NULL CHECK (length(trim(sort_key)) > 0),
  sort_direction text NOT NULL CHECK (sort_direction IN ('asc', 'desc')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section)
);
CREATE INDEX idx_user_table_preferences_user ON public.user_table_preferences (user_id);

CREATE TABLE public.cases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code  text NOT NULL,
  user_id      uuid NOT NULL,
  client_id    uuid,
  practice_number integer NOT NULL,
  principal_id uuid,
  counterparty_id uuid,
  status       public.case_status NOT NULL DEFAULT 'open',
  authority    text,
  rg_number    text,
  opened_at    date NOT NULL DEFAULT CURRENT_DATE,
  closed_at    date,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cases_public_code_format CHECK (public_code ~ '^PR-[0-9]{5}$'),
  CONSTRAINT cases_practice_number_positive CHECK (practice_number > 0),
  UNIQUE (user_id, public_code),
  UNIQUE (user_id, practice_number),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_cases_user   ON public.cases (user_id);
CREATE INDEX idx_cases_client ON public.cases (client_id);
CREATE INDEX idx_cases_status ON public.cases (status);
CREATE INDEX idx_cases_user_practice_number ON public.cases (user_id, practice_number);

CREATE TABLE public.case_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid NOT NULL,
  user_id         uuid NOT NULL,
  previous_status public.case_status,
  new_status      public.case_status NOT NULL,
  note            text,
  changed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_status_history_case ON public.case_status_history (case_id);
CREATE INDEX idx_case_status_history_user ON public.case_status_history (user_id);

CREATE TABLE public.invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code        text NOT NULL,
  user_id            uuid NOT NULL,
  client_id          uuid NOT NULL,
  case_id            uuid,
  number             text NOT NULL,
  year               integer NOT NULL,
  issue_date         date NOT NULL DEFAULT CURRENT_DATE,
  due_date           date,
  status             public.invoice_status NOT NULL DEFAULT 'draft',
  cassa_rate         numeric NOT NULL DEFAULT 4.00,
  vat_rate           numeric NOT NULL DEFAULT 22.00,
  withholding_rate   numeric NOT NULL DEFAULT 20.00,
  apply_withholding  boolean NOT NULL DEFAULT true,
  taxable_fees       numeric NOT NULL DEFAULT 0,
  art15_expenses     numeric NOT NULL DEFAULT 0,
  cassa_amount       numeric NOT NULL DEFAULT 0,
  vat_amount         numeric NOT NULL DEFAULT 0,
  withholding_amount numeric NOT NULL DEFAULT 0,
  stamp_amount       numeric NOT NULL DEFAULT 0,
  total_amount       numeric NOT NULL DEFAULT 0,
  net_to_pay         numeric NOT NULL DEFAULT 0,
  paid_at            date,
  payment_method     text,
  principal_id        uuid,
  billing_run_id      uuid,
  include_general_expenses boolean NOT NULL DEFAULT false,
  general_expenses_rate numeric NOT NULL DEFAULT 10.00,
  general_expenses_amount numeric NOT NULL DEFAULT 0,
  cassa_base_amount   numeric NOT NULL DEFAULT 0,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_public_code_format CHECK (public_code ~ '^FT-[0-9]{5}$'),
  UNIQUE (user_id, public_code),
  UNIQUE (user_id, year, number),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_invoices_user   ON public.invoices (user_id);
CREATE INDEX idx_invoices_client ON public.invoices (client_id);
CREATE INDEX idx_invoices_case   ON public.invoices (case_id);
CREATE INDEX idx_invoices_status ON public.invoices (status);
CREATE INDEX idx_invoices_principal ON public.invoices (principal_id);
CREATE INDEX idx_invoices_billing_run ON public.invoices (billing_run_id);

CREATE TABLE public.invoice_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  invoice_id  uuid NOT NULL,
  position    integer NOT NULL DEFAULT 0,
  case_activity_id uuid,
  practice_number integer,
  client_name text,
  counterparty_name text,
  activity_date date,
  hearing_dates date[] NOT NULL DEFAULT '{}'::date[],
  kind        public.invoice_line_kind NOT NULL DEFAULT 'fee',
  description text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL DEFAULT 0,
  amount      numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines (invoice_id);
CREATE INDEX idx_invoice_lines_user    ON public.invoice_lines (user_id);
CREATE UNIQUE INDEX invoice_lines_case_activity_unique
  ON public.invoice_lines (case_activity_id)
  WHERE case_activity_id IS NOT NULL;

CREATE TABLE public.principals (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code                     text NOT NULL,
  user_id                         uuid NOT NULL,
  business_name                   text NOT NULL,
  tax_code                        text,
  vat_number                      text,
  email                           text,
  phone                           text,
  pec                             text,
  sdi_code                        text,
  address_street                  text,
  address_city                    text,
  address_zip                     text,
  address_province                text,
  address_country                 text DEFAULT 'IT',
  fees_enabled                    boolean NOT NULL DEFAULT true,
  expense_reimbursements_enabled  boolean NOT NULL DEFAULT true,
  default_general_expenses_rate   numeric NOT NULL DEFAULT 10.00,
  default_cassa_rate              numeric NOT NULL DEFAULT 4.00,
  notes                           text,
  archived_at                     timestamptz,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT principals_business_name_not_blank CHECK (length(btrim(business_name)) > 0),
  CONSTRAINT principals_general_expenses_rate_non_negative CHECK (default_general_expenses_rate >= 0),
  CONSTRAINT principals_cassa_rate_non_negative CHECK (default_cassa_rate >= 0),
  CONSTRAINT principals_economics_at_least_one_enabled CHECK (fees_enabled OR expense_reimbursements_enabled),
  CONSTRAINT principals_public_code_format CHECK (public_code ~ '^CM-[0-9]{5}$'),
  UNIQUE (user_id, public_code),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_principals_user ON public.principals (user_id);
CREATE INDEX idx_principals_archived ON public.principals (archived_at);

CREATE TABLE public.principal_clients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  principal_id  uuid NOT NULL,
  client_id     uuid NOT NULL,
  active_from   date,
  active_to     date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT principal_clients_dates_order CHECK (active_to IS NULL OR active_from IS NULL OR active_to >= active_from),
  UNIQUE (user_id, principal_id, client_id)
);
CREATE INDEX idx_principal_clients_user ON public.principal_clients (user_id);
CREATE INDEX idx_principal_clients_principal ON public.principal_clients (principal_id);
CREATE INDEX idx_principal_clients_client ON public.principal_clients (client_id);

CREATE TABLE public.counterparties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code    text NOT NULL,
  user_id        uuid NOT NULL,
  kind           public.counterparty_kind NOT NULL DEFAULT 'company',
  first_name     text,
  last_name      text,
  business_name  text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT counterparties_name_present CHECK (
    (kind = 'individual' AND length(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) > 0)
    OR (kind IN ('company', 'group') AND length(btrim(coalesce(business_name, ''))) > 0)
  ),
  CONSTRAINT counterparties_public_code_format CHECK (public_code ~ '^CP-[0-9]{5}$'),
  UNIQUE (user_id, public_code),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_counterparties_user ON public.counterparties (user_id);
CREATE INDEX idx_counterparties_kind ON public.counterparties (kind);

CREATE TABLE public.counterparty_subjects (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  counterparty_id uuid NOT NULL,
  kind            public.client_kind NOT NULL DEFAULT 'individual',
  first_name      text,
  last_name       text,
  business_name   text,
  notes           text,
  position        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT counterparty_subjects_name_present CHECK (
    (kind = 'individual' AND length(btrim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) > 0)
    OR (kind = 'company' AND length(btrim(coalesce(business_name, ''))) > 0)
  ),
  UNIQUE (counterparty_id, position)
);
CREATE INDEX idx_counterparty_subjects_user ON public.counterparty_subjects (user_id);
CREATE INDEX idx_counterparty_subjects_counterparty ON public.counterparty_subjects (counterparty_id);

CREATE TABLE public.case_credit_transfers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  case_id            uuid NOT NULL,
  previous_client_id uuid,
  new_client_id      uuid NOT NULL,
  transferred_at     date NOT NULL DEFAULT CURRENT_DATE,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_credit_transfers_user ON public.case_credit_transfers (user_id);
CREATE INDEX idx_case_credit_transfers_case ON public.case_credit_transfers (case_id);
CREATE INDEX idx_case_credit_transfers_new_client ON public.case_credit_transfers (new_client_id);

CREATE TABLE public.price_books (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code                     text NOT NULL,
  user_id                         uuid NOT NULL,
  principal_id                    uuid NOT NULL,
  year                            integer NOT NULL,
  status                          public.price_book_status NOT NULL DEFAULT 'draft',
  fees_enabled                    boolean NOT NULL DEFAULT true,
  expense_reimbursements_enabled  boolean NOT NULL DEFAULT true,
  valid_from                      date NOT NULL,
  valid_to                        date,
  notes                           text,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_books_year_range CHECK (year BETWEEN 2000 AND 2100),
  CONSTRAINT price_books_dates_order CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CONSTRAINT price_books_economics_at_least_one_enabled CHECK (fees_enabled OR expense_reimbursements_enabled),
  CONSTRAINT price_books_public_code_format CHECK (public_code ~ '^PZ-[0-9]{5}$'),
  UNIQUE (user_id, public_code),
  UNIQUE (user_id, principal_id, year),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_price_books_user ON public.price_books (user_id);
CREATE INDEX idx_price_books_principal ON public.price_books (principal_id);
CREATE INDEX idx_price_books_status ON public.price_books (status);

CREATE TABLE public.price_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL,
  price_book_id            uuid NOT NULL,
  kind                     public.price_item_kind NOT NULL,
  code                     text NOT NULL,
  name                     text NOT NULL,
  invoice_description      text,
  unit_price               numeric,
  is_enabled               boolean NOT NULL DEFAULT true,
  requires_hearing_dates   boolean NOT NULL DEFAULT false,
  sort_order               integer NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT price_items_code_not_blank CHECK (length(btrim(code)) > 0),
  CONSTRAINT price_items_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT price_items_fee_has_unit_price CHECK (kind <> 'fee' OR unit_price IS NOT NULL),
  CONSTRAINT price_items_unit_price_non_negative CHECK (unit_price IS NULL OR unit_price >= 0),
  UNIQUE (price_book_id, code),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_price_items_user ON public.price_items (user_id);
CREATE INDEX idx_price_items_price_book ON public.price_items (price_book_id);
CREATE INDEX idx_price_items_kind ON public.price_items (kind);

CREATE TABLE public.case_activities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  case_id               uuid NOT NULL,
  principal_id          uuid NOT NULL,
  client_id             uuid NOT NULL,
  counterparty_id       uuid,
  price_book_id         uuid NOT NULL,
  price_item_id         uuid NOT NULL,
  invoice_id            uuid,
  activity_date         date NOT NULL DEFAULT CURRENT_DATE,
  kind                  public.price_item_kind NOT NULL,
  status                public.case_activity_status NOT NULL DEFAULT 'to_invoice',
  needs_review          boolean NOT NULL DEFAULT false,
  snapshot_price_year   integer NOT NULL,
  snapshot_price_code   text NOT NULL,
  snapshot_price_name   text NOT NULL,
  description           text NOT NULL,
  quantity              numeric NOT NULL DEFAULT 1,
  unit_price            numeric NOT NULL DEFAULT 0,
  amount                numeric NOT NULL DEFAULT 0,
  postponed_until       date,
  postponed_count       integer NOT NULL DEFAULT 0,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_activities_description_not_blank CHECK (length(btrim(description)) > 0),
  CONSTRAINT case_activities_quantity_positive CHECK (quantity > 0),
  CONSTRAINT case_activities_unit_price_non_negative CHECK (unit_price >= 0),
  CONSTRAINT case_activities_amount_non_negative CHECK (amount >= 0),
  CONSTRAINT case_activities_postponed_count_non_negative CHECK (postponed_count >= 0),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_case_activities_user ON public.case_activities (user_id);
CREATE INDEX idx_case_activities_case ON public.case_activities (case_id);
CREATE INDEX idx_case_activities_principal ON public.case_activities (principal_id);
CREATE INDEX idx_case_activities_client ON public.case_activities (client_id);
CREATE INDEX idx_case_activities_counterparty ON public.case_activities (counterparty_id);
CREATE INDEX idx_case_activities_price_item ON public.case_activities (price_item_id);
CREATE INDEX idx_case_activities_invoice ON public.case_activities (invoice_id);
CREATE INDEX idx_case_activities_status_date ON public.case_activities (status, activity_date);
CREATE INDEX idx_case_activities_needs_review ON public.case_activities (user_id, needs_review, activity_date) WHERE needs_review;

CREATE TABLE public.case_activity_hearings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  activity_id   uuid NOT NULL,
  hearing_date  date NOT NULL,
  position      integer NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, position)
);
CREATE INDEX idx_case_activity_hearings_user ON public.case_activity_hearings (user_id);
CREATE INDEX idx_case_activity_hearings_activity ON public.case_activity_hearings (activity_id);

CREATE TABLE public.activity_attachments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  activity_id         uuid NOT NULL,
  bucket_id           text NOT NULL DEFAULT 'pratix-documents',
  storage_path        text NOT NULL,
  original_file_name  text,
  display_name        text NOT NULL,
  document_type       text,
  mime_type           text,
  size_bytes          bigint,
  preview_available   boolean NOT NULL DEFAULT false,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_attachments_display_name_not_blank CHECK (length(btrim(display_name)) > 0),
  CONSTRAINT activity_attachments_size_non_negative CHECK (size_bytes IS NULL OR size_bytes >= 0),
  UNIQUE (storage_path),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_activity_attachments_user ON public.activity_attachments (user_id);
CREATE INDEX idx_activity_attachments_activity ON public.activity_attachments (activity_id);

CREATE TABLE public.billing_runs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL,
  principal_id             uuid NOT NULL,
  invoice_id               uuid,
  period_start             date NOT NULL,
  period_end               date NOT NULL,
  status                   public.billing_run_status NOT NULL DEFAULT 'draft',
  include_general_expenses boolean NOT NULL DEFAULT false,
  general_expenses_rate    numeric NOT NULL DEFAULT 10.00,
  compensation_total       numeric NOT NULL DEFAULT 0,
  general_expenses_amount  numeric NOT NULL DEFAULT 0,
  cassa_rate               numeric NOT NULL DEFAULT 4.00,
  cassa_base_amount        numeric NOT NULL DEFAULT 0,
  cassa_amount             numeric NOT NULL DEFAULT 0,
  reimbursements_total     numeric NOT NULL DEFAULT 0,
  notes                    text,
  request_id               uuid,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_runs_period_order CHECK (period_end >= period_start),
  CONSTRAINT billing_runs_general_expenses_rate_non_negative CHECK (general_expenses_rate >= 0),
  CONSTRAINT billing_runs_cassa_rate_non_negative CHECK (cassa_rate >= 0),
  CONSTRAINT billing_runs_totals_non_negative CHECK (
    compensation_total >= 0
    AND general_expenses_amount >= 0
    AND cassa_base_amount >= 0
    AND cassa_amount >= 0
    AND reimbursements_total >= 0
  ),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_billing_runs_user ON public.billing_runs (user_id);
CREATE INDEX idx_billing_runs_principal_period ON public.billing_runs (principal_id, period_start, period_end);
CREATE INDEX idx_billing_runs_invoice ON public.billing_runs (invoice_id);
CREATE INDEX idx_billing_runs_status ON public.billing_runs (status);
CREATE UNIQUE INDEX billing_runs_user_request_unique
  ON public.billing_runs (user_id, request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE public.billing_run_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  billing_run_id uuid NOT NULL,
  activity_id    uuid NOT NULL,
  status         public.billing_run_item_status NOT NULL DEFAULT 'included',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (billing_run_id, activity_id)
);
CREATE INDEX idx_billing_run_items_user ON public.billing_run_items (user_id);
CREATE INDEX idx_billing_run_items_run ON public.billing_run_items (billing_run_id);
CREATE INDEX idx_billing_run_items_activity ON public.billing_run_items (activity_id);
CREATE INDEX idx_billing_run_items_status ON public.billing_run_items (status);

CREATE TABLE public.billing_exports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  billing_run_id uuid NOT NULL,
  invoice_id     uuid,
  kind           public.billing_export_kind NOT NULL,
  bucket_id      text NOT NULL DEFAULT 'pratix-documents',
  storage_path   text NOT NULL,
  file_name      text NOT NULL,
  mime_type      text,
  size_bytes     bigint,
  storage_status text NOT NULL DEFAULT 'ready'
    CHECK (storage_status IN ('pending', 'ready')),
  generated_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_exports_file_name_not_blank CHECK (length(btrim(file_name)) > 0),
  CONSTRAINT billing_exports_size_non_negative CHECK (size_bytes IS NULL OR size_bytes >= 0),
  UNIQUE (storage_path),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_billing_exports_user ON public.billing_exports (user_id);
CREATE INDEX idx_billing_exports_run ON public.billing_exports (billing_run_id);
CREATE INDEX idx_billing_exports_invoice ON public.billing_exports (invoice_id);
CREATE UNIQUE INDEX billing_exports_run_kind_unique
  ON public.billing_exports (billing_run_id, kind);

CREATE TABLE public.imports (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL,
  mode                public.import_mode NOT NULL DEFAULT 'manual',
  status              public.import_status NOT NULL DEFAULT 'draft',
  source_file_name    text,
  source_storage_path text,
  total_rows          integer NOT NULL DEFAULT 0,
  valid_rows          integer NOT NULL DEFAULT 0,
  error_rows          integer NOT NULL DEFAULT 0,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT imports_row_counts_non_negative CHECK (total_rows >= 0 AND valid_rows >= 0 AND error_rows >= 0),
  UNIQUE (id, user_id)
);
CREATE INDEX idx_imports_user ON public.imports (user_id);
CREATE INDEX idx_imports_status ON public.imports (status);

CREATE TABLE public.import_rows (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  import_id         uuid NOT NULL,
  row_number        integer NOT NULL,
  status            public.import_row_status NOT NULL DEFAULT 'pending',
  raw_data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  normalized_data   jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_messages    text[] NOT NULL DEFAULT ARRAY[]::text[],
  warning_messages  text[] NOT NULL DEFAULT ARRAY[]::text[],
  applied_case_id   uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT import_rows_row_number_positive CHECK (row_number > 0),
  UNIQUE (import_id, row_number)
);
CREATE INDEX idx_import_rows_user ON public.import_rows (user_id);
CREATE INDEX idx_import_rows_import ON public.import_rows (import_id);
CREATE INDEX idx_import_rows_status ON public.import_rows (status);

CREATE TABLE public.duplicate_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  entity_type      text NOT NULL,
  left_record_id   uuid NOT NULL,
  right_record_id  uuid NOT NULL,
  score            numeric NOT NULL DEFAULT 0,
  confidence       text NOT NULL DEFAULT 'low',
  reasons          text[] NOT NULL DEFAULT ARRAY[]::text[],
  status           text NOT NULL DEFAULT 'open',
  kept_record_id   uuid,
  merged_record_id uuid,
  snapshot         jsonb NOT NULL DEFAULT '{}'::jsonb,
  note             text,
  detected_at      timestamptz NOT NULL DEFAULT now(),
  snoozed_until    timestamptz,
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT duplicate_reviews_entity_type_check CHECK (
    entity_type IN (
      'principal',
      'client',
      'counterparty',
      'case',
      'activity',
      'counterparty_subject',
      'cross_entity'
    )
  ),
  CONSTRAINT duplicate_reviews_confidence_check CHECK (confidence IN ('high', 'medium', 'low')),
  CONSTRAINT duplicate_reviews_status_check CHECK (
    status IN ('open', 'snoozed', 'dismissed', 'merged')
  ),
  CONSTRAINT duplicate_reviews_score_range CHECK (score >= 0 AND score <= 1),
  CONSTRAINT duplicate_reviews_distinct_records CHECK (left_record_id <> right_record_id),
  CONSTRAINT duplicate_reviews_ordered_pair CHECK (left_record_id < right_record_id),
  UNIQUE (user_id, entity_type, left_record_id, right_record_id)
);
CREATE INDEX idx_duplicate_reviews_user ON public.duplicate_reviews (user_id);
CREATE INDEX idx_duplicate_reviews_status ON public.duplicate_reviews (status);
CREATE INDEX idx_duplicate_reviews_entity ON public.duplicate_reviews (entity_type);
CREATE INDEX idx_duplicate_reviews_snoozed_until
  ON public.duplicate_reviews (snoozed_until)
  WHERE status = 'snoozed';


-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_table_preferences
  ADD CONSTRAINT user_table_preferences_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT cases_client_owner_fkey
  FOREIGN KEY (client_id, user_id) REFERENCES public.clients(id, user_id) ON DELETE SET NULL (client_id);

ALTER TABLE public.case_status_history
  ADD CONSTRAINT case_status_history_case_owner_fkey
  FOREIGN KEY (case_id, user_id) REFERENCES public.cases(id, user_id) ON DELETE CASCADE,
  ADD CONSTRAINT case_status_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoices_client_owner_fkey
  FOREIGN KEY (client_id, user_id) REFERENCES public.clients(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT invoices_case_owner_fkey
  FOREIGN KEY (case_id, user_id) REFERENCES public.cases(id, user_id) ON DELETE SET NULL (case_id);

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_invoice_owner_fkey
  FOREIGN KEY (invoice_id, user_id) REFERENCES public.invoices(id, user_id) ON DELETE CASCADE,
  ADD CONSTRAINT invoice_lines_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.principals
  ADD CONSTRAINT principals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.principal_clients
  ADD CONSTRAINT principal_clients_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT principal_clients_principal_owner_fkey
  FOREIGN KEY (principal_id, user_id) REFERENCES public.principals(id, user_id) ON DELETE CASCADE,
  ADD CONSTRAINT principal_clients_client_owner_fkey
  FOREIGN KEY (client_id, user_id) REFERENCES public.clients(id, user_id) ON DELETE CASCADE;

ALTER TABLE public.counterparties
  ADD CONSTRAINT counterparties_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.counterparty_subjects
  ADD CONSTRAINT counterparty_subjects_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT counterparty_subjects_counterparty_owner_fkey
  FOREIGN KEY (counterparty_id, user_id) REFERENCES public.counterparties(id, user_id) ON DELETE CASCADE;

ALTER TABLE public.cases
  ADD CONSTRAINT cases_principal_owner_fkey
  FOREIGN KEY (principal_id, user_id) REFERENCES public.principals(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT cases_counterparty_owner_fkey
  FOREIGN KEY (counterparty_id, user_id) REFERENCES public.counterparties(id, user_id) ON DELETE RESTRICT;

ALTER TABLE public.case_credit_transfers
  ADD CONSTRAINT case_credit_transfers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT case_credit_transfers_case_owner_fkey
  FOREIGN KEY (case_id, user_id) REFERENCES public.cases(id, user_id) ON DELETE CASCADE,
  ADD CONSTRAINT case_credit_transfers_previous_client_owner_fkey
  FOREIGN KEY (previous_client_id, user_id) REFERENCES public.clients(id, user_id) ON DELETE SET NULL (previous_client_id),
  ADD CONSTRAINT case_credit_transfers_new_client_owner_fkey
  FOREIGN KEY (new_client_id, user_id) REFERENCES public.clients(id, user_id) ON DELETE RESTRICT;

ALTER TABLE public.price_books
  ADD CONSTRAINT price_books_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT price_books_principal_owner_fkey
  FOREIGN KEY (principal_id, user_id) REFERENCES public.principals(id, user_id) ON DELETE CASCADE;

ALTER TABLE public.price_items
  ADD CONSTRAINT price_items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT price_items_price_book_owner_fkey
  FOREIGN KEY (price_book_id, user_id) REFERENCES public.price_books(id, user_id) ON DELETE CASCADE;

ALTER TABLE public.case_activities
  ADD CONSTRAINT case_activities_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT case_activities_case_owner_fkey
  FOREIGN KEY (case_id, user_id) REFERENCES public.cases(id, user_id) ON DELETE CASCADE,
  ADD CONSTRAINT case_activities_principal_owner_fkey
  FOREIGN KEY (principal_id, user_id) REFERENCES public.principals(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT case_activities_client_owner_fkey
  FOREIGN KEY (client_id, user_id) REFERENCES public.clients(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT case_activities_counterparty_owner_fkey
  FOREIGN KEY (counterparty_id, user_id) REFERENCES public.counterparties(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT case_activities_price_book_owner_fkey
  FOREIGN KEY (price_book_id, user_id) REFERENCES public.price_books(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT case_activities_price_item_owner_fkey
  FOREIGN KEY (price_item_id, user_id) REFERENCES public.price_items(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT case_activities_invoice_owner_fkey
  FOREIGN KEY (invoice_id, user_id) REFERENCES public.invoices(id, user_id) ON DELETE SET NULL (invoice_id);

ALTER TABLE public.case_activity_hearings
  ADD CONSTRAINT case_activity_hearings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT case_activity_hearings_activity_owner_fkey
  FOREIGN KEY (activity_id, user_id) REFERENCES public.case_activities(id, user_id) ON DELETE CASCADE;

ALTER TABLE public.activity_attachments
  ADD CONSTRAINT activity_attachments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT activity_attachments_activity_owner_fkey
  FOREIGN KEY (activity_id, user_id) REFERENCES public.case_activities(id, user_id) ON DELETE CASCADE;

ALTER TABLE public.billing_runs
  ADD CONSTRAINT billing_runs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT billing_runs_principal_owner_fkey
  FOREIGN KEY (principal_id, user_id) REFERENCES public.principals(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT billing_runs_invoice_owner_fkey
  FOREIGN KEY (invoice_id, user_id) REFERENCES public.invoices(id, user_id) ON DELETE SET NULL (invoice_id);

ALTER TABLE public.billing_run_items
  ADD CONSTRAINT billing_run_items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT billing_run_items_run_owner_fkey
  FOREIGN KEY (billing_run_id, user_id) REFERENCES public.billing_runs(id, user_id) ON DELETE CASCADE,
  ADD CONSTRAINT billing_run_items_activity_owner_fkey
  FOREIGN KEY (activity_id, user_id) REFERENCES public.case_activities(id, user_id) ON DELETE RESTRICT;

ALTER TABLE public.billing_exports
  ADD CONSTRAINT billing_exports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT billing_exports_run_owner_fkey
  FOREIGN KEY (billing_run_id, user_id) REFERENCES public.billing_runs(id, user_id) ON DELETE CASCADE,
  ADD CONSTRAINT billing_exports_invoice_owner_fkey
  FOREIGN KEY (invoice_id, user_id) REFERENCES public.invoices(id, user_id) ON DELETE SET NULL (invoice_id);

ALTER TABLE public.imports
  ADD CONSTRAINT imports_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.import_rows
  ADD CONSTRAINT import_rows_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT import_rows_import_owner_fkey
  FOREIGN KEY (import_id, user_id) REFERENCES public.imports(id, user_id) ON DELETE CASCADE,
  ADD CONSTRAINT import_rows_applied_case_owner_fkey
  FOREIGN KEY (applied_case_id, user_id) REFERENCES public.cases(id, user_id) ON DELETE SET NULL (applied_case_id);

ALTER TABLE public.duplicate_reviews
  ADD CONSTRAINT duplicate_reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_principal_owner_fkey
  FOREIGN KEY (principal_id, user_id) REFERENCES public.principals(id, user_id) ON DELETE RESTRICT,
  ADD CONSTRAINT invoices_billing_run_owner_fkey
  FOREIGN KEY (billing_run_id, user_id) REFERENCES public.billing_runs(id, user_id) ON DELETE SET NULL (billing_run_id);

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_case_activity_owner_fkey
  FOREIGN KEY (case_activity_id, user_id) REFERENCES public.case_activities(id, user_id) ON DELETE SET NULL (case_activity_id);


-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER profiles_set_updated_at        BEFORE UPDATE ON public.profiles        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clients_set_updated_at         BEFORE UPDATE ON public.clients         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clients_assign_public_code     BEFORE INSERT OR UPDATE OF public_code ON public.clients FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CL', 'client_public_code_next_number');
CREATE TRIGGER user_table_preferences_set_updated_at BEFORE UPDATE ON public.user_table_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cases_set_updated_at           BEFORE UPDATE ON public.cases           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_set_updated_at        BEFORE UPDATE ON public.invoices        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_assign_public_code    BEFORE INSERT OR UPDATE OF public_code ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('FT', 'invoice_public_code_next_number');
CREATE TRIGGER principals_set_updated_at              BEFORE UPDATE ON public.principals              FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER principals_assign_public_code          BEFORE INSERT OR UPDATE OF public_code ON public.principals FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CM', 'principal_public_code_next_number');
CREATE TRIGGER principal_clients_set_updated_at       BEFORE UPDATE ON public.principal_clients       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER counterparties_set_updated_at          BEFORE UPDATE ON public.counterparties          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER counterparties_assign_public_code      BEFORE INSERT OR UPDATE OF public_code ON public.counterparties FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CP', 'counterparty_public_code_next_number');
CREATE TRIGGER counterparty_subjects_set_updated_at   BEFORE UPDATE ON public.counterparty_subjects   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_credit_transfers_set_updated_at   BEFORE UPDATE ON public.case_credit_transfers   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_books_set_updated_at             BEFORE UPDATE ON public.price_books             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_books_assign_public_code         BEFORE INSERT OR UPDATE OF public_code ON public.price_books FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('PZ', 'price_book_public_code_next_number');
CREATE TRIGGER price_items_set_updated_at             BEFORE UPDATE ON public.price_items             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_activities_set_updated_at         BEFORE UPDATE ON public.case_activities         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_activity_hearings_set_updated_at  BEFORE UPDATE ON public.case_activity_hearings  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER activity_attachments_set_updated_at    BEFORE UPDATE ON public.activity_attachments    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_runs_set_updated_at            BEFORE UPDATE ON public.billing_runs            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_run_items_set_updated_at       BEFORE UPDATE ON public.billing_run_items       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_exports_set_updated_at         BEFORE UPDATE ON public.billing_exports         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER imports_set_updated_at                 BEFORE UPDATE ON public.imports                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER import_rows_set_updated_at             BEFORE UPDATE ON public.import_rows             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER duplicate_reviews_set_updated_at       BEFORE UPDATE ON public.duplicate_reviews      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER cases_log_status_change
  AFTER INSERT OR UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.log_case_status_change();

CREATE TRIGGER cases_assign_practice_number
  BEFORE INSERT OR UPDATE OF practice_number, user_id
  ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.assign_case_practice_number();

CREATE TRIGGER cases_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code
  ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('PR', 'case_public_code_next_number');

CREATE TRIGGER case_activities_set_amount
  BEFORE INSERT OR UPDATE OF quantity, unit_price
  ON public.case_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_case_activity_amount();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================================
-- FUNCTION PERMISSIONS
-- ============================================================================

-- These functions are used by triggers only and must not be callable through
-- PostgREST RPC by anonymous or authenticated users.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_case_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_case_practice_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_public_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_case_activity_amount() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_practice_number() TO authenticated;
REVOKE ALL ON FUNCTION public.apply_import_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_import_row(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_invoice_issue_state(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_invoice_issue_state(uuid, boolean) TO authenticated;
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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_table_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duplicate_reviews TO authenticated;
REVOKE UPDATE (
  client_public_code_next_number,
  principal_public_code_next_number,
  counterparty_public_code_next_number,
  case_public_code_next_number,
  price_book_public_code_next_number,
  invoice_public_code_next_number
) ON public.profiles FROM authenticated;


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Pattern: ogni tabella espone solo le righe dove (select auth.uid()) = user_id
-- (tranne profiles, dove la chiave è id che coincide con auth.uid()).

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_table_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.principals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.principal_clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterparties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterparty_subjects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_credit_transfers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_books            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_activity_hearings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_run_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_exports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_reviews      ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((select auth.uid()) = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

-- clients
CREATE POLICY clients_select_own ON public.clients FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY clients_insert_own ON public.clients FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY clients_update_own ON public.clients FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY clients_delete_own ON public.clients FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- user_table_preferences
CREATE POLICY user_table_preferences_select_own ON public.user_table_preferences FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY user_table_preferences_insert_own ON public.user_table_preferences FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_table_preferences_update_own ON public.user_table_preferences FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY user_table_preferences_delete_own ON public.user_table_preferences FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- cases
CREATE POLICY cases_select_own ON public.cases FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY cases_insert_own ON public.cases FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY cases_update_own ON public.cases FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY cases_delete_own ON public.cases FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- case_status_history (solo select + insert; lo storico non si modifica)
CREATE POLICY case_status_history_select_own ON public.case_status_history FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY case_status_history_insert_own ON public.case_status_history FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

-- invoices
CREATE POLICY invoices_select_own ON public.invoices FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY invoices_insert_own ON public.invoices FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY invoices_update_own ON public.invoices FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY invoices_delete_own ON public.invoices FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- invoice_lines
CREATE POLICY invoice_lines_select_own ON public.invoice_lines FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY invoice_lines_insert_own ON public.invoice_lines FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY invoice_lines_update_own ON public.invoice_lines FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY invoice_lines_delete_own ON public.invoice_lines FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY principals_select_own ON public.principals FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY principals_insert_own ON public.principals FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY principals_update_own ON public.principals FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY principals_delete_own ON public.principals FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY principal_clients_select_own ON public.principal_clients FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY principal_clients_insert_own ON public.principal_clients FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY principal_clients_update_own ON public.principal_clients FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY principal_clients_delete_own ON public.principal_clients FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY counterparties_select_own ON public.counterparties FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY counterparties_insert_own ON public.counterparties FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY counterparties_update_own ON public.counterparties FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY counterparties_delete_own ON public.counterparties FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY counterparty_subjects_select_own ON public.counterparty_subjects FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY counterparty_subjects_insert_own ON public.counterparty_subjects FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY counterparty_subjects_update_own ON public.counterparty_subjects FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY counterparty_subjects_delete_own ON public.counterparty_subjects FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY case_credit_transfers_select_own ON public.case_credit_transfers FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY case_credit_transfers_insert_own ON public.case_credit_transfers FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY case_credit_transfers_update_own ON public.case_credit_transfers FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY case_credit_transfers_delete_own ON public.case_credit_transfers FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY price_books_select_own ON public.price_books FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY price_books_insert_own ON public.price_books FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY price_books_update_own ON public.price_books FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY price_books_delete_own ON public.price_books FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY price_items_select_own ON public.price_items FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY price_items_insert_own ON public.price_items FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY price_items_update_own ON public.price_items FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY price_items_delete_own ON public.price_items FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY case_activities_select_own ON public.case_activities FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY case_activities_insert_own ON public.case_activities FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY case_activities_update_own ON public.case_activities FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY case_activities_delete_own ON public.case_activities FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY case_activity_hearings_select_own ON public.case_activity_hearings FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY case_activity_hearings_insert_own ON public.case_activity_hearings FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY case_activity_hearings_update_own ON public.case_activity_hearings FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY case_activity_hearings_delete_own ON public.case_activity_hearings FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY activity_attachments_select_own ON public.activity_attachments FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY activity_attachments_insert_own ON public.activity_attachments FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY activity_attachments_update_own ON public.activity_attachments FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY activity_attachments_delete_own ON public.activity_attachments FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY billing_runs_select_own ON public.billing_runs FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY billing_runs_insert_own ON public.billing_runs FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY billing_runs_update_own ON public.billing_runs FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY billing_runs_delete_own ON public.billing_runs FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY billing_run_items_select_own ON public.billing_run_items FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY billing_run_items_insert_own ON public.billing_run_items FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY billing_run_items_update_own ON public.billing_run_items FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY billing_run_items_delete_own ON public.billing_run_items FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY billing_exports_select_own ON public.billing_exports FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY billing_exports_insert_own ON public.billing_exports FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY billing_exports_update_own ON public.billing_exports FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY billing_exports_delete_own ON public.billing_exports FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY imports_select_own ON public.imports FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY imports_insert_own ON public.imports FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY imports_update_own ON public.imports FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY imports_delete_own ON public.imports FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY import_rows_select_own ON public.import_rows FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY import_rows_insert_own ON public.import_rows FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY import_rows_update_own ON public.import_rows FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY import_rows_delete_own ON public.import_rows FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY duplicate_reviews_select_own ON public.duplicate_reviews FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY duplicate_reviews_insert_own ON public.duplicate_reviews FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY duplicate_reviews_update_own ON public.duplicate_reviews FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY duplicate_reviews_delete_own ON public.duplicate_reviews FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
