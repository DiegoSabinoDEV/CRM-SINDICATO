# AGENTS.md — CRM Filiação Sindical
> Contexto de máquina. Sem prosa. Cada linha é uma decisão ou contrato.
> Versão 3.0 — inclui GRANT Supabase, importação Excel, pagamentos e app carteira.

---

## STACK — DECISÕES FINAIS (não questionar)
```
DB/Auth/Storage : Supabase (PostgreSQL + Auth + Storage)
Frontend        : HTML + Vanilla JS (sem framework)
PDF             : jsPDF (client-side, sem servidor)
Assinatura      : canvas → toDataURL('image/png') → base64
CEP             : ViaCEP API (https://viacep.com.br/ws/{cep}/json/)
IP capture      : https://api.ipapi.is/?q (GET, sem key)
Notificações    : n8n + Evolution API + Resend (fora deste repo)
Deploy          : Hostinger KVM2 (static files)
```

---

## ⚠️ MUDANÇA SUPABASE — OBRIGATÓRIO A PARTIR DE 30/05/2026

A partir de 30/05/2026 novos projetos Supabase exigem GRANT explícito para expor
tabelas do schema public via PostgREST/supabase-js. Sem isso as queries retornam
erro 42501 ou resultado vazio mesmo com RLS correto.

**Todo CREATE TABLE DEVE ser seguido imediatamente de:**
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON [tabela] TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON [tabela] TO authenticated;
```
> anon     = usuário não autenticado (página de filiação pública)
> authenticated = admin logado no CRM e app carteira

Isso já está incluído em todos os blocos SQL abaixo. Não remover.

---

## ESTRUTURA DE ARQUIVOS (gerar exatamente assim)
```
/
├── index.html               ← página de filiação (sócio)
├── privacidade.html         ← política de privacidade LGPD
├── admin/
│   ├── index.html           ← login admin
│   ├── dashboard.html       ← lista sócios + filtros
│   ├── detalhe.html         ← ver/aprovar/recusar/editar sócio
│   ├── novo.html            ← cadastro manual
│   └── importar.html        ← importação CSV/Excel
├── js/
│   ├── supabase.js          ← init client (import from CDN)
│   ├── filiacao.js          ← lógica página de filiação
│   ├── pdf.js               ← geração PDF com jsPDF
│   ├── assinatura.js        ← canvas signature pad
│   └── admin/
│       ├── auth.js          ← login/logout/guard
│       ├── dashboard.js
│       ├── detalhe.js
│       ├── novo.js
│       └── importar.js      ← parse CSV + insert em lote
├── css/
│   └── style.css            ← design system simples (vars CSS)
└── sql/
    ├── 01_schema.sql        ← CREATE TABLE socios + RLS + GRANT
    ├── 02_storage.sql       ← buckets + policies storage
    ├── 03_pagamentos.sql    ← CREATE TABLE pagamentos + RLS + GRANT
    └── 04_indices.sql       ← índices de performance
```

---

## BANCO DE DADOS

### 01_schema.sql — tabela socios
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
  -- vencimento fixo: dia 5 de cada mês (hardcoded no n8n, não armazenar)
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
  origem                   TEXT NOT NULL DEFAULT 'pagina_web' CHECK (origem IN ('pagina_web','manual','importacao')),
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

CREATE POLICY "public_insert"  ON socios FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_select"    ON socios FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_update"    ON socios FOR UPDATE  USING (auth.role() = 'authenticated');
CREATE POLICY "auth_delete"    ON socios FOR DELETE  USING (auth.role() = 'authenticated');

-- ⚠️ GRANT obrigatório (mudança Supabase 30/05/2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON socios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON socios TO authenticated;
```

### 02_storage.sql — buckets
```sql
-- Buckets criados via dashboard: 'fichas' e 'contracheques' — private=true
-- Executar as policies abaixo no SQL Editor

CREATE POLICY "public_upload_fichas"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'fichas');

CREATE POLICY "public_upload_contracheques"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contracheques');

CREATE POLICY "auth_read_fichas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fichas' AND auth.role() = 'authenticated');

CREATE POLICY "auth_read_contracheques"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contracheques' AND auth.role() = 'authenticated');

CREATE POLICY "auth_delete_fichas"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'fichas' AND auth.role() = 'authenticated');

CREATE POLICY "auth_delete_contracheques"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'contracheques' AND auth.role() = 'authenticated');
```

### 03_pagamentos.sql — controle de adimplência
```sql
CREATE TABLE IF NOT EXISTS pagamentos (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  socio_id         UUID NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  mes_referencia   TEXT NOT NULL,        -- formato: 'YYYY-MM' ex: '2026-06'
  data_pagamento   DATE,
  valor            NUMERIC(10,2),
  forma            TEXT CHECK (forma IN ('pix','boleto','especie','folha')),
  observacao       TEXT,
  registrado_por   TEXT,                 -- email do admin
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(socio_id, mes_referencia)       -- um pagamento por mês por sócio
);

ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_pagamentos" ON pagamentos
  FOR ALL USING (auth.role() = 'authenticated');

-- App carteira também pode consultar (leitura pública autenticada via token)
CREATE POLICY "app_select_pagamentos" ON pagamentos
  FOR SELECT USING (auth.role() = 'authenticated');

-- ⚠️ GRANT obrigatório (mudança Supabase 30/05/2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON pagamentos TO authenticated;
-- anon NÃO tem acesso a pagamentos
```

### 04_indices.sql — performance
```sql
-- Executar após popular a base (600+ registros)
CREATE INDEX IF NOT EXISTS idx_socios_cpf       ON socios(cpf);
CREATE INDEX IF NOT EXISTS idx_socios_status    ON socios(status);
CREATE INDEX IF NOT EXISTS idx_socios_pagamento ON socios(forma_pagamento);
CREATE INDEX IF NOT EXISTS idx_socios_nome      ON socios USING gin(to_tsvector('portuguese', nome_completo));
CREATE INDEX IF NOT EXISTS idx_pagamentos_socio ON pagamentos(socio_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mes   ON pagamentos(mes_referencia);
```

---

## SUPABASE CLIENT (js/supabase.js)
```js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
  'SUPABASE_URL',     // substituir
  'SUPABASE_ANON_KEY' // substituir — anon key (não service key)
)
```
> ⚠️ Usar ANON KEY (não service_role). RLS + GRANT protegem o resto.

---

## FLUXO DE FILIAÇÃO (js/filiacao.js)

### Ordem de execução no submit — NUNCA alterar ordem
```
1. validarCampos()        → throw se inválido
2. validarCPF(cpf)        → algoritmo mod11, throw se inválido
3. capturarIP()           → GET api.ipapi.is, retorna string
4. exportarAssinatura()   → canvas.toDataURL() → blob
5. gerarPDF()             → jsPDF, retorna blob
6. uploadContracheque()   → supabase.storage 'contracheques/{uuid}-{cpf}'
7. uploadFicha()          → supabase.storage 'fichas/{uuid}-{cpf}.pdf'
8. uploadAssinatura()     → supabase.storage 'fichas/{uuid}-{cpf}-ass.png'
9. insertSocio()          → supabase.from('socios').insert({...urls})
10. exibirSucesso()       → esconder form, mostrar mensagem
```

### Validação CPF
```js
function validarCPF(cpf) {
  cpf = cpf.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i)
  let r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(cpf[9])) return false
  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i)
  r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(cpf[10])
}
```

### Mensagens de erro visíveis ao usuário
| Condição | Mensagem |
|---|---|
| CPF inválido | "CPF inválido. Verifique os números." |
| CPF duplicado (unique violation) | "Este CPF já possui cadastro." |
| Contracheque não enviado | "Envie o contracheque para continuar." |
| Canvas vazio | "Assine o formulário para continuar." |
| LGPD não marcado | "Aceite os termos para continuar." |
| Erro genérico | "Erro ao enviar. Tente novamente." |

---

## PDF DA FICHA (js/pdf.js)
```js
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf/+esm'
```

### Conteúdo obrigatório (nesta ordem)
```
CABEÇALHO  : Logo/nome sindicato + "FICHA DE FILIAÇÃO" + data/hora geração
SEÇÃO 1    : DADOS PESSOAIS — nome, CPF (não mascarar), RG, nascimento, sexo, estado civil
SEÇÃO 2    : CONTATO — email, telefone, whatsapp
SEÇÃO 3    : ENDEREÇO — logradouro, número, bairro, CEP, cidade/UF
SEÇÃO 4    : DADOS PROFISSIONAIS — empresa, cargo, matrícula, setor, admissão
SEÇÃO 5    : PAGAMENTO — forma (X em checkbox correto) + "Vencimento: dia 5 de cada mês" se direto
SEÇÃO 6    : DECLARAÇÃO LGPD — texto fixo + "Consentido em: {data} — IP: {ip}"
SEÇÃO 7    : ASSINATURA — imagem do canvas + "Assinado digitalmente em {datetime}"
RODAPÉ     : ID UUID do registro
```

---

## CANVAS ASSINATURA (js/assinatura.js)
```js
const canvas = document.getElementById('canvas-assinatura')
const ctx = canvas.getContext('2d')
let desenhando = false

canvas.addEventListener('mousedown', e => { desenhando = true; ctx.beginPath(); ctx.moveTo(...pos(e)) })
canvas.addEventListener('mousemove', e => { if (!desenhando) return; ctx.lineTo(...pos(e)); ctx.stroke() })
canvas.addEventListener('mouseup',   () => desenhando = false)
canvas.addEventListener('touchstart', e => { e.preventDefault(); desenhando = true; ctx.beginPath(); ctx.moveTo(...posTouch(e)) }, { passive: false })
canvas.addEventListener('touchmove',  e => { e.preventDefault(); if (!desenhando) return; ctx.lineTo(...posTouch(e)); ctx.stroke() }, { passive: false })
canvas.addEventListener('touchend',   () => desenhando = false)

function pos(e)      { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
function posTouch(e) { const r = canvas.getBoundingClientRect(); return [e.touches[0].clientX - r.left, e.touches[0].clientY - r.top] }

export function canvasVazio()        { return !ctx.getImageData(0,0,canvas.width,canvas.height).data.some(x => x !== 0) }
export function exportarAssinatura() { return canvas.toDataURL('image/png') }
export function limparCanvas()       { ctx.clearRect(0,0,canvas.width,canvas.height) }
```

---

## CRM ADMIN

### Guard de autenticação (topo de todo js/admin/*.js exceto auth.js)
```js
import { supabase } from '../supabase.js'
const { data: { session } } = await supabase.auth.getSession()
if (!session) { window.location.href = '/admin/index.html'; throw new Error('unauthenticated') }
```

### Queries por tela

**dashboard.js — listar com filtros + paginação**
```js
const PAGE_SIZE = 50
let query = supabase.from('socios')
  .select('id,nome_completo,cpf,empresa,status,forma_pagamento,data_filiacao', { count: 'exact' })
if (filtroStatus)    query = query.eq('status', filtroStatus)
if (filtroPagamento) query = query.eq('forma_pagamento', filtroPagamento)
if (busca)           query = query.or(`nome_completo.ilike.%${busca}%,cpf.ilike.%${busca}%`)
query = query.order('created_at', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
const { data, count, error } = await query
```

**detalhe.js — carregar sócio + último pagamento**
```js
const { data: socio } = await supabase.from('socios').select('*').eq('id', id).single()
const { data: pagamentos } = await supabase.from('pagamentos')
  .select('*').eq('socio_id', id).order('mes_referencia', { ascending: false }).limit(12)
```

**detalhe.js — URL assinada para arquivo privado**
```js
const { data: { signedUrl } } = await supabase.storage
  .from('fichas').createSignedUrl(path, 3600)
```

**detalhe.js — registrar pagamento**
```js
await supabase.from('pagamentos').upsert({
  socio_id: id,
  mes_referencia: '2026-06',   // formato YYYY-MM
  data_pagamento: new Date().toISOString().split('T')[0],
  valor: socio.valor_mensalidade,
  forma: 'pix',
  registrado_por: session.user.email
})
```

**detalhe.js — verificar adimplência (lógica)**
```js
const mesAtual = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
const adimplente = pagamentos?.some(p => p.mes_referencia === mesAtual)
// badge: adimplente=verde / inadimplente=vermelho
```

**detalhe.js — aprovar / recusar / excluir**
```js
// aprovar
await supabase.from('socios').update({ status:'aprovado', aprovado_por: session.user.email, aprovado_em: new Date().toISOString() }).eq('id', id)

// recusar
await supabase.from('socios').update({ status:'recusado', motivo_recusa: motivo, aprovado_por: session.user.email, aprovado_em: new Date().toISOString() }).eq('id', id)

// excluir (remover storage antes)
await supabase.storage.from('fichas').remove([fichaPath, assPath])
await supabase.storage.from('contracheques').remove([contrPath])
await supabase.from('socios').delete().eq('id', id)
```

---

## IMPORTAÇÃO DE SÓCIOS (admin/importar.html + js/admin/importar.js)

### Objetivo
Importar base existente de ~600 sócios via CSV exportado do Excel.

### Colunas esperadas no CSV (cabeçalho exato)
```
nome_completo,cpf,rg,data_nascimento,sexo,email,telefone,whatsapp,
cep,logradouro,numero,bairro,cidade,estado,
empresa,cargo,matricula,setor,data_admissao,
forma_pagamento,valor_mensalidade,status
```

### Lógica do importar.js
```js
// 1. Parse CSV com PapaParse via CDN
import Papa from 'https://cdn.jsdelivr.net/npm/papaparse/+esm'

// 2. Para cada linha:
//    - Limpar CPF (remover . e -)
//    - Validar CPF com validarCPF()
//    - Setar origem = 'importacao'
//    - Setar consentimento_lgpd = false (dados pré-LGPD, marcar manualmente depois)
//    - Setar campos de arquivo como null

// 3. Insert em lote (máx 100 por vez para não estourar limite)
const BATCH = 100
for (let i = 0; i < registros.length; i += BATCH) {
  const lote = registros.slice(i, i + BATCH)
  const { error } = await supabase.from('socios').upsert(lote, { onConflict: 'cpf', ignoreDuplicates: true })
  atualizarProgresso(i + lote.length, registros.length)
}

// 4. Exibir relatório: X importados, Y duplicados ignorados, Z erros
```

### UI da tela de importação
```
- Drag & drop ou input file (aceita .csv e .xlsx)
- Botão "Baixar modelo CSV" (gera CSV vazio com cabeçalho correto)
- Preview das primeiras 5 linhas antes de confirmar
- Barra de progresso durante importação
- Relatório final: total / importados / duplicados / erros
```

---

## APP CARTEIRA DO SÓCIO — CONTRATO DA API

O app (Flutter/React Native/PWA) consulta o Supabase diretamente via supabase-js ou REST.
Autenticação do app: token JWT gerado via Supabase Auth (usuário do tipo 'app' separado do admin).

### Endpoint de verificação (o app chama isso)
```js
// Verificar se é sócio e se está adimplente
async function verificarSocio(cpf) {
  const mesAtual = new Date().toISOString().slice(0, 7)

  const { data: socio } = await supabase
    .from('socios')
    .select('id, nome_completo, status, forma_pagamento, valor_mensalidade')
    .eq('cpf', cpf.replace(/\D/g, ''))
    .single()

  if (!socio) return { encontrado: false }
  if (socio.status !== 'aprovado') return { encontrado: true, ativo: false }

  // folha = sempre adimplente (desconto automático)
  if (socio.forma_pagamento === 'folha') {
    return { encontrado: true, ativo: true, adimplente: true, socio }
  }

  // direto = verificar tabela pagamentos
  const { data: pag } = await supabase
    .from('pagamentos')
    .select('id')
    .eq('socio_id', socio.id)
    .eq('mes_referencia', mesAtual)
    .single()

  return { encontrado: true, ativo: true, adimplente: !!pag, socio }
}
```

### Resposta esperada pelo app
```json
{ "encontrado": true, "ativo": true, "adimplente": true,
  "socio": { "nome_completo": "João Silva", "status": "aprovado" } }
```

### RLS para o app (criar policy separada)
```sql
-- Usuário do app só lê socios e pagamentos, não escreve
CREATE POLICY "app_read_socios" ON socios
  FOR SELECT USING (auth.role() = 'authenticated');
-- (a policy auth_select já cobre isso — não duplicar)
```

---

## CSS — DESIGN SYSTEM (css/style.css)
```css
:root {
  --primary:  #1a3a5c;
  --accent:   #e8a020;
  --success:  #22c55e;
  --warning:  #f59e0b;
  --danger:   #ef4444;
  --info:     #3b82f6;
  --bg:       #f8fafc;
  --surface:  #ffffff;
  --border:   #e2e8f0;
  --text:     #1e293b;
  --muted:    #64748b;
  --radius:   8px;
  --shadow:   0 1px 3px rgba(0,0,0,.1);
}
```
> UI/UX Pro Max skill: aplicar ao gerar os HTMLs.
> Badge adimplente: var(--success) | Badge inadimplente: var(--danger)

---

## CAMPOS OBRIGATÓRIOS vs OPCIONAIS
| Campo | Obrigatório |
|---|---|
| nome_completo | ✅ |
| cpf | ✅ |
| whatsapp | ✅ |
| contracheque_url | ✅ (dispensar na importação) |
| assinatura_url | ✅ (dispensar na importação) |
| consentimento_lgpd | ✅ (false na importação) |
| forma_pagamento | ✅ |
| email | ❌ |
| rg, sexo, estado_civil | ❌ |
| endereço | ❌ (CEP auto-preenche) |
| dados profissionais | ❌ |

---

## RESTRIÇÕES — NÃO FAZER
```
❌ Não usar React, Vue, Angular, Svelte
❌ Não criar backend Node.js/Python
❌ Não usar service_role key no frontend
❌ Não expor contracheque via URL pública
❌ Não armazenar senha no localStorage
❌ Não criar rotas de API customizadas
❌ Não instalar npm packages (usar CDN)
❌ Não mascarar CPF no PDF da ficha (apenas na listagem CRM)
❌ Não omitir GRANT após CREATE TABLE (quebra desde 30/05/2026)
```

---

## ORDEM DE GERAÇÃO (uma sessão por vez)
```
SESSÃO 1 → sql/01_schema.sql + sql/02_storage.sql + sql/03_pagamentos.sql + sql/04_indices.sql
SESSÃO 2 → js/supabase.js + js/assinatura.js + js/pdf.js
SESSÃO 3 → index.html + js/filiacao.js + privacidade.html
SESSÃO 4 → admin/index.html + js/admin/auth.js
SESSÃO 5 → admin/dashboard.html + js/admin/dashboard.js
SESSÃO 6 → admin/detalhe.html + js/admin/detalhe.js (inclui pagamentos)
SESSÃO 7 → admin/novo.html + js/admin/novo.js + css/style.css
SESSÃO 8 → admin/importar.html + js/admin/importar.js
```
> Cada sessão carrega APENAS este AGENTS.md + arquivos da sessão anterior relevantes.

---

## ROADMAP DE FASES
```
✅ Fase 1–4  → Filiação digital + CRM (concluído)
⬜ Fase 5    → n8n: lembrete WhatsApp/email dia 5 com QR Code PIX
⬜ Fase 6    → Importação 600 sócios do Excel (SESSÃO 8)
⬜ Fase 7    → Tabela pagamentos + controle adimplência no CRM (SESSÃO 6)
⬜ Fase 8    → App carteira do sócio (repo separado, consome API Supabase)
```

---

## CRITÉRIOS DE ACEITE
```
[ ] Sócio envia → aparece no Supabase Studio como 'pendente'
[ ] PDF contém assinatura visível e dados corretos
[ ] Contracheque retorna 403 por URL direta
[ ] CPF duplicado mostra mensagem, não erro de console
[ ] Admin não acessa dashboard sem login
[ ] Aprovar/recusar registra email do admin e timestamp
[ ] Excluir remove arquivos do storage
[ ] Formulário bloqueia sem LGPD marcado
[ ] CEP auto-preenche via ViaCEP
[ ] Canvas funciona em mobile
[ ] Dashboard pagina resultados (50 por página)
[ ] Badge adimplente/inadimplente aparece no detalhe do sócio
[ ] Importação CSV processa 600 registros sem travar
[ ] Importação ignora CPFs duplicados sem quebrar o lote
[ ] GRANT aplicado em todas as tabelas (testar query sem login → deve falhar)
```
