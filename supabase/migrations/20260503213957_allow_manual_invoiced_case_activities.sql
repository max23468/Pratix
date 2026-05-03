-- Fase 5 recupero crediti:
-- una voce fatturabile puo' essere marcata come gia' fatturata anche quando
-- deriva da archivio storico o inserimento manuale e non ha ancora una
-- fattura generata da Pratix. La Fase 6 colleghera' invoice_id per le fatture
-- prodotte dal modulo di fatturazione.

ALTER TABLE public.case_activities
  DROP CONSTRAINT IF EXISTS case_activities_invoiced_has_invoice;
