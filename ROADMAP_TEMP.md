# Roadmap Temporario Consolidado do Postinder

> Lista unica de trabalho futuro, riscos operacionais e validacoes ainda nao comprovadas fora do ambiente local. Funcionalidades implementadas pertencem ao `PROJECT_STATE_TEMP.md`; evolucao historica pertence ao `CHANGELOG_TEMP.md`.

## P0 - Publicacao, ambiente e validacao externa

- Configurar no Render uma etapa de release unica para executar `npm run db:migrate` antes do startup, sem depender da verificacao do servidor como mecanismo de correcao.
- Confirmar no Supabase publicado a aplicacao das migrations estruturais `001` e `003` a `014` e seus registros em `schema_migrations`; `002_development_seed.sql` deve permanecer apenas como historico quando ja existir em bancos antigos.
- Confirmar no ambiente publicado as variaveis de Render, Vercel e Supabase, incluindo `DATABASE_URL`, `APP_PUBLIC_URL`, `VITE_API_URL`, `CORS_ORIGINS` e configuracao do Storage.
- Executar smoke test ponta a ponta publicado para criacao, envio, portal por token e login de Cliente, aprovacao/reprovacao, correcao, execucao, exclusao logica e duplicacao.
- Validar no Supabase publicado upload, substituicao, remocao, reordenacao, copia fisica por duplicacao e metadados `bucket`, `storage_path`, MIME e tamanho.
- Testar a limpeza manual de Retencao com dados descartaveis e confirmar que preserva metadados, registra falhas e nunca remove novamente arquivo com `storage_deleted_at`.
- Confirmar a regra concorrente de unicidade de e-mail e a reutilizacao depois de exclusao/desativacao no banco publicado, inclusive para registros anteriores a migration 011.
- Definir backup, restauracao e procedimento de rollback antes de migrations de impacto ou exclusao definitiva.
- Manter o ambiente de testes restrito a equipe/amigos ate que as validacoes de publicacao e seguranca estejam concluídas.

## P0 - Separacao de Modo demonstracao e Modo producao

- Completar `APP_MODE=demo|production` como configuracao central da aplicacao, sem branches distintos para local, demonstracao, homologacao e producao.
- Permitir reset administrativo, seed/recriacao de dados e credenciais demonstrativas somente em Modo demonstracao.
- Em Modo producao, desabilitar reset e seed automatica, exigir o primeiro admin por `INITIAL_ADMIN_*` e avaliar obrigatoriedade de troca de senha no primeiro acesso.
- Confirmar quais dados o reset deve recriar, preservar e remover em cada modo antes de qualquer uso com clientes reais.
- Remover credenciais previsiveis ou exigir sua troca antes de ampliar o acesso externo.

## P1 - Integridade, seguranca e operacao

- Criar scheduler externo para `npm run storage:cleanup-retention`, com frequencia, alerta e procedimento operacional definidos.
- Adicionar retries controlados e outbox/fila para falhas de Storage e para a compensacao que nao puder terminar dentro da requisicao.
- Registrar resultados agregados da limpeza e falhas de Storage em monitoramento/log operacional.
- Avaliar bucket privado e signed URLs para conteudo de Clientes; definir migracao das URLs publicas existentes antes da mudanca.
- Executar `db:audit-shared-storage-files` no ambiente publicado e planejar a regularizacao segura de objetos legados sem identidade ou com compartilhamento historico.
- Confirmar limites reais de tamanho e quantidade de arquivos em Render/Supabase.
- Adicionar rate limiting e protecao contra tentativa de tokens do portal.
- Auditar permissoes e isolamento por `company_id` em portal, postagens, arquivos, atividades, notificacoes, reset e exclusao definitiva.
- Impedir exclusao ou rebaixamento indevido do ultimo admin capaz de administrar a instancia.
- Definir politica de reativacao quando o e-mail de Cliente inativo ja tiver sido reutilizado.

## P1 - Modelo futuro de Empresa/agencia e Identidade global

- Modelar Identidade global de conta e vinculos por Empresa/agencia antes de suportar multiempresa.
- Definir autenticacao, autorizacao, migracao de `users` e `clients` e regras de e-mail para accounts + memberships.
- Executar auditoria completa de isolamento por `company_id` antes de habilitar mais de uma Empresa/agencia.
- Decidir se `post` continuara representando tambem projeto/campanha ou se sera criada entidade propria de Projeto/Campanha com varias postagens.
- Definir revisao posterior a `executed` como nova postagem ou revisao explicitamente auditavel, sem reabrir nem alterar a Executada original.
- Modelar versoes de arquivos/postagens e decisoes por versao para auditoria de longo prazo.

## P1 - Metricas, notificacoes e historico

- Validar metricas de primeira decisao com varias rodadas de correcao, anexos removidos por Retencao, reenvios e fusos horarios.
- Evitar dupla contagem entre feedback atual e historico; avaliar persistencia explicita de decisao inicial e versao.
- Definir tratamento de Clientes desativados, exclusao definitiva e relatorios/exportacoes de longo prazo.
- Avaliar uma tabela `notifications` para persistir conteudo, destinatario, origem, validade e link.
- Completar politica de notificacoes para correcao reenviada, Executada, anexo removido por Retencao e falha de limpeza.
- Fazer timeline consumir eventos reais de `activity_events` por versao e definir a politica de retencao dos eventos.

## P2 - Itens mantidos sob revisao

- Decidir o destino funcional de `EmailPage` e `IntegrationsPage`, que permanecem por rota ativa ou evolucao futura, sem papel operacional final confirmado.
- Revisar as rotas ainda ativas `/api/v1/approvals`, `/api/v1/files` e `/api/v1/feedback`: manter, restringir ou consolidar somente depois de mapear consumidores e contratos externos.
- Revisar o recorte dos cards do Dashboard no escopo `Geral`, os filtros salvos para Cliente desativado e a coerencia de metricas entre `approved` e `executed`.
- Executar regressao responsiva e de acessibilidade por teclado em tabelas, modal de lote, carrosseis, portal e detalhes do Cliente.
- Padronizar textos remanescentes, incluindo acentuacao/mojibake e a terminologia `postagem`, `Cliente`, `Empresa/agencia`, `Concluida` e `Executada`.
- Revisar aviso do Vite sobre bundle acima de 500 kB e considerar code splitting.
- Criar testes automatizados para repositorios, controllers e fluxos criticos do portal, alem de procedimento de smoke test apos deploy.

## P2 - Configuracoes futuras por Empresa/agencia

- Definir Retencao padrao por Empresa/agencia, mantendo opcao de sobrescrita por postagem.
- Definir prazo padrao de token, politica de regeneracao e regras para desativacao de Cliente por Empresa/agencia.

## P3 - Integracoes adiadas

- Implementar recuperacao de senha real.
- Implementar e-mail/Resend para notificacoes e links.
- Retomar WhatsApp/Z-API somente depois da estabilizacao do fluxo principal.
- Validar painel de IA, custos, privacidade e local correto das chaves.
