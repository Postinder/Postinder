# Roadmap do Postinder

Este documento contem somente trabalho futuro e validacoes ainda pendentes.

## P0 - Publicacao e ambientes

- Configurar etapa de release no Render para executar `npm run db:migrate` antes do startup.
- Confirmar no Supabase publicado as migrations estruturais e `schema_migrations`.
- Validar variaveis de Render, Vercel e Supabase, incluindo API, CORS, URLs de portal e Storage.
- Executar smoke test publicado para criacao, envio, portal, decisao do Cliente, correcao, execucao, exclusao logica e duplicacao.
- Validar no ambiente publicado metadados de Storage, copia fisica e limpeza manual de Retencao com dados descartaveis.
- Definir backup, restauracao e rollback antes de migrations de impacto ou exclusao definitiva.

## P0 - Modo demonstracao e Modo producao

- Completar `APP_MODE=demo|production` como configuracao central para local, demonstracao, homologacao e producao.
- Restringir reset, seed e credenciais demonstrativas ao Modo demonstracao.
- Em producao, exigir bootstrap do primeiro admin por ambiente e avaliar troca obrigatoria de senha no primeiro acesso.

## P1 - Storage, seguranca e operacao

- Agendar `npm run storage:cleanup-retention` externamente, com alerta e procedimento operacional.
- Adicionar retries controlados e outbox/fila para falhas de Storage e compensacoes incompletas.
- Avaliar bucket privado e signed URLs, com plano de migracao das URLs existentes.
- Executar auditoria de objetos compartilhados e arquivos legados sem identidade no ambiente publicado.
- Adicionar rate limiting para tokens e auditoria completa de permissoes e isolamento por `company_id`.
- Proteger contra exclusao ou rebaixamento do ultimo admin da instancia.

## P1 - Empresa/agencia e Identidade global

- Modelar contas globais, Empresas/agencias e memberships antes de habilitar multiempresa.
- Definir migracao de `users` e `clients`, autenticacao e regras de e-mail para o novo modelo.
- Decidir e modelar organizacao Cliente versus pessoa aprovadora, incluindo multiplos membros, permissoes, regra de aprovacao unica ou multipla, substituicao de aprovadores sem perda de historico e vinculos da organizacao com varias Empresas/agencias.
- Definir a experiencia de visao geral e alternancia entre Empresas/agencias depois de um unico login de Cliente, preservando o isolamento de cada contexto.
- Auditar isolamento por Empresa/agencia antes de habilitar mais de uma empresa.
- Decidir entre manter `post` como agregador ou criar entidade propria de Projeto/Campanha.
- Modelar versoes de postagem/anexo e revisoes posteriores a `executed` sem alterar o registro original.

## P1 - Historico, metricas e notificacoes

- Validar metricas em reenvios, Retencao, fusos horarios e multiplas rodadas de correcao.
- Avaliar estrutura persistida para decisao inicial, versao e notificacoes.
- Definir tratamento de Clientes desativados e exclusao definitiva em relatorios e exportacoes.
- Definir o tratamento de postagens excluidas por `deleted_at`: separar metricas operacionais de registros ativos das metricas historicas, inclusive para postagem `approved` excluida, preservando primeira decisao e feedbacks em relatorios, insights, exportacoes e indicadores de aprovacao.
- Estudar prazo configuravel para manifestacao do Cliente, com lembretes antes do vencimento, tratamento da ausencia de resposta e eventual decisao explicita da agencia de publicar apos o prazo. Essa decisao nao equivalera a aprovacao do Cliente e devera registrar ator, prazo, data, justificativa e origem, refletir em notificacoes, metricas e historico e usar operacao especifica, sem reutilizar o endpoint generico de status.

## P2 - Itens sob revisao e qualidade

- Definir o destino de `EmailPage`, `IntegrationsPage` e das rotas `/api/v1/approvals`, `/api/v1/files` e `/api/v1/feedback`.
- Revisar filtros, escopos e metricas entre `approved` e `executed`.
- Ampliar testes automatizados, regressao responsiva, acessibilidade de teclado e smoke test apos deploy.
- Corrigir textos remanescentes com acentuacao/mojibake e avaliar code splitting do bundle Vite.

## P3 - Integracoes

- Recuperacao de senha real.
- E-mail/Resend para notificacoes e links.
- WhatsApp/Z-API depois da estabilizacao do fluxo principal.
- Painel de IA, custos, privacidade e gestao de chaves.
