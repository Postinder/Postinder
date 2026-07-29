# Investigação da simulação das migrations 012–015

## 1. Objetivo

Simular a atualização incremental do banco atualmente publicado, do estado estrutural `011` para `015`, usando o migrador real do Postinder contra uma nova stack Supabase local, restaurada a partir do backup lógico validado.

**Resultado:** simulação concluída com sucesso. As migrations `012`, `013`, `014` e `015` foram aplicadas na ordem correta; a segunda execução foi um no-op operacional; produção não foi acessada.

## 2. Proteções contra produção

Antes da criação da stack:

- `POSTINDER_PROD_DATABASE_URL`: ausente;
- `DATABASE_URL`: ausente;
- nenhuma conexão remota disponível foi utilizada;
- nenhuma conexão foi procurada em `.env`, Render, Supabase remoto, histórico do terminal, logs antigos ou documentos;
- nenhuma URL ou credencial foi exibida ou persistida.

Os mesmos gates foram repetidos imediatamente antes de cada execução do migrador. A variável `DATABASE_URL` foi definida somente no processo de cada execução, apontando para o destino local sanitizado:

- host: `127.0.0.1`;
- porta: `55432`;
- banco: `postgres`.

Ao final, `POSTINDER_PROD_DATABASE_URL` e `DATABASE_URL` continuavam ausentes. Não foram executados `supabase login`, `supabase link`, `db push`, `db pull`, dump remoto, acesso ao Storage remoto, deploy ou operação Git mutável.

## 3. Referências utilizadas

Foram consultados somente os trechos necessários de:

- seções 4, 7, 14 e 15 de `INVESTIGACAO_AUDITORIA_PRE_DEPLOY.md`;
- seção 29 de `INVESTIGACAO_INVENTARIO_BANCO_PRODUCAO.md`;
- resultado, limitações e veredito de `INVESTIGACAO_BACKUP_PRE_DEPLOY.md`;
- seção prevalente 22 de `INVESTIGACAO_RESTAURACAO_BACKUP.md`;
- `backend/package.json`;
- `backend/scripts/migrate.ts`;
- `backend/src/shared/database/migrationCatalog.ts`;
- `backend/src/shared/database/migrationStatus.ts`;
- `backend/src/server.ts`;
- `backend/scripts/cleanupLegacyArchivedPosts.ts`;
- migrations reais `012`, `013`, `014` e `015`;
- trecho pertinente de `docs/DEPLOYMENT.md`.

Não foi refeita a auditoria geral.

## 4. Hashes

### 4.1. Dumps originais

Pasta: `C:\Users\Murilo\Backups\Postinder\2026-07-29_16-06-06`

| Arquivo | Tamanho | SHA-256 inicial e final | Resultado |
| --- | ---: | --- | --- |
| `roles.sql` | 358 bytes | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | Idêntico |
| `schema.sql` | 15.000 bytes | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Idêntico |
| `data.sql` | 13.364 bytes | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Idêntico |

### 4.2. Cópias preparadas e manifesto

Pasta: `C:\Users\Murilo\Temp\PostinderRestorePrepared\2026-07-29_17-29-30`

| Arquivo | Tamanho | SHA-256 inicial e final | Resultado |
| --- | ---: | --- | --- |
| `roles.restore.sql` | 377 bytes | `2B29CAE6FA2175E522D53D387F713B9E905D2F762AC88D55500B1D267C2C48D2` | Idêntico |
| `schema.restore.sql` | 15.000 bytes | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Idêntico |
| `data.restore.sql` | 13.364 bytes | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Idêntico |
| `RESTORE_TRANSFORMATIONS.md` | 2.695 bytes | `7EEFAC0EDE492EA3214672AAAB0668814BB98AAB4331B20C940EFDE29BA68938` | Idêntico |

Nenhum desses arquivos foi alterado.

## 5. Ambiente descartável

- Criação: 2026-07-29 às 17:47:11 -03:00;
- workdir externo: `C:\Users\Murilo\Temp\PostinderSupabaseMigrationSimulation\2026-07-29_17-47-11`;
- `project_id`: `postinder-migration-sim-20260729-174712`;
- Node.js: `v24.16.0`;
- Supabase CLI: `2.110.0`, usada por `npx`;
- Docker client/server: `29.6.2` / `29.6.2`;
- PostgreSQL da stack: `17.6`;
- imagem: `public.ecr.aws/supabase/postgres:17.6.1.143`;
- `psql`: `18.4`;
- porta do banco: `55432`;
- porta shadow: `55433`;
- outras portas temporárias reservadas: `55421`, `55423`, `55424`, `55427`, `55429` e `55483`;
- serviço necessário iniciado: banco PostgreSQL da stack;
- frontend, backend servidor e Docker Compose do Postinder: não iniciados.

A porta `55432` estava livre antes da criação. A stack usou projeto, contêiner, volume e rede novos. Não reutilizou o contêiner preexistente `postinder-db`, o volume `postinder_postgres_data` ou a rede `postinder_default`.

Roles necessárias confirmadas antes da restauração:

- `anon`;
- `authenticated`;
- `authenticator`;
- `service_role`;
- `supabase_admin`.

## 6. Restauração do estado 011

O destino foi confirmado como vazio, saudável e exclusivamente local para os clientes utilizados.

A restauração foi executada uma vez, em uma transação única, pelo procedimento lógico:

```text
psql -X
  --single-transaction
  --variable ON_ERROR_STOP=1
  --file roles.restore.sql
  --file schema.restore.sql
  --command "SET session_replication_role = replica"
  --file data.restore.sql
  --dbname <conexão-local-da-stack>
```

Resultado:

- código de saída: `0`;
- commit da transação única: concluído;
- erro: nenhum;
- tabelas públicas restauradas: 9, incluindo `schema_migrations`;
- tabelas centrais do Postinder: 8;
- registros em `schema_migrations`: 11.

Os arquivos originais não foram utilizados diretamente nem modificados. Foram usadas somente as três cópias preparadas e previamente validadas.

## 7. Baseline antes das migrations

### 7.1. Histórico

Sequência restaurada:

1. `001_core_schema.sql`;
2. `002_development_seed.sql`, histórica;
3. `003_client_portal_tokens.sql`;
4. `004_file_sort_order.sql`;
5. `005_fix_rejected_post_status.sql`;
6. `006_client_last_access.sql`;
7. `007_archive_inactive_client_posts.sql`;
8. `008_executed_posts_retention.sql`;
9. `009_inactive_clients_file_cleanup.sql`;
10. `010_client_deactivation_restore_marker.sql`;
11. `011_reusable_deleted_emails.sql`.

Confirmações:

- `012` a `015`: ausentes;
- duplicidades de migration: 0;
- sequência estrutural até `011`: contínua;
- `002`: presente somente como registro histórico.

### 7.2. Dados

| Métrica | Baseline |
| --- | ---: |
| Clientes totais | 1 |
| Clientes ativos | 1 |
| Clientes inativos | 0 |
| Posts | 0 |
| Posts arquivados | 0 |
| Files | 0 |
| Feedbacks vinculados a posts arquivados | 0 |
| Eventos vinculados a posts arquivados | 0 |

Como o clone contém um único Cliente e nenhum post/file, não há grupos incompatíveis nesses dados. A restauração anterior do mesmo conteúdo também havia confirmado 0 grupos duplicados de e-mail ativo entre Clientes e entre usuários.

### 7.3. Schema e integridade

Antes do migrador, estavam ausentes:

- `files.bucket`;
- `files.storage_path`;
- `files.mime_type`;
- `files.size_bytes`;
- `files.storage_deleted_at`;
- `files.storage_delete_error`;
- `posts.files_retention_policy`;
- `post_soundtracks`;
- `post_soundtrack_versions`;
- `post_soundtrack_decisions`;
- índices e checks associados às migrations `013`–`015`.

Integridade:

- FKs não validadas: 0;
- órfãos detectáveis nas relações existentes: 0;
- duplicidades de migration: 0;
- relações com posts arquivados: 0.

O baseline corresponde ao inventário publicado nas métricas validadas.

## 8. Análise do migrador

### 8.1. Componentes

- entrypoint: `backend/scripts/migrate.ts`;
- catálogo: `backend/src/shared/database/migrationCatalog.ts`;
- comando do projeto: `npm run db:migrate`;
- diretório esperado de execução: `backend`;
- diretório de migrations resolvido: `../database/migrations`.

### 8.2. Regras observadas

- os arquivos `.sql` são ordenados lexicograficamente;
- `002_development_seed.sql` é excluída explicitamente do catálogo estrutural;
- `schema_migrations.filename` identifica o que já foi aplicado;
- o lock de sessão usa `pg_advisory_lock(hashtext('postinder:database:migrations'))`;
- cada migration pendente recebe sua própria transação `BEGIN`/`COMMIT`;
- o registro em `schema_migrations` ocorre na mesma transação do SQL da migration;
- falha provoca `ROLLBACK` da migration corrente, encerra o processo com código diferente de zero e não desfaz migrations anteriores já confirmadas;
- a liberação do advisory lock fica no bloco `finally`;
- não há checksum do conteúdo das migrations já registradas.

### 8.3. Relação com o startup

`backend/src/server.ts` consulta migrations pendentes antes de abrir a porta. Em produção, uma pendência impede o startup e o processo termina com erro. O servidor não executa migrations automaticamente.

Assim, foi possível usar com segurança o migrador isolado, sem iniciar a API:

```text
cd backend
npm run db:migrate
```

A conexão local foi fornecida somente por variável temporária do processo.

## 9. Primeira execução

- início aproximado: 2026-07-29 às 17:51:42 -03:00;
- comando lógico: `npm run db:migrate`, no diretório `backend`;
- destino sanitizado: `127.0.0.1:55432`;
- duração: 1.679 ms;
- código de saída: `0`;
- resultado final: `Database migrations completed.`;
- falhas: nenhuma;
- warning bloqueante: nenhum;
- `002` foi apenas informada como seed histórica excluída.

Ordem aplicada:

1. `012_remove_legacy_archived_posts.sql`;
2. `013_file_storage_identity.sql`;
3. `014_storage_retention_audit.sql`;
4. `015_post_soundtracks.sql`.

As migrations `001` e `003`–`011` foram reconhecidas como já aplicadas. O histórico passou de 11 para 15 registros sem duplicidades.

## 10. Resultado de cada migration

### 10.1. `012_remove_legacy_archived_posts.sql`

- aplicada e registrada;
- posts arquivados antes/depois: 0 / 0;
- posts apagados: 0;
- files apagados por cascata: 0;
- feedbacks apagados por cascata: 0;
- eventos apagados: 0;
- Clientes antes/depois: 1 / 1;
- efeito destrutivo no snapshot: nenhum.

O script separado `cleanupLegacyArchivedPosts.ts`, mencionado pela migration para remoção prévia de objetos físicos, não foi executado. Ele não era necessário para o snapshot, que possuía 0 posts arquivados e 0 files. Objetos físicos do Storage não foram acessados.

### 10.2. `013_file_storage_identity.sql`

Estruturas confirmadas:

| Coluna | Tipo | Nulável | Default |
| --- | --- | --- | --- |
| `files.bucket` | `varchar(255)` | sim | nenhum |
| `files.storage_path` | `text` | sim | nenhum |
| `files.mime_type` | `varchar(255)` | sim | nenhum |
| `files.size_bytes` | `bigint` | sim | nenhum |

O índice parcial `idx_files_storage_identity(bucket, storage_path)` foi criado com predicado para valores não nulos. Como havia 0 files, nenhuma linha exigiu backfill e não houve backfill incorreto.

### 10.3. `014_storage_retention_audit.sql`

Estruturas confirmadas:

| Coluna | Tipo | Nulável | Default |
| --- | --- | --- | --- |
| `posts.files_retention_policy` | `varchar(20)` | sim | nenhum |
| `files.storage_deleted_at` | `timestamp without time zone` | sim | nenhum |
| `files.storage_delete_error` | `text` | sim | nenhum |

Também foram confirmados:

- check `posts_files_retention_policy_check`;
- valores permitidos: `immediate`, `1d`, `7d`, `30d`, `never` ou nulo;
- índice parcial `idx_files_storage_retention_pending`;
- compatibilidade com os dados existentes;
- nenhum backfill necessário no snapshot sem posts.

### 10.4. `015_post_soundtracks.sql`

As três tabelas foram criadas integralmente:

- `post_soundtracks`;
- `post_soundtrack_versions`;
- `post_soundtrack_decisions`.

Foram confirmados:

- todas as colunas previstas pelo SQL real;
- tipos, nulabilidade e defaults;
- checks de `mode`, `approval_status`, `usage_source`, início não negativo, revisão positiva, decisões permitidas e comentário obrigatório para ajuste;
- PKs;
- FKs de post e soundtrack com `ON DELETE CASCADE`;
- FK de `source_media_id` para `files` com `ON DELETE SET NULL`;
- unicidade `(soundtrack_id, revision_number)`;
- unicidade parcial de uma trilha ativa por post;
- índices de post, mídia-fonte, identidade de Storage, retenção, versões e decisões;
- 0 estruturas parciais;
- 0 linhas criadas;
- nenhum backfill exigido para posts antigos.

## 11. Comparação antes/depois

| Área | Antes | Depois da primeira execução | Resultado |
| --- | --- | --- | --- |
| Migrations | até `011`, mais `002` histórica | até `015`, mais `002` histórica | avanço contínuo |
| Registros de migration | 11 | 15 | +4 esperados |
| Duplicidades de migration | 0 | 0 | preservado |
| Clientes | 1 total / 1 ativo | 1 total / 1 ativo | preservado |
| Posts | 0 | 0 | preservado |
| Posts arquivados | 0 | 0 | preservado |
| Files | 0 | 0 | preservado |
| Fundo sonoro | ausente | 3 tabelas completas | criado |
| Colunas de identidade do Storage | ausentes | presentes | criadas |
| Retenção/auditoria | ausente | presente | criada |
| Órfãos detectáveis | 0 | 0 | preservado |
| FKs não validadas | 0 | 0 | preservado |
| Constraints inválidas | 0 | 0 | preservado |

A marca de aplicação da `002` histórica permaneceu inalterada; ela não foi reaplicada.

## 12. Segunda execução

- início aproximado: 2026-07-29 às 17:53:30 -03:00;
- mesmo migrador e mesmo destino local;
- duração: 981 ms;
- código de saída: `0`;
- migrations aplicadas: 0;
- entradas informadas como já aplicadas/excluídas: 15;
- `012`–`015` reaplicadas: nenhuma;
- registros duplicados: 0;
- contagens alteradas: nenhuma;
- timestamps de aplicação de `012`–`015`: inalterados;
- resultado final: `Database migrations completed.`.

Dois dumps locais de schema-only foram comparados, um após a primeira execução e outro após a segunda. O `pg_dump 18` gera chaves aleatórias nas linhas de guarda `\restrict`/`\unrestrict`, o que torna o hash bruto diferente. Depois de remover somente essas duas linhas voláteis:

- SHA-256 normalizado após a primeira execução: `30DE94EA81E7492699AD1E60297050D393FF607CC74EE19F7DAEF733AFEED152`;
- SHA-256 normalizado após a segunda execução: `30DE94EA81E7492699AD1E60297050D393FF607CC74EE19F7DAEF733AFEED152`;
- diferenças estruturais normalizadas: 0.

A segunda execução foi um no-op operacional. Isso comprova o comportamento do migrador diante de migrations já registradas, não a idempotência individual de cada arquivo SQL.

## 13. Integridade

Após as duas execuções:

- migrations registradas: 15;
- lacunas estruturais: 0;
- duplicidades de migration: 0;
- Clientes: 1 total, 1 ativo e 0 inativos;
- posts: 0;
- files: 0;
- linhas nas três tabelas de fundo sonoro: 0;
- perda inesperada de linhas: 0;
- FKs não validadas: 0;
- constraints/checks inválidos: 0;
- órfãos detectáveis nas relações antigas: 0;
- órfãos detectáveis nas novas relações: 0;
- advisory locks retidos após cada processo: 0.

O lock foi adquirido e liberado pelo fluxo obrigatório do código e não permaneceu retido após nenhuma execução. A serialização sob contenção concorrente não foi submetida a teste de carga específico nesta microetapa.

## 14. Análise do release step

### 14.1. Comando e ordem

Se o Root Directory do serviço Render for `backend`, o comando apropriado para uma etapa anterior ao start é:

```text
npm run db:migrate
```

Se a execução partir da raiz do repositório, o equivalente é:

```text
cd backend && npm run db:migrate
```

Essa etapa deve ocorrer antes do Start Command. O diretório irmão `database/migrations` precisa estar presente no artefato.

### 14.2. Falhas e startup

- erro de migration produz código de saída diferente de zero;
- a migration que falha sofre rollback;
- migrations anteriores da mesma cadeia podem já ter sido confirmadas, porque a transação é por migration;
- o backend em produção consulta pendências antes de escutar;
- se a cadeia ficar incompleta, o backend novo termina com erro em vez de abrir a API;
- o advisory lock de sessão serializa execuções concorrentes do migrador que usam o mesmo identificador.

### 14.3. Mecanismo recomendado

Usar um Pre-Deploy Command/release step separado e bloqueante é mais adequado que incorporar migrations ao Start Command. Isso evita que cada instância tente migrar durante o startup e permite conferir o resultado antes de disponibilizar o backend.

Variáveis e condições necessárias:

- `DATABASE_URL` do banco publicado;
- ambiente de produção/SSL coerente com a configuração atual;
- dependências do migrador disponíveis;
- diretório `database/migrations` incluído;
- apenas uma etapa de migration oficial antes do start.

Logs a conferir:

- migrations ignoradas por já estarem registradas;
- mensagem explícita de exclusão da `002`;
- `Applied <filename>` para cada migration pendente;
- `Failed to apply <filename>` em falha;
- `Database migrations completed.` no sucesso;
- código de saída da etapa;
- ausência de migrations pendentes antes do startup.

### 14.4. Rollback operacional

Não existem down migrations. Em caso de falha:

1. bloquear o início do backend novo;
2. identificar a primeira migration que falhou e quais anteriores já foram registradas;
3. não editar `schema_migrations` nem reaplicar SQL manualmente;
4. usar o backup lógico pré-migrations e o procedimento de restauração validado em uma operação separada e autorizada;
5. tratar objetos físicos do Storage separadamente, pois não estão incluídos no backup.

### 14.5. Prontidão

O migrador e a cadeia `012`–`015` estão tecnicamente adequados para um release step no snapshot testado. O repositório ainda não está pronto para deploy:

- o Pre-Deploy Command/release step ainda não está configurado no Render;
- a contagem de dados destrutíveis pela `012` deve ser reconfirmada imediatamente antes da execução real, pois produção pode mudar;
- `015` e arquivos relacionados ainda aparecem como não rastreados no worktree;
- permanecem bloqueadores de segurança independentes desta simulação, documentados na auditoria: fronteira administrativa para JWT de Cliente, reset destrutivo, RBAC no backend e exposição de tokens em logs.

## 15. Limpeza

A stack foi parada com Supabase CLI `2.110.0`, usando o workdir específico e `--no-backup`. Não foi usado `--all`.

Resultado:

- código de saída do stop: `0`;
- contêineres da stack restantes: 0;
- volumes da stack restantes: 0;
- redes da stack restantes: 0;
- listeners na porta `55432`: 0;
- imagens oficiais em cache: preservadas;
- workdir externo: preservado inativo como evidência;
- backup e cópias preparadas: preservados.

Recursos preexistentes preservados:

- contêiner `postinder-db`;
- volume `postinder_postgres_data`;
- rede `postinder_default`.

## 16. Limitações

- O snapshot possuía 0 posts, 0 files e 0 posts arquivados; por isso, a parte destrutiva da `012`, cascatas e backfills não foram exercitados com linhas reais.
- Objetos físicos do Supabase Storage não fazem parte do dump, não foram acessados e não foram validados.
- A segurança da `012` vale para o snapshot restaurado; exige novo preflight somente leitura imediatamente antes da execução em produção.
- O advisory lock foi confirmado pelo caminho do código e pela ausência de locks residuais; contenção entre dois deploys concorrentes não foi stress-tested.
- A ausência de checksum significa que o migrador confia no filename registrado.
- Nenhum teste de aplicação/API foi executado nesta microetapa.
- Nenhuma configuração real do Render foi inspecionada ou alterada.
- Nenhuma migration foi executada em produção.

## 17. Bloqueadores

Bloqueador da cadeia `012`–`015` no snapshot testado: **nenhum**.

Bloqueadores do deploy completo que permanecem:

1. correções críticas/altas de autorização, reset de produção, RBAC e logs de tokens;
2. configuração de uma etapa de migration anterior ao Start Command;
3. inclusão intencional de todos os arquivos necessários no futuro commit;
4. preflight final e autorização específica para a execução real;
5. decisão operacional sobre rollback e objetos físicos do Storage.

Nenhum desses itens foi corrigido ou configurado nesta microetapa.

## 18. Veredito

1. **A produção permaneceu inacessível?** Sim.
2. **O clone restaurado correspondia ao estado publicado?** Sim, nas migrations, tabelas, contagens e verificações de integridade validadas.
3. **O migrador real pôde ser usado?** Sim, por `npm run db:migrate` no diretório `backend`.
4. **`012`–`015` foram executadas na ordem correta?** Sim.
5. **Houve perda inesperada de dados?** Não.
6. **O schema final corresponde ao esperado pelo código?** Sim, para todas as estruturas criadas por `013`–`015`.
7. **A segunda execução foi um no-op?** Sim: 0 migrations aplicadas e 0 mudanças estruturais ou de contagem.
8. **O advisory lock funcionou?** Sim no fluxo normal observado: o código o adquiriu antes da cadeia e o liberou no `finally`; 0 locks residuais. Contenção concorrente não foi stress-tested.
9. **A stack foi totalmente removida?** Sim: 0 contêineres, volumes, redes e listeners associados.
10. **Os arquivos de backup permaneceram intactos?** Sim, todos os sete hashes finais correspondem.
11. **A cadeia `012`–`015` está tecnicamente pronta para produção?** Sim para o snapshot testado, condicionada a preflight final e release step bloqueante.
12. **O que ainda impede o deploy?** Os bloqueadores de segurança documentados, a ausência do release step no Render, o estado não rastreado de arquivos necessários e a preparação operacional final.
13. **Qual é a próxima única microetapa?** Corrigir e validar com testes a fronteira de autorização administrativa do backend, começando por impedir JWT de Cliente de acessar qualquer rota administrativa (`C-01`), sem configurar Render nem executar deploy nessa mesma etapa.

## 19. Próxima única microetapa recomendada

Executar uma microetapa isolada para corrigir e testar `C-01`: aplicar negação por padrão de JWT de Cliente em toda a árvore administrativa e comprovar, por matriz de testes, que somente as rotas do portal permanecem acessíveis ao Cliente.

A configuração do release step no Render deve ocorrer posteriormente, em etapa separada e somente após os bloqueadores de segurança pertinentes estarem resolvidos.

---

Nenhuma conexão de produção, migration remota, restauração remota, seed, reset, deploy, acesso a objetos físicos do Storage ou operação Git mutável foi realizada. Código, migrations, manifests, Docker Compose, `package.json`, `package-lock.json`, configurações e relatórios anteriores não foram alterados por esta microetapa. O único novo arquivo no repositório é este relatório.
