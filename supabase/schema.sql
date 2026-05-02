-- =============================================================================
-- Pratix — Schema baseline
-- =============================================================================
-- Generato: 2026-04-29 (versione app 0.3.0)
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

CREATE TYPE public.expense_category AS ENUM (
  'contributo_unificato', 'marche_da_bollo', 'copie',
  'trasferte', 'ctu', 'notifiche', 'altro'
);

CREATE TYPE public.fee_type AS ENUM ('flat', 'hourly');

CREATE TYPE public.invoice_line_kind AS ENUM (
  'fee', 'expense_taxable', 'expense_art15'
);

CREATE TYPE public.invoice_status AS ENUM (
  'draft', 'issued', 'paid', 'overdue'
);

CREATE TYPE public.tax_regime AS ENUM ('ordinario', 'forfettario');


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
  user_id          uuid NOT NULL,
  kind             public.client_kind NOT NULL DEFAULT 'individual',
  first_name       text,
  last_name        text,
  business_name    text,
  tax_code         text,
  vat_number       text,
  email            text,
  phone            text,
  pec              text,
  sdi_code         text,
  address_street   text,
  address_city     text,
  address_zip      text,
  address_province text,
  address_country  text DEFAULT 'IT',
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_user ON public.clients (user_id);

CREATE TABLE public.cases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  client_id    uuid,
  case_number  text NOT NULL,
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
  UNIQUE (user_id, case_number)
);
CREATE INDEX idx_cases_user   ON public.cases (user_id);
CREATE INDEX idx_cases_client ON public.cases (client_id);
CREATE INDEX idx_cases_status ON public.cases (status);

CREATE TABLE public.case_deadlines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  case_id      uuid NOT NULL,
  description  text NOT NULL,
  due_date     date NOT NULL,
  completed    boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_deadlines_case     ON public.case_deadlines (case_id);
CREATE INDEX idx_case_deadlines_user_due ON public.case_deadlines (user_id, due_date);

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

CREATE TABLE public.expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL,
  case_id      uuid NOT NULL,
  invoice_id   uuid,
  category     public.expense_category NOT NULL DEFAULT 'altro',
  description  text NOT NULL,
  amount       numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  is_art15     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_user    ON public.expenses (user_id);
CREATE INDEX idx_expenses_case    ON public.expenses (case_id);
CREATE INDEX idx_expenses_invoice ON public.expenses (invoice_id);

CREATE TABLE public.invoices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, number)
);
CREATE INDEX idx_invoices_user   ON public.invoices (user_id);
CREATE INDEX idx_invoices_client ON public.invoices (client_id);
CREATE INDEX idx_invoices_case   ON public.invoices (case_id);
CREATE INDEX idx_invoices_status ON public.invoices (status);

CREATE TABLE public.invoice_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  invoice_id  uuid NOT NULL,
  position    integer NOT NULL DEFAULT 0,
  kind        public.invoice_line_kind NOT NULL DEFAULT 'fee',
  description text NOT NULL,
  quantity    numeric NOT NULL DEFAULT 1,
  unit_price  numeric NOT NULL DEFAULT 0,
  amount      numeric NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines (invoice_id);


-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_user_id_fkey
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

ALTER TABLE public.case_deadlines
  ADD CONSTRAINT case_deadlines_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE,
  ADD CONSTRAINT case_deadlines_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE CASCADE,
  ADD CONSTRAINT expenses_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE RESTRICT,
  ADD CONSTRAINT invoices_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_invoice_fk
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE,
  ADD CONSTRAINT invoice_lines_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER profiles_set_updated_at        BEFORE UPDATE ON public.profiles        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clients_set_updated_at         BEFORE UPDATE ON public.clients         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER cases_set_updated_at           BEFORE UPDATE ON public.cases           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER case_deadlines_set_updated_at  BEFORE UPDATE ON public.case_deadlines  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER expenses_set_updated_at        BEFORE UPDATE ON public.expenses        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER invoices_set_updated_at        BEFORE UPDATE ON public.invoices        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER cases_log_status_change
  AFTER INSERT OR UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.log_case_status_change();

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


-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Pattern: ogni tabella espone solo le righe dove (select auth.uid()) = user_id
-- (tranne profiles, dove la chiave è id che coincide con auth.uid()).

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_deadlines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines       ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((select auth.uid()) = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

-- clients
CREATE POLICY clients_select_own ON public.clients FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY clients_insert_own ON public.clients FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY clients_update_own ON public.clients FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY clients_delete_own ON public.clients FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- cases
CREATE POLICY cases_select_own ON public.cases FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY cases_insert_own ON public.cases FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY cases_update_own ON public.cases FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY cases_delete_own ON public.cases FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- case_deadlines
CREATE POLICY case_deadlines_select_own ON public.case_deadlines FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY case_deadlines_insert_own ON public.case_deadlines FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY case_deadlines_update_own ON public.case_deadlines FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY case_deadlines_delete_own ON public.case_deadlines FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- case_status_history (solo select + insert; lo storico non si modifica)
CREATE POLICY case_status_history_select_own ON public.case_status_history FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY case_status_history_insert_own ON public.case_status_history FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

-- expenses
CREATE POLICY expenses_select_own ON public.expenses FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY expenses_insert_own ON public.expenses FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY expenses_update_own ON public.expenses FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY expenses_delete_own ON public.expenses FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

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
