DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'vat_number'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'invoices'
      AND column_name = 'principal_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'principals'
      AND column_name = 'vat_number'
  ) THEN
    UPDATE public.principals p
    SET tax_code = COALESCE(NULLIF(p.tax_code, ''), NULLIF(c.tax_code, '')),
        vat_number = COALESCE(NULLIF(p.vat_number, ''), NULLIF(c.vat_number, '')),
        pec = COALESCE(NULLIF(p.pec, ''), NULLIF(c.pec, '')),
        sdi_code = COALESCE(NULLIF(p.sdi_code, ''), NULLIF(c.sdi_code, ''))
    FROM public.invoices i
    JOIN public.clients c
      ON c.id = i.client_id
     AND c.user_id = i.user_id
    WHERE p.id = i.principal_id
      AND p.user_id = i.user_id
      AND (
        (NULLIF(p.tax_code, '') IS NULL AND NULLIF(c.tax_code, '') IS NOT NULL)
        OR (NULLIF(p.vat_number, '') IS NULL AND NULLIF(c.vat_number, '') IS NOT NULL)
        OR (NULLIF(p.pec, '') IS NULL AND NULLIF(c.pec, '') IS NOT NULL)
        OR (NULLIF(p.sdi_code, '') IS NULL AND NULLIF(c.sdi_code, '') IS NOT NULL)
      );
  END IF;
END $$;

ALTER TABLE public.clients
  DROP COLUMN IF EXISTS tax_code,
  DROP COLUMN IF EXISTS vat_number,
  DROP COLUMN IF EXISTS pec,
  DROP COLUMN IF EXISTS sdi_code;
