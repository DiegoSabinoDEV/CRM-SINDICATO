# CRM Filiação Sindical — SINTEENP-PB

Sistema digital de filiação e gestão de associados do
Sindicato dos Trabalhadores em Estabelecimentos de
Ensino Privado da Paraíba.

## Produção
https://portalsinteenp.org

## Stack
- Frontend: HTML + Vanilla JS (sem framework)
- Banco: Supabase (PostgreSQL)
- Auth: Supabase Auth
- Storage: Supabase Storage
- Notificações: n8n + Evolution API + Resend
- Deploy: Hostinger KVM2

## Estrutura
- `hostinger/` — arquivos para deploy no servidor
- `local/` — SQL, workflows n8n e documentação

## Funcionalidades
- Página de filiação digital com assinatura na tela
- Geração de ficha PDF com marca d'água
- Upload de contracheque
- CRM admin: aprovar, recusar, editar, excluir
- Cadastro manual e importação CSV
- Controle de adimplência e pagamentos
- Notificação WhatsApp/email ao aprovar ou recusar
- Conformidade LGPD

## Desenvolvido por
Liftcode — https://liftcode.com.br
