# AGENTS.md — CRM Filiação Sindical
> Contexto de máquina. Sem prosa. Cada linha é uma decisão ou contrato.

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
Deploy          : Vercel (static)
```

---

## ESTRUTURA DE ARQUIVOS (gerar exatamente assim)
```
/
├── index.html          ← página de filiação (sócio)
├── privacidade.html    ← política de privacidade LGPD
├── admin/
│   ├── index.html      ← login admin
│   ├── dashboard.html  ← lista sócios + filtros
│   ├── detalhe.html    ← ver/aprovar/recusar/editar sócio
│   └── novo.html       ← cadastro manual
├── js/
│   ├── supabase.js     ← init client (import from CDN)
│   ├── filiacao.js     ← lógica página de filiação
│   ├── pdf.js          ← geração PDF com jsPDF
│   ├── assinatura.js   ← canvas signature pad
│   └── admin/
│       ├── auth.js     ← login/logout/guard
│       ├── dashboard.js
│       ├── detalhe.js
│       └── novo.js
├── css/
│   └── style.css       ← design system simples (vars CSS)
└── sql/
    ├── 01_schema.sql   ← CREATE TABLE socios + RLS
    └── 02_storage.sql  ← buckets + policies storage
```

---

## BANCO DE DADOS

### Schema completo (gerar em `sql/01_schema.sql`)
```sql
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
```

### Storage (gerar em `sql/02_storage.sql`)
```sql
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
```

---

## SUPABASE CLIENT (js/supabase.js)
```js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

export const supabase = createClient(
  'SUPABASE_URL',   // substituir
  'SUPABASE_ANON_KEY' // substituir — anon key (não service key)
)
```
> ⚠️ Usar ANON KEY (não service_role). RLS protege o resto.

---

## FLUXO DE FILIAÇÃO (js/filiacao.js)

### Ordem de execução no submit — NUNCA alterar ordem
```
1. validarCampos()           → throw se inválido
2. validarCPF(cpf)           → algoritmo mod11, throw se inválido
3. capturarIP()              → GET api.ipapi.is, retorna string
4. assinarCanvas()           → canvas.toDataURL() → blob
5. gerarPDF()                → jsPDF, retorna blob
6. uploadContracheque()      → supabase.storage 'contracheques/{uuid}-{cpf}'
7. uploadFicha()             → supabase.storage 'fichas/{uuid}-{cpf}.pdf'
8. uploadAssinatura()        → supabase.storage 'fichas/{uuid}-{cpf}-ass.png'
9. insertSocio()             → supabase.from('socios').insert({...urls})
10. exibirSucesso()          → esconder form, mostrar mensagem
```

### Validação CPF (implementar)
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

### Erros que DEVEM ter mensagem visível ao usuário
| Condição | Mensagem |
|---|---|
| CPF inválido | "CPF inválido. Verifique os números." |
| CPF duplicado (unique violation) | "Este CPF já possui cadastro." |
| Contracheque não enviado | "Envie o contracheque para continuar." |
| Canvas vazio (sem assinatura) | "Assine o formulário para continuar." |
| LGPD não marcado | "Aceite os termos para continuar." |
| Erro genérico | "Erro ao enviar. Tente novamente." |

---

## PDF DA FICHA (js/pdf.js)

### Gerar com jsPDF via CDN
```js
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf/+esm'
```

### Conteúdo obrigatório do PDF (nesta ordem)
```
CABEÇALHO  : Logo/nome sindicato + "FICHA DE FILIAÇÃO" + data/hora geração
SEÇÃO 1    : DADOS PESSOAIS — nome, CPF (não mascarar no PDF), RG, nascimento, sexo, estado civil
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
// Setup mínimo funcional
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

export function canvasVazio() {
  return !ctx.getImageData(0,0,canvas.width,canvas.height).data.some(x => x !== 0)
}
export function exportarAssinatura() { return canvas.toDataURL('image/png') }
export function limparCanvas()       { ctx.clearRect(0,0,canvas.width,canvas.height) }
```

---

## CRM ADMIN

### Guard de autenticação (chamar no topo de dashboard.js, detalhe.js, novo.js)
```js
import { supabase } from '../supabase.js'

const { data: { session } } = await supabase.auth.getSession()
if (!session) { window.location.href = '/admin/index.html'; throw new Error('unauthenticated') }
```

### Queries Supabase por tela

**dashboard.js — listar com filtros**
```js
let query = supabase.from('socios').select('id,nome_completo,cpf,empresa,status,forma_pagamento,data_filiacao')
if (filtroStatus)     query = query.eq('status', filtroStatus)
if (filtroPagemento)  query = query.eq('forma_pagamento', filtroPagamento)
if (busca)            query = query.or(`nome_completo.ilike.%${busca}%,cpf.ilike.%${busca}%`)
query = query.order('created_at', { ascending: false })
const { data, error } = await query
```

**detalhe.js — carregar sócio**
```js
const { data } = await supabase.from('socios').select('*').eq('id', id).single()
```

**detalhe.js — gerar URL assinada para arquivos privados**
```js
const { data: { signedUrl } } = await supabase.storage
  .from('fichas').createSignedUrl(path, 3600) // 1h de validade
```

**detalhe.js — aprovar**
```js
await supabase.from('socios').update({
  status: 'aprovado',
  aprovado_por: session.user.email,
  aprovado_em: new Date().toISOString()
}).eq('id', id)
```

**detalhe.js — recusar**
```js
await supabase.from('socios').update({
  status: 'recusado',
  motivo_recusa: motivo,
  aprovado_por: session.user.email,
  aprovado_em: new Date().toISOString()
}).eq('id', id)
```

**detalhe.js — excluir (remover arquivos também)**
```js
// 1. deletar arquivos do storage
await supabase.storage.from('fichas').remove([fichaPath, assPath])
await supabase.storage.from('contracheques').remove([contrPath])
// 2. deletar registro
await supabase.from('socios').delete().eq('id', id)
```

---

## CSS — DESIGN SYSTEM (css/style.css)

```css
:root {
  --primary:    #1a3a5c;   /* azul sindical */
  --accent:     #e8a020;   /* dourado */
  --success:    #22c55e;
  --warning:    #f59e0b;
  --danger:     #ef4444;
  --bg:         #f8fafc;
  --surface:    #ffffff;
  --border:     #e2e8f0;
  --text:       #1e293b;
  --muted:      #64748b;
  --radius:     8px;
  --shadow:     0 1px 3px rgba(0,0,0,.1);
}
```

> UI/UX Pro Max skill: aplicar ao gerar os HTMLs.
> Awesome Design MD skill: usar padrões de formulário multi-step se necessário.

---

## CAMPOS OBRIGATÓRIOS vs OPCIONAIS

| Campo | Obrigatório |
|---|---|
| nome_completo | ✅ |
| cpf | ✅ |
| whatsapp | ✅ |
| contracheque_url | ✅ |
| assinatura_url | ✅ |
| consentimento_lgpd | ✅ |
| forma_pagamento | ✅ |
| email | ❌ |
| rg, sexo, estado_civil | ❌ |
| endereço completo | ❌ (CEP auto-preenche) |
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
❌ Não mascarar CPF no PDF da ficha (apenas na listagem do CRM)
```

---

## COMANDOS OPENCODE RECOMENDADOS

```bash
# Iniciar projeto (usar GSD)
/gsd-new-project

# Planejar fase por fase
/gsd-plan-phase 1   # SQL + Supabase setup
/gsd-plan-phase 2   # Página filiação
/gsd-plan-phase 3   # CRM admin
/gsd-plan-phase 4   # Revisão
/gsd-plan-phase 5   # n8n notificações

# Antes de gerar qualquer HTML
/plan               # ECC: planejar componentes

# Ao gerar UI
# Ativar UI/UX Pro Max skill antes de gerar HTMLs
# Referenciar Awesome Design MD para padrões de form
```

---

## ORDEM DE GERAÇÃO (uma fase por sessão para economizar tokens)

```
SESSÃO 1 → sql/01_schema.sql + sql/02_storage.sql
SESSÃO 2 → js/supabase.js + js/assinatura.js + js/pdf.js
SESSÃO 3 → index.html + js/filiacao.js + privacidade.html
SESSÃO 4 → admin/index.html + js/admin/auth.js
SESSÃO 5 → admin/dashboard.html + js/admin/dashboard.js
SESSÃO 6 → admin/detalhe.html + js/admin/detalhe.js
SESSÃO 7 → admin/novo.html + js/admin/novo.js + css/style.css
```

> Cada sessão carrega APENAS este AGENTS.md + os arquivos da sessão anterior relevantes.
> Não carregar todos os arquivos em todas as sessões.

---

## CRITÉRIOS DE ACEITE (testes manuais ao final)
```
[ ] Sócio envia → registro aparece no Supabase Studio como 'pendente'
[ ] PDF gerado contém assinatura visível e dados corretos
[ ] Contracheque não acessível por URL direta (403)
[ ] CPF duplicado retorna mensagem correta, não erro de console
[ ] Admin não acessa dashboard sem login (redireciona)
[ ] Aprovar/recusar registra email do admin e timestamp
[ ] Excluir remove arquivos do storage (verificar no Supabase Studio)
[ ] Formulário bloqueia envio sem LGPD marcado
[ ] CEP auto-preenche endereço via ViaCEP
[ ] Canvas funciona em mobile (touch events)
```
