-- Tabela de arrecadação mensal
CREATE TABLE IF NOT EXISTS arrecadacao_mensal (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mes_referencia   TEXT NOT NULL UNIQUE, -- 'YYYY-MM'
  valor_esperado   NUMERIC(10,2),
  valor_arrecadado NUMERIC(10,2),
  observacoes      TEXT,
  registrado_por   TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Trigger updated_at
CREATE OR REPLACE TRIGGER trg_arrecadacao_updated_at
  BEFORE UPDATE ON arrecadacao_mensal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE arrecadacao_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_arrecadacao" ON arrecadacao_mensal
  FOR ALL USING (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON arrecadacao_mensal
  TO authenticated;
