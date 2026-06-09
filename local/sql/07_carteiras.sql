-- ============================================================
-- 07_carteiras.sql — Carteira Digital do Sócio
-- ============================================================

-- Tabela de carteiras (uma por sócio, upsert ao renovar)
CREATE TABLE IF NOT EXISTS carteiras (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  socio_id         UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  foto_url         TEXT,
  validade         DATE NOT NULL,
  ativa            BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(socio_id)
);

-- Auto-update timestamp
CREATE TRIGGER trg_carteiras_updated_at
  BEFORE UPDATE ON carteiras
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE carteiras ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ler carteiras (necessário para verificação pública e geração sem login)
CREATE POLICY "public_select_carteiras" ON carteiras
  FOR SELECT USING (true);

-- Sócio sem login pode inserir/upsert a própria carteira
CREATE POLICY "public_insert_carteiras" ON carteiras
  FOR INSERT WITH CHECK (true);

-- Admin autenticado pode fazer tudo
CREATE POLICY "auth_write_carteiras" ON carteiras
  FOR ALL USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT ON carteiras TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON carteiras TO authenticated;

-- ============================================================
-- POLÍTICA ADICIONAL NA TABELA SOCIOS
-- Necessária para busca por CPF sem autenticação (fluxo carteira)
-- Expõe apenas sócios com status='aprovado'
-- ============================================================
CREATE POLICY "public_select_socios_aprovados" ON socios
  FOR SELECT USING (status = 'aprovado');

-- ============================================================
-- STORAGE — bucket 'fotos-carteira' (PUBLIC)
-- Criar o bucket via Supabase Dashboard:
--   Storage → New Bucket → Name: fotos-carteira → Public: ON
-- ============================================================

CREATE POLICY "public_upload_fotos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fotos-carteira');

CREATE POLICY "public_read_fotos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fotos-carteira');

CREATE POLICY "public_update_fotos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'fotos-carteira')
  WITH CHECK (bucket_id = 'fotos-carteira');
