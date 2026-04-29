
-- ENUMS
CREATE TYPE public.client_kind AS ENUM ('individual', 'company');
CREATE TYPE public.case_status AS ENUM ('open', 'in_progress', 'suspended', 'closed', 'archived');
CREATE TYPE public.case_matter AS ENUM ('civile', 'penale', 'lavoro', 'famiglia', 'amministrativo', 'tributario', 'commerciale', 'altro');
CREATE TYPE public.fee_type AS ENUM ('flat', 'hourly');
CREATE TYPE public.expense_category AS ENUM ('contributo_unificato', 'marche_da_bollo', 'copie', 'trasferte', 'ctu', 'notifiche', 'altro');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'issued', 'paid', 'overdue');
CREATE TYPE public.tax_regime AS ENUM ('ordinario', 'forfettario');
CREATE TYPE public.invoice_line_kind AS ENUM ('fee', 'expense_taxable', 'expense_art15');

-- Helper trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- PROFILES (dati studio)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Dati identificativi
  full_name TEXT,
  business_name TEXT,
  vat_number TEXT,
  tax_code TEXT,
  -- Indirizzo
  address_street TEXT,
  address_city TEXT,
  address_zip TEXT,
  address_province TEXT,
  address_country TEXT DEFAULT 'IT',
  -- Contatti
  phone TEXT,
  email TEXT,
  pec TEXT,
  -- REA / albo
  rea TEXT,
  bar_association TEXT,
  -- Regime fiscale
  tax_regime public.tax_regime NOT NULL DEFAULT 'ordinario',
  cassa_rate NUMERIC(5,2) NOT NULL DEFAULT 4.00,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 22.00,
  withholding_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  apply_withholding BOOLEAN NOT NULL DEFAULT true,
  -- Pagamenti
  iban TEXT,
  bank_name TEXT,
  -- Numerazione fatture
  invoice_number_prefix TEXT,
  invoice_next_number INTEGER NOT NULL DEFAULT 1,
  invoice_year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM now())::INTEGER,
  -- Branding
  logo_url TEXT,
  -- Stato onboarding
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: crea automaticamente il profilo quando si registra un utente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CLIENTS
-- ============================================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.client_kind NOT NULL DEFAULT 'individual',
  -- Persona
  first_name TEXT,
  last_name TEXT,
  -- Azienda
  business_name TEXT,
  -- Fiscali
  tax_code TEXT,
  vat_number TEXT,
  -- Contatti
  email TEXT,
  phone TEXT,
  pec TEXT,
  sdi_code TEXT, -- codice destinatario 7 caratteri
  -- Indirizzo
  address_street TEXT,
  address_city TEXT,
  address_zip TEXT,
  address_province TEXT,
  address_country TEXT DEFAULT 'IT',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_user ON public.clients(user_id);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own" ON public.clients
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "clients_insert_own" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_update_own" ON public.clients
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_delete_own" ON public.clients
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER clients_set_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- CASES (pratiche)
-- ============================================================
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  case_number TEXT NOT NULL,
  title TEXT NOT NULL,
  counterparty TEXT,
  matter public.case_matter NOT NULL DEFAULT 'civile',
  status public.case_status NOT NULL DEFAULT 'open',
  authority TEXT, -- autorità giudiziaria
  rg_number TEXT, -- R.G.
  opened_at DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_at DATE,
  -- Tariffe pattuite
  fee_type public.fee_type NOT NULL DEFAULT 'flat',
  agreed_fee NUMERIC(12,2) DEFAULT 0,
  hourly_rate NUMERIC(12,2),
  retainer NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, case_number)
);

CREATE INDEX idx_cases_user ON public.cases(user_id);
CREATE INDEX idx_cases_client ON public.cases(client_id);
CREATE INDEX idx_cases_status ON public.cases(status);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cases_select_own" ON public.cases
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "cases_insert_own" ON public.cases
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cases_update_own" ON public.cases
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cases_delete_own" ON public.cases
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER cases_set_updated_at
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: registra cambi di stato in case_status_history
-- (la tabella history viene creata sotto, ma il trigger viene definito dopo)

-- ============================================================
-- CASE STATUS HISTORY
-- ============================================================
CREATE TABLE public.case_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_status public.case_status,
  new_status public.case_status NOT NULL,
  note TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_status_history_case ON public.case_status_history(case_id);

ALTER TABLE public.case_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_status_history_select_own" ON public.case_status_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "case_status_history_insert_own" ON public.case_status_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Trigger: registra automaticamente il cambio di stato
CREATE OR REPLACE FUNCTION public.log_case_status_change()
RETURNS TRIGGER
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

CREATE TRIGGER cases_log_status_change
  AFTER INSERT OR UPDATE OF status ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.log_case_status_change();

-- ============================================================
-- CASE DEADLINES
-- ============================================================
CREATE TABLE public.case_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  description TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_case_deadlines_case ON public.case_deadlines(case_id);
CREATE INDEX idx_case_deadlines_user_due ON public.case_deadlines(user_id, due_date);

ALTER TABLE public.case_deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "case_deadlines_select_own" ON public.case_deadlines
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "case_deadlines_insert_own" ON public.case_deadlines
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "case_deadlines_update_own" ON public.case_deadlines
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "case_deadlines_delete_own" ON public.case_deadlines
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER case_deadlines_set_updated_at
  BEFORE UPDATE ON public.case_deadlines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category public.expense_category NOT NULL DEFAULT 'altro',
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Anticipazione ex art. 15 DPR 633/72 (esclusa da IVA)
  is_art15 BOOLEAN NOT NULL DEFAULT false,
  invoice_id UUID, -- riferimento alla fattura quando addebitata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_case ON public.expenses(case_id);
CREATE INDEX idx_expenses_user ON public.expenses(user_id);
CREATE INDEX idx_expenses_invoice ON public.expenses(invoice_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select_own" ON public.expenses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "expenses_insert_own" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses_update_own" ON public.expenses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses_delete_own" ON public.expenses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  case_id UUID REFERENCES public.cases(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  year INTEGER NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status public.invoice_status NOT NULL DEFAULT 'draft',
  -- Aliquote applicate (snapshot al momento della creazione)
  cassa_rate NUMERIC(5,2) NOT NULL DEFAULT 4.00,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 22.00,
  withholding_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  apply_withholding BOOLEAN NOT NULL DEFAULT true,
  -- Totali calcolati
  taxable_fees NUMERIC(12,2) NOT NULL DEFAULT 0,
  taxable_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  art15_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  cassa_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  withholding_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  stamp_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_to_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  -- Pagamento
  paid_at DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, number)
);

CREATE INDEX idx_invoices_user ON public.invoices(user_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_case ON public.invoices(case_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select_own" ON public.invoices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update_own" ON public.invoices
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_delete_own" ON public.invoices
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER invoices_set_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- FK ritardata da expenses a invoices
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_invoice_fk
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

-- ============================================================
-- INVOICE LINES
-- ============================================================
CREATE TABLE public.invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.invoice_line_kind NOT NULL DEFAULT 'fee',
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_lines_select_own" ON public.invoice_lines
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "invoice_lines_insert_own" ON public.invoice_lines
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoice_lines_update_own" ON public.invoice_lines
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoice_lines_delete_own" ON public.invoice_lines
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
