# Changelog Temporario Consolidado do Postinder

> Cronologia reconstruida das tres conversas, auditorias posteriores e sprints de consolidacao. Este e o unico documento temporario que preserva decisoes substituidas, tentativas intermediarias, correcoes e evolucao historica. Nao representa releases oficiais nem garante que cada alteracao tenha sido commitada ou publicada.

## Revisao final da documentacao temporaria

- Os quatro documentos temporarios foram confrontados com o codigo, migrations e scripts locais apos as Sprints Storage A, B e C e a limpeza de legados.
- O estado vigente passou a usar a terminologia `Em andamento`, `Concluida` (`approved`), `Executada` (`executed`), exclusao por `deleted_at` e Retencao.
- Regras ja implementadas deixaram de aparecer como backlog funcional; ficaram pendentes apenas validacoes de publicacao, testes ponta a ponta e evolucoes aprovadas para fases futuras.
- A confirmacao do banco publicado, Render, Vercel e Supabase continua externa ao repositorio e deve acompanhar a futura promocao da documentacao oficial.

## Consolidacao tecnica posterior - Arquitetura de banco

- A cadeia estrutural foi consolidada em `database/migrations`; `001_initial_schema.sql` passou a ser legado/depreciado e deixou de ser usado por setup ou deploy.
- O DDL silencioso de `backend/src/app.ts` foi removido depois de validar banco PostgreSQL vazio criado somente por migrations.
- A migration historica `002_development_seed.sql` foi preservada sem reescrita, mas excluida do migrador estrutural. A seed demo passou para `db:seed-demo`, idempotente e condicionada a `APP_MODE=demo`.
- Foi criado `db:bootstrap-admin` para o primeiro administrador por variaveis de ambiente, separado das credenciais demo.
- O migrador passou a usar lock advisory e o startup passou a conferir `schema_migrations`; producao falha com migrations pendentes, enquanto desenvolvimento as informa claramente.
- O uso ativo de `post_notes` foi removido por ser codigo morto; nao foi criada tabela nova. Referencias condicionais de limpeza de legado foram preservadas.
- Validacao em bancos temporarios confirmou duas execucoes idempotentes do migrador, duas execucoes idempotentes da seed, schema completo, build do backend e healthcheck de banco.

## Consolidacao tecnica posterior - Limpeza segura de legados

- Componentes sem rota do swipe antigo, seu servico exclusivo e o layout de cliente nao utilizado foram removidos sem alterar o portal atual.
- `PostResponseDTO`, exports sem consumidores e 29 barrels/placeholders sem imports foram removidos do codigo-fonte.
- O schema inicial depreciado, a configuracao nao utilizada do Nodemon e o log local de desenvolvimento foram removidos.
- Migrations historicas, o cleanup de `archived`, o marcador de compatibilidade de desativacao, rotas ainda expostas e funcoes de IA previstas foram preservados conscientemente.

## Consolidacao tecnica posterior - Sprint Storage A

- Migration `013_file_storage_identity.sql` adicionou `bucket`, `storage_path`, `mime_type` e `size_bytes` sem remover URLs ou dados historicos.
- O helper de Storage passou a devolver e remover por identidade persistida, sem interpretar URL publica para reconstruir path.
- Upload simples e multiplo agora persistem os metadados do objeto e compensam objetos ja enviados quando a gravacao no banco falha.
- Substituicao e remocao verificam outras referencias registradas antes de remover um objeto fisico; duplicacao permanece com compartilhamento explicito por mesmos bucket/path nesta fase.
- Retencao automatica, copia fisica, assets, bucket privado, signed URLs e multiempresa foram mantidos fora do escopo.
- Validacao em banco temporario confirmou migration, upload simples, upload multiplo, substituicao, remocao e compensacao de falha apos upload.

## Consolidacao tecnica posterior - Sprint Storage B

- Nenhuma migration foi necessaria: os campos de identidade adicionados pela Sprint A ja suportavam a independencia fisica dos novos objetos.
- Duplicar postagem passou a criar objetos em paths unicos no formato `posts/<novo-post-id>/<uuid>.<extensao>` para Storage local e Supabase, sem reutilizar URL ou `bucket + storage_path` da origem.
- A operacao passou a usar transacao para novo post e novos registros de `files`; se uma copia ou gravacao falha, o banco e revertido e os objetos copiados sao compensados.
- Arquivos da copia preservam ordem, metadados e nome, mas iniciam `pending` sem motivo/tags de rejeicao; o evento de duplicacao registra origem, destino e quantidade copiada somente apos commit.
- Arquivo legado sem identidade persistida bloqueia a duplicacao inteira, evitando uma copia parcial silenciosa.
- Foi adicionado diagnostico somente leitura para URL/path compartilhados e arquivos sem identidade; compartilhamentos historicos nao foram migrados automaticamente.
- Validacao em banco PostgreSQL temporario confirmou copia simples e multipla, independencia em remocao/substituicao, rollback por falha na copia, rollback por falha de banco e bloqueio de arquivo legado.

## Consolidacao tecnica posterior - Sprint Storage C

- Migration `014_storage_retention_audit.sql` adicionou politica de retencao por post e os campos auditaveis `storage_deleted_at` e `storage_delete_error` sem remover registros de `files`.
- A politica passou a aceitar `immediate`, `1d`, `7d`, `30d` e `never`; a execucao apenas agenda a data, sem apagar arquivo dentro da requisicao administrativa.
- A limpeza oportunista durante listagem de posts foi removida e substituida pelo comando manual `storage:cleanup-retention`.
- O job remove o objeto por `bucket + storage_path`, preserva metadados, nao repete arquivo ja marcado, grava falhas e protege referencias compartilhadas ainda dentro da janela de retencao.
- A Previa do Feed mostra nome, ordem, data de remocao e politica aplicada no lugar de midia expirada.
- Scheduler, retry automatico, filas, bucket privado, signed URLs, versionamento e multiempresa permaneceram fora do escopo.
- Validacao em banco PostgreSQL temporario confirmou as cinco politicas, falha simulada de Storage, nova execucao manual e preservacao dos metadados.

## Consolidacao tecnica posterior - Unicidade concorrente de e-mail

- A validacao cruzada de e-mail entre `users` e `clients` deixou de usar consultas independentes e passou a usar um helper compartilhado na mesma transacao.
- A chave global `email:<normalizado>` e protegida por `pg_advisory_xact_lock(hashtextextended(...))`; a normalizacao aplica apenas `trim` e minusculas.
- Criacao de usuario, criacao de cliente e reativacao de cliente foram cobertas. Nao existe reativacao de usuario nem edicao de e-mail no fluxo atual.
- Seed demo, bootstrap do primeiro admin e reset demo passaram a usar locks compativeis e permaneceram idempotentes.
- Nenhuma migration ou indice foi alterado: os indices globais parciais de `011_reusable_deleted_emails.sql` permanecem a defesa final dentro de cada tabela.
- Os cinco cenarios concorrentes, a normalizacao, seed, bootstrap e reset foram validados em bancos PostgreSQL temporarios removidos ao final.

## Consolidacao final - Correcao do contrato de status e autenticacao

- A interface ja usava o endpoint generico apenas para alternar `draft` e `ready`, mas o contrato da API permitia estados indevidos.
- O backend passou a aceitar somente `draft -> ready` e `ready -> draft`, rejeitando estados e transicoes redundantes ou pertencentes a endpoints especificos.
- As rotas administrativas de postagens passaram a rejeitar JWTs de cliente; a politica de somente leitura do `viewer` foi preservada.
- Os endpoints especificos de envio, reenvio, aprovacao/rejeicao do portal e execucao foram mantidos sem mudanca de fluxo.
- A aprovacao e a rejeicao continuam sendo operacoes exclusivas do cliente no backend.
- O componente legado `ClientSwipePage` permaneceu sem referencias ate sua remocao segura na limpeza posterior de legados.

## Consolidacao final - Exclusao logica e imutabilidade de executados

- O uso operacional de `archived` por `DELETE /posts/:id` foi substituido por exclusao logica com `deleted_at`; nenhuma exclusao fisica de post, anexos, feedbacks ou eventos foi introduzida.
- Postagens em andamento podem ser excluidas por usuarios administrativos com permissao de edicao; `approved` exige papel `admin` e confirmacao reforcada com `EXCLUIR`.
- Postagens `executed` passaram a ser imutaveis no backend e na interface: edicao, alteracoes de anexos, envio, reenvio, status e exclusao sao bloqueados; duplicacao do original continua permitida.
- A exclusao cria evento `post_deleted` com ator, papel, status anterior e indicacao de aprovacao.
- Dashboard e central de postagens passaram a usar o mesmo modal e a mesma regra de permissao para exclusao.
- Seis registros legados `archived` foram identificados no banco conectado durante a verificacao inicial; por serem apenas dados de validacao, foram removidos com anexos nao compartilhados e a migration `012_remove_legacy_archived_posts.sql`.

## Conversa 1 - Linha de base preservada

### Fase 1 - Analise e primeira evolucao do frontend

- Estrutura inicial do frontend foi analisada e considerada adequada para evolucao incremental.
- Sino de notificacoes passou a listar posts pendentes/recusados.
- Notificacoes eram calculadas a partir dos posts existentes.

### Fase 2 - Insights, filtros e paginacao

- Metricas passaram a aceitar visao geral e por cliente.
- Feedbacks/listas receberam paginacao.
- Periodos semanal/mensal/anual ganharam subfiltro de periodo exato.
- Filtros foram preservados em `localStorage`.
- Exportacao CSV foi implementada.

### Fase 3 - Busca e consistencia visual

- Busca global foi adicionada a topbar.
- Estados vazios, confirmacoes, toasts, badges, skeletons e hovers foram padronizados.
- Icones e cores de status foram organizados.

### Fase 4 - Detalhes e historicos

- Modal de post ganhou dados, arquivos, feedbacks e timeline derivada.
- Pagina de detalhes do cliente foi criada.
- Dashboard recebeu tendencias semanais e atividade recente.

### Fase 5 - Dados reais no backend

- Modulo/tabela `activity_events` foram criados.
- Acoes principais passaram a gerar eventos.
- Dashboard passou a consultar atividades do backend.

### Fase 6 - Merge com estrutura do colega

- Branch `newStructure` foi mesclada em `Murilo-mod2`.
- `PageHeader`, layout, utilitario de midia, Supabase Storage e arquivos de deploy foram incorporados.
- Funcionalidades sobrescritas foram reaplicadas.

### Fase 7 - Viewer somente leitura

- Login passou a carregar permissoes.
- Menu/rotas respeitaram permissoes.
- Viewer foi bloqueado para escrita no frontend e backend.

### Fase 8 - Notificacoes lidas e nao lidas

- Sino ganhou filtros, contador de nao lidas e `Marcar todas`.
- Leitura saiu de `localStorage` e foi persistida em `notification_reads`.
- Modulo `/api/v1/notifications` foi criado.

### Fase 9 - Banco e deploy

- Runner e migrations `001_core_schema.sql` e `002_development_seed.sql` foram criados.
- CORS, healthchecks e checklist de deploy foram adicionados.
- Arquitetura Vercel + Render + Supabase foi consolidada.

### Fase 10 - Storage online

- Bucket Supabase tornou-se configuravel.
- Upload online foi corrigido pela troca da service role key no Render.
- Frontend passou a exibir a mensagem real de erro do backend.

### Fase 11 - Acesso aos detalhes do cliente

- Rota/pagina existente foi confirmada.
- Botao `Detalhes` foi restaurado nos cards de clientes.

## Conversa 2 - Evolucao posterior

### Fase 12 - Portal de Revisao por token

- Migration `003_client_portal_tokens.sql` criou tokens privados com hash, validade, revogacao e ultimo uso.
- Backend ganhou modulo de portal e rotas publicas limitadas ao cliente do token.
- Admin ganhou `Gerar link`, `Copiar link` e `Regerar link` no detalhe do cliente.
- Rota `/portal/:token` foi adicionada.
- `/aprovar` passou a reutilizar o novo portal para cliente autenticado.
- Portal recebeu resumo, calendario, historico, arquivos e feedbacks.
- Builds local de frontend/backend foram validados.

### Fase 13 - Gestao interna antes da aprovacao

- Criacao automatica com envio imediato foi removida.
- `Nova Postagem` passou a salvar `draft` ou `ready` e permitir continuar criando.
- Nova central `/admin/posts` foi adicionada ao menu.
- Foram implementados filtros, busca, ordenacao, edicao, duplicacao, arquivamento e envio individual/em lote.
- Backend ganhou rotas de listagem, edicao, duplicacao, status, exclusao e envio em lote.
- Rascunhos/prontos passaram a ser preparados internamente antes de chegar ao cliente.

### Fase 14 - Ordem persistida dos anexos

- Migration `004_file_sort_order.sql` adicionou `sort_order` e preencheu arquivos antigos.
- Criacao/edicao passaram a exibir lista ordenavel com preview, posicao, nome e remocao.
- Endpoint de reordenacao validou propriedade dos arquivos.
- Portal, aprovacoes e previews passaram a respeitar a ordem.
- Indicadores `1/N` foram adicionados.

### Fase 15 - Propriedade da decisao e status de recusa

- Agencia foi impedida de aprovar/reprovar; somente cliente pode decidir.
- A pagina administrativa de aprovacoes virou acompanhamento.
- Projeto com qualquer arquivo recusado deixou de aparecer como aprovado.
- Migration `005_fix_rejected_post_status.sql` corrigiu dados inconsistentes existentes.
- Dashboard teve atividade recente limitada inicialmente a cinco itens.

### Fase 16 - Portal Tinder e revisao por projeto

- Revisao passou a ser a area central e primeira informacao do portal.
- Cliente escolhe projeto e analisa arquivos individualmente.
- Swipe e botoes de aprovar/reprovar foram implementados.
- Foi criada regra de retorno somente sobre a ultima decisao.
- Persistencia da ultima acao em `localStorage` corrigiu perda do retorno apos refresh.
- Retorno passou a ser bloqueado quando o projeto inteiro e aprovado.
- Textos e tags de feedback foram corrigidos/restaurados.

### Fase 17 - Recusados, edicao de feedback e correcao

- Aba `Recusados` foi adicionada ao portal.
- Cliente passou a poder mudar recusado para aprovado.
- Feedback e tags de recusados passaram a ser editaveis.
- Reenvio de nova versao remove o item da lista de recusados e o devolve a analise.
- Portal passou a identificar explicitamente `Correcao enviada pela 20Cinco`.
- Diferenca entre primeira versao e rodada de correcao ficou visivel.

### Fase 18 - Insights historicos

- `Feedbacks de reprovacao` voltou a trazer dados dos clientes.
- Tempo medio de aprovacao/reprovacao foi adicionado.
- Analise percentual de tags foi adicionada com filtros por empresa/cliente/periodo.
- Metricas deixaram de apagar recusas depois da aprovacao de uma correcao.
- Foram adicionados aprovados/recusados iniciais e concluidos com/sem revisao.
- Visao por item/arquivo foi adicionada para comparar proporcao de arquivos aprovados e recusados.
- Calculo por item tambem passou a usar a condicao inicial, nao o estado final.

### Fase 19 - Notificacoes e manutencao de arquivos

- Sino de notificacoes foi revisado e voltou a carregar eventos derivados dos posts.
- Edicao administrativa passou a permitir apagar anexos existentes e adicionar novos.
- Recusados passaram a ser selecionaveis para reenvio na central de postagens.
- Filtro `Recusado` foi adicionado.

### Fase 20 - Aprovacoes e previews com carrossel

- Consulta/status da aba `Aprovacoes` foi corrigida para incluir novas postagens enviadas.
- Modal de arquivo nas aprovacoes ganhou navegacao anterior/proximo.
- Modal de detalhes da Previa do Feed ganhou carrossel acima da lista de anexos.
- Lista inferior de arquivos foi preservada para abertura em nova aba.
- Nomes dos projetos ficaram permanentemente visiveis na grade.
- Indicadores de status e legenda foram aumentados.
- Feed ganhou filtros combinados por cliente e estado.

### Fase 21 - Ajustes de status e organizacao de postagens

- Postagens `ready` e `draft` passaram a alternar de status.
- Erro PostgreSQL `inconsistent types deduced for parameter $2` foi corrigido.
- Central foi dividida em `Em andamento` e `Concluidos`.
- Aprovados saem da lista principal.
- Filtro de aprovado foi removido da visao em andamento.
- Dashboard passou a direcionar cards para a central com filtros correspondentes.
- Atalho redundante `Ver pendentes de envio` foi removido.

### Fase 22 - Dashboard e atividades

- `Empresa em foco` foi movida para antes dos dados que ela filtra.
- Atividade recente foi mantida por sua utilidade para administradores.
- Limite passou a 50 eventos, paginados em 5 ou 10 itens.
- Cards, tendencias e lista continuaram integrados aos filtros.

### Fase 23 - Detalhes do cliente e ultimo acesso

- Detalhe do cliente foi atualizado com aprovacao/recusa inicial e concluidos com/sem revisao.
- Migration `006_client_last_access.sql` adicionou `last_access_at`.
- Login e uso do portal passaram a atualizar o ultimo acesso.
- Ausencia recorrente de dado foi corrigida no backend/repository.

### Fase 24 - Encerramento por execucao e retencao

- Nova aba/status `Executados` foi adicionada.
- A agencia pode marcar post aprovado como executado.
- Migration `008_executed_posts_retention.sql` adicionou `executed_at` e `files_delete_after`.
- Retencao por execucao passou a aceitar manter, imediato, 1 dia ou 7 dias.
- Arquivos podem ser removidos sem apagar metricas e metadados do projeto.

### Fase 25 - Revisao para testes e reset

- Foi realizada revisao geral visando nova publicacao de testes pessoais/equipe/amigos.
- Credenciais padrao foram confirmadas.
- Pagina `Reset de testes` foi adicionada na secao Conta.
- Reset exige digitar `RESETAR`, remove arquivos e trunca dados operacionais.
- Admin e cliente padrao sao recriados.
- Foi esclarecido que metricas e arquivos da plataforma sao zerados, mas schema/migrations e dados externos permanecem.

### Fase 26 - Ciclo de vida dos clientes

- Problema de exclusao parcial foi analisado: posts ainda apareciam em feed/aprovacoes e metricas tinham comportamento diferente.
- Conceito de arquivar cliente evoluiu para desativar/reativar.
- Cliente desativado passou a manter metricas e desaparecer das listas operacionais.
- Tokens sao revogados e anexos recebem prazo de exclusao de 1 dia.
- Migration `007_archive_inactive_client_posts.sql` registrou a primeira implementacao, que arquivava posts inativos.
- Migration `009_inactive_clients_file_cleanup.sql` adicionou limpeza e marcador de desativacao.
- Exclusao definitiva foi separada, removendo arquivos e dados relacionados.

### Fase 27 - Escopo ativos versus geral

- Insights ganhou seletor `Geral`/`Somente clientes ativos`, aplicado tambem ao CSV e IA.
- Falta de import de `useMemo` causou tela preta em Insights e foi corrigida.
- Dashboard passou a iniciar com clientes ativos e ganhou opcao `Geral`.
- Cards, lista, tendencias e atividades do Dashboard passaram a respeitar o escopo.
- Previa do Feed passou a iniciar com clientes ativos e ganhou opcao `Geral`.
- Clientes desativados ficaram sinalizados nos filtros historicos.

### Fase 28 - Correcao final da reativacao

- Teste revelou que desativar alterava posts para `archived` e reativar deixava o cliente vazio.
- Decisao tecnica foi revista: desativacao nao deve substituir o status do post.
- `archived_by_client_deactivation` passou a marcar registros afetados pelo comportamento anterior.
- Migration `010_client_deactivation_restore_marker.sql` foi criada para compatibilidade.
- Reativacao passou a cancelar limpeza pendente e restaurar posts marcados pela desativacao antiga.
- Arquivamento manual passou a limpar o marcador para nao ser restaurado no futuro.
- Foi registrado risco residual para registros legados, pois antes do marcador nao havia distincao perfeita entre post apagado manualmente e post arquivado pela desativacao.

## Conversa 3 - Consolidacao administrativa e refinamentos de experiencia

### Fase 29 - Unicidade de e-mail, credenciais e tema do login

- Criacao e edicao de usuarios/clientes passaram a normalizar e-mails e impedir duplicidade entre registros ativos das duas categorias.
- O tratamento deixou de aceitar que um usuario e um cliente compartilhassem o mesmo login, ainda que estivessem em tabelas diferentes.
- Atributos de autocomplete dos formularios foram ajustados para reduzir a interferencia do gerenciador de senhas entre os campos de usuario e senha durante o cadastro.
- A alternancia entre tema claro e escuro foi corrigida na tela de login, alinhando-a ao comportamento ja existente dentro da plataforma.

### Fase 30 - Exclusao e administracao de usuarios e clientes

- Usuarios passaram a poder ser excluidos pela interface administrativa.
- O usuario principal `admin@postinder.local` recebeu protecao contra exclusao.
- O papel do usuario passou a poder ser alterado depois da criacao entre `admin`, `manager`, `editor` e `viewer`.
- O arquivamento/desativacao do cliente foi preservado como opcao reversivel que mantem metricas e historico.
- A exclusao definitiva do cliente foi mantida como opcao separada e passou a avisar explicitamente que postagens, arquivos, feedbacks e metricas vinculados tambem serao apagados.
- Foi confirmado no fluxo funcional que posts do cliente excluido deixam a central de postagens e a Previa do Feed.
- Migration `011_reusable_deleted_emails.sql` substituiu unicidade global por indices unicos parciais para registros ativos, liberando e-mails depois de exclusao/desativacao.
- O relato de um e-mail ainda bloqueado na versao online indicou que dados antigos e/ou a aplicacao da migration no Supabase precisam ser confirmados antes da consolidacao oficial.

### Fase 31 - Ajustes responsivos

- Foi realizada uma analise da experiencia mobile.
- Telas de usuarios, clientes, dashboard e portal receberam ajustes responsivos em controles, listas, acoes e distribuicao de conteudo.
- O trabalho foi retomado apos o aplicativo de desenvolvimento fechar durante a execucao, sem mudanca de escopo.

### Fase 32 - Previa compacta na edicao de postagens

- O modal de edicao passou a exibir uma previa compacta do feed.
- Um erro de importacao de `resolveMediaUrl`, que causava tela branca/preta ao abrir a edicao, foi corrigido.
- O layout foi reorganizado para mostrar cliente e data, titulo, previa e legenda em sequencia vertical mais legivel.
- A imagem e os textos deixaram de ficar comprimidos na lateral.
- A previa ganhou navegacao anterior/proximo e contador para percorrer todos os anexos, em vez de mostrar apenas a primeira imagem.
- Builds do frontend passaram depois das correcoes do modal e do carrossel.

### Fase 33 - Notificacoes e visibilidade de rascunhos

- Foi corrigida a notificacao incorreta que tratava um rascunho salvo como conteudo aguardando aprovacao do cliente.
- Notificacoes passaram a considerar apenas posts enviados, correcoes em aprovacao e recusas relevantes.
- O texto vazio do sino foi atualizado para refletir esse recorte.
- Consultas do portal autenticado e por token passaram a ocultar `draft`, `ready` e `archived`.
- Somente `sent`, `pending_approval`, `rejected`, `approved` e `executed` permanecem visiveis ao cliente.
- Acoes de aprovacao, recusa, reset e feedback foram restringidas aos estados permitidos pelo fluxo.
- Builds de backend e frontend passaram depois dos ajustes.

### Fase 34 - Correcao do swipe no portal do cliente

- O swipe mobile foi refeito usando captura de ponteiro e referencias estaveis para a posicao do gesto.
- A imagem deixou de iniciar o arraste/copia nativo do navegador.
- O card passou a distinguir melhor gesto horizontal de aprovacao/recusa e rolagem vertical da pagina.
- Botoes de aprovar e recusar foram preservados como alternativa ao gesto.
- Build do frontend passou depois da correcao.

## Migrations adicionadas na segunda conversa

- `003_client_portal_tokens.sql`;
- `004_file_sort_order.sql`;
- `005_fix_rejected_post_status.sql`;
- `006_client_last_access.sql`;
- `007_archive_inactive_client_posts.sql`;
- `008_executed_posts_retention.sql`;
- `009_inactive_clients_file_cleanup.sql`;
- `010_client_deactivation_restore_marker.sql`.

## Migration adicionada na terceira conversa

- `011_reusable_deleted_emails.sql`.

## Validacoes registradas

- Builds de frontend e backend foram executados repetidamente nas tres conversas e passaram ao final dos ajustes registrados.
- Aviso de bundle Vite acima de 500 kB permaneceu nao bloqueante.
- Fluxos foram testados manualmente pelo usuario, revelando e corrigindo 404 do portal, status incorreto, perda de undo, feedbacks ausentes, notificacoes, alternancia de status, ultimo acesso, reativacao, tela vazia na edicao, rascunho visivel ao cliente e falha do swipe mobile.
- Nao houve confirmacao de suite automatizada completa.
- Nao houve confirmacao de deploy final contendo integralmente o estado das conversas, consolidacoes tecnicas e Sprints Storage A, B e C.

## Observacoes de release

- Nao foi criado release oficial nem versionamento semantico.
- Alteracoes foram tratadas principalmente como versao local de testes.
- A proxima publicacao planejada continuava restrita a equipe/amigos.
- Aplicacao das migrations estruturais `001` e `003` a `014`, estado final de commits/branch e configuracao publicada em Render, Vercel e Supabase permanecem por verificar antes da documentacao oficial.
