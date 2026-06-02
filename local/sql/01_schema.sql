-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabela principal
CREATE TABLE IF NOT EXISTS socios (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- pessoal
  nome_completo            TEXT NOT NULL,
  cpf                      TEXT NOT NULL UNIQUE,
  rg                       TEXT,
  data_nascimento          DATE,
  sexo                     TEXT CHECK (sexo IN ('M','F','O')),
  estado_civil             TEXT,
  -- contato
  email                    TEXT,
  telefone                 TEXT,
  whatsapp                 TEXT NOT NULL,
  -- endereço
  cep                      TEXT,
  logradouro               TEXT,
  numero                   TEXT,
  complemento              TEXT,
  bairro                   TEXT,
  cidade                   TEXT,
  estado                   TEXT,
  -- profissional
  empresa                  TEXT,
  cargo                    TEXT,
  matricula                TEXT,
  setor                    TEXT,
  data_admissao            DATE,
  -- pagamento
  forma_pagamento          TEXT NOT NULL DEFAULT 'folha' CHECK (forma_pagamento IN ('folha','direto')),
  -- vencimento fixo: dia 5 de cada mês (não armazenar, hardcoded no n8n)
  valor_mensalidade        NUMERIC(10,2),
  -- filiação
  status                   TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','recusado')),
  motivo_recusa            TEXT,
  data_filiacao            TIMESTAMPTZ DEFAULT now(),
  aprovado_por             TEXT,
  aprovado_em              TIMESTAMPTZ,
  -- arquivos (paths no storage)
  ficha_pdf_url            TEXT,
  contracheque_url         TEXT,
  assinatura_url           TEXT,
  -- LGPD
  consentimento_lgpd       BOOLEAN NOT NULL DEFAULT false,
  data_consentimento_lgpd  TIMESTAMPTZ,
  ip_consentimento         TEXT,
  -- meta
  origem                   TEXT NOT NULL DEFAULT 'pagina_web' CHECK (origem IN ('pagina_web','manual')),
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_socios_updated_at
  BEFORE UPDATE ON socios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_insert"    ON socios FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_select"      ON socios FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_update"      ON socios FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete"      ON socios FOR DELETE  USING (auth.role() = 'authenticated');
