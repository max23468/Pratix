CREATE TABLE public.duplicate_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  entity_type      text NOT NULL,
  left_record_id   uuid NOT NULL,
  right_record_id  uuid NOT NULL,
  score            numeric NOT NULL DEFAULT 0,
  confidence       text NOT NULL DEFAULT 'low',
  reasons          text[] NOT NULL DEFAULT ARRAY[]::text[],
  status           text NOT NULL DEFAULT 'open',
  kept_record_id   uuid,
  merged_record_id uuid,
  snapshot         jsonb NOT NULL DEFAULT '{}'::jsonb,
  note             text,
  detected_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT duplicate_reviews_entity_type_check CHECK (
    entity_type IN ('principal', 'client', 'counterparty', 'case')
  ),
  CONSTRAINT duplicate_reviews_confidence_check CHECK (confidence IN ('high', 'medium', 'low')),
  CONSTRAINT duplicate_reviews_status_check CHECK (
    status IN ('open', 'snoozed', 'dismissed', 'merged')
  ),
  CONSTRAINT duplicate_reviews_score_range CHECK (score >= 0 AND score <= 1),
  CONSTRAINT duplicate_reviews_distinct_records CHECK (left_record_id <> right_record_id),
  CONSTRAINT duplicate_reviews_ordered_pair CHECK (left_record_id < right_record_id),
  UNIQUE (user_id, entity_type, left_record_id, right_record_id)
);

CREATE INDEX idx_duplicate_reviews_user ON public.duplicate_reviews (user_id);
CREATE INDEX idx_duplicate_reviews_status ON public.duplicate_reviews (status);
CREATE INDEX idx_duplicate_reviews_entity ON public.duplicate_reviews (entity_type);

ALTER TABLE public.duplicate_reviews
  ADD CONSTRAINT duplicate_reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TRIGGER duplicate_reviews_set_updated_at
  BEFORE UPDATE ON public.duplicate_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.duplicate_reviews TO authenticated;

ALTER TABLE public.duplicate_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY duplicate_reviews_select_own
  ON public.duplicate_reviews
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY duplicate_reviews_insert_own
  ON public.duplicate_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY duplicate_reviews_update_own
  ON public.duplicate_reviews
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY duplicate_reviews_delete_own
  ON public.duplicate_reviews
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
