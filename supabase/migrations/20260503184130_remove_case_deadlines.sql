-- Phase 1 recupero crediti: remove the standalone deadline module.
-- The table is no longer part of the active product domain; invoice payment
-- due dates remain on invoices.

DROP TABLE IF EXISTS public.case_deadlines;
