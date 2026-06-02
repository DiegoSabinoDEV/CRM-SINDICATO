## LEMBRANÇA.md — Sessão 11 Completa
> Estado: Em produção em https://portalsinteenp.org
> Última atualização: 02/06/2026

---

## PROGRESSO GERAL
```
Sessão 1  ✅ SQL Schema v3.0 + Storage buckets
Sessão 2  ✅ Supabase client + Signature canvas + PDF jsPDF
Sessão 3  ✅ Filiação form (público) + privacidade LGPD
Sessão 4  ✅ Admin login (Supabase Auth)
Sessão 5  ✅ Dashboard com filtros (status, pagamento, busca)
Sessão 6  ✅ Detalhe page (aprovar, recusar, excluir, arquivos)
Sessão 7  ✅ CSS design system + beneficios.html + rodapé profissional
Sessão 8  ✅ Importação CSV/XLSX + pagamentos + ajustes profissionais
Sessão 9  ✅ Bugs corrigidos + toggle adimplência + notificações n8n
Sessão 10 ✅ Deploy Hostinger + n8n produção + redesign identidade visual
Sessão 11 ✅ PDF redesign + reorganização repo + cabeçalho mobile/desktop
Próxima   ⬜ Dashboard: filtro adimplência + admin/relatorio.html
```

---

## DEPLOY — EM PRODUÇÃO

```
URL pública    : https://portalsinteenp.org
Hospedagem     : Hostinger KVM2 → public_html/
SSL            : Let's Encrypt (ativo)
GitHub         : https://github.com/DiegoSabinoDEV/CRM-SINDICATO
Último commit  : 5c8c749
```

**Configurações ativas:**
- CORS Supabase: `https://portalsinteenp.org` ✅
- N8N_CORS_ALLOWED_ORIGINS: `https://portalsinteenp.org` ✅
- Supabase GRANT: todas as tabelas com permissões corretas ✅

---

## STACK CONFIRMADO (NÃO MUDA)
```
DB/Auth/Storage : Supabase — projeto BancoDadosSocios
                  URL: https://eomwjmszybravljilaeg.supabase.co
Frontend        : HTML + Vanilla JS (sem framework)
PDF             : jsPDF v2.5.1 UMD via <script> tag (window.jspdf)
                  ⚠️ NÃO usar ES build — tem deps @babel/runtime
CSV/XLSX        : SheetJS CDN (xlsx.full.min.js)
Assinatura      : canvas → toDataURL('image/png')
CEP             : ViaCEP API
IP capture      : https://api.ipapi.is/?q
Notificações    : n8n + Evolution API + Resend [ATIVO]
Deploy          : Hostinger KVM2 → public_html/hostinger/
Servidor local  : npx serve hostinger/ -p 3000
```

---

## ESTRUTURA DO REPO (reorganizada na S11)

```
/
├── hostinger/               ← deploy no Hostinger (public_html/)
│   ├── index.html           ✅ Filiação + cabeçalho branco redesenhado
│   ├── beneficios.html      ✅
│   ├── privacidade.html     ✅
│   ├── .htaccess            ✅
│   ├── admin/
│   │   ├── index.html       ✅ Login com .login-logo centralizada
│   │   ├── dashboard.html   ✅
│   │   ├── detalhe.html     ✅
│   │   ├── novo.html        ✅
│   │   └── importar.html    ✅
│   ├── js/
│   │   ├── supabase.js      ⚠️ EXCLUÍDO DO GIT (contém ANON KEY)
│   │   ├── supabase.example.js  ✅ Template sem credenciais
│   │   ├── filiacao.js      ✅ email/empresa/cargo obrigatórios + scroll shrink
│   │   ├── pdf.js           ✅ UMD build, paleta #CC0000, marca d'água
│   │   ├── assinatura.js    ✅
│   │   └── admin/
│   │       ├── auth.js      ✅
│   │       ├── dashboard.js ✅
│   │       ├── detalhe.js   ✅ webhook: pesquisa-sindicato
│   │       ├── novo.js      ✅
│   │       └── importar.js  ✅
│   ├── css/
│   │   ├── filiacao.css     ✅ cabeçalho branco, logo 80px, mobile ok
│   │   ├── beneficios.css   ✅
│   │   ├── privacidade.css  ✅
│   │   ├── style.css        ✅
│   │   └── admin/
│   │       ├── admin.css    ✅ .login-logo centralizada
│   │       ├── dashboard.css ✅
│   │       ├── detalhe.css  ✅
│   │       ├── novo.css     ✅
│   │       └── importar.css ✅
│   └── logo/
│       ├── logoSinteenp.jpeg ✅ Logo principal
│       └── faviSinteenp.jpeg ✅ Favicon
│
├── local/                   ← docs e config (não vão ao servidor)
│   ├── sql/01-05_*.sql      ✅ Schema + storage + pagamentos + índices
│   ├── n8n/                 ⚠️ EXCLUÍDO DO GIT
│   ├── LEMBRANCA.md         ← este arquivo
│   ├── AGENTS.md + AGENTS-2.md
│   ├── PRD_Sistema_Filiacao_Sindical.md
│   └── serve.json           ← cleanUrls:false (dev local)
│
├── admin/ js/ css/ logo/    ← espelho raiz (dev local npx serve .)
├── README.md
└── .gitignore               ← exclui supabase.js e n8n/workflow
```

---

## SESSÃO 11 — O QUE FOI FEITO

### pdf.js — Redesign completo
- Paleta: `#CC0000` (primary) / `#1a1a1a` (header bg) / branco para texto
- Marca d'água: `logoSinteenp.jpeg` a 10% opacidade (via GState)
- Otimização 1 página A4: margem 12mm, cabeçalho 28mm, campos 2 colunas
- Campos duplos: CPF|RG, Nascimento|Sexo, Telefone|WhatsApp, CEP|Estado, Cargo|Matrícula
- Import UMD: `const { jsPDF, GState } = window.jspdf || {}`
  - ⚠️ ES build (`jspdf.es.min.js`) tem deps `@babel/runtime` — não usar
  - ✅ UMD build (`jspdf.umd.min.js`) via `<script>` tag no index.html

### Reorganização do repositório
- Criado `hostinger/` (arquivos do servidor) e `local/` (docs)
- `.gitignore` exclui `supabase.js` e `n8n/workflow_notificacao.json`
- `hostinger/js/supabase.example.js` como template para deploy
- GitHub: https://github.com/DiegoSabinoDEV/CRM-SINDICATO

### Bugs corrigidos
1. **Logo login admin**: inline `height:80px` sem max-width → `.login-logo` CSS class
   (max-width:200px, max-height:80px, object-fit:contain, margin:0 auto)
2. **PDF sem design**: import ES build com @babel/runtime quebrava o jsPDF
   → `<script src="jspdf@2.5.1/dist/jspdf.umd.min.js">` + `window.jspdf`
3. **Meta descriptions**: corrigidas em index.html e admin/index.html
   (tinham "SINTEENPPB-PB" e "Energia Elétrica")

### Cabeçalho filiacao.css — Estado final

**Desktop (min-width: 769px):**
- Fundo branco `#ffffff` + `border-bottom: 3px solid #CC0000`
- Logo `max-height: 80px`, sem fundo branco no container (brand-mark transparente)
- Texto da brand (brand-name, brand-subtitle): OCULTOS globalmente
- Scroll >60px: logo reduz para 44px, botões continuam visíveis
- Padding: `12px 32px` → `6px 32px` ao rolar

**Mobile (max-width: 720px):**
- Logo centralizada 56×56px, nome/subtítulo ocultos
- Scroll >60px: logo reduz + botões SOMEM (max-height:0)
- Rodapé: text-align center em 580px

### Campos obrigatórios adicionados
Em `filiacao.js` `validarCampos()` + HTML `required` + asterisco `*`:
- Email (com regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- Empresa
- Cargo
- Assinatura: mensagem atualizada → "A assinatura digital é obrigatória."

---

## IDENTIDADE VISUAL (ATUAL)

```
Logo            : /logo/logoSinteenp.jpeg
Favicon         : /logo/faviSinteenp.jpeg
Nome curto      : SINTEENP-PB
Nome completo   : Sindicato dos Trabalhadores em
                  Estabelecimentos de Ensino Privado da Paraíba
Endereço        : Av. Gen. Osório, 109 - Centro, João Pessoa - PB, 58010-780
Telefone        : (83) 3221-8935 → tel:+558332218935
Instagram       : @sinteenppb (confirmar conta real)
Email           : sinteenppb@hotmail.com (atual no rodapé)
```

**Paleta de cores (filiacao.css):**
```css
--primary:      #CC0000   /* vermelho SINTEENP */
--text:         #2f2f35   /* texto escuro */
--muted:        #67676f
--bg:           #f6f3f3
--surface:      #ffffff
--border:       #e1d6d6
```

---

## N8N — NOTIFICAÇÕES (EM PRODUÇÃO)

```
URL n8n           : https://n8n.liftcode.com.br
Webhook path      : pesquisa-sindicato
URL completa      : https://n8n.liftcode.com.br/webhook/pesquisa-sindicato
Evolution API URL : https://evo.liftcode.com.br
Instância WA      : pesquisa-sindicato
Resend from       : noreply@portalsinteenp.org
```

**Status:** Workflow "Notificação Filiação Sindical" — ATIVO ✅
Aprovação → WhatsApp ✅ | Recusa → WhatsApp ✅

---

## SCHEMA BANCO (v3.1 Ativo)

### Tabela `socios`
```sql
id UUID PRIMARY KEY
nome_completo TEXT NOT NULL
cpf TEXT NOT NULL UNIQUE
forma_pagamento TEXT CHECK (IN 'folha', 'direto') NOT NULL
status TEXT CHECK (IN 'pendente', 'aprovado', 'recusado') DEFAULT 'pendente'
adimplente BOOLEAN NOT NULL DEFAULT true
consentimento_lgpd BOOLEAN DEFAULT false
origem TEXT CHECK (IN 'pagina_web', 'manual', 'importacao') DEFAULT 'pagina_web'
```

### Tabela `pagamentos`
```sql
id UUID PRIMARY KEY
socio_id UUID NOT NULL REFERENCES socios(id)
mes_referencia TEXT NOT NULL  -- 'YYYY-MM'
valor NUMERIC(10,2)           -- coluna = 'valor' (não valor_pagamento)
data_pagamento DATE
forma TEXT CHECK (IN 'pix','boleto','especie','folha')
registrado_por TEXT
UNIQUE(socio_id, mes_referencia)
```

---

## ROADMAP — PRÓXIMAS AÇÕES

```
⬜ Dashboard: filtro adimplente/inadimplente no <select>
⬜ admin/relatorio.html — gráfico arrecadação + tabela inadimplentes + export
⬜ hCaptcha — substituir pela chave real (sitekey atual no index.html)
⬜ Instagram real do sindicato (@sinteenppb — confirmar conta)
⬜ Importar ~600 sócios (revisão manual da planilha necessária antes)
⬜ App carteira do sócio (repo separado)
⬜ Fase 5 n8n — lembrete PIX dia 5 para pagamento direto
```

---

## CREDENCIAIS / CONFIG

⚠️ NÃO COMMITAR:
```
SUPABASE_URL     = https://eomwjmszybravljilaeg.supabase.co
SUPABASE_ANON_KEY= eyJ... (ver hostinger/js/supabase.js — NÃO está no git)
Admin CRM        : liftcode@outlook.com / Admin@2026
n8n URL          : https://n8n.liftcode.com.br
Evolution API    : https://evo.liftcode.com.br
Resend from      : noreply@portalsinteenp.org
```

---

**Última atualização**: 02 Jun 2026 — Sessão 11 Completa ✅
**Status**: Em produção — https://portalsinteenp.org 🟢
**GitHub**: https://github.com/DiegoSabinoDEV/CRM-SINDICATO (commit 5c8c749)
