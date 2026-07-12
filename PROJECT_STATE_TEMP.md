# Estado Temporario Consolidado do Postinder

> Retrato temporario do estado funcional consolidado apos as tres conversas historicas, auditorias tecnicas, Sprints Storage A, B e C e limpeza de legados. Nao substitui a documentacao oficial.

**Terminologia vigente:** `Em andamento` abrange os estados operacionais anteriores a `approved`; `Concluida` corresponde a `approved`; `Executada` corresponde a `executed`; excluir uma postagem significa exclusao logica por `deleted_at`. `archived` nao faz parte do dominio atual de postagens e aparece apenas em referencias historicas ou de compatibilidade.

## 1. Visao geral consolidada

O Postinder e uma plataforma de gestao, revisao e aprovacao de conteudos para agencias de marketing, desenvolvida no programa de residencia em TIC 55 em parceria com a 20Cinco Comunicacoes.

O produto cobre um ciclo operacional completo de preparacao, revisao, aprovacao e encerramento:

- a agencia cria postagens sem envia-las automaticamente;
- revisa, edita, duplica, ordena anexos e organiza lotes internamente;
- envia uma ou varias postagens ao cliente;
- o cliente revisa arquivos individualmente em um portal privado com interacao por swipe ou botoes;
- recusas geram feedbacks e uma nova rodada identificada como correcao;
- aprovacoes encerram a revisao do cliente;
- a agencia marca a postagem como Executada quando o conteudo foi efetivamente encaminhado para publicacao/execucao;
- metricas preservam a primeira decisao e distinguem postagens Concluidas com ou sem revisao.
- usuarios e clientes ativos compartilham a mesma regra de unicidade de e-mail;
- clientes podem ser desativados para preservar historico ou excluidos definitivamente com seus posts, arquivos e metricas;
- `draft` e `ready` permanecem internos; o cliente e as notificacoes relevantes so recebem itens depois do envio ou de um evento posterior do fluxo.
- o endpoint generico `PATCH /posts/:id/status` aceita somente `draft <-> ready`; envio, aprovacao, rejeicao, reenvio e execucao usam endpoints especificos.
- exclusoes de postagens usam `deleted_at`, removendo itens nao executados do fluxo e das metricas operacionais sem apagar fisicamente seus relacionamentos.

A infraestrutura de referencia continua sendo frontend React/Vite, backend Express/TypeScript, PostgreSQL e storage local/Supabase. As alteracoes reconstruidas nas tres conversas foram validadas principalmente no ambiente local. Nao ha confirmacao documental de que o estado final tenha sido publicado integralmente na Vercel/Render/Supabase. O uso online planejado permanece restrito a testes pessoais, equipe e amigos, sem liberacao para clientes reais.

## 2. Arquitetura atual

### Frontend

- React + Vite em `apps/admin`.
- React Router com areas administrativas, login tradicional do cliente e portal publico por token.
- Tailwind CSS e componentes locais de UI.
- Zustand para autenticacao e tema.
- Axios para API `/api/v1`.
- Layout administrativo preservado, com sidebar, topbar, busca, tema e notificacoes.
- Alternancia claro/escuro funciona tambem na tela de login.
- As rotas administrativas de postagens exigem JWT de usuario administrativo; JWT de cliente e rejeitado, enquanto a regra de somente leitura do `viewer` permanece vigente.
- Telas de usuarios, clientes, dashboard e portal receberam ajustes responsivos para uso mobile.
- Novas paginas/fluxos relevantes:
  - `/admin/posts`: central de gerenciamento de postagens;
  - `/admin/posts/new`: criacao sem envio automatico;
  - `/admin/reset`: reset de dados de teste, restrito a admin;
  - `/portal/:token`: Portal de Revisao por link privado;
  - `/aprovar`: portal equivalente para cliente autenticado;
  - `/aprovar/resumo`: redireciona para `/aprovar`.

### Backend

- Express + TypeScript em `backend`.
- PostgreSQL via `pg`.
- JWT para administradores e clientes autenticados.
- Modulos de autenticacao, usuarios, clientes, posts, aprovacoes, portal, atividades, notificacoes e manutencao.
- Upload local em desenvolvimento e Supabase Storage em producao.
- `files` identifica objetos novos por `bucket` e `storage_path`; `url` publica permanece por compatibilidade e exibicao.
- Uploads persistem MIME e tamanho, usam compensacao para objetos enviados que nao puderem ser gravados no banco e removem objetos apenas pela identidade persistida.
- Duplicacoes novas copiam cada objeto fisico para `posts/<novo-post-id>/<uuid>.<extensao>` e criam registros `files` independentes; falha de copia ou banco reverte a nova postagem e compensa os objetos novos.
- A retencao preserva os registros de `files`: o objeto removido recebe `storage_deleted_at`, e falhas ficam em `storage_delete_error` para auditoria manual.
- Escopo por `company_id` aplicado nas consultas principais descritas nas conversas.
- `database/migrations` e a fonte unica da verdade para o schema; o startup nao executa DDL nem tenta corrigir estruturas.
- Antes de abrir a porta HTTP, o backend consulta `schema_migrations`: em desenvolvimento lista migrations pendentes; em producao interrompe o startup quando o schema esta atrasado.
- Regras de e-mail normalizam o valor e impedem duplicidade global entre usuarios e clientes ativos.
- Criacao e reativacao de identidades usam transacao, `pg_advisory_xact_lock` por `email:<normalizado>` e consulta cruzada na mesma conexao; os indices parciais globais de `011_reusable_deleted_emails.sql` permanecem como defesa por tabela.

### Infraestrutura de referencia

- Vercel para frontend.
- Render para backend.
- Supabase para PostgreSQL e Storage.
- O link do portal usa `APP_PUBLIC_URL` ou a URL local do frontend.

### Confirmacoes externas pendentes

- O comportamento acima foi confrontado com o codigo e as migrations locais; a aplicacao integral no banco publicado, no Render, na Vercel e no Supabase ainda precisa ser confirmada.
- A etapa de release do Render para executar `db:migrate`, as variaveis publicadas e as politicas/configuracoes reais do bucket ainda nao foram verificadas neste retrato.
- `seedDemo` exige explicitamente `APP_MODE=demo`, mas a separacao completa entre Modo demonstracao e Modo producao ainda nao esta implementada como comportamento global da aplicacao.
- Nao ha confirmacao de uma suite automatizada ponta a ponta cobrindo todos os fluxos; as validacoes registradas foram principalmente builds, verificacoes locais e testes manuais.

## 3. Portal de Revisao do Cliente

### Acesso por token

- Migration `003_client_portal_tokens.sql` criou `client_portal_tokens`.
- Token bruto e gerado com 32 bytes aleatorios e entregue somente no link.
- O banco armazena apenas SHA-256 do token em `token_hash`.
- Token fica associado a `client_id` e opcionalmente `company_id`.
- Validade configuravel na interface em 7 ou 15 dias.
- Regerar link revoga tokens ativos anteriores do cliente.
- Sao registrados `expires_at`, `revoked_at`, `last_used_at`, `created_by` e `created_at`.
- A validacao do token ocorre no backend e restringe consultas/mutacoes ao cliente vinculado.
- Cliente desativado nao consegue usar token; a desativacao revoga os links existentes.

### Rotas publicas do portal

- `GET /api/v1/portal/:token`;
- `GET /api/v1/portal/:token/posts`;
- `POST /api/v1/portal/:token/posts/:postId/approve`;
- `POST /api/v1/portal/:token/posts/:postId/reject`;
- `POST /api/v1/portal/:token/files/:fileId/approve`;
- `POST /api/v1/portal/:token/files/:fileId/reject`;
- `PATCH /api/v1/portal/:token/files/:fileId/feedback`;
- `POST /api/v1/portal/:token/files/:fileId/reset`;
- `POST /api/v1/portal/:token/feedback`.

O mesmo conjunto funcional existe em `/api/v1/client-portal` para clientes autenticados em `/aprovar`.

### UX do portal

- A revisao e o primeiro elemento da tela e ocupa a area visual principal.
- O cliente primeiro escolhe o projeto/postagem que deseja revisar.
- Cada arquivo e analisado individualmente em um card central no estilo Tinder.
- Swipe para a direita aprova; swipe para a esquerda reprova; botoes equivalentes permanecem disponiveis para desktop e mobile.
- O gesto usa captura de ponteiro, preserva a rolagem vertical e impede que a imagem seja arrastada como arquivo/copia pelo navegador.
- Titulo, legenda, data, canais, sequencia de arquivos, tags de feedback e anexos ficam visiveis.
- O portal diferencia explicitamente uma primeira versao de uma `Correcao enviada pela 20Cinco`.
- O cliente pode desfazer somente a ultima acao e apenas enquanto o projeto ainda nao estiver integralmente aprovado/concluido/executado.
- A ultima acao e persistida em `localStorage` para sobreviver a atualizacao da pagina.
- Quando o projeto inteiro e aprovado, o retorno e bloqueado para evitar alteracao depois que a agencia considera o trabalho concluido.
- O bloqueio de retorno existe no fluxo normal; na aba de recusados, o cliente pode reconsiderar uma recusa e aprovar o item.
- Feedback de item recusado pode ser editado, incluindo comentario e tags.
- Quando a agencia envia uma nova versao, o item deixa a lista de recusados e retorna ao fluxo de analise como correcao.
- O portal lista apenas conteudos efetivamente enviados ou ja processados pelo cliente: `sent`, `pending_approval`, `rejected`, `approved` e `executed`.
- `draft` e `ready` nao ficam visiveis para o cliente; acoes de revisao sao limitadas aos estados revisaveis.

### Conteudo complementar

O portal mantem resumo e abas complementares para:

- Calendario;
- Recusados;
- Historico;
- Arquivos;
- Feedbacks.

Tambem apresenta cards de conteudos aguardando aprovacao, aprovados no mes, itens com ajustes e proxima publicacao.

## 4. Gestao interna de postagens

### Novo ciclo de status

O fluxo atual possui uma etapa interna antes do envio ao cliente:

- `draft`: rascunho interno;
- `ready`: pronto para envio;
- `sent`/`pending_approval`: enviado e aguardando cliente;
- `approved`: aprovado pelo cliente;
- `rejected`: recusado ou com pelo menos um arquivo recusado;
- `executed`: aprovado e efetivamente publicado/executado pela agencia, preservado como historico imutavel.

O status calculado considera os arquivos. Um unico arquivo recusado impede o projeto de aparecer como aprovado. A migration `005_fix_rejected_post_status.sql` corrigiu posts antigos que estavam `approved` apesar de conterem arquivo `rejected`.

### Criacao

- `Nova Postagem` salva como `draft` ou `ready`.
- A criacao nao envia mais automaticamente ao cliente.
- Existe `Salvar e continuar criando`.
- O backend aceita somente `draft` ou `ready` na criacao inicial.
- Multiplos arquivos podem ser adicionados e ordenados antes de salvar.

### Central `/admin/posts`

- Pagina separada da criacao.
- Visao dividida em `Em andamento`, `Aprovado pelo cliente` (`approved`) e `Postado na rede` (`executed`).
- Postagens Concluidas deixam a lista principal e aparecem em `Aprovado pelo cliente`.
- Postagens Executadas possuem a aba `Postado na rede`.
- Filtros por cliente, status, canal, busca e ordenacao.
- O filtro `Recusado` foi adicionado.
- O filtro `Aprovado` foi retirado da visao em andamento, pois as postagens Concluidas ficam em `Aprovado pelo cliente`.
- Exibicao de cliente, titulo, data, canais, status, quantidade de arquivos e atualizacao.
- Acoes de visualizar, editar, duplicar, excluir, alterar entre rascunho/pronto, enviar e reenviar.
- Postagens `draft`, `ready` e `rejected` podem ser selecionadas para envio em lote.
- Postagens aprovadas nao podem ser selecionadas para novo envio.
- Postagens em andamento podem ser excluidas por usuarios administrativos com permissao de edicao; postagens aprovadas exigem papel `admin` e confirmacao textual `EXCLUIR`.
- Postagens executadas mantem apenas consulta e duplicacao; backend e interface bloqueiam edicao, anexos, reenvio, status e exclusao.
- O envio em lote possui confirmacao com resumo dos itens.
- O erro PostgreSQL `inconsistent types deduced for parameter $2` ao alternar status foi corrigido no backend.

### Edicao e correcao

- Rascunho e pronto podem ser editados normalmente.
- Post enviado/recusado usa fluxo de correcao e reenvio.
- O formulario permite alterar cliente, data, titulo, legenda, tag de funil, canais e anexos.
- Arquivos existentes podem ser removidos.
- Novos arquivos entram ao final e podem ser reordenados.
- Arquivos recusados podem ser substituidos por novas versoes antes do reenvio.
- O reenvio registra nova atividade e volta a expor o projeto ao cliente como correcao.
- O modal de edicao inclui uma previa compacta do feed, posicionada entre titulo e legenda.
- A previa exibe cliente e data, titulo, legenda, canais, contador de anexos e navegacao anterior/proximo entre todas as imagens.

### Rotas administrativas de posts adicionadas/expandidas

- `GET /api/v1/posts` com filtros por cliente e status operacional;
- `GET /api/v1/posts/:id`;
- `PUT /api/v1/posts/:id`;
- `POST /api/v1/posts/:id/duplicate`;
- `PATCH /api/v1/posts/:id/status`;
- `DELETE /api/v1/posts/:id`;
- `POST /api/v1/posts/:id/send-for-approval`;
- alias `POST /api/v1/posts/:id/submit-for-approval`;
- `POST /api/v1/posts/send-batch-for-approval`;
- `POST /api/v1/posts/:id/resubmit`;
- `POST /api/v1/posts/:id/execute`;
- rotas de upload, substituicao, remocao e reordenacao de arquivos.

## 5. Ordenacao e visualizacao de anexos

- Migration `004_file_sort_order.sql` adicionou `files.sort_order`.
- Arquivos antigos receberam posicao por `created_at` e `id`.
- Indice `(post_id, sort_order)` foi criado.
- Upload aceita ordem inicial.
- Endpoint `PATCH /api/v1/posts/:id/files/reorder` valida se os arquivos pertencem ao post e ao tenant.
- Frontend usa controles de subir/descer, adequados tambem para mobile.
- Ordem e preservada na criacao, edicao, portal, aprovacoes e previa do feed.
- Previews indicam posicao como `1/5`, `2/5` etc.
- Modal de aprovacoes permite navegar entre os arquivos sem fechar.
- Modal da Previa do Feed ganhou carrossel acima da lista de arquivos; a lista inferior continua abrindo itens em nova aba.
- Nomes dos projetos na grade do feed ficaram permanentemente visiveis, nao apenas no hover.
- Indicadores coloridos de status e legenda do feed foram aumentados para melhorar leitura.
- Previa do Feed ganhou filtros combinaveis por cliente e estado: aprovado, recusado, aguardando e rascunho.

### Identidade de Storage

- Migration `013_file_storage_identity.sql` adicionou `bucket`, `storage_path`, `mime_type` e `size_bytes` em `files`.
- Registros legados recebem bucket/path apenas quando a URL corresponde com seguranca ao formato publico do Supabase ou ao upload local; os demais permanecem compativeis por `url`.
- Upload e substituicao continuam retornando/exibindo URL publica, mas a remocao de objetos nao interpreta mais URLs.
- A duplicacao copia fisicamente cada arquivo identificado e preserva ordem, nome, tipo, MIME e tamanho, mas reinicia status em `pending` e limpa a decisao de rejeicao.
- Arquivo legado sem `bucket + storage_path` bloqueia a duplicacao de forma explicita, sem criar uma postagem parcial; compartilhamentos anteriores permanecem para auditoria e regularizacao futura.

### Retencao auditavel

- Migration `014_storage_retention_audit.sql` adicionou `files_retention_policy` em posts e `storage_deleted_at`/`storage_delete_error` em `files`.
- O comando manual `npm run storage:cleanup-retention` localiza anexos vencidos, remove apenas o objeto fisico e preserva URL, identidade, nome, ordem, tipo, tamanho, status e decisoes.
- Arquivo ja marcado com `storage_deleted_at` nao volta a ser enviado ao Storage; erro de remocao fica persistido para uma proxima execucao manual do comando.
- A Previa do Feed mantem os metadados e mostra a mensagem de retencao, data de remocao e politica aplicada no lugar da midia.

## 6. Regra de aprovacao e acompanhamento administrativo

- A empresa gerenciadora nao pode aprovar nem reprovar em nome do cliente.
- A pagina `Aprovacoes` tornou-se uma tela de acompanhamento, reenvio de aviso e correcao.
- Backend de aprovacoes bloqueia aprovacao/reprovacao para usuario que nao seja cliente.
- A aprovacao e a rejeicao sao garantidas no backend como operacoes exclusivas do cliente, pelos fluxos autenticado ou por token do portal.
- A decisao final e sempre do cliente, pelo portal autenticado ou por token.
- Novos posts enviados voltaram a aparecer no acompanhamento apos correcao das consultas/status.
- Uma recusa em qualquer arquivo mantem o projeto em revisao/recusado; concluir a rodada nao equivale a aprovar.
- Eventos de aprovacao, recusa, feedback, reset, reenvio e execucao sao registrados em `activity_events`.

## 7. Metricas, insights e feedbacks

### Historico preservado

As metricas usam a primeira decisao e o historico de feedback, evitando que uma correcao posteriormente aprovada apague a recusa original.

Foram adicionados:

- taxa de aprovacao inicial por projeto;
- taxa de recusa inicial por projeto;
- projetos concluidos sem revisao;
- projetos concluidos com revisao;
- taxa de aprovacao inicial por item/arquivo;
- taxa de recusa inicial por item/arquivo;
- quantidade de arquivos que exigiram ajuste;
- tempo medio entre envio e aprovacao/reprovacao;
- analise percentual das tags de reprovacao;
- feedbacks de reprovacao atuais e historicos.

Exemplo de interpretacao adotada: dois projetos com alguma recusa podem representar 100% de projetos com revisao, mas, se 4 de 20 arquivos foram recusados, a visao por item mostra 20% de recusa e 80% de aprovacao inicial.

### Filtros

- Filtros temporais semanal, mensal e anual continuam disponiveis.
- Filtro por cliente continua disponivel.
- Insights ganhou escopo `Geral` ou `Somente clientes ativos`.
- O escopo afeta cards, graficos, feedbacks, IA e exportacao CSV.
- O CSV registra explicitamente o escopo utilizado.
- Filtros permanecem persistidos em `localStorage`.

### Detalhes do cliente

- Pagina de detalhes foi atualizada para usar as metricas historicas de primeira decisao.
- Exibe aprovacao inicial, recusa inicial, concluidos com revisao e sem revisao.
- `last_access_at` e persistido pela estrutura introduzida na migration `006_client_last_access.sql`.
- Login tradicional, acesso ao portal por token e portal autenticado atualizam o ultimo acesso.
- Detalhes do cliente permite gerar, copiar e regerar link do portal com validade de 7 ou 15 dias.

## 8. Dashboard, atividades e notificacoes

### Dashboard

- `Empresa em foco` foi movida para o topo porque seu filtro afeta os blocos abaixo.
- Cards de Total, Pendentes, Aprovados e Recusados passaram a abrir `/admin/posts` com filtros correspondentes.
- Aprovados direcionam para a aba `Aprovado pelo cliente`.
- O atalho redundante `Ver pendentes de envio` foi removido; ficaram `Gerenciar postagens` e `Nova Postagem`.
- Dashboard inicia no escopo `Clientes ativos`.
- Opcao `Geral` inclui historico de clientes desativados.
- Cards, lista de posts, tendencias e atividades respeitam o mesmo escopo.

### Atividade recente

- Formato foi refinado para tabela/lista.
- Consulta e composicao ficam limitadas aos 50 eventos mais recentes.
- Usuario escolhe 5 ou 10 itens por pagina.
- Paginacao permite percorrer o conjunto de ate 50 eventos.
- A atividade continua importante para rastreabilidade de administradores, apesar de inicialmente ter sido considerada possivelmente redundante.

### Notificacoes

- Notificacoes continuam derivadas de posts, com leitura persistida em `notification_reads`.
- Rascunhos e itens apenas prontos para envio nao geram notificacao.
- A notificacao de espera pelo cliente surge somente depois do envio, nos estados `sent` ou `pending_approval`.
- Itens recusados geram notificacao de recusa; correcoes reenviadas sao identificadas separadamente.
- Consulta, contador e estado de leitura estao integrados ao sino.
- Nao foi criada tabela completa de conteudo de notificacao.

## 9. Execucao e retencao de arquivos

- Aprovacao nao e o ultimo estado operacional da agencia.
- Post aprovado pode ser marcado como `executed` quando a agencia efetivamente encaminhou/executou o trabalho.
- Projeto executado nao pode mais ser editado pelo fluxo normal.
- A imutabilidade de `executed` e garantida no backend para edicao, upload, remocao, substituicao e reordenacao de anexos, envio, reenvio, status e exclusao; a duplicacao cria outro post em `draft`.
- Migration `008_executed_posts_retention.sql` adicionou `executed_at` e `files_delete_after`.
- Ao marcar como executado, a agencia escolhe a retencao dos anexos:
  - manter (`never`);
  - excluir imediatamente (`immediate`);
  - excluir em 1 dia (`1d`);
  - excluir em 7 dias (`7d`);
  - excluir em 30 dias (`30d`).
- Metadados, status, atividades e metricas permanecem depois da exclusao dos arquivos.
- A limpeza vencida e executada somente pelo comando dedicado `npm run storage:cleanup-retention`; nao ha scheduler, retry automatico, fila ou cron nesta fase.

## 10. Ciclo de vida dos clientes

### Desativacao reversivel

- `DELETE /api/v1/clients/:id` desativa logicamente o cliente (`is_active = false`);
- cliente desativado recebe badge e pode ser reativado;
- postagens deixam as telas operacionais, mas metricas e historico permanecem;
- links do portal sao revogados;
- anexos recebem prazo de exclusao de 1 dia;
- dashboard e feed mostram somente ativos por padrao, com opcao `Geral`;
- Insights permite geral ou somente ativos;
- ao reativar antes da limpeza, a exclusao pendente e cancelada e as postagens ainda existentes voltam.

A desativacao esconde os dados pelo estado do cliente e preserva o status original dos posts. `archived_by_client_deactivation` existe apenas como marcador de compatibilidade para registros afetados por comportamento legado.

### Exclusao definitiva

- Existe `DELETE /api/v1/clients/:id/permanent`.
- Remove arquivos do storage, eventos ligados ao cliente/posts e o cliente com dados relacionados por cascata.
- A interface alerta explicitamente que postagens, arquivos, feedbacks e metricas vinculados tambem serao removidos.
- Depois da exclusao, as postagens do cliente deixam a central de postagens e a Previa do Feed.
- Exclusao definitiva nao preserva metricas; para preservar historico deve-se usar desativacao.
- Migration `011_reusable_deleted_emails.sql` trocou unicidade global de e-mail por indices unicos apenas para registros ativos, permitindo reutilizacao apos exclusao/desativacao.

## 11. Gestao de usuarios e identidade

- A criacao e a edicao de usuarios e clientes normalizam e-mails para minusculas.
- Um mesmo e-mail nao pode pertencer simultaneamente a usuario ou cliente ativo.
- E-mails de registros excluidos ou inativos ficam disponiveis para novo cadastro.
- Usuarios podem ser excluidos pela administracao.
- O usuario principal `admin@postinder.local` nao pode ser excluido.
- O tipo de usuario pode ser alterado depois da criacao entre `admin`, `manager`, `editor` e `viewer`.
- Formularios de credenciais usam atributos de autocomplete distintos para reduzir interferencia do gerenciador de senhas entre login e senha durante o cadastro.
- A unicidade de e-mail e global no modelo atual, inclusive entre `users` e `clients`; nao usa `company_id` como escopo.
- O helper compartilhado normaliza com `trim` e minusculas e serializa criacao e reativacao por advisory lock transacional, impedindo corrida entre as duas tabelas.

## 12. Reset do ambiente de testes

- Nova pagina `/admin/reset`, visivel para admin na secao Conta.
- Confirmacao exige digitar exatamente `RESETAR`.
- Endpoint `POST /api/v1/maintenance/reset-demo-data` valida papel admin.
- Arquivos registrados sao removidos do storage.
- `notification_reads`, `activity_events`, `client_portal_tokens`, `feedback`, `files`, `posts`, `clients` e `users` sao truncados.
- Usuario e cliente padrao sao recriados:
  - `admin@postinder.local` / `Admin@123456`;
  - `cliente@example.com` / `Cliente@123456`.
- Metricas e dados exibidos pela plataforma voltam ao estado inicial.
- `schema_migrations`, configuracoes externas e logs dos provedores nao sao apagados.

## 13. Banco e migrations acumuladas

Migrations acumuladas nas tres conversas:

- `001_core_schema.sql`: schema principal;
- `002_development_seed.sql`: migration historica de seed, preservada para compatibilidade de registro, mas excluida da cadeia estrutural executada pelo migrador;
- `003_client_portal_tokens.sql`: tokens privados do portal;
- `004_file_sort_order.sql`: ordem persistida dos anexos;
- `005_fix_rejected_post_status.sql`: corrige posts aprovados com arquivos recusados;
- `006_client_last_access.sql`: ultimo acesso do cliente;
- `007_archive_inactive_client_posts.sql`: compatibilidade com o tratamento legado de posts de clientes inativos;
- `008_executed_posts_retention.sql`: execucao e retencao de anexos;
- `009_inactive_clients_file_cleanup.sql`: limpeza de arquivos de clientes inativos e marcador de desativacao;
- `010_client_deactivation_restore_marker.sql`: compatibilidade para restauracao apos reativacao;
- `011_reusable_deleted_emails.sql`: unicidade de e-mail somente entre registros ativos.
- `012_remove_legacy_archived_posts.sql`: remove dados legados do antigo estado `archived`.
- `013_file_storage_identity.sql`: identidade persistida de objeto e metadados de upload.
- `014_storage_retention_audit.sql`: politica de retencao e auditoria da remocao fisica de arquivos.

O comportamento vigente e: desativacao nao apaga o status original do post; apenas o cliente inativo o remove das visoes operacionais e agenda a limpeza de arquivos. As migrations 007, 009 e 010 permanecem na cadeia por compatibilidade com bancos que receberam etapas anteriores dessa evolucao.

Postagens excluidas individualmente usam `deleted_at`; nao recebem `status = archived`. A migration `012_remove_legacy_archived_posts.sql` removeu os registros legados e o estado deixou de existir no dominio e nas consultas atuais.

Para banco vazio, o fluxo oficial e `npm run db:migrate`, seguido opcionalmente de `APP_MODE=demo npm run db:seed-demo` ou de `npm run db:bootstrap-admin` com as variaveis `INITIAL_ADMIN_*`. A seed demo e idempotente e cria somente as credenciais fixas de demonstracao; o bootstrap de producao nao usa essas credenciais. O migrador usa lock advisory para evitar execucao concorrente. O schema inicial legado foi removido; as migrations sao o unico caminho de instalacao.

O uso de `post_notes` foi removido do fluxo de reenvio por nao haver tabela, leitura ou funcionalidade ativa correspondente. Referencias condicionais permanecem apenas na limpeza de legado, para bancos antigos que eventualmente possuam essa tabela.

## 14. Limpeza de legados sem uso

- Foram removidos os componentes sem rota `ClientSwipePage`, `ClientSummary`, `ClientLayout` e o servico exclusivo do swipe antigo.
- Foram removidos `PostResponseDTO`, exports sem consumidores, 29 barrels/placeholders sem imports, o schema inicial depreciado, a configuracao obsoleta do Nodemon e o log local de desenvolvimento.
- Permanecem migrations historicas, a rotina de limpeza de `archived`, o marcador `archived_by_client_deactivation`, APIs ainda expostas e codigo de IA adiado, por ainda terem compatibilidade, rota ativa ou evolucao futura registrada.

## 15. Permissoes e seguranca

- Viewer continua bloqueado para mutacoes pelo frontend e middleware backend.
- Editor/manager/admin podem gerenciar posts conforme a matriz de permissoes existente.
- Exclusao de post em andamento exige permissao de edicao; exclusao de `approved` exige `admin`; `executed` nao pode ser excluido por nenhum papel.
- Admin/agencia nao pode aprovar conteudo em nome do cliente.
- Portal por token nao da acesso a rotas administrativas.
- Token e longo, aleatorio, imprevisivel e armazenado somente como hash.
- Consultas do portal verificam token, expiracao, revogacao, cliente, `company_id`, post e arquivo.
- Reset e restrito a admin e exige confirmacao textual.
- Exclusao definitiva e uma operacao destrutiva separada da desativacao.
- O usuario principal padrao e protegido contra exclusao.
- A alteracao posterior do papel do usuario respeita as opcoes de permissao existentes.
