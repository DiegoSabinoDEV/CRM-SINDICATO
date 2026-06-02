## LEMBRANÇA.md — Sessão 10 Completa
> Estado: Em produção em https://portalsinteenp.org
> Última atualização: 01/06/2026

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
Próxima   ⬜ Filtro adimplência dashboard + relatório financeiro
```

---

## DEPLOY — EM PRODUÇÃO

```
URL pública    : https://portalsinteenp.org
Hospedagem     : Hostinger KVM2 → public_html/
SSL            : Let's Encrypt (ativo)
Domínio        : portalsinteenp.org (comprado e configurado)
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
PDF             : jsPDF (client-side)
CSV/XLSX        : SheetJS CDN (xlsx.full.min.js)
Assinatura      : canvas → toDataURL('image/png')
CEP             : ViaCEP API
IP capture      : https://api.ipapi.is/?q
Notificações    : n8n + Evolution API + Resend [ATIVO]
Deploy          : Hostinger KVM2 (static files)
Servidor local  : npx serve . -p 3000 (com serve.json cleanUrls:false)
```

---

## IDENTIDADE VISUAL (ATUALIZADA SESSÃO 10)

```
Logo            : /logo/logoSinteenp.jpeg
Favicon         : /logo/faviSinteenp.jpeg
Nome curto      : SINTEENP-PB
Nome completo   : Sindicato dos Trabalhadores em
                  Estabelecimentos de Ensino Privado da Paraíba
Endereço        : Av. Gen. Osório, 109 - Centro, João Pessoa - PB, 58010-780
Telefone        : (83) 3221-8935  →  tel:+558332218935
Instagram       : @sinteenppb (placeholder — confirmar conta real)
Email contato   : contato@sinteenp-pb.org.br (placeholder)
```

**Paleta de cores:**
```css
--primary:    #CC0000   /* vermelho SINTEENP */
--accent:     #1a1a1a   /* preto */
--success:    #22c55e   /* aprovado / adimplente */
--warning:    #f59e0b   /* pendente */
--danger:     #ef4444   /* recusado / inadimplente */
--bg:         #f8fafc
--surface:    #ffffff
--border:     #e2e8f0
--text:       #1a1a1a
--radius:     8px
```

**Arquivos CSS atualizados:**
- `css/style.css` — variáveis globais
- `css/filiacao.css` — header fixo #1a1a1a, botões #CC0000, hero, formulário, rodapé
- `css/beneficios.css` — header fixo, hero #1a1a1a, CTA banner #CC0000, footer
- `css/admin/admin.css` — login bg #1a1a1a, primary #CC0000
- `index.html` — brand "SINTEENP", rodapé com dados reais
- `beneficios.html` — brand "SINTEENP", logo atualizada, rodapé
- `admin/index.html` — logo no card de login

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
data_pagamento DATE           -- formato YYYY-MM-DD
forma TEXT CHECK (IN 'pix','boleto','especie','folha')
registrado_por TEXT
UNIQUE(socio_id, mes_referencia)
```

**SQLs executados no Supabase:**
- `sql/01_schema.sql` — socios + RLS + GRANT ✅
- `sql/02_storage.sql` — buckets fichas/contracheques ✅
- `sql/03_pagamentos.sql` — tabela pagamentos + RLS + GRANT ✅
- `sql/04_indices.sql` — índices de performance ✅
- `sql/05_adimplente.sql` — ALTER TABLE + GRANT ✅

---

## N8N — NOTIFICAÇÕES (EM PRODUÇÃO)

```
URL n8n           : https://n8n.liftcode.com.br
Webhook path      : pesquisa-sindicato
URL completa      : https://n8n.liftcode.com.br/webhook/pesquisa-sindicato
Evolution API URL : https://evo.liftcode.com.br
Instância WA      : pesquisa-sindicato
Resend from       : noreply@portalsinteenp.org
Resend domínio    : portalsinteenp.org — VERIFICADO ✅
```

**Status dos fluxos:**
- Workflow "Notificação Filiação Sindical" — **ATIVO** ✅
- Fluxo aprovação → WhatsApp ✅ (testado em produção)
- Fluxo recusa → WhatsApp ✅ (testado em produção)
- Número formatado com prefixo 55 via nó Code in JavaScript ✅
- MESSAGES_UPDATE desativado na Evolution (evita loop) ✅
- Filtro IF removido (desnecessário após desativar eventos) ✅

---

## SESSÃO 8 — RESUMO (Importação + Pagamentos)

### admin/importar.html + js/admin/importar.js
- Drag-drop CSV/XLSX, preview 5 linhas, progress bar, relatório final
- Download modelo CSV incluído
- Batch insert 100 registros, upsert com onConflict CPF

### admin/detalhe.html + js/admin/detalhe.js
- Seção pagamentos: últimos 12 meses, badge adimplente/inadimplente
- `registrarPagamento()` — insere com `valor` (não valor_pagamento)
- `verificarAdimplencia()` — checa mês atual
- Toggle adimplente manual (campo `adimplente BOOLEAN` em socios)
- Forma de pagamento: `<select>` PIX/Boleto/Espécie/Folha

---

## SESSÃO 9 — RESUMO (Bugs + n8n)

### Bugs corrigidos
1. Caminhos absolutos → relativos (`./dashboard.html` etc.)
2. `crypto.randomUUID()` → `gerarUUID()` com fallback para HTTP
3. Campo `valor_pagamento` → `valor` em detalhe.js
4. `serve.json` com `cleanUrls: false` para servidor local

### Ajustes profissionais
- hCaptcha no formulário (chave real pendente — ver roadmap)
- Limite 2MB no contracheque (PDF, JPG, PNG)
- Tela de sucesso com número de protocolo (8 chars UUID)
- Meta tags + favicon em todos os HTMLs
- Identidade no PDF: SINTEENP-PB + subtítulo completo
- `.htaccess`: `Options -Indexes`, bloqueio `.sql/.json/.md`
- Rate limiting no formulário (flag `enviando`, botão disabled)

### CSS separado — 2.595 linhas extraídas de 8 HTMLs
```
css/filiacao.css          (898 linhas)
css/beneficios.css        (591 linhas)
css/privacidade.css       (204 linhas)
css/admin/admin.css       (209 linhas)
css/admin/dashboard.css   (215 linhas)
css/admin/detalhe.css     (185 linhas)
css/admin/novo.css        (122 linhas)
css/admin/importar.css    (171 linhas)
```

---

## DIRETÓRIO — ESTRUTURA ATUAL

```
/
├── index.html                    ✅ Filiação pública + header SINTEENP
├── privacidade.html              ✅ LGPD
├── beneficios.html               ✅ 6 categorias, 18 cards, CTA banner
├── serve.json                    ✅ cleanUrls:false (servidor local)
├── .htaccess                     ✅ Options -Indexes, bloqueios
├── admin/
│   ├── index.html                ✅ Login com logo SINTEENP
│   ├── dashboard.html            ✅ Coluna adimplência
│   ├── detalhe.html              ✅ Toggle adimplência + pagamentos + notificações
│   ├── novo.html                 ✅ Cadastro manual
│   └── importar.html             ✅ Drag-drop CSV/XLSX
├── js/
│   ├── supabase.js               ✅ Client Supabase
│   ├── filiacao.js               ✅ gerarUUID(), hCaptcha, rate limit
│   ├── pdf.js                    ✅ jsPDF com identidade SINTEENP-PB
│   ├── assinatura.js             ✅ Canvas signature
│   └── admin/
│       ├── auth.js               ✅ login/logout/guard (caminhos relativos)
│       ├── dashboard.js          ✅ SELECT inclui adimplente
│       ├── detalhe.js            ✅ toggleAdimplente + notificarSocio
│       │                            webhook: pesquisa-sindicato
│       ├── novo.js               ✅ Cadastro form
│       └── importar.js           ✅ Parse CSV/XLSX, batch insert
├── css/
│   ├── style.css                 ✅ Variáveis: #CC0000 / #1a1a1a
│   ├── filiacao.css              ✅ Header fixo + identidade SINTEENP
│   ├── beneficios.css            ✅ Header fixo + CTA #CC0000
│   ├── privacidade.css           ✅
│   └── admin/
│       ├── admin.css             ✅ Login bg #1a1a1a, primary #CC0000
│       ├── dashboard.css         ✅
│       ├── detalhe.css           ✅
│       ├── novo.css              ✅
│       └── importar.css          ✅
├── sql/
│   ├── 01_schema.sql             ✅ Socios + RLS + GRANT
│   ├── 02_storage.sql            ✅ Buckets + policies
│   ├── 03_pagamentos.sql         ✅ Tabela pagamentos
│   ├── 04_indices.sql            ✅ Performance indices
│   └── 05_adimplente.sql         ✅ ALTER TABLE + GRANT
├── logo/
│   ├── logoSinteenp.jpeg         ✅ Logo principal (header, footer, PDF)
│   └── faviSinteenp.jpeg         ✅ Favicon
└── n8n/
    └── workflow_notificacao.json ✅ Workflow notificações (path: pesquisa-sindicato)
```

---

## ROADMAP — PRÓXIMAS AÇÕES

```
⬜ Dashboard: filtro adimplente/inadimplente no <select>
⬜ admin/relatorio.html — gráfico arrecadação + tabela inadimplentes + export
⬜ hCaptcha — substituir HCAPTCHA_SITE_KEY pela chave real
⬜ Instagram real do sindicato (@sinteenppb — confirmar conta)
⬜ Email real de contato (contato@sinteenp-pb.org.br — confirmar)
⬜ Importar ~600 sócios (revisão manual da planilha necessária antes)
⬜ App carteira do sócio (repo separado)
⬜ Fase 5 n8n — lembrete PIX dia 5 para pagamento direto
⬜ Supabase GRANT nos projetos clinicaharmony e agentesindicato
```

---

## CREDENCIAIS / CONFIG

⚠️ NÃO COMMITAR:
```
SUPABASE_URL     = https://eomwjmszybravljilaeg.supabase.co
SUPABASE_ANON_KEY= eyJ... (ver js/supabase.js)
Admin CRM        : liftcode@outlook.com / Admin@2026
n8n URL          : https://n8n.liftcode.com.br
Evolution API    : https://evo.liftcode.com.br
Resend from      : noreply@portalsinteenp.org
```

---

**Última atualização**: 01 Jun 2026 — Sessão 10 Completa ✅
**Status**: Em produção — https://portalsinteenp.org 🟢
