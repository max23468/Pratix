-- =============================================================================
-- Pratix — Schema baseline
-- =============================================================================
-- Aggiornato: 2026-05-08 (RPC conferma import archivio, migration 20260508190457)
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

CREATE TYPE public.case_matter AS ENUM (
  'civile', 'penale', 'lavoro', 'famiglia',
  'amministrativo', 'tributario', 'commerciale', 'altro'
);

CREATE TYPE public.case_status AS ENUM (
  'open', 'in_progress', 'suspended', 'closed', 'archived'
);

CREATE TYPE public.client_kind AS ENUM ('individual', 'company');

CREATE TYPE public.fee_type AS ENUM ('flat', 'hourly');

CREATE TYPE public.invoice_line_kind AS ENUM (
  'fee', 'expense_taxable', 'expense_art15'
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
    IF NEW.case_number IS NOT NULL AND btrim(NEW.case_number) ~ '^[0-9]{1,9}$' THEN
      NEW.practice_number := btrim(NEW.case_number)::integer;
    ELSE
      PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));

      SELECT COALESCE(MAX(practice_number), 0) + 1
      INTO next_number
      FROM public.cases
      WHERE user_id = NEW.user_id;

      NEW.practice_number := next_number;
    END IF;
  END IF;

  IF NEW.practice_number <= 0 THEN
    RAISE EXCEPTION 'practice_number must be positive';
  END IF;

  IF NEW.case_number IS NULL OR length(btrim(NEW.case_number)) = 0 THEN
    NEW.case_number := NEW.practice_number::text;
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
  next_number integer;
BEGIN
  prefix := TG_ARGV[0];

  IF prefix IS NULL OR prefix !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'public_code prefix must be two uppercase letters';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.public_code := OLD.public_code;
    RETURN NEW;
  END IF;

  IF NEW.public_code IS NOT NULL AND length(btrim(NEW.public_code)) > 0 THEN
    NEW.public_code := upper(btrim(NEW.public_code));
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME || ':' || NEW.user_id::text, 0));

  EXECUTE format(
    'SELECT COALESCE(MAX(substring(public_code from %L)::integer), 0) + 1
       FROM %I.%I
      WHERE user_id = $1
        AND public_code ~ %L',
    '^' || prefix || '-([0-9]{5})$',
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    '^' || prefix || '-[0-9]{5}$'
  )
  INTO next_number
  USING NEW.user_id;

  NEW.public_code := prefix || '-' || lpad(next_number::text, 5, '0');
  RETURN NEW;
END;
$$;

-- Conferma una riga di import archivio in una singola transazione database.
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
  iban                        text,
  bank_name                   text,
  invoice_number_prefix       text,
  invoice_next_number         integer NOT NULL DEFAULT 1,
  invoice_year                integer NOT NULL DEFAULT (EXTRACT(year FROM now()))::integer,
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
  email            text,
  phone            text,
  address_street   text,
  address_city     text,
  address_zip      text,
  address_province text,
  address_country  text DEFAULT 'IT',
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
  case_number  text NOT NULL,
  practice_number integer NOT NULL,
  principal_id uuid,
  counterparty_id uuid,
  title        text NOT NULL,
  matter       public.case_matter NOT NULL DEFAULT 'civile',
  status       public.case_status NOT NULL DEFAULT 'open',
  authority    text,
  rg_number    text,
  counterparty text,
  fee_type     public.fee_type NOT NULL DEFAULT 'flat',
  agreed_fee   numeric DEFAULT 0,
  hourly_rate  numeric,
  retainer     numeric DEFAULT 0,
  opened_at    date NOT NULL DEFAULT CURRENT_DATE,
  closed_at    date,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cases_public_code_format CHECK (public_code ~ '^PR-[0-9]{5}$'),
  CONSTRAINT cases_practice_number_positive CHECK (practice_number > 0),
  UNIQUE (user_id, public_code),
  UNIQUE (user_id, case_number),
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
  taxable_expenses   numeric NOT NULL DEFAULT 0,
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
  kind        public.invoice_line_kind NOT NULL DEFAULT 'fee',
  description text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL DEFAULT 0,
  amount      numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines (invoice_id);
CREATE INDEX idx_invoice_lines_user    ON public.invoice_lines (user_id);

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

CREATE TABLE public.case_activity_hearings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  activity_id   uuid NOT NULL,
  hearing_date  date NOT NULL,
  position      integer NOT NULL DEFAULT 0,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, position),
  UNIQUE (activity_id, hearing_date)
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
  ADD CONSTRAINT cases_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.case_status_history
  ADD CONSTRAINT case_status_history_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE,
  ADD CONSTRAINT case_status_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT,
  ADD CONSTRAINT invoices_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE,
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
CREATE TRIGGER clients_assign_public_code     BEFORE INSERT OR UPDATE OF public_code ON public.clients FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CL');
CREATE TRIGGER user_table_preferences_set_updated_at BEFORE UPDATE ON public.user_table_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cases_set_updated_at           BEFORE UPDATE ON public.cases           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_set_updated_at        BEFORE UPDATE ON public.invoices        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_assign_public_code    BEFORE INSERT OR UPDATE OF public_code ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('FT');
CREATE TRIGGER principals_set_updated_at              BEFORE UPDATE ON public.principals              FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER principals_assign_public_code          BEFORE INSERT OR UPDATE OF public_code ON public.principals FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CM');
CREATE TRIGGER principal_clients_set_updated_at       BEFORE UPDATE ON public.principal_clients       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER counterparties_set_updated_at          BEFORE UPDATE ON public.counterparties          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER counterparties_assign_public_code      BEFORE INSERT OR UPDATE OF public_code ON public.counterparties FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CP');
CREATE TRIGGER counterparty_subjects_set_updated_at   BEFORE UPDATE ON public.counterparty_subjects   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_credit_transfers_set_updated_at   BEFORE UPDATE ON public.case_credit_transfers   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_books_set_updated_at             BEFORE UPDATE ON public.price_books             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_books_assign_public_code         BEFORE INSERT OR UPDATE OF public_code ON public.price_books FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('PZ');
CREATE TRIGGER price_items_set_updated_at             BEFORE UPDATE ON public.price_items             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_activities_set_updated_at         BEFORE UPDATE ON public.case_activities         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_activity_hearings_set_updated_at  BEFORE UPDATE ON public.case_activity_hearings  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER activity_attachments_set_updated_at    BEFORE UPDATE ON public.activity_attachments    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_runs_set_updated_at            BEFORE UPDATE ON public.billing_runs            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_run_items_set_updated_at       BEFORE UPDATE ON public.billing_run_items       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_exports_set_updated_at         BEFORE UPDATE ON public.billing_exports         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER imports_set_updated_at                 BEFORE UPDATE ON public.imports                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER import_rows_set_updated_at             BEFORE UPDATE ON public.import_rows             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER cases_log_status_change
  AFTER INSERT OR UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.log_case_status_change();

CREATE TRIGGER cases_assign_practice_number
  BEFORE INSERT OR UPDATE OF case_number, practice_number, user_id
  ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.assign_case_practice_number();

CREATE TRIGGER cases_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code
  ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('PR');

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
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_table_preferences TO authenticated;


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
