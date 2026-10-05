# Relatório final — pacote de revisão Postinder

Data: 04/10/2026. Escopo: implementação exclusivamente local de Voltar, Adorei com feedback positivo e aprovação administrativa, seguida da correção focal de AUD-025-01 e AUD-025-02.

## A. Resultado geral

A reauditoria adversarial da implementação encontrou AUD-025-01 (MEDIUM) e AUD-025-02 (LOW), com veredito CHANGES REQUIRED. Ambos foram corrigidos nesta etapa focal; a decisão final de auditoria permanece pendente. Estado da correção: READY FOR FOCAL REAUDIT. Nenhuma operação remota ou consolidação Git foi realizada.

## A.1 Correção focal — AUD-025-01 e AUD-025-02

- **AUD-025-01: FIXED.** Insights preserva na população histórica as postagens posteriormente certificadas por admin quando existem feedbacks/evidências de rejeição do cliente. Origem administrativa isolada não cria decisão do cliente. Um helper pequeno reúne a fórmula já existente, usada pela tela e pelo CSV; nenhuma fórmula legada de deduplicação foi remodelada. O cenário auditado permanece em 4 arquivos, 25%/75% antes/depois; aprovação administrativa não incrementa aprovação mensal do cliente nem Adorei.
- **AUD-025-02: FIXED.** O modal limita entrada/colagem e contador a 5.000 pontos de código Unicode usando Array.from; não depende de maxLength em UTF-16. API e PostgreSQL já seguiam esse contrato e permaneceram inalterados.
- Novos testes: 5 unitários de histórico; 1 fluxo React de tela/CSV; 3 fluxos React de fronteira ASCII/emoji/mista; 3 unitários backend e 3 integrações HTTP/PostgreSQL das mesmas fronteiras. São 15 testes adicionados aos agregados.
- Validação da correção: backend 243/243, frontend unitário 88/88, React 57/57, PostgreSQL revisão 27/27, portal 14/14 e pacote 43/43: **472 testes distintos**. Typechecks backend/frontend, build frontend e git diff --check passaram. Probe adicional com certificação administrativa real confirmou métricas idênticas antes/depois.
- Documentação pontual: PRODUCT_DECISIONS.md e PROJECT_STATE.md distinguem status operacional de origem client/admin.
- Nenhuma mudança em certificação, fingerprint, r+1, rewind, capability, idempotência, autorização, gate, soundtrack, transações, migration 025 ou dados históricos. O SHA-256 da migration permanece o mesmo registrado em C.
- Baseline desta correção: 47 tracked modificados, 11 novos e 89 arquivos preexistentes em tmp/. Resultado: 47 tracked modificados e 14 novos (3 arquivos focais adicionais); índice vazio e tmp/ com hashes preservados.
- Testes/build executados em cópia externa, com PostgreSQL descartável local. Container postinder-focal-fix-20261004 e recursos externos de validação removidos ao final. Lint continua indisponível; o build mantém aviso de chunk (653,83 kB / 183,79 kB gzip).

## B. Git da implementação principal (antes da correção focal)

- Branch: `configuracoes-gerais-plataforma`.
- HEAD inicial e final: `62dd524f3ca8a67ca907d36ee423b767a87f7409`.
- Baseline confirmado: nenhum tracked modificado, índice vazio e tmp/ preexistente. As alterações atuais foram feitas nesta implementação.
- Estado final: 47 arquivos rastreados modificados e 11 novos deste pacote, incluindo este relatório. Nenhum staged. O workspace contém deliberadamente alterações para revisão; o estado após a correção focal está registrado em A.1.
- tmp/: 89 arquivos antes/depois; comparação de caminhos e hashes SHA-256 sem diferenças. Não foi adicionado ao Git.
- Sem commit, push, pull, merge, rebase, deploy, stash, reset ou alteração de produção/serviço remoto.
- git diff --check passou. Diff de backend, frontend, migration, testes e documentação revisado.

### Arquivos rastreados modificados

- `CHANGELOG.md`
- `PRODUCT_DECISIONS.md`
- `PROJECT_STATE.md`
- `README.md`
- `ROADMAP.md`
- `apps/admin/package.json`
- `apps/admin/src/components/posts/DeletePostModal.jsx`
- `apps/admin/src/features/approvals/ApprovalsPage.jsx`
- `apps/admin/src/features/clients/ClientDetailsPage.jsx`
- `apps/admin/src/features/dashboard/DashboardPage.jsx`
- `apps/admin/src/features/insights/InsightsPage.jsx`
- `apps/admin/src/features/portal/ClientPortalPage.jsx`
- `apps/admin/src/features/portal/PortalReviewActions.jsx`
- `apps/admin/src/features/portal/PortalReviewHeader.jsx`
- `apps/admin/src/features/portal/PortalRevisionConflictFlow.test.jsx`
- `apps/admin/src/features/portal/PortalStatusBadge.jsx`
- `apps/admin/src/features/portal/SoundtrackReviewCard.jsx`
- `apps/admin/src/features/portal/portalMetrics.js`
- `apps/admin/src/features/portal/portalRevision.js`
- `apps/admin/src/features/portal/portalServices.test.jsx`
- `apps/admin/src/features/posts/ManagePostsPage.jsx`
- `apps/admin/src/features/posts/postBulkSelection.js`
- `apps/admin/src/services/clientPortal.service.js`
- `apps/admin/src/services/portal.service.js`
- `apps/admin/src/services/posts.service.js`
- `backend/README.md`
- `backend/package.json`
- `backend/scripts/validateSoundtracks.ts`
- `backend/src/modules/auth/domain/AdminCapability.ts`
- `backend/src/modules/branding/branding.test.ts`
- `backend/src/modules/portal/infrastructure/repositories/PortalRepository.ts`
- `backend/src/modules/portal/portalApproval.integration.test.ts`
- `backend/src/modules/portal/portalApproval.test.ts`
- `backend/src/modules/portal/presentation/controllers/PortalController.ts`
- `backend/src/modules/posts/infrastructure/mappers/PostMapper.ts`
- `backend/src/modules/posts/infrastructure/repositories/PostRepository.ts`
- `backend/src/modules/posts/postRevision.integration.test.ts`
- `backend/src/modules/posts/presentation/controllers/PostsController.ts`
- `backend/src/modules/posts/presentation/routes/posts.routes.ts`
- `backend/src/modules/soundtracks/infrastructure/repositories/SoundtrackRepository.ts`
- `backend/src/shared/authorization/AdminRoutePolicy.ts`
- `backend/src/shared/middlewares/adminAuthorization.test.ts`
- `backend/src/shared/middlewares/authBoundary.test.ts`
- `backend/src/shared/utils/logSanitizer.test.ts`
- `database/README.md`
- `docs/DEPLOYMENT.md`
- `docs/deploy/CHECKLIST_DEPLOY_TESTE.md`

### Arquivos novos

- `apps/admin/src/components/posts/AdministrativeReview.jsx`
- `apps/admin/src/features/portal/PositiveFeedbackDialog.jsx`
- `apps/admin/src/features/portal/ReviewPackageFlow.test.jsx`
- `backend/src/modules/portal/domain/ReviewRound.ts`
- `backend/src/modules/posts/application/services/AdministrativeApprovalService.ts`
- `backend/src/modules/posts/domain/ApprovalCertification.ts`
- `backend/src/modules/posts/domain/MaterialFingerprint.test.ts`
- `backend/src/modules/posts/domain/MaterialFingerprint.ts`
- `backend/src/modules/posts/reviewPackage.integration.test.ts`
- `database/migrations/025_review_feedback_and_admin_approval.sql`
- `docs/REVIEW_PACKAGE_REPORT.md`

## C. Migration

`database/migrations/025_review_feedback_and_admin_approval.sql` é a única migration incremental nova.

- Adiciona positive_feedback nullable em drafts/decisões; justification, idempotency_key e request_fingerprint em ações.
- Valida approved+loved, campo content apenas na decisão content, texto não branco incluindo Unicode e limite de 5.000 caracteres; snapshots antigos sem positiveFeedback continuam válidos.
- admin_approved exige revisão positiva, ator identificado com papel admin, rejeição referenciada, justificativa, UUID idempotente e SHA-256. Backend valida postagem/cliente/ciclo da rejeição sob transação.
- Índices parciais únicos por (post_id, content_revision) e (post_id, idempotency_key).
- Sem backfill, novo status, nova tabela ou reescrita de histórico/triggers append-only.
- Cadeia oficial: 24 migrations estruturais aplicadas em banco vazio; segunda execução fez skip das 24, além de ignorar o seed 002 em ambas. Constraints, índices, legado, append-only e cascatas foram testados.
- SHA-256 do arquivo validado: `7B6E8501DF71A61D823F6840B495B3D0C1419BCBBE159ABEB48DA3D5EF298431`.
- PostgreSQL descartável: container `postinder-approval-test-20261004`, porta 127.0.0.1:55439, bancos postinder_approval_test e postinder_migration_test. Container removido ao final; docker ps -a filtrado confirmou ausência.

## D. Voltar

A candidata vem da última decisão oficial do cliente antes da elegibilidade. Reaberta, consumida, executada, alterada, deletada ou reassociada: nenhuma postagem anterior a substitui. GET dos dois portais devolve available, postId, decisionId, contentRevision e reviewSequence. localStorage não participa da autorização.

Conclusões e rewind usam advisory lock por cliente antes do lock da postagem, estabelecendo ordem inclusive entre posts diferentes. O horário oficial é atribuído após esse lock; alterações materiais usam clock_timestamp() após adquirir o lock para não parecerem anteriores à conclusão. Todos os comandos de review verificam expectedReviewSequence além de expectedRevision. Rewind verifica expectedDecisionId, registra client_rewind e reconhece retry sem duplicação. Voltar aparece no cabeçalho e na tela final; refresh/foco atualizam a autoridade do servidor. Navegação entre anexos continua livre.

## E. Adorei

Identidade azul em estados normal, hover, selecionado, foco, disabled e dark. Ao clicar abre o modal aprovado, com campo opcional até 5.000 caracteres. Cancelar/fechar não salva; confirmar registra approved+loved, com trim/branco→NULL. A intenção captura post, item, revisão e rodada; mudanças invalidam o modal.

Em content, o comentário integra portal_review_decisions.positive_feedback. Em item, integra portal_item_review_drafts.positive_feedback até a conclusão; depois pertence a item_snapshot[].positiveFeedback, separado de comment de rejeição. Rewind limpa drafts atuais e preserva o histórico. Retry idêntico é idempotente; texto diferente após fato oficial conflita. Nenhum elogio entra em feedback. “Adorei no mês” continua uma contagem por post e não conta certificação administrativa como entusiasmo do cliente.

## F. Aprovação administrativa

- Capability posts:admin-approve exclusivamente para admin; manager, editor, viewer, cliente e token privado de portal não podem aprovar administrativamente.
- GET /api/v1/posts/:id/admin-approval prepara revisão/fingerprint; POST /api/v1/posts/:id/admin-approve confirma. Body estrito: justification, expectedRevision, expectedFingerprint, idempotencyKey. Ator/role/empresa vêm do servidor.
- Exige status rejected, rejeição oficial atual da mesma postagem/cliente/ciclo, cliente ativo, empresa coerente, material completo e post não deletado/executado. Legado sem fato oficial é recusado.
- AdministrativeApprovalService bloqueia post, arquivos, soundtrack e configuração aplicável. Revalida fingerprint e idempotência; certifica r+1, arquivos e trilha na mesma transação, inserindo admin_approved com referência à rejeição r. Falha intermediária reverte todos os efeitos.
- Arquivos passam a approved preservando evidências de rejeição; soundtrack aplicável cria decisão com ator admin real e selo r+1. none/embedded/uploaded/external_reference foram exercitados. Não se insere approved fictício em decisões do cliente.
- GET /api/v1/posts/:id/review-history fornece auditoria interna com ator, data, revisão, justificativa e referência à rejeição. O portal recebe somente origem mínima, sem justificativa interna.
- Fluxo compartilhado em Gerenciar postagens e Aprovações; chave UUID por intenção, bloqueio de clique duplo e reutilização do mesmo payload após timeout.
- approvalSource derivado client/admin é compartilhado entre projeções e gate. Execução exige certificação oficial da revisão corrente, selo coerente, arquivos aprovados, soundtrack aplicável certificada e cliente/tenant válido. Status approved isolado ou certificação de revisão anterior não basta.

## G. Fingerprint

SHA-256 do JSON canônico em `MaterialFingerprint.ts`, envelope version=1. Chaves de objetos ordenadas recursivamente; undefined/null→null; datas ISO UTC; texto visível exato; arrays de domínio preservados. Anexos são ordenados por sort_order (NULL=999999), created_at e id. Política de campos obrigatórios é ordenada antes do hash.

- Post: id, client_id, company_id, content_revision, title, description, channels, formats, email_link, scheduled_date e funnel_tag quando a política da nova revisão o torna visível.
- Arquivo: id, url, bucket, storage_path, mime_type, size_bytes, original_name, file_type, sort_order, storage_deleted_at. created_at determina desempate da ordem, sem integrar cada objeto material.
- Soundtrack habilitada/aplicável: id, mode, revision_number, source_media_id, track_name, artist, external_url, platform, start_time_seconds, usage_source, usage_notes, rights_notes, audio_url, bucket, storage_path, mime_type, size_bytes, original_name, storage_deleted_at.
- Política: soundtrackEnabled, funnelVisible, requiredFields. Soundtrack ausente/none/desabilitada e funil não visível não entram como material. Status derivado, timestamp de leitura/atualização e valores da interface ficam fora.

request_fingerprint é um hash distinto da intenção normalizada: postId, ator autenticado (id, role, companyId), justification, expectedRevision, expectedFingerprint e idempotencyKey. A mesma chave com alteração de intenção gera conflito. Campos derivados do resultado não substituem a identidade material preparada.

## H. Testes da implementação principal (antes da correção focal)

| Suíte/verificação | Resultado | Quantidade |
| --- | --- | ---: |
| Backend npm test | passou | 240 |
| Frontend unitário | passou | 83 |
| Frontend React | passou | 53 |
| PostgreSQL revisão e guard de ambiente | passou | 27 |
| PostgreSQL portal | passou | 14 |
| PostgreSQL pacote novo/API/concorrência | passou | 40 |
| Autenticação test:auth | passou; também incluída no agregado backend | 33 |
| Autorização test:h03 | passou; também incluída no agregado backend | 48 |
| Migration: cadeia nova / repetição oficial | passou | 24 aplicadas / 24 skips estruturais |
| Migration: integridade/append-only/cascatas | passou; incluída no pacote PostgreSQL | 2 testes compostos |
| Soundtrack, duplicação e retenção local | passou | 1 script integrado |
| Backend build/typecheck | passou | 1 build |
| Frontend build/typecheck | passou com aviso de chunk | 1 build |
| Frontend lint | indisponível: ESLint ausente | não aprovado |
| git diff --check | passou | 1 gate final |

São 457 testes nos agregados distintos (240 + 83 + 53 + 27 + 14 + 40), sem somar novamente as suítes de autorização ou probes já incluídos. O script de soundtrack removeu dois objetos locais, marcou três referências e registrou zero falhas. Não foram criados testes que dependem de produção.

Logs de execução permanecem fora de tmp/ do repositório, em `C:\Users\Murilo\AppData\Local\Temp\postinder-approval-package-20261004`: backend-final.log, auth-final.log, authorization-final.log, frontend-unit-final.log, react-final.log, revision-final.log, portal-final.log, package-final.log, soundtrack-final.log, migration-fresh-final.log, migration-repeat-final.log e frontend-build-final.log.

## I. Cenários críticos

1. **A+B concluídas → rewind B → tentativa de A: recusada.** Verificado por repository e HTTP; refresh continua sem fallback. Retry concorrente de B cria apenas uma ação. Nova conclusão de C pode tornar-se candidata.
2. **Rejeição r → edição → modal admin → nova edição → confirmação antiga: recusada sem efeito parcial.** Verificado para texto, arquivo, ordem, soundtrack e política, incluindo corrida controlada com transação aguardando lock.
3. **Rejeição r → correção → admin aprova → r+1 → execução: aceita.** approved_revision e executed_revision ficam em r+1; rejeição r permanece byte a byte no fato original. Exercitado nos quatro modos de soundtrack e e-mail sem arquivo.
4. **Adorei com comentário: approved+loved e texto na decisão correta.** Conteúdo e item foram verificados via API real e PostgreSQL. Frontend confirmou campo opcional, cancelamento, foco, busy, stale e métrica de um Adorei por postagem.

Também passaram: role/tenant/body spoofing, duas chaves administrativas concorrentes, retry após timeout, alteração de justificativa/fingerprint, failure injection após atualizar filhos, gate sem fato oficial, certificado antigo, arquivos/trilha incoerentes, append-only e compatibilidade legada.

## J. Documentação atualizada

PROJECT_STATE.md (estado/gate), README.md (produto/compatibilidade), PRODUCT_DECISIONS.md (contratos aprovados), ROADMAP.md (entrega local e revisão pendente), CHANGELOG.md (pacote 025), backend/README.md (endpoints/fingerprint/testes), database/README.md (schema/migração), docs/DEPLOYMENT.md (ordem/compatibilidade futura) e docs/deploy/CHECKLIST_DEPLOY_TESTE.md (gate local e smoke futuro). Este relatório registra inventário e evidências adicionais. Referências históricas de ambientes publicados não foram revalidadas remotamente.

## K. Pendências e riscos residuais

- ESLint e configuração não estão instalados no projeto. npm run lint foi tentado e falhou por ferramenta ausente; não foi declarado aprovado nem houve instalação de dependências fora do escopo.
- Build frontend avisa sobre chunk principal de aproximadamente 653,69 kB minificado (183,67 kB gzip). Build concluiu normalmente.
- Um teste antigo de fallback do logo falhou de modo intermitente durante a execução ampla; passou nas repetições integrais, inclusive a final de 53 testes. Teste/componente de branding não foram alterados para ocultar a ocorrência. React Router também emite avisos de futuras flags.
- API nova exige rodada; uma aba com frontend antigo precisa recarregar quando houver publicação futura. Essa publicação não foi realizada.
- Eventos secundários de atividade de decisões do cliente continuam best-effort após commit, conforme arquitetura anterior; fatos oficiais e ação administrativa são transacionais. Nenhuma aprovação depende desses eventos secundários.
- Revisão humana, commit e deploy permanecem pendentes por instrução expressa, sem bloqueio à revisão local.

## L. Veredito da correção focal

**READY FOR FOCAL REAUDIT.** AUD-025-01 e AUD-025-02 corrigidos e validados, sem remodelar os contratos críticos já auditados. Este resultado não declara CLEAN: a reauditoria focal e a decisão de consolidação permanecem pendentes. Nenhum commit, push ou deploy.
