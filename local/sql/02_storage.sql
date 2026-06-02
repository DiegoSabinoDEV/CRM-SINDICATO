-- Criar buckets privados via Supabase dashboard ou API
-- Buckets: 'fichas' e 'contracheques' — ambos private=true

-- Policy: upload público (page insere sem login)
CREATE POLICY "public_upload_fichas"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fichas');

CREATE POLICY "public_upload_contracheques"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contracheques');

-- Policy: leitura somente autenticado
CREATE POLICY "auth_read_fichas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fichas' AND auth.role() = 'authenticated');

CREATE POLICY "auth_read_contracheques"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contracheques' AND auth.role() = 'authenticated');
