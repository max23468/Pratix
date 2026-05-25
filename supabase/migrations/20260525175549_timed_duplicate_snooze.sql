ALTER TABLE public.duplicate_reviews
  ADD COLUMN snoozed_until timestamptz;

CREATE INDEX idx_duplicate_reviews_snoozed_until
  ON public.duplicate_reviews (snoozed_until)
  WHERE status = 'snoozed';
