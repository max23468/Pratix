-- Supabase Storage privato per documenti, fatture, allegati, asset profilo
-- ed export dell'utente.
--
-- Convenzione percorsi:
--   <user_id>/invoices/<invoice_id>/<file>
--   <user_id>/cases/<case_id>/<file>
--   <user_id>/expenses/<expense_id>/<file>
--   <user_id>/profile/<file>
--   <user_id>/exports/<file>
--
-- Le policy controllano il primo segmento del path, che deve coincidere con
-- auth.uid(). L'upsert richiede select + insert + update.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'pratix-documents',
  'pratix-documents',
  false,
  26214400,
  ARRAY[
    'application/pdf',
    'application/xml',
    'text/xml',
    'application/zip',
    'text/csv',
    'text/plain',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "pratix_documents_owner_select" ON storage.objects;
DROP POLICY IF EXISTS "pratix_documents_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "pratix_documents_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "pratix_documents_owner_delete" ON storage.objects;

CREATE POLICY "pratix_documents_owner_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pratix-documents'
    AND (storage.foldername(name))[1] = ((select auth.uid())::text)
  );

CREATE POLICY "pratix_documents_owner_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pratix-documents'
    AND (storage.foldername(name))[1] = ((select auth.uid())::text)
  );

CREATE POLICY "pratix_documents_owner_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'pratix-documents'
    AND (storage.foldername(name))[1] = ((select auth.uid())::text)
  )
  WITH CHECK (
    bucket_id = 'pratix-documents'
    AND (storage.foldername(name))[1] = ((select auth.uid())::text)
  );

CREATE POLICY "pratix_documents_owner_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pratix-documents'
    AND (storage.foldername(name))[1] = ((select auth.uid())::text)
  );
