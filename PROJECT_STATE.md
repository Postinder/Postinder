# Estado Atual do Postinder

## Status da auditoria e da publicacao

- A auditoria tecnica pre-deploy foi concluida.
- Os bloqueadores tecnicos C-01, C-02, H-02, H-03 e H-04 foram corrigidos e validados localmente.
- Backend: 139/139 testes aprovados. Frontend: 14/14 testes aprovados. Os dois builds e `git diff --check` foram aprovados.
- As correcoes ainda nao foram publicadas. O frontend ativo em `postinder.vercel.app` e o backend ativo no Render continuam em versoes anteriores.
- O deploy permanece **nao autorizado**. Nenhuma migration pendente foi aplicada no banco publicado.
- A proxima frente e composta por ajustes pontuais de interface; depois deles ocorrera a preparacao operacional final de deploy.

## Visao do produto

O Postinder e uma plataforma para agencias prepararem postagens, enviarem conteudo para revisao do Cliente e preservarem o historico da decisao e da execucao.

O fluxo implementado e:

`draft -> ready -> sent/pending_approval -> approved ou rejected -> correcao/reenvio -> approved -> executed`

- `draft` e `ready` sao internos.
- O Cliente aprova ou reprova arquivos e postagens pelo portal.
- `approved` representa conteudo aprovado pelo Cliente e aparece na central como **Aprovado pelo cliente**.
- `executed` representa conteudo efetivamente publicado ou realizado pela agencia e aparece como **Postado na rede**.
- Postagens `executed` sao registros historicos imutaveis; podem ser consultadas e duplicadas, mas nao editadas, reenviadas, alteradas ou excluidas.
- Excluir postagem e exclusao logica por `deleted_at`. Postagem `approved` exige admin e confirmacao reforcada; `executed` nunca pode ser excluida.

## Arquitetura

| Area | Implementacao |
| --- | --- |
| Frontend | React, Vite, React Router, Tailwind, Zustand e Axios em `apps/admin` |
| Backend | Express e TypeScript em `backend`, organizado por modulos |
| Banco | PostgreSQL via `pg` |
| Storage local | Diretorio `uploads` em desenvolvimento |
| Storage publicado | Supabase Storage em producao |
| Infraestrutura de referencia | Vercel para frontend, Render para API e Supabase para Postgres/Storage |

Os modulos ativos incluem autenticacao, usuarios, Clientes, postagens, aprovacoes, portal, arquivos, fundos sonoros, feedbacks, atividades, notificacoes e manutencao de demonstracao.

## Areas e acesso

- A area administrativa concentra dashboard, Clientes, usuarios, postagens, aprovacoes, feed, insights, reset e configuracoes disponiveis.
- O portal por token esta em `/portal/:token`; o portal para Cliente autenticado esta em `/aprovar`.
- Tokens de portal sao aleatorios, armazenados como hash, expiram, podem ser regenerados e sao revogados quando o Cliente e desativado.
- Identidades administrativas, identidades de Cliente, refresh tokens e tokens privados de portal sao contextos distintos. Access tokens administrativos exigem `type: "admin"`; tokens de Cliente exigem `type: "client"` em seus fluxos proprios.
- Todas as rotas administrativas passam pela cadeia central de autenticacao, validacao do contexto administrativo e autorizacao por capacidade. Tokens ambiguos, mistos, legados ou de refresh usados como access token sao rejeitados antes dos controllers.
- A autorizacao administrativa e tipada, nega por padrao e possui 36 capacidades aplicadas explicitamente a 43 rotas. Uma rota administrativa sem politica declarada recebe `403`.
- Os perfis oficiais sao `admin`, `manager`, `editor` e `viewer`: admin possui todas as capacidades; manager opera sem administrar usuarios, executar exclusoes destrutivas ou reset; editor atua no fluxo editorial sem mutacoes de Clientes, execucao, exclusoes, usuarios ou reset; viewer possui somente leituras aprovadas.
- Criacao e alteracao de usuarios ou papeis exigem capacidades exclusivas de admin. Perfis desconhecidos, legados ou identidades nao administrativas recebem zero capacidades.
- O frontend ainda possui referencias visuais legadas a `gestor` e `equipe`; elas podem exibir acoes que o backend recusara, mas nao contornam a barreira autoritativa.
- Aprovacao e reprovacao sao operacoes exclusivas do Cliente. `PATCH /posts/:id/status` aceita somente `draft <-> ready`; envio, reenvio, decisao e execucao possuem endpoints especificos.

## Postagens, anexos e metricas

- A agencia cria, edita, ordena anexos, duplica e envia postagens individualmente ou em lote.
- O portal oferece swipe e botoes, feedback por arquivo, tags, edicao de feedback e desfazer apenas da ultima decisao no fluxo permitido. Em dispositivos moveis, as acoes permanecem fixas na parte inferior; em telas maiores, ficam junto da legenda.
- Imagens e videos usam uma previa reutilizavel nas telas administrativas e no portal. Videos possuem player nativo com controles, `playsInline`, carregamento por metadados e alternativa para abrir o arquivo original quando o navegador nao reproduz o codec.
- Os controles do video sao isolados do gesto horizontal de decisao. Legendas permanecem alinhadas a esquerda, preservam quebras, usam hifenizacao automatica em portugues e podem ser expandidas por `Ver mais` sem sobrepor as acoes.
- O primeiro quadro de revisao foi compactado para priorizar, na abertura, faixa de contexto, midia, nome, estado, instrucao de swipe, legenda e acoes. A altura da midia responde ao viewport e usa limite menor em telas grandes para manter a borda inferior visivel.
- A ordem dos anexos e persistida por `files.sort_order` e usada em criacao, edicao, portal e previews.
- A edicao administrativa possui previa compacta navegavel do feed.
- Metricas preservam a primeira decisao, inclusive quando uma correcao posterior e aprovada. Dashboard, feed e insights tratam Clientes ativos como escopo padrao e oferecem visao geral quando aplicavel.
- Notificacoes nao sao criadas para `draft` ou `ready`; eventos de envio, recusa e correcao permanecem distintos.

## Fundo sonoro

- Criacao e edicao administrativas possuem uma secao separada dos anexos, com as modalidades sem fundo, incorporado a um video, arquivo de audio enviado e referencia externa. A trilha nunca participa de `files.sort_order`.
- Postagens anteriores a esta capacidade carregam normalmente como `none`, sem migracao retroativa de conteudo ou historico.
- O modo incorporado vincula um video ativo da propria postagem. O modo enviado aceita um unico audio ativo e metadados de faixa, origem, ponto inicial e observacoes. Referencias externas exibem somente seus dados e link quando nao ha audio local.
- No portal por token e no portal autenticado, a decisao sobre o fundo sonoro e exclusiva do Cliente. `pending` e `adjustment_requested` bloqueiam a aprovacao integral; `approved` satisfaz o requisito. Controles de reproducao e mute nao alteram status nem registram decisao.
- A trilha enviada continua tocando durante a navegacao entre cards da mesma postagem e e interrompida ao trocar de postagem ou sair da tela. Som original do video e fundo sonoro possuem controles distintos; audio incorporado usa o proprio video, sem player ficticio separado.
- Cada alteracao material gera nova revisao pendente. Versoes e decisoes anteriores permanecem nas tabelas de auditoria, e `activity_events` registra configuracao, aprovacao, ajuste, substituicao e reenvio. Postagens `executed` permanecem somente leitura.

## Clientes, usuarios e e-mail

- Cliente pode ser desativado de modo reversivel, preservando historico e metricas, ou excluido definitivamente com os dados relacionados.
- `archived_by_client_deactivation` permanece somente como marcador tecnico de compatibilidade no fluxo de desativacao/reativacao de Cliente. Ele nao representa o antigo status `archived`, nao pertence ao dominio operacional das postagens e nao deve aparecer como estado na interface.
- Usuarios podem ter o papel alterado entre `admin`, `manager`, `editor` e `viewer`. O administrador principal de demonstracao nao pode ser excluido.
- E-mails sao normalizados com `trim` e minusculas. Usuarios e Clientes ativos compartilham unicidade global, inclusive entre tabelas.
- Criacao e reativacao usam transacao, consulta cruzada e `pg_advisory_xact_lock` por e-mail. Indices unicos parciais mantem a defesa dentro de cada tabela.

## Banco de dados

`database/migrations` e a unica fonte de verdade do schema. O migrador registra aplicacoes em `schema_migrations`; o startup nao cria nem repara tabelas, colunas, indices ou dados.

Uma instalacao vazia usa `npm run db:migrate` no diretorio `backend`. A migration `002_development_seed.sql` e historica e nao integra a cadeia estrutural. As migrations estruturais vigentes vao de `001` e `003` a `015`, cobrindo portal, ordenacao, execucao, retencao, e-mail, remocao do antigo estado `archived`, metadados de Storage e fundo sonoro versionado.

O backend publicado usa PostgreSQL da Supabase. No snapshot auditado:

- `001`, a `002` historica e `003` a `011` estavam registradas;
- `012`, `013`, `014` e `015` permaneciam pendentes;
- havia 1 Cliente ativo, nenhum Cliente inativo, 0 posts e 0 files;
- nao foram encontrados orfaos, duplicidades incompatíveis ou FKs invalidas;
- a parte destrutiva da `012` atingiria zero linhas naquele snapshot.

O backup logico foi criado, preservado e validado. A restauracao foi comprovada em stack Supabase local compativel, em transacao unica, usando copia de `roles.sql` com somente a instrucao de `statement_timeout` de `supabase_admin` comentada; schema e dados permaneceram identicos. O backup e restauravel com esse procedimento documentado de compatibilidade, mas nao inclui objetos fisicos do Supabase Storage.

Sobre o clone restaurado, o migrador real `backend/scripts/migrate.ts`, executado por `npm run db:migrate` em `backend`, aplicou `012` a `015` na ordem correta. Uma segunda execucao foi no-op, e o advisory lock foi adquirido e liberado sem residuos. O Render ainda precisa de um Pre-Deploy Command/release step bloqueante que execute esse comando antes do Start Command. Um novo backup e um novo preflight da `012` sao obrigatorios imediatamente antes do deploy, pois o banco pode mudar.

## Seguranca e demonstracao

- C-01 separa de forma autoritativa JWT administrativo, JWT de Cliente, refresh tokens e token privado do portal. Sessoes antigas ambiguas podem exigir novo login.
- C-02 separa `NODE_ENV`, que representa apenas o modo tecnico do Node, de `DEPLOYMENT_MODE`, que representa a finalidade da implantacao.
- O reset so existe quando `DEPLOYMENT_MODE=demo` e `ENABLE_DEMO_RESET=true`, e ainda exige admin autenticado com a capacidade propria. A rota nao e montada quando indisponivel e o controller repete a guarda antes de qualquer efeito lateral.
- `VITE_DEPLOYMENT_MODE` e apenas apresentacao; o frontend nao consegue habilitar o reset no backend.
- URLs de portal, query strings sensiveis, objetos, arrays, erros, stacks e causes passam pela sanitizacao H-02. Tokens privados nao sao persistidos em eventos, refletidos em respostas ou registrados integralmente em logs da aplicacao; subrotas desconhecidas recebem resposta generica.
- O token real continua intacto ate o hashing e a validacao. A entrega deliberada de um novo link ao administrador autorizado permanece necessaria ao recurso e nao e tratada como vazamento.
- Logs historicos e logs externos antigos do Render nao foram auditados. Alguns `console.error` nao relacionados ao request permanecem como risco defensivo residual.

## Integracoes e IA

- O frontend atual consome somente `VITE_API_URL`, `VITE_DEPLOYMENT_MODE` e `VITE_GA_MEASUREMENT_ID`, todas publicas. Nenhuma chave, token ou client secret deve usar prefixo `VITE_*`.
- Anthropic e Z-API sao server-side. Twilio, GoHighLevel, Canva e Resend permanecem desabilitados ate implementacao segura. Google Analytics conserva somente o identificador publico.
- A IA usa `POST /api/v1/integrations/ai-insights` e a capacidade `ai-insights:generate`, atualmente exclusiva de `admin`.
- Fluxo: frontend -> API do Postinder -> autenticacao C-01 -> capacidade H-03 -> controller -> service -> adaptador Anthropic server-side.
- A URL do provedor e fixa no backend, o modelo usa allowlist, e a chamada possui timeout e abort. Configuracao ausente produz indisponibilidade segura e nao existe chamada no startup.
- O provedor recebe somente periodo, totais e metricas agregadas, contagem de Clientes, rotulos efemeros `Cliente N` e a pergunta explicita do administrador. Nomes, e-mails, telefones, IDs internos, tokens, links privados e mapa persistente de reidentificacao nao sao enviados.
- A politica formal de privacidade, provedor e tratamento de dados para uso real da IA continua pendente. A credencial server-side so deve ser configurada quando o recurso for deliberadamente habilitado.

## Storage e Retencao

- A identidade de cada objeto e `bucket + storage_path`; a URL publica e apenas uma forma de acesso mantida por compatibilidade.
- `files` persiste bucket, caminho, MIME e tamanho. Uploads compensam objetos enviados quando o banco falha.
- O frontend valida tipo e limite de 200 MB antes do envio, apresenta progresso por arquivo e envia anexos sequencialmente. O backend devolve `413` para excesso de tamanho e `415` para tipo nao suportado.
- Se a postagem for criada e um anexo falhar, o registro permanece editavel e a interface informa que o envio pode ser tentado novamente.
- Duplicacao cria copia fisica independente em novo path e registro proprio; arquivos legados sem identidade bloqueiam a duplicacao de modo explicito.
- Retencao por postagem aceita `immediate`, `1d`, `7d`, `30d` e `never`. O comando manual `npm run storage:cleanup-retention` remove o objeto vencido, preserva metadados e registra `storage_deleted_at` ou `storage_delete_error`.
- Nao existe scheduler, fila ou retry automatico nesta versao.
- Arquivos de fundo sonoro usam o mesmo bucket e adaptador de Storage, em path proprio da postagem, com limite de 50 MB e validacao inicial de MP3, WAV, OGG, AAC e M4A. Duplicacao e Retencao aplicam as mesmas garantias de identidade independente e auditoria dos anexos.

## Estado operacional e limitacoes

- As correcoes foram validadas localmente com 139/139 testes de backend, 14/14 de frontend, builds dos dois projetos, `git diff --check` e bundle scan com zero sentinelas. Nenhum teste chamou provedor real, e as correcoes nao acessaram banco ou servico remoto.
- Nenhuma migration pendente foi executada em producao e nenhum deploy foi realizado.
- O dominio ativo ainda serve o bundle anterior a H-04. Ele contem nomes legados `VITE_*`, mas nenhuma credencial funcional foi identificada: codigo vulneravel publicado sem credencial evidenciada e exposicao historica inconclusiva.
- A verificacao manual da Vercel continua pendente para nomes de variaveis, Production/Preview/Development, commit ativo, deployments historicos e previews. Eventual segredo historico exigira rotacao ou invalidacao em etapa separada.
- A verificacao manual do Render confirmou categorias de URL/CORS, banco, JWT, Supabase/Storage e `NODE_ENV`; nenhum `VITE_*`, credencial de integracao ou Environment Group foi evidenciado. O backend publicado e anterior as correcoes, e `DEPLOYMENT_MODE`, `ENABLE_DEMO_RESET` e a credencial server-side de IA ainda nao estao configurados.
- O ambiente publicado atual continua sendo uma demo. Antes da proxima publicacao, Render e frontend devem receber os marcadores de demo descritos no guia de deploy.
- O backend ativo observado no Render correspondia ao commit abreviado `3552b8e` (`Correcao swipe`). Essa observacao nao prova que nenhum deployment intermediario tenha existido.
- A versao publicada nao deve receber dados reais sensiveis nem novas credenciais frontend.
- O bucket continua publico no fluxo atual; bucket privado e signed URLs nao foram implementados.
- Em producao, cada arquivo ainda passa pela memoria do backend antes do Supabase. Upload direto ou retomavel para o Storage nao foi implementado.
- A seed explicita continua condicionada a `APP_MODE=demo`; o reset e protegido separadamente por `DEPLOYMENT_MODE` e `ENABLE_DEMO_RESET`.
- Multiempresa, identidade global de contas e entidades proprias de Projeto/Campanha ainda nao foram implementadas.
- Fundo sonoro nao inclui busca ou download externo, integracoes com plataformas, escolha entre varias trilhas, editor, mixagem, renderizacao final ou metricas musicais.

Consulte [DEPLOYMENT.md](docs/DEPLOYMENT.md) para instalacao e ambientes, [STORAGE_ARCHITECTURE.md](docs/STORAGE_ARCHITECTURE.md) para arquivos e Retencao, e [ROADMAP.md](ROADMAP.md) para o trabalho futuro.

## Ordem de leitura para retomada

1. [PROJECT_STATE.md](PROJECT_STATE.md) — estado consolidado e limites atuais.
2. [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md) — regras permanentes.
3. [ROADMAP.md](ROADMAP.md) — proxima frente e trabalho pendente.
4. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — procedimento operacional.
5. [docs/deploy/CHECKLIST_DEPLOY_TESTE.md](docs/deploy/CHECKLIST_DEPLOY_TESTE.md) — gates antes e depois do deploy.
6. [CHANGELOG.md](CHANGELOG.md) — alteracoes locais ainda nao publicadas.

Os relatorios `INVESTIGACAO_*` e `CORRECAO_*` devem ser consultados somente
quando forem necessarios detalhes de evidencia, testes ou limitacoes tecnicas.
