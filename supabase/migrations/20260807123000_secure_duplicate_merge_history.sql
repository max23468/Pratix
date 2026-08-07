-- La cronologia di stato è immutabile via RLS: solo questa RPC owner-scoped
-- può riallinearla insieme al resto del merge, nella stessa transazione.
ALTER FUNCTION public.merge_duplicate_records(text, uuid, uuid, uuid)
  SECURITY DEFINER;
ALTER FUNCTION public.merge_duplicate_records(text, uuid, uuid, uuid)
  SET search_path = '';
