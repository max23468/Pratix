-- Fase 6 recupero crediti: i rimborsi spese sono ora attività fatturabili
-- (`case_activities.kind = 'expense_reimbursement'`) e il vecchio modulo
-- `expenses` non è più usato dal prodotto.

DROP TABLE IF EXISTS public.expenses;
DROP TYPE IF EXISTS public.expense_category;
