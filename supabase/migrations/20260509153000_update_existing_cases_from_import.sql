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
    RAISE EXCEPTION 'Riga di import non trovata o non confermabile.';
  END IF;

  IF v_normalized IS NULL OR v_normalized = '{}'::jsonb THEN
    RAISE EXCEPTION 'Riga di import senza dati normalizzati.';
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
      business_name,
      address_country
    )
    VALUES (
      v_user_id,
      (v_normalized #>> '{client,kind}')::public.client_kind,
      CASE WHEN v_normalized #>> '{client,kind}' = 'individual'
        THEN nullif(v_normalized #>> '{client,firstName}', '') ELSE NULL END,
      CASE WHEN v_normalized #>> '{client,kind}' = 'individual'
        THEN nullif(v_normalized #>> '{client,lastName}', '') ELSE NULL END,
      CASE WHEN v_normalized #>> '{client,kind}' = 'company'
        THEN nullif(v_normalized #>> '{client,businessName}', '') ELSE NULL END,
      'IT'
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
        case_number = v_normalized #>> '{practice,practiceNumber}',
        title = v_normalized #>> '{practice,title}',
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
      user_id, principal_id, client_id, counterparty_id, practice_number, case_number,
      title, matter, status, fee_type, agreed_fee, hourly_rate, retainer, counterparty,
      authority, rg_number, opened_at, closed_at, notes
    )
    VALUES (
      v_user_id, v_principal_id, v_client_id, v_counterparty_id,
      (v_normalized #>> '{practice,practiceNumber}')::integer,
      v_normalized #>> '{practice,practiceNumber}',
      v_normalized #>> '{practice,title}',
      'civile',
      (v_normalized #>> '{practice,status}')::public.case_status,
      'flat', 0, NULL, 0, NULL,
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
      RAISE EXCEPTION 'Voce prezzo non valida per la riga di import.';
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

REVOKE ALL ON FUNCTION public.apply_import_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_import_row(uuid) TO authenticated;
