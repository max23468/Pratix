-- Evita il riuso dei codici pubblici dopo eliminazioni usando contatori
-- persistenti sul profilo utente, invece di MAX(public_code) sulle righe vive.

ALTER TABLE public.profiles
  ADD COLUMN client_public_code_next_number integer NOT NULL DEFAULT 1,
  ADD COLUMN principal_public_code_next_number integer NOT NULL DEFAULT 1,
  ADD COLUMN counterparty_public_code_next_number integer NOT NULL DEFAULT 1,
  ADD COLUMN case_public_code_next_number integer NOT NULL DEFAULT 1,
  ADD COLUMN price_book_public_code_next_number integer NOT NULL DEFAULT 1,
  ADD COLUMN invoice_public_code_next_number integer NOT NULL DEFAULT 1;

UPDATE public.profiles p
SET client_public_code_next_number = COALESCE((
      SELECT MAX(substring(public_code from '^CL-([0-9]{5})$')::integer) + 1
      FROM public.clients c
      WHERE c.user_id = p.id
        AND c.public_code ~ '^CL-[0-9]{5}$'
    ), 1),
    principal_public_code_next_number = COALESCE((
      SELECT MAX(substring(public_code from '^CM-([0-9]{5})$')::integer) + 1
      FROM public.principals pr
      WHERE pr.user_id = p.id
        AND pr.public_code ~ '^CM-[0-9]{5}$'
    ), 1),
    counterparty_public_code_next_number = COALESCE((
      SELECT MAX(substring(public_code from '^CP-([0-9]{5})$')::integer) + 1
      FROM public.counterparties co
      WHERE co.user_id = p.id
        AND co.public_code ~ '^CP-[0-9]{5}$'
    ), 1),
    case_public_code_next_number = COALESCE((
      SELECT MAX(substring(public_code from '^PR-([0-9]{5})$')::integer) + 1
      FROM public.cases ca
      WHERE ca.user_id = p.id
        AND ca.public_code ~ '^PR-[0-9]{5}$'
    ), 1),
    price_book_public_code_next_number = COALESCE((
      SELECT MAX(substring(public_code from '^PZ-([0-9]{5})$')::integer) + 1
      FROM public.price_books pb
      WHERE pb.user_id = p.id
        AND pb.public_code ~ '^PZ-[0-9]{5}$'
    ), 1),
    invoice_public_code_next_number = COALESCE((
      SELECT MAX(substring(public_code from '^FT-([0-9]{5})$')::integer) + 1
      FROM public.invoices i
      WHERE i.user_id = p.id
        AND i.public_code ~ '^FT-[0-9]{5}$'
    ), 1);

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

DROP TRIGGER clients_assign_public_code ON public.clients;
CREATE TRIGGER clients_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CL', 'client_public_code_next_number');

DROP TRIGGER principals_assign_public_code ON public.principals;
CREATE TRIGGER principals_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.principals
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CM', 'principal_public_code_next_number');

DROP TRIGGER counterparties_assign_public_code ON public.counterparties;
CREATE TRIGGER counterparties_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.counterparties
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CP', 'counterparty_public_code_next_number');

DROP TRIGGER cases_assign_public_code ON public.cases;
CREATE TRIGGER cases_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('PR', 'case_public_code_next_number');

DROP TRIGGER price_books_assign_public_code ON public.price_books;
CREATE TRIGGER price_books_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.price_books
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('PZ', 'price_book_public_code_next_number');

DROP TRIGGER invoices_assign_public_code ON public.invoices;
CREATE TRIGGER invoices_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('FT', 'invoice_public_code_next_number');
