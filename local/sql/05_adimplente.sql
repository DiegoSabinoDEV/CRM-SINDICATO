-- Adicionar campo de controle de adimplência direto na tabela socios
-- Permite toggle manual pelo admin sem depender da tabela pagamentos

ALTER TABLE socios
  ADD COLUMN IF NOT EXISTS adimplente BOOLEAN NOT NULL DEFAULT true;

-- Permissão de escrita para admins autenticados
GRANT UPDATE ON socios TO authenticated;
