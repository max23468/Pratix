-- Phase 2 recupero crediti: compatible data foundation.
--
-- This migration introduces the debt-collection domain without removing the
-- legacy columns still used by the current UI. Later UI phases can switch to
-- these tables progressively, then remove compatibility fields when safe.

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE public.counterparty_kind AS ENUM ('individual', 'company', 'group');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.price_book_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.price_item_kind AS ENUM ('fee', 'expense_reimbursement');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.case_activity_status AS ENUM ('to_invoice', 'invoiced');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.billing_run_status AS ENUM ('draft', 'finalized', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.billing_run_item_status AS ENUM ('included', 'postponed', 'excluded');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.billing_export_kind AS ENUM ('fees', 'expenses');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.import_mode AS ENUM ('manual', 'excel');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.import_status AS ENUM ('draft', 'validated', 'imported', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.import_row_status AS ENUM ('pending', 'valid', 'warning', 'error', 'imported', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- COMPATIBILITY KEYS AND COLUMNS
-- ============================================================================

ALTER TABLE public.clients
  ADD CONSTRAINT clients_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.cases
  ADD CONSTRAINT cases_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.cases
  ADD COLUMN practice_number integer,
  ADD COLUMN principal_id uuid,
  ADD COLUMN counterparty_id uuid;

WITH parsed_cases AS (
  SELECT
    id,
    user_id,
    CASE
      WHEN btrim(case_number) ~ '^[0-9]{1,9}$' THEN btrim(case_number)::integer
      ELSE NULL
    END AS parsed_number,
    CASE
      WHEN btrim(case_number) ~ '^[0-9]{1,9}$' THEN NULL
      ELSE row_number() OVER (PARTITION BY user_id ORDER BY created_at, id)
    END AS fallback_number
  FROM public.cases
),
user_max AS (
  SELECT user_id, COALESCE(MAX(parsed_number), 0) AS max_number
  FROM parsed_cases
  GROUP BY user_id
)
UPDATE public.cases AS c
SET practice_number = COALESCE(p.parsed_number, u.max_number + p.fallback_number)
FROM parsed_cases AS p
JOIN user_max AS u ON u.user_id = p.user_id
WHERE c.id = p.id;

ALTER TABLE public.cases
  ALTER COLUMN practice_number SET NOT NULL,
  ADD CONSTRAINT cases_practice_number_positive CHECK (practice_number > 0);

CREATE UNIQUE INDEX idx_cases_user_practice_number
  ON public.cases (user_id, practice_number);

ALTER TABLE public.invoices
  ADD COLUMN principal_id uuid,
  ADD COLUMN billing_run_id uuid,
  ADD COLUMN include_general_expenses boolean NOT NULL DEFAULT false,
  ADD COLUMN general_expenses_rate numeric NOT NULL DEFAULT 10.00,
  ADD COLUMN general_expenses_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN cassa_base_amount numeric NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_lines
  ADD COLUMN case_activity_id uuid,
  ADD COLUMN practice_number integer,
  ADD COLUMN client_name text,
  ADD COLUMN counterparty_name text,
  ADD COLUMN activity_date date;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE public.principals (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  CONSTRAINT case_activities_invoiced_has_invoice CHECK (status <> 'invoiced' OR invoice_id IS NOT NULL),
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
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

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

CREATE TRIGGER cases_assign_practice_number
  BEFORE INSERT OR UPDATE OF case_number, practice_number, user_id
  ON public.cases
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_case_practice_number();

CREATE TRIGGER case_activities_set_amount
  BEFORE INSERT OR UPDATE OF quantity, unit_price
  ON public.case_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_case_activity_amount();

CREATE TRIGGER principals_set_updated_at              BEFORE UPDATE ON public.principals              FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER principal_clients_set_updated_at       BEFORE UPDATE ON public.principal_clients       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER counterparties_set_updated_at          BEFORE UPDATE ON public.counterparties          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER counterparty_subjects_set_updated_at   BEFORE UPDATE ON public.counterparty_subjects   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_credit_transfers_set_updated_at   BEFORE UPDATE ON public.case_credit_transfers   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_books_set_updated_at             BEFORE UPDATE ON public.price_books             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER price_items_set_updated_at             BEFORE UPDATE ON public.price_items             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_activities_set_updated_at         BEFORE UPDATE ON public.case_activities         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_activity_hearings_set_updated_at  BEFORE UPDATE ON public.case_activity_hearings  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER activity_attachments_set_updated_at    BEFORE UPDATE ON public.activity_attachments    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_runs_set_updated_at            BEFORE UPDATE ON public.billing_runs            FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_run_items_set_updated_at       BEFORE UPDATE ON public.billing_run_items       FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER billing_exports_set_updated_at         BEFORE UPDATE ON public.billing_exports         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER imports_set_updated_at                 BEFORE UPDATE ON public.imports                 FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER import_rows_set_updated_at             BEFORE UPDATE ON public.import_rows             FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE EXECUTE ON FUNCTION public.assign_case_practice_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_case_activity_amount() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_practice_number() TO authenticated;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

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

-- ============================================================================
-- STORAGE MIME TYPES
-- ============================================================================

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT mime_type
  FROM unnest(
    coalesce(allowed_mime_types, ARRAY[]::text[])
    || ARRAY[
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.oasis.opendocument.spreadsheet'
    ]::text[]
  ) AS mime_type
)
WHERE id = 'pratix-documents';
