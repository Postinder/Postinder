# Roadmap do Postinder

Este documento registra o estado das frentes de preparacao e o trabalho futuro. Investigacoes e relatorios tecnicos nao sao funcionalidades de produto.

## Estado da preparacao pre-deploy

| Frente | Estado |
| --- | --- |
| Auditoria tecnica | concluida |
| Correcoes criticas e altas C-01, C-02, H-02, H-03 e H-04 | concluidas e validadas localmente |
| Backup, restauracao e cadeia de migrations | validados localmente |
| Auditoria operacional do Render | concluida |
| Auditoria operacional da Vercel | pendente |
| Ajustes pontuais de layout definidos na rodada atual | concluidos e validados localmente |
| Aprovacao configuravel `content|item`, UX do portal e rewind por postagem | concluidos, auditados e nao publicados |
| Revisao/certificacao de conteudo, funil com snapshot e historico append-only de soundtrack | concluidos, validados e nao publicados |
| Reacao positiva **Adorei**, metrica mensal, migration 024 e dois P2 focais | concluidos, gate PASS, documentacao em consolidacao e nao publicados |
| Selecao contextual em lote | concluida, auditada e nao publicada |
| Preparacao final de deploy | pendente |
| Deploy | pendente e nao autorizado |
| Validacao pos-deploy | pendente |

## P0 - Ajustes pontuais de interface

- [x] Concluir a rodada definida de Previa do Feed com videos, paineis recolhiveis, swipe em videos, reorganizacao do portal, identidade da 20Cinco e contraste nos temas.
- [x] Concluir aprovacao configuravel, navegacao livre por midias, conclusao explicita no modo `item`, UI simplificada e selecao contextual em lote.
- Alinhar visualmente as acoes dos perfis `admin`, `manager`, `editor` e `viewer`.
- Remover referencias visuais legadas a `gestor` e `equipe`.
- Preservar C-01, C-02, H-02, H-03, H-04, contratos da API, acessibilidade, portal do Cliente e temas claro/escuro.

## P0 - Publicacao e ambientes

- Concluir a verificacao manual da Vercel: nomes e escopos de variaveis, Production/Preview/Development, commit ativo, deployments historicos e previews.
- Rotacionar ou invalidar credenciais somente se a verificacao confirmar ou presumir exposicao historica.
- Revisar as variaveis finais da Vercel e do Render sem transportar segredos para o frontend.
- Configurar a demo publicada com `DEPLOYMENT_MODE=demo`, `ENABLE_DEMO_RESET=true` e `VITE_DEPLOYMENT_MODE=demo`.
- Decidir se a IA sera habilitada; se for, configurar a credencial somente no backend.
- Criar novo backup logico e executar novo preflight imediatamente antes do deploy.
- [ ] Auditar o diff final e criar o segundo commit local autorizado. Antes do deploy, reconfirmar o preflight das migrations `017` a `024` e manter `npm run db:migrate` como release step bloqueante anterior ao Start Command.
- Publicar primeiro o backend, confirmar migrations e startup, depois publicar o frontend.
- Confirmar commits e bundles ativos e executar smoke tests, conferencia de logs sanitizados e teste controlado do reset demo.
- Validar no ambiente publicado metadados de Storage, copia fisica e limpeza manual de Retencao somente com dados descartaveis.

## P0 - Modo demonstracao e Modo producao

- Manter `DEPLOYMENT_MODE` como finalidade da implantacao e `NODE_ENV` como modo tecnico.
- Preservar a dupla guarda do reset, sua capacidade exclusiva e a negacao por padrao.
- Manter seed, reset e credenciais demonstrativas restritos a ambientes controlados.
- Em producao, exigir bootstrap do primeiro admin por ambiente e avaliar troca obrigatoria de senha no primeiro acesso.

## P1 - Storage, seguranca e operacao

- Agendar `npm run storage:cleanup-retention` externamente, com alerta e procedimento operacional.
- Adicionar retries controlados e outbox/fila para falhas de Storage e compensacoes incompletas.
- Implementar upload direto ou retomavel para o Storage, com URL assinada, progresso, repeticao segura e finalizacao auditavel, evitando que videos grandes atravessem integralmente a memoria da API.
- Avaliar transcodificacao ou normalizacao opcional de video para MP4 H.264/AAC e geracao de capa, sem substituir o acesso ao arquivo original.
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
- Expandir, quando houver requisito de produto, as estruturas atuais de revisao e decisao oficial para novas metricas/notificacoes sem substituir o historico append-only existente.
- Avaliar outbox ou transacao compartilhada para `activity_events`, hoje best-effort depois do commit transacional da decisao oficial no banco. A ressalva e baixa e nao afeta estado, revisao, feedback ou metricas.
- Definir tratamento de Clientes desativados e exclusao definitiva em relatorios e exportacoes.
- Definir o tratamento de postagens excluidas por `deleted_at`: separar metricas operacionais do estado canonico vigente das metricas e revisoes historicas, inclusive para postagem `approved` excluida, preservando feedbacks em relatorios, insights, exportacoes e indicadores de aprovacao.
- Estudar prazo configuravel para manifestacao do Cliente, com lembretes antes do vencimento, tratamento da ausencia de resposta e eventual decisao explicita da agencia de publicar apos o prazo. Essa decisao nao equivalera a aprovacao do Cliente e devera registrar ator, prazo, data, justificativa e origem, refletir em notificacoes, metricas e historico e usar operacao especifica, sem reutilizar o endpoint generico de status.

## P2 - Itens sob revisao e qualidade

- Definir o destino de `EmailPage`, `IntegrationsPage` e das rotas `/api/v1/approvals`, `/api/v1/files` e `/api/v1/feedback`.
- Revisar filtros, escopos e metricas entre `approved` e `executed`.
- Ampliar testes automatizados, regressao responsiva, acessibilidade de teclado e smoke test apos deploy.
- Substituir a adaptacao SVG atual da 20Cinco por asset vetorial oficial ou variante oficial para fundos escuros quando fornecida, sem fabricar versao negativa por CSS.
- Configurar uma cadeia de lint coerente com JS/JSX/TS/TSX. O script atual existe, mas ESLint e sua configuracao ainda nao estao disponiveis; lint nao participa de CI nem das configuracoes versionadas/documentadas de Vercel e Render.
- Cobrir upload e reproducao de video nos navegadores suportados, incluindo MP4 compativel, codec nao reproduzivel, arquivo acima de 200 MB, progresso, nova tentativa e controles de video sem acionamento do swipe.
- Corrigir textos remanescentes com acentuacao/mojibake e avaliar code splitting do bundle Vite.
- Avaliar tags de reprovacao configuraveis e eventual editor sem antecipar nova arquitetura.
- Reavaliar a permanencia do soundtrack, hoje opcional e secundario, sem considerar sua remocao uma decisao ja tomada.
- Avaliar somente analises historicas adicionais de entusiasmo; a intencao **Adorei** e a metrica mensal da projecao corrente ja estao concluidas no pacote local.

## P3 - Integracoes

- Recuperacao de senha real.
- E-mail/Resend para notificacoes e links.
- WhatsApp/Z-API depois da estabilizacao do fluxo principal.
- Decidir politica de privacidade, provedor, tratamento de dados, custos e gestao server-side de chaves antes de habilitar a IA real.
- Implementar Twilio, GoHighLevel, Canva e Resend somente por fluxos server-side/OAuth seguros.
