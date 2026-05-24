-- Bonifica residui pre-focus recupero crediti:
-- la Pratica usa solo practice_number e soggetti strutturati.

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

    INSERT INTO public.case_activities (
      id, user_id, case_id, principal_id, client_id, counterparty_id,
      price_book_id, price_item_id, activity_date, kind, status,
      description, quantity, unit_price, notes
    )
    VALUES (
      (v_activity ->> 'id')::uuid,
      v_user_id,
      v_case_id,
      v_principal_id,
      v_client_id,
      v_counterparty_id,
      (v_activity ->> 'priceBookId')::uuid,
      (v_activity ->> 'priceItemId')::uuid,
      (v_activity ->> 'activityDate')::date,
      (v_activity ->> 'kind')::public.price_item_kind,
      (v_activity ->> 'status')::public.case_activity_status,
      v_activity ->> 'description',
      (v_activity ->> 'quantity')::numeric,
      (v_activity ->> 'unitPrice')::numeric,
      nullif(v_activity ->> 'notes', '')
    )
    ON CONFLICT (id) DO UPDATE SET
      principal_id = excluded.principal_id,
      client_id = excluded.client_id,
      counterparty_id = excluded.counterparty_id,
      price_book_id = excluded.price_book_id,
      price_item_id = excluded.price_item_id,
      activity_date = excluded.activity_date,
      kind = excluded.kind,
      status = excluded.status,
      description = excluded.description,
      quantity = excluded.quantity,
      unit_price = excluded.unit_price,
      notes = excluded.notes,
      updated_at = now()
    WHERE public.case_activities.user_id = v_user_id
    RETURNING id INTO v_activity_id;

    DELETE FROM public.case_activity_hearings
    WHERE user_id = v_user_id
      AND activity_id = v_activity_id;

    IF jsonb_array_length(coalesce(v_activity -> 'hearingDates', '[]'::jsonb)) > 0 THEN
      FOR v_hearing_date IN
        SELECT value #>> '{}' FROM jsonb_array_elements(v_activity -> 'hearingDates')
      LOOP
        IF nullif(v_hearing_date, '') IS NOT NULL THEN
          INSERT INTO public.case_activity_hearings (
            user_id, activity_id, hearing_date, position
          )
          VALUES (
            v_user_id,
            v_activity_id,
            v_hearing_date::date,
            coalesce((
              SELECT max(position) + 1
              FROM public.case_activity_hearings
              WHERE activity_id = v_activity_id
            ), 0)
          );
        END IF;
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

DROP TRIGGER IF EXISTS cases_assign_practice_number ON public.cases;

CREATE TRIGGER cases_assign_practice_number
  BEFORE INSERT OR UPDATE OF practice_number, user_id
  ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.assign_case_practice_number();

ALTER TABLE public.cases
  DROP CONSTRAINT IF EXISTS cases_user_id_case_number_key,
  DROP COLUMN IF EXISTS case_number,
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS matter,
  DROP COLUMN IF EXISTS counterparty,
  DROP COLUMN IF EXISTS fee_type,
  DROP COLUMN IF EXISTS agreed_fee,
  DROP COLUMN IF EXISTS hourly_rate,
  DROP COLUMN IF EXISTS retainer;

DROP TYPE IF EXISTS public.case_matter;
DROP TYPE IF EXISTS public.fee_type;

DELETE FROM public.invoice_lines
WHERE kind = 'expense_taxable';

ALTER TABLE public.invoices
  DROP COLUMN IF EXISTS taxable_expenses;

ALTER TABLE public.invoice_lines
  ALTER COLUMN kind DROP DEFAULT,
  ALTER COLUMN kind TYPE text USING kind::text;

DROP TYPE IF EXISTS public.invoice_line_kind;

CREATE TYPE public.invoice_line_kind AS ENUM ('fee', 'expense_art15');

ALTER TABLE public.invoice_lines
  ALTER COLUMN kind TYPE public.invoice_line_kind USING kind::public.invoice_line_kind,
  ALTER COLUMN kind SET DEFAULT 'fee';
