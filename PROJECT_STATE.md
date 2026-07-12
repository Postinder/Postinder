# Estado Atual do Postinder

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

Os modulos ativos incluem autenticacao, usuarios, Clientes, postagens, aprovacoes, portal, arquivos, feedbacks, atividades, notificacoes e manutencao de demonstracao.

## Areas e acesso

- A area administrativa concentra dashboard, Clientes, usuarios, postagens, aprovacoes, feed, insights, reset e configuracoes disponiveis.
- O portal por token esta em `/portal/:token`; o portal para Cliente autenticado esta em `/aprovar`.
- Tokens de portal sao aleatorios, armazenados como hash, expiram, podem ser regenerados e sao revogados quando o Cliente e desativado.
- JWT de Cliente e recusado nas rotas administrativas de postagens. `viewer` permanece somente leitura.
- Aprovacao e reprovacao sao operacoes exclusivas do Cliente. `PATCH /posts/:id/status` aceita somente `draft <-> ready`; envio, reenvio, decisao e execucao possuem endpoints especificos.

## Postagens, anexos e metricas

- A agencia cria, edita, ordena anexos, duplica e envia postagens individualmente ou em lote.
- O portal oferece swipe e botoes, feedback por arquivo, tags, edicao de feedback e desfazer apenas da ultima decisao no fluxo permitido.
- A ordem dos anexos e persistida por `files.sort_order` e usada em criacao, edicao, portal e previews.
- A edicao administrativa possui previa compacta navegavel do feed.
- Metricas preservam a primeira decisao, inclusive quando uma correcao posterior e aprovada. Dashboard, feed e insights tratam Clientes ativos como escopo padrao e oferecem visao geral quando aplicavel.
- Notificacoes nao sao criadas para `draft` ou `ready`; eventos de envio, recusa e correcao permanecem distintos.

## Clientes, usuarios e e-mail

- Cliente pode ser desativado de modo reversivel, preservando historico e metricas, ou excluido definitivamente com os dados relacionados.
- `archived_by_client_deactivation` permanece somente como marcador tecnico de compatibilidade no fluxo de desativacao/reativacao de Cliente. Ele nao representa o antigo status `archived`, nao pertence ao dominio operacional das postagens e nao deve aparecer como estado na interface.
- Usuarios podem ter o papel alterado entre `admin`, `manager`, `editor` e `viewer`. O administrador principal de demonstracao nao pode ser excluido.
- E-mails sao normalizados com `trim` e minusculas. Usuarios e Clientes ativos compartilham unicidade global, inclusive entre tabelas.
- Criacao e reativacao usam transacao, consulta cruzada e `pg_advisory_xact_lock` por e-mail. Indices unicos parciais mantem a defesa dentro de cada tabela.

## Banco de dados

`database/migrations` e a unica fonte de verdade do schema. O migrador registra aplicacoes em `schema_migrations`; o startup nao cria nem repara tabelas, colunas, indices ou dados.

Uma instalacao vazia usa `npm run db:migrate` no diretorio `backend`. A migration `002_development_seed.sql` e historica e nao integra a cadeia estrutural. As migrations estruturais vigentes vao de `001` e `003` a `014`, cobrindo portal, ordenacao, execucao, retencao, e-mail, remocao do antigo estado `archived` e metadados de Storage.

## Storage e Retencao

- A identidade de cada objeto e `bucket + storage_path`; a URL publica e apenas uma forma de acesso mantida por compatibilidade.
- `files` persiste bucket, caminho, MIME e tamanho. Uploads compensam objetos enviados quando o banco falha.
- Duplicacao cria copia fisica independente em novo path e registro proprio; arquivos legados sem identidade bloqueiam a duplicacao de modo explicito.
- Retencao por postagem aceita `immediate`, `1d`, `7d`, `30d` e `never`. O comando manual `npm run storage:cleanup-retention` remove o objeto vencido, preserva metadados e registra `storage_deleted_at` ou `storage_delete_error`.
- Nao existe scheduler, fila ou retry automatico nesta versao.

## Estado operacional e limitacoes

- A implementacao foi validada localmente por builds, verificacoes tecnicas e testes manuais. Nao ha confirmacao de cobertura automatizada ponta a ponta completa.
- A aplicacao integral de migrations, variaveis e configuracoes de Storage no ambiente publicado ainda precisa ser confirmada.
- O bucket continua publico no fluxo atual; bucket privado e signed URLs nao foram implementados.
- A seed explicita e condicionada a `APP_MODE=demo`, mas a separacao completa entre Modo demonstracao e Modo producao ainda e trabalho futuro.
- Multiempresa, identidade global de contas e entidades proprias de Projeto/Campanha ainda nao foram implementadas.

Consulte [DEPLOYMENT.md](docs/DEPLOYMENT.md) para instalacao e ambientes, [STORAGE_ARCHITECTURE.md](docs/STORAGE_ARCHITECTURE.md) para arquivos e Retencao, e [ROADMAP.md](ROADMAP.md) para o trabalho futuro.
