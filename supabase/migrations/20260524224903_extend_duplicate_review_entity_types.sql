ALTER TABLE public.duplicate_reviews
  DROP CONSTRAINT duplicate_reviews_entity_type_check;

ALTER TABLE public.duplicate_reviews
  ADD CONSTRAINT duplicate_reviews_entity_type_check CHECK (
    entity_type IN (
      'principal',
      'client',
      'counterparty',
      'case',
      'activity',
      'counterparty_subject',
      'cross_entity'
    )
  );
