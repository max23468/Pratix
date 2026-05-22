ALTER TABLE public.case_activities
  ADD COLUMN needs_review boolean NOT NULL DEFAULT false;

CREATE INDEX idx_case_activities_needs_review
  ON public.case_activities (user_id, needs_review, activity_date)
  WHERE needs_review;
