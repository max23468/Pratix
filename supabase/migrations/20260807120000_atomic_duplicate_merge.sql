CREATE OR REPLACE FUNCTION public.merge_duplicate_records(
  p_entity_type text,
  p_left_record_id uuid,
  p_right_record_id uuid,
  p_kept_record_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_merged_record_id uuid;
  v_review_id uuid;
  v_review jsonb;
  v_case_public_code text;
  v_case_practice_number integer;
  v_case_principal_id uuid;
  v_case_client_id uuid;
  v_case_counterparty_id uuid;
  v_next_position integer;
  v_target text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF p_entity_type NOT IN ('principal', 'client', 'counterparty', 'case') THEN
    RAISE EXCEPTION 'duplicate entity cannot be merged';
  END IF;
  IF p_left_record_id IS NULL OR p_right_record_id IS NULL
     OR p_left_record_id = p_right_record_id THEN
    RAISE EXCEPTION 'invalid duplicate pair';
  END IF;
  IF p_kept_record_id NOT IN (p_left_record_id, p_right_record_id) THEN
    RAISE EXCEPTION 'invalid kept record';
  END IF;

  v_merged_record_id := CASE
    WHEN p_kept_record_id = p_left_record_id THEN p_right_record_id
    ELSE p_left_record_id
  END;

  SELECT id
    INTO v_review_id
  FROM public.duplicate_reviews
  WHERE user_id = v_user_id
    AND entity_type = p_entity_type
    AND left_record_id = least(p_left_record_id, p_right_record_id)
    AND right_record_id = greatest(p_left_record_id, p_right_record_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'duplicate review not found';
  END IF;

  IF p_entity_type = 'principal' THEN
    PERFORM id FROM public.principals
    WHERE id = p_kept_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kept principal not found'; END IF;

    PERFORM id FROM public.principals
    WHERE id = v_merged_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'merged principal not found'; END IF;

    UPDATE public.cases
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    UPDATE public.case_activities
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    UPDATE public.invoices
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    UPDATE public.billing_runs
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    DELETE FROM public.principal_clients merged_link
    USING public.principal_clients kept_link
    WHERE merged_link.user_id = v_user_id
      AND merged_link.principal_id = v_merged_record_id
      AND kept_link.user_id = v_user_id
      AND kept_link.principal_id = p_kept_record_id
      AND kept_link.client_id = merged_link.client_id;

    UPDATE public.principal_clients
    SET principal_id = p_kept_record_id
    WHERE user_id = v_user_id AND principal_id = v_merged_record_id;

    UPDATE public.price_books merged_book
    SET principal_id = p_kept_record_id
    WHERE merged_book.user_id = v_user_id
      AND merged_book.principal_id = v_merged_record_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.price_books kept_book
        WHERE kept_book.user_id = v_user_id
          AND kept_book.principal_id = p_kept_record_id
          AND kept_book.year = merged_book.year
      );

    UPDATE public.principals
    SET archived_at = now()
    WHERE id = v_merged_record_id AND user_id = v_user_id;

  ELSIF p_entity_type = 'client' THEN
    PERFORM id FROM public.clients
    WHERE id = p_kept_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kept client not found'; END IF;

    PERFORM id FROM public.clients
    WHERE id = v_merged_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'merged client not found'; END IF;

    UPDATE public.cases
    SET client_id = p_kept_record_id
    WHERE user_id = v_user_id AND client_id = v_merged_record_id;

    UPDATE public.case_activities
    SET client_id = p_kept_record_id
    WHERE user_id = v_user_id AND client_id = v_merged_record_id;

    UPDATE public.invoices
    SET client_id = p_kept_record_id
    WHERE user_id = v_user_id AND client_id = v_merged_record_id;

    UPDATE public.case_credit_transfers
    SET previous_client_id = p_kept_record_id
    WHERE user_id = v_user_id AND previous_client_id = v_merged_record_id;

    UPDATE public.case_credit_transfers
    SET new_client_id = p_kept_record_id
    WHERE user_id = v_user_id AND new_client_id = v_merged_record_id;

    DELETE FROM public.principal_clients merged_link
    USING public.principal_clients kept_link
    WHERE merged_link.user_id = v_user_id
      AND merged_link.client_id = v_merged_record_id
      AND kept_link.user_id = v_user_id
      AND kept_link.client_id = p_kept_record_id
      AND kept_link.principal_id = merged_link.principal_id;

    UPDATE public.principal_clients
    SET client_id = p_kept_record_id
    WHERE user_id = v_user_id AND client_id = v_merged_record_id;

    DELETE FROM public.clients
    WHERE id = v_merged_record_id
      AND user_id = v_user_id
      AND nullif(btrim(notes), '') IS NULL;

  ELSIF p_entity_type = 'counterparty' THEN
    PERFORM id FROM public.counterparties
    WHERE id = p_kept_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kept counterparty not found'; END IF;

    PERFORM id FROM public.counterparties
    WHERE id = v_merged_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'merged counterparty not found'; END IF;

    UPDATE public.cases
    SET counterparty_id = p_kept_record_id
    WHERE user_id = v_user_id AND counterparty_id = v_merged_record_id;

    SELECT coalesce(max(position), -1) + 1
      INTO v_next_position
    FROM public.counterparty_subjects
    WHERE user_id = v_user_id AND counterparty_id = p_kept_record_id;

    WITH moved_subjects AS (
      SELECT id, row_number() OVER (ORDER BY position, id) - 1 AS offset
      FROM public.counterparty_subjects
      WHERE user_id = v_user_id AND counterparty_id = v_merged_record_id
    )
    UPDATE public.counterparty_subjects subject
    SET counterparty_id = p_kept_record_id,
        position = v_next_position + moved.offset
    FROM moved_subjects moved
    WHERE subject.id = moved.id AND subject.user_id = v_user_id;

    UPDATE public.case_activities
    SET counterparty_id = p_kept_record_id
    WHERE user_id = v_user_id AND counterparty_id = v_merged_record_id;

    DELETE FROM public.counterparties
    WHERE id = v_merged_record_id
      AND user_id = v_user_id
      AND nullif(btrim(notes), '') IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.counterparty_subjects
        WHERE user_id = v_user_id AND counterparty_id = v_merged_record_id
      );

  ELSE
    SELECT public_code, practice_number, principal_id, client_id, counterparty_id
      INTO v_case_public_code, v_case_practice_number, v_case_principal_id,
           v_case_client_id, v_case_counterparty_id
    FROM public.cases
    WHERE id = p_kept_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'kept case not found'; END IF;

    PERFORM id FROM public.cases
    WHERE id = v_merged_record_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'merged case not found'; END IF;

    UPDATE public.case_activities
    SET case_id = p_kept_record_id,
        principal_id = v_case_principal_id,
        client_id = v_case_client_id,
        counterparty_id = v_case_counterparty_id
    WHERE user_id = v_user_id AND case_id = v_merged_record_id;

    UPDATE public.invoices
    SET case_id = p_kept_record_id,
        principal_id = v_case_principal_id,
        client_id = v_case_client_id
    WHERE user_id = v_user_id AND case_id = v_merged_record_id;

    UPDATE public.case_status_history
    SET case_id = p_kept_record_id
    WHERE user_id = v_user_id AND case_id = v_merged_record_id;

    UPDATE public.case_credit_transfers
    SET case_id = p_kept_record_id
    WHERE user_id = v_user_id AND case_id = v_merged_record_id;

    v_target := coalesce(v_case_public_code, v_case_practice_number::text, p_kept_record_id::text);
    UPDATE public.cases
    SET status = 'archived',
        notes = format('Pratica assorbita in %s.', v_target)
    WHERE id = v_merged_record_id AND user_id = v_user_id;
  END IF;

  UPDATE public.duplicate_reviews AS review
  SET status = 'merged',
      kept_record_id = p_kept_record_id,
      merged_record_id = v_merged_record_id,
      snoozed_until = NULL,
      resolved_at = now()
  WHERE id = v_review_id AND user_id = v_user_id
  RETURNING to_jsonb(review.*) INTO v_review;

  RETURN v_review;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_duplicate_records(text, uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_duplicate_records(text, uuid, uuid, uuid)
  TO authenticated;
