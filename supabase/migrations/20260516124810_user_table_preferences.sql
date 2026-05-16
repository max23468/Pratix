CREATE TABLE public.user_table_preferences (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section        text NOT NULL CHECK (length(trim(section)) > 0),
  sort_key       text NOT NULL CHECK (length(trim(sort_key)) > 0),
  sort_direction text NOT NULL CHECK (sort_direction IN ('asc', 'desc')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, section)
);

CREATE INDEX idx_user_table_preferences_user ON public.user_table_preferences (user_id);

CREATE TRIGGER user_table_preferences_set_updated_at
  BEFORE UPDATE ON public.user_table_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_table_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_table_preferences TO authenticated;

CREATE POLICY user_table_preferences_select_own
  ON public.user_table_preferences
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY user_table_preferences_insert_own
  ON public.user_table_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_table_preferences_update_own
  ON public.user_table_preferences
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY user_table_preferences_delete_own
  ON public.user_table_preferences
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
