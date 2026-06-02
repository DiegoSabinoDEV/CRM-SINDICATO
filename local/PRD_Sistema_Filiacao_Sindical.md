# PRD — Sistema de Filiação Digital Sindical
**Product Requirements Document**
**Versão:** 2.0
**Data:** 22/05/2026
**Autor:** Diego Sabino — Liftcode
**Status:** Pronto para desenvolvimento

---

## 1. Visão Geral do Produto

### 1.1 Objetivo
Criar um sistema simples, seguro e funcional que integre uma página de filiação digital a um CRM interno, permitindo que trabalhadores se filiem online e que o sindicato gerencie esses cadastros de forma centralizada.

### 1.2 Problema que resolve
Atualmente o processo de filiação é manual (papel, presencial ou por e-mail), dificultando rastreamento, aprovação e organização dos dados dos sócios. O sistema digitaliza e automatiza esse fluxo do início ao fim.

### 1.3 Resultado esperado
- Sócio preenche formulário online → dados chegam automaticamente no CRM
- Sócio escolhe forma de pagamento: desconto em folha ou pagamento direto ao sindicato
- Ficha preenchida com assinatura digital é gerada e armazenada como PDF
- Contracheque enviado pelo sócio é armazenado com segurança
- Funcionário do sindicato revisa, aprova ou recusa cada filiação
- Sócios com pagamento direto recebem lembrete automático via WhatsApp e/ou e-mail no dia do vencimento com QR Code PIX
- Todos os dados tratados em conformidade com a LGPD (Lei 13.709/2018)

---

## 2. Usuários do Sistema

| Perfil | Quem é | O que faz |
|---|---|---|
| **Candidato a Sócio** | Trabalhador que acessa a página | Preenche formulário, assina, envia contracheque |
| **Admin / Funcionário** | Funcionário do sindicato | Aprova, recusa, edita, exclui, cadastra manualmente |

---

## 3. Stack Tecnológica Recomendada

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Banco de dados** | Supabase (PostgreSQL) | Gratuito, seguro, API automática, storage nativo |
| **Autenticação CRM** | Supabase Auth | Simples, pronto, sem backend extra |
| **Página de filiação** | HTML/JS existente | Integra via supabase-js SDK |
| **Armazenamento de arquivos** | Supabase Storage | PDF da ficha + contracheque |
| **Geração de PDF da ficha** | jsPDF (client-side) ou pdf-lib | Gera PDF com dados + imagem da assinatura |
| **CRM (painel admin)** | HTML/JS ou React simples | Dashboard leve, sem framework pesado |
| **Hospedagem CRM** | Vercel / Netlify (free tier) | Deploy simples, gratuito |
| **Automação de notificações** | n8n (já utilizado na Liftcode) | Scheduled trigger diário para lembretes |
| **WhatsApp (lembretes)** | Evolution API (já utilizado) | Disparo de mensagem + QR Code PIX |
| **E-mail (lembretes)** | Resend + Supabase | Envio de e-mail transacional gratuito |
| **Geração QR Code PIX** | API pix.ae ou geração local | QR Code estático por sócio |

> **Zero backend customizado.** Todo o fluxo roda via Supabase diretamente. As notificações usam infraestrutura já existente na Liftcode.

---

## 4. Arquitetura do Sistema

```
┌─────────────────────────────────────┐
│         PÁGINA DE FILIAÇÃO          │
│  (HTML existente — lado do sócio)   │
│                                     │
│  1. Formulário de dados + LGPD      │
│  2. Escolha forma de pagamento      │
│  3. Upload contracheque             │
│  4. Assinatura na tela (canvas)     │
│  5. Geração PDF da ficha            │
│  6. Envio via supabase-js           │
└──────────────────┬──────────────────┘
                   │ supabase-js SDK
                   ▼
┌─────────────────────────────────────┐
│              SUPABASE               │
│                                     │
│  ┌─────────────┐  ┌──────────────┐  │
│  │  Tabela     │  │   Storage    │  │
│  │  socios     │  │  Buckets:    │  │
│  │             │  │  - fichas/   │  │
│  │  (todos os  │  │  - contrach/ │  │
│  │   dados)    │  │              │  │
│  └─────────────┘  └──────────────┘  │
│                                     │
│  Auth (login do funcionário)        │
│  RLS (segurança por linha)          │
└────────┬─────────────────┬──────────┘
         │                 │
         ▼                 ▼
┌──────────────┐  ┌─────────────────────┐
│  CRM ADMIN   │  │  n8n (agendado)     │
│              │  │  Todo dia — 08h     │
│  - Listar    │  │                     │
│  - Aprovar   │  │  Busca sócios com   │
│  - Recusar   │  │  pagamento direto   │
│  - Editar    │  │  e vencimento hoje  │
│  - Excluir   │  │         ↓           │
│  - Manual    │  │  Gera QR Code PIX   │
└──────────────┘  │         ↓           │
                  │  Evolution API      │
                  │  (WhatsApp)         │
                  │  + Resend (E-mail)  │
                  └─────────────────────┘
```

---

## 5. Modelo de Dados

### Tabela: `socios`

```sql
CREATE TABLE socios (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Dados pessoais
  nome_completo     TEXT NOT NULL,
  cpf               TEXT NOT NULL UNIQUE,
  rg                TEXT,
  data_nascimento   DATE,
  sexo              TEXT,
  estado_civil      TEXT,

  -- Contato
  email             TEXT,
  telefone          TEXT,
  whatsapp          TEXT,

  -- Endereço
  cep               TEXT,
  logradouro        TEXT,
  numero            TEXT,
  complemento       TEXT,
  bairro            TEXT,
  cidade            TEXT,
  estado            TEXT,

  -- Dados profissionais
  empresa           TEXT,
  cargo             TEXT,
  matricula         TEXT,
  setor             TEXT,
  data_admissao     DATE,

  -- Pagamento da mensalidade
  forma_pagamento   TEXT DEFAULT 'folha',
  -- valores: 'folha' | 'direto'
  dia_vencimento    INTEGER,
  -- dia do mês (1-28) — preenchido quando forma_pagamento = 'direto'
  valor_mensalidade NUMERIC(10,2),

  -- Filiação
  status            TEXT DEFAULT 'pendente',
  -- valores: 'pendente' | 'aprovado' | 'recusado'
  motivo_recusa     TEXT,
  data_filiacao     TIMESTAMPTZ DEFAULT now(),
  aprovado_por      TEXT,
  aprovado_em       TIMESTAMPTZ,

  -- Arquivos (caminhos no Supabase Storage)
  ficha_pdf_url     TEXT,
  contracheque_url  TEXT,
  assinatura_url    TEXT,

  -- LGPD
  consentimento_lgpd        BOOLEAN NOT NULL DEFAULT false,
  data_consentimento_lgpd   TIMESTAMPTZ,
  ip_consentimento          TEXT,
  -- dados do IP no momento do preenchimento (evidência de consentimento)

  -- Metadata
  origem            TEXT DEFAULT 'pagina_web',
  -- valores: 'pagina_web' | 'manual'
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

### Bucket Storage (Supabase)

| Bucket | Conteúdo | Acesso |
|---|---|---|
| `fichas` | PDF gerado com dados + assinatura | Privado (só admin) |
| `contracheques` | Arquivo enviado pelo sócio | Privado (só admin) |

---

## 6. Funcionalidades Detalhadas

### 6.1 Página de Filiação (Frontend — Sócio)

**Seções do formulário:**

1. **Dados Pessoais**
   - Nome completo (obrigatório)
   - CPF com validação de formato (obrigatório)
   - RG
   - Data de nascimento
   - Sexo / Estado civil

2. **Contato**
   - E-mail
   - Telefone / WhatsApp

3. **Endereço**
   - CEP com auto-preenchimento via ViaCEP API
   - Logradouro, número, bairro, cidade, UF

4. **Dados Profissionais**
   - Empresa / Matrícula / Cargo / Setor
   - Data de admissão

5. **Upload de Contracheque**
   - Aceita: PDF, JPG, PNG
   - Tamanho máximo: 5MB
   - Campo obrigatório

6. **Assinatura Digital**
   - Canvas de assinatura na tela (já existente na página)
   - Capturada como imagem base64

7. **Forma de Pagamento da Mensalidade**
   - 🔘 Desconto em folha de pagamento
   - 🔘 Pagamento direto ao sindicato (PIX/boleto)
   - Se "pagamento direto": exibir campo "Dia preferencial de vencimento" (1 a 28)

8. **Consentimento LGPD** *(obrigatório)*
   - Texto visível: *"Seus dados serão utilizados exclusivamente para fins de filiação sindical, conforme a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018). Você pode solicitar a exclusão dos seus dados a qualquer momento."*
   - Checkbox obrigatório: *"Li e concordo com a Política de Privacidade e autorizo o uso dos meus dados"*
   - Link para a Política de Privacidade (página separada)

9. **Declaração e Envio**
   - Checkbox: *"Declaro que as informações prestadas são verdadeiras"*
   - Botão de enviar

**Fluxo de envio (JavaScript):**

```
1. Validar campos obrigatórios (CPF, nome, contracheque, assinatura, consentimento LGPD)
2. Capturar IP do usuário via API pública (ipapi.co)
3. Gerar PDF da ficha com jsPDF (dados + assinatura + forma de pagamento embutidos)
4. Upload contracheque → Supabase Storage bucket 'contracheques'
5. Upload ficha PDF → Supabase Storage bucket 'fichas'
6. Upload imagem da assinatura → Supabase Storage bucket 'fichas'
7. Insert na tabela 'socios' com todas as URLs + dados LGPD
8. Exibir tela de sucesso para o sócio
```

**Estados de feedback:**
- Loading durante envio
- Sucesso: "Sua filiação foi recebida! Aguarde contato."
- Erro de CPF duplicado: "Este CPF já possui cadastro."
- Erro genérico: "Erro ao enviar. Tente novamente."

---

### 6.2 CRM — Painel Admin (Frontend — Funcionário)

**Acesso:**
- Login via Supabase Auth (e-mail + senha)
- Sessão persistente no browser
- Logout manual

**Tela Principal — Lista de Sócios:**

| Coluna | Descrição |
|---|---|
| Nome | Nome completo |
| CPF | Formatado e mascarado |
| Empresa | Empresa do trabalhador |
| Pagamento | Badge: Folha (azul) / Direto (laranja) |
| Status | Badge colorido: Pendente (amarelo) / Aprovado (verde) / Recusado (vermelho) |
| Data | Data da filiação |
| Ações | Ver / Editar / Excluir |

**Filtros disponíveis:**
- Por status (pendente / aprovado / recusado)
- Por forma de pagamento (folha / direto)
- Por período (data de filiação)
- Busca por nome ou CPF

**Tela de Detalhe do Sócio:**
- Todos os dados preenchidos
- Visualização da ficha PDF (abrir/baixar)
- Visualização do contracheque (abrir/baixar)
- Imagem da assinatura
- Botões: **Aprovar** | **Recusar** (com campo de motivo) | **Editar** | **Excluir**

**Cadastro Manual:**
- Formulário idêntico ao da página de filiação
- Campo "origem" preenchido automaticamente como `manual`
- Upload de contracheque opcional
- Status inicial: pode ser definido diretamente como "aprovado"

**Ações disponíveis:**

| Ação | Comportamento |
|---|---|
| **Aprovar** | Muda status para `aprovado`, registra quem aprovou e quando |
| **Recusar** | Muda status para `recusado`, exige preenchimento de motivo |
| **Editar** | Abre formulário preenchido, salva alterações |
| **Excluir** | Confirmação modal, remove registro e arquivos do storage |
| **Cadastro manual** | Abre formulário em branco para inserção pelo admin |

---

## 7. Segurança

### 7.1 Row Level Security (RLS) no Supabase

```sql
-- Inserção pública (página de filiação não exige login)
CREATE POLICY "insert_publico" ON socios
  FOR INSERT WITH CHECK (true);

-- Leitura somente para usuários autenticados
CREATE POLICY "leitura_autenticados" ON socios
  FOR SELECT USING (auth.role() = 'authenticated');

-- Atualização somente para usuários autenticados
CREATE POLICY "atualizacao_autenticados" ON socios
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Exclusão somente para usuários autenticados
CREATE POLICY "exclusao_autenticados" ON socios
  FOR DELETE USING (auth.role() = 'authenticated');
```

### 7.2 Storage

- Buckets `fichas` e `contracheques` configurados como **privados**
- Upload público permitido apenas para inserção (sem leitura pública)
- Download somente via URL assinada (signed URL) gerada pelo CRM autenticado

### 7.3 Dados sensíveis

- CPF não é exibido em telas de listagem (apenas mascarado: `***.123.456-**`)
- Contracheque acessível somente dentro do CRM autenticado
- Comunicação exclusivamente via HTTPS

---

## 8. Geração da Ficha PDF

A ficha é gerada **no browser do sócio** antes do envio, usando `jsPDF`.

**Conteúdo do PDF:**

```
┌────────────────────────────────────────────┐
│        FICHA DE FILIAÇÃO — [SINDICATO]     │
│        Data: DD/MM/AAAA                    │
├────────────────────────────────────────────┤
│ DADOS PESSOAIS                             │
│ Nome: ___________________________________  │
│ CPF: ______________  RG: ______________    │
│ Nascimento: ________  Sexo: ___________    │
├────────────────────────────────────────────┤
│ CONTATO                                    │
│ E-mail: _________________________________  │
│ Telefone/WhatsApp: _______________         │
├────────────────────────────────────────────┤
│ ENDEREÇO                                   │
│ Rua/Av: ________________________________   │
│ Bairro: ____________  CEP: ____________    │
│ Cidade/UF: _____________________________   │
├────────────────────────────────────────────┤
│ DADOS PROFISSIONAIS                        │
│ Empresa: _______________________________   │
│ Cargo: _____________  Matrícula: _______   │
├────────────────────────────────────────────┤
│ FORMA DE PAGAMENTO DA MENSALIDADE          │
│ ( ) Desconto em folha                      │
│ ( ) Pagamento direto — Vencimento: dia __  │
├────────────────────────────────────────────┤
│ DECLARAÇÃO                                 │
│ Declaro que as informações são verdadeiras │
│ e solicito minha filiação ao sindicato.    │
│ Autorizo o uso dos meus dados conforme     │
│ a LGPD (Lei 13.709/2018).                  │
├────────────────────────────────────────────┤
│ ASSINATURA DIGITAL:                        │
│                                            │
│  [imagem da assinatura capturada]          │
│                                            │
│ Assinado digitalmente em: DD/MM/AAAA HH:MM │
└────────────────────────────────────────────┘
```

---

## 9. Fases de Desenvolvimento

### Fase 1 — Banco de dados e infraestrutura (Dia 1)
- [ ] Criar projeto no Supabase
- [ ] Executar SQL de criação da tabela `socios` (com campos de pagamento e LGPD)
- [ ] Criar buckets `fichas` e `contracheques`
- [ ] Configurar RLS e policies
- [ ] Criar usuário admin no Supabase Auth
- [ ] Testar inserção e leitura via Supabase Studio

### Fase 2 — Integração da página de filiação (Dia 2-3)
- [ ] Adicionar `supabase-js` SDK à página existente
- [ ] Implementar validação de CPF
- [ ] Implementar seleção de forma de pagamento (folha / direto + dia de vencimento)
- [ ] Implementar bloco de consentimento LGPD com link para política de privacidade
- [ ] Implementar captura de IP do usuário (ipapi.co)
- [ ] Implementar upload do contracheque para Storage
- [ ] Implementar geração do PDF da ficha com jsPDF (incluindo pagamento e LGPD)
- [ ] Implementar captura da assinatura como imagem
- [ ] Implementar insert na tabela `socios` com todos os campos
- [ ] Implementar feedbacks de sucesso/erro para o sócio
- [ ] Criar página de Política de Privacidade

### Fase 3 — CRM Painel Admin (Dia 4-6)
- [ ] Criar página de login (Supabase Auth)
- [ ] Criar listagem de sócios com filtros (status, forma de pagamento, período, busca)
- [ ] Criar tela de detalhe com visualização de arquivos
- [ ] Implementar ações: Aprovar / Recusar / Editar / Excluir
- [ ] Implementar cadastro manual (com campo de forma de pagamento)
- [ ] Testar fluxo completo end-to-end

### Fase 4 — Revisão e entrega (Dia 7)
- [ ] Testes de segurança (RLS, acesso não autenticado)
- [ ] Teste de upload de arquivos grandes
- [ ] Teste de CPF duplicado
- [ ] Ajustes de UI/UX
- [ ] Deploy do CRM (Vercel/Netlify)
- [ ] Documentação de uso para o cliente

### Fase 5 — Notificações automáticas de pagamento (Dia 8-9)
- [ ] Criar workflow n8n com Schedule Trigger (todo dia às 08h)
- [ ] Nó Supabase: buscar sócios `status = 'aprovado'` + `forma_pagamento = 'direto'` + `dia_vencimento = hoje`
- [ ] Integrar API de geração de QR Code PIX (pix.ae ou equivalente)
- [ ] Nó Evolution API: montar mensagem WhatsApp com nome do sócio + valor + QR Code PIX
- [ ] Nó Resend: montar e-mail com mesmas informações (para quem tiver e-mail cadastrado)
- [ ] Tratar erros: sócios sem WhatsApp ou sem e-mail (pular sem quebrar o fluxo)
- [ ] Testar envio completo com sócio de teste

---

## 10. LGPD — Conformidade Detalhada

### 10.1 Bases legais utilizadas
O sistema se baseia em duas bases legais da LGPD:

| Base Legal | Artigo LGPD | Onde se aplica |
|---|---|---|
| **Consentimento** | Art. 7º, I | Coleta de dados pessoais na filiação |
| **Execução de contrato** | Art. 7º, V | Gestão da filiação e cobrança de mensalidade |

### 10.2 Requisitos implementados no sistema

| Requisito | Implementação |
|---|---|
| **Consentimento explícito** | Checkbox obrigatório com texto da finalidade e link para política |
| **Registro do consentimento** | Campos `consentimento_lgpd`, `data_consentimento_lgpd`, `ip_consentimento` na tabela |
| **Finalidade declarada** | Texto visível no formulário antes do checkbox |
| **Política de Privacidade** | Página separada linkada no formulário (criada na Fase 2) |
| **Dados mínimos** | Formulário coleta apenas o necessário para filiação |
| **Armazenamento seguro** | Supabase com RLS, storage privado, HTTPS |
| **Direito de exclusão** | Admin pode excluir qualquer cadastro pelo CRM |
| **Acesso restrito** | CRM acessível apenas com autenticação |

### 10.3 O que é responsabilidade do sindicato (não técnico)

| Obrigação | Descrição |
|---|---|
| **Nomear DPO** | Indicar um responsável pelos dados pessoais (pode ser interno) |
| **Registrar o tratamento** | Manter registro interno das atividades de tratamento de dados |
| **Responder solicitações** | Atender pedidos de acesso, correção ou exclusão de dados dos sócios |
| **Não compartilhar dados** | Não repassar dados dos sócios a terceiros sem nova base legal |

### 10.4 Texto da Política de Privacidade (modelo base)

A ser publicado em página dedicada (ex: `/privacidade`):

```
POLÍTICA DE PRIVACIDADE — [NOME DO SINDICATO]

1. QUAIS DADOS COLETAMOS
   Nome, CPF, RG, data de nascimento, endereço, contato, dados profissionais,
   contracheque e assinatura digital, coletados exclusivamente para fins de filiação.

2. PARA QUE USAMOS
   Gestão de filiação sindical, controle de mensalidades e comunicação com o sócio.

3. COM QUEM COMPARTILHAMOS
   Não compartilhamos seus dados com terceiros, exceto quando exigido por lei.

4. POR QUANTO TEMPO GUARDAMOS
   Pelo período necessário para manutenção da filiação. Após desfiliação,
   os dados são excluídos em até 90 dias, salvo obrigação legal.

5. SEUS DIREITOS (LGPD)
   Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer
   momento pelo e-mail: [EMAIL DO SINDICATO]

6. CONTATO DO RESPONSÁVEL
   [NOME DO RESPONSÁVEL] — [EMAIL] — [TELEFONE]

Última atualização: [DATA]
```

---

## 11. O que está FORA do escopo (v1.0)

- Assinatura digital com validade jurídica (ICP-Brasil) — é uma assinatura de aceite simples
- Portal do sócio para acompanhar status
- Relatórios e exportação de dados (CSV/Excel)
- App mobile
- Controle de inadimplência (registro de pagamentos recebidos)

---

## 12. Critérios de Aceite (Definition of Done)

| # | Critério |
|---|---|
| 1 | Sócio preenche formulário e recebe confirmação de envio |
| 2 | Dados aparecem no CRM com status "pendente" imediatamente |
| 3 | Ficha PDF é gerada com dados corretos, forma de pagamento e assinatura visível |
| 4 | Contracheque é armazenado e acessível apenas pelo admin |
| 5 | Admin consegue aprovar/recusar com registro de quem executou |
| 6 | Admin consegue editar qualquer campo do cadastro |
| 7 | Admin consegue excluir cadastro com confirmação |
| 8 | Admin consegue cadastrar sócio manualmente |
| 9 | CPF duplicado é rejeitado com mensagem clara |
| 10 | Painel CRM inacessível sem login autenticado |
| 11 | Sócio com pagamento direto recebe WhatsApp no dia do vencimento com QR Code PIX |
| 12 | Sócio com e-mail cadastrado recebe e-mail de cobrança no dia do vencimento |
| 13 | Formulário não envia sem consentimento LGPD marcado |
| 14 | Data, hora e IP do consentimento são gravados no banco |
| 15 | Política de Privacidade está acessível pelo link no formulário |

---

*Documento gerado por Liftcode — liftcode.com.br*
