-- Codici pubblici stabili per URL leggibili senza esporre nomi o UUID.

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

REVOKE EXECUTE ON FUNCTION public.assign_public_code() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.clients ADD COLUMN public_code text;
ALTER TABLE public.principals ADD COLUMN public_code text;
ALTER TABLE public.counterparties ADD COLUMN public_code text;
ALTER TABLE public.cases ADD COLUMN public_code text;
ALTER TABLE public.price_books ADD COLUMN public_code text;
ALTER TABLE public.invoices ADD COLUMN public_code text;

WITH numbered AS (
  SELECT id, 'CL-' || lpad(row_number() OVER (PARTITION BY user_id ORDER BY created_at, id)::text, 5, '0') AS public_code
  FROM public.clients
)
UPDATE public.clients target
SET public_code = numbered.public_code
FROM numbered
WHERE target.id = numbered.id;

WITH numbered AS (
  SELECT id, 'CM-' || lpad(row_number() OVER (PARTITION BY user_id ORDER BY created_at, id)::text, 5, '0') AS public_code
  FROM public.principals
)
UPDATE public.principals target
SET public_code = numbered.public_code
FROM numbered
WHERE target.id = numbered.id;

WITH numbered AS (
  SELECT id, 'CP-' || lpad(row_number() OVER (PARTITION BY user_id ORDER BY created_at, id)::text, 5, '0') AS public_code
  FROM public.counterparties
)
UPDATE public.counterparties target
SET public_code = numbered.public_code
FROM numbered
WHERE target.id = numbered.id;

WITH numbered AS (
  SELECT id, 'PR-' || lpad(row_number() OVER (PARTITION BY user_id ORDER BY created_at, id)::text, 5, '0') AS public_code
  FROM public.cases
)
UPDATE public.cases target
SET public_code = numbered.public_code
FROM numbered
WHERE target.id = numbered.id;

WITH numbered AS (
  SELECT id, 'PZ-' || lpad(row_number() OVER (PARTITION BY user_id ORDER BY created_at, id)::text, 5, '0') AS public_code
  FROM public.price_books
)
UPDATE public.price_books target
SET public_code = numbered.public_code
FROM numbered
WHERE target.id = numbered.id;

WITH numbered AS (
  SELECT id, 'FT-' || lpad(row_number() OVER (PARTITION BY user_id ORDER BY created_at, id)::text, 5, '0') AS public_code
  FROM public.invoices
)
UPDATE public.invoices target
SET public_code = numbered.public_code
FROM numbered
WHERE target.id = numbered.id;

ALTER TABLE public.clients
  ALTER COLUMN public_code SET NOT NULL,
  ADD CONSTRAINT clients_public_code_format CHECK (public_code ~ '^CL-[0-9]{5}$'),
  ADD CONSTRAINT clients_user_public_code_key UNIQUE (user_id, public_code);

ALTER TABLE public.principals
  ALTER COLUMN public_code SET NOT NULL,
  ADD CONSTRAINT principals_public_code_format CHECK (public_code ~ '^CM-[0-9]{5}$'),
  ADD CONSTRAINT principals_user_public_code_key UNIQUE (user_id, public_code);

ALTER TABLE public.counterparties
  ALTER COLUMN public_code SET NOT NULL,
  ADD CONSTRAINT counterparties_public_code_format CHECK (public_code ~ '^CP-[0-9]{5}$'),
  ADD CONSTRAINT counterparties_user_public_code_key UNIQUE (user_id, public_code);

ALTER TABLE public.cases
  ALTER COLUMN public_code SET NOT NULL,
  ADD CONSTRAINT cases_public_code_format CHECK (public_code ~ '^PR-[0-9]{5}$'),
  ADD CONSTRAINT cases_user_public_code_key UNIQUE (user_id, public_code);

ALTER TABLE public.price_books
  ALTER COLUMN public_code SET NOT NULL,
  ADD CONSTRAINT price_books_public_code_format CHECK (public_code ~ '^PZ-[0-9]{5}$'),
  ADD CONSTRAINT price_books_user_public_code_key UNIQUE (user_id, public_code);

ALTER TABLE public.invoices
  ALTER COLUMN public_code SET NOT NULL,
  ADD CONSTRAINT invoices_public_code_format CHECK (public_code ~ '^FT-[0-9]{5}$'),
  ADD CONSTRAINT invoices_user_public_code_key UNIQUE (user_id, public_code);

CREATE TRIGGER clients_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CL');

CREATE TRIGGER principals_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.principals
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CM');

CREATE TRIGGER counterparties_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.counterparties
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('CP');

CREATE TRIGGER cases_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('PR');

CREATE TRIGGER price_books_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.price_books
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('PZ');

CREATE TRIGGER invoices_assign_public_code
  BEFORE INSERT OR UPDATE OF public_code ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_public_code('FT');
