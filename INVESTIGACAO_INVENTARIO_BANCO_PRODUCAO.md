# Inventário controlado do banco publicado do Postinder

Data da investigação: 28/07/2026  
Escopo: PostgreSQL publicado, migrations `007`, `012` e `015` e dados potencialmente afetados  
Modo: somente leitura; nenhuma migration, correção, seed, limpeza, reset ou restauração

## 1. Resumo executivo

**Resultado desta microetapa:** inventário SQL integralmente preparado, mas não executado. A única `DATABASE_URL` disponível no workspace foi classificada de forma sanitizada como PostgreSQL local de desenvolvimento: não aponta ao Supabase, `NODE_ENV` não é produção e não há `SUPABASE_URL` configurada nesse arquivo. Também não existe `DATABASE_URL` herdada pelo processo. O painel do Supabase estava acessível apenas na tela de login, sem sessão autenticada. Por isso, o banco publicado não pôde ser confirmado e nenhuma conexão SQL foi aberta.

O repositório espera PostgreSQL com migrations estruturais `001`, `003` a `015`; a migration histórica `002_development_seed.sql` é explicitamente excluída. O principal risco é a sequência `007` → `012`: a primeira transforma em `archived` as postagens não excluídas logicamente de Clientes inativos e a segunda remove definitivamente todas as postagens `archived`, com cascata para anexos e feedbacks. A `015` é necessária porque o código atual consulta incondicionalmente três tabelas de fundo sonoro.

Até que o inventário real e um backup recuperável sejam confirmados, **os dados não podem ser considerados comprovadamente preservados e o deploy permanece bloqueado**.

Nível de confiança:

- alto quanto ao modelo esperado e ao comportamento das migrations, por inspeção direta do repositório;
- inconclusivo quanto ao estado real do banco publicado, pois nenhuma consulta foi executada;
- inconclusivo quanto a backup, retenção e restauração, pois não havia acesso autenticado ao provedor.

## 2. Limites e proteções adotadas

- Proibidos: `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, `ALTER`, migrations, seeds, reset, limpeza, sincronização de schema e restauração.
- Proibidas operações de escrita no Supabase Storage e operações Git mutáveis.
- Nenhuma URL de conexão, usuário, senha, chave, token, e-mail, nome de Cliente ou token de portal será exibido.
- Resultados de dados serão limitados a contagens, agrupamentos, booleanos e metadados estruturais.
- Antes de consultar, a origem local da configuração será classificada sem revelar valores e deverá ser compatível com o projeto publicado esperado.
- Se a conexão for confirmada, a sessão deverá executar `BEGIN; SET TRANSACTION READ ONLY;`, verificar `transaction_read_only = on` e finalizar sempre com `ROLLBACK`.
- A transação read-only é proteção adicional: todas as instruções planejadas também são estruturalmente não destrutivas.
- Consultas dependentes de tabela ou coluna serão executadas somente depois de a introspecção confirmar sua existência.
- Nenhum arquivo ou objeto do Storage será aberto, baixado, alterado ou removido.
- A inspeção sanitizada revelou somente os booleanos/classificações necessários; nenhum valor de `.env` foi impresso.
- Como o alvo disponível era local, ele não foi usado nem mesmo para produzir contagens substitutas: resultados locais não representam produção.
- A tentativa de conferência do painel foi encerrada na tela de autenticação; nenhuma credencial foi solicitada ou transmitida e nenhuma alteração externa foi realizada.

## 3. Modelo esperado pelo repositório

### Migrations e inicialização

O catálogo em `backend/src/shared/database/migrationCatalog.ts` lista arquivos `.sql` em ordem lexicográfica e exclui somente `002_development_seed.sql`. O migrador em `backend/scripts/migrate.ts`:

1. conecta por `DATABASE_URL`;
2. toma advisory lock;
3. cria `schema_migrations(id, filename, applied_at)` se necessário;
4. aplica cada arquivo pendente em uma transação própria;
5. registra somente o nome do arquivo, sem checksum.

O startup em `backend/src/server.ts` apenas lê `schema_migrations`. Em produção, qualquer filename esperado ausente impede o servidor de aceitar conexões; ele não aplica migrations. A documentação define Render com diretório `backend`, build `npm install --include=dev && npm run build` e start `npm run start`, mas a etapa de release/migration ainda é uma pendência operacional.

Ordem estrutural esperada:

1. `001_core_schema.sql`
2. `003_client_portal_tokens.sql`
3. `004_file_sort_order.sql`
4. `005_fix_rejected_post_status.sql`
5. `006_client_last_access.sql`
6. `007_archive_inactive_client_posts.sql`
7. `008_executed_posts_retention.sql`
8. `009_inactive_clients_file_cleanup.sql`
9. `010_client_deactivation_restore_marker.sql`
10. `011_reusable_deleted_emails.sql`
11. `012_remove_legacy_archived_posts.sql`
12. `013_file_storage_identity.sql`
13. `014_storage_retention_audit.sql`
14. `015_post_soundtracks.sql`

### Tabelas e relações relevantes esperadas

| Tabela | Estruturas relevantes | Relações e exclusão |
| --- | --- | --- |
| `users` | papel, permissões, empresa, atividade | e-mail ativo único por índice parcial após `011` |
| `clients` | `is_active`, `last_access_at`, dados operacionais | não possui `deleted_at`; desativação é `is_active=false` |
| `posts` | status, `deleted_at`, datas de submissão/aprovação/execução, marcador de desativação, política de retenção | `client_id → clients` com `ON DELETE CASCADE` |
| `files` | URL, nome, tipo, status, ordem, `bucket`, `storage_path`, MIME, tamanho e auditoria de remoção | `post_id → posts` com `ON DELETE CASCADE` |
| `feedback` | avaliação e texto | Cliente e post; cascata ao excluir |
| `activity_events` | histórico de Cliente/post | Cliente/post usam `ON DELETE SET NULL`; a `012` apaga antes os eventos de posts arquivados |
| `notification_reads` | marcações de leitura | sem FK para post |
| `client_portal_tokens` | hash, expiração, revogação | `client_id → clients` com cascata |
| `post_soundtracks` | modo, mídia de origem, identidade de áudio, aprovação, revisão e soft delete | post em cascata; arquivo de origem com `ON DELETE SET NULL`; um registro ativo por post |
| `post_soundtrack_versions` | snapshot por revisão | trilha e post em cascata |
| `post_soundtrack_decisions` | decisão por revisão | trilha e post em cascata |

Status de post reconhecidos pelo código atual: `draft`, `ready`, `sent`, `pending_approval`, `approved`, `rejected`, `executed`, `scheduled` e `published`. `archived` existe apenas como estado legado de migration e não pertence ao enum atual.

### Papel das migrations críticas

- `007`: não é apenas estrutural. Atualiza toda postagem não excluída de Cliente inativo para `status='archived'` e revoga seus tokens de portal. Uma reaplicação executa novamente os updates sobre dados novos; portanto, não é idempotente no sentido operacional, apesar de convergir parcialmente o status.
- `012`: apaga eventos de posts `archived`, apaga `post_notes` se a tabela existir e remove definitivamente todos os posts `archived`. As FKs em cascata removem `files` e `feedback`. O comentário exige limpeza prévia do Storage por um script destrutivo que não integra o migrador. Uma reaplicação sem novos arquivados seria vazia, mas qualquer novo `archived` seria apagado; não é segura para reaplicação operacional.
- `015`: cria `post_soundtracks`, `post_soundtrack_versions`, `post_soundtrack_decisions`, checks e índices. Não altera posts existentes nem exige backfill; a ausência de trilha é representada pelo não relacionamento. O código atual consulta essas tabelas ao carregar, duplicar, revisar e limpar posts, logo o backend atual não é compatível com banco sem `015`.

Diferenças prováveis em banco antigo: ausência de `last_access_at`, marcadores de execução/desativação, identidade de Storage e auditoria de retenção; e ausência total ou parcial das tabelas de trilha. Dados legados podem conservar URL, mas não `bucket + storage_path`, MIME ou tamanho.

## 4. Plano SQL

Todos os grupos abaixo foram **preparados antes da validação da conexão**. Nenhum grupo foi executado porque o banco publicado não pôde ser confirmado. Consultas dependentes deverão ser puladas se a introspecção mostrar que a tabela ou coluna não existe.

### Proteção da sessão

```sql
BEGIN;
SET TRANSACTION READ ONLY;
SHOW transaction_read_only;
-- executar somente os SELECTs aplicáveis abaixo
ROLLBACK;
```

Condição de continuidade: `SHOW transaction_read_only` deve retornar `on`. Qualquer erro encerra a tentativa com `ROLLBACK`.

### A. Ambiente e versão — preparado

Finalidade: confirmar tecnologia, contexto lógico, schema, horário e schemas relevantes sem credenciais.

```sql
SELECT version() AS postgres_version;

SELECT
  current_database() AS current_database,
  current_schema() AS current_schema,
  current_timestamp AS server_timestamp,
  current_setting('TimeZone') AS server_timezone;

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN ('public', 'auth', 'storage')
ORDER BY schema_name;

SELECT current_schemas(true) AS search_path_schemas;
```

### B. Migrations — preparado

Finalidade: localizar a tabela de controle, conhecer sua estrutura, registros, ordem, duplicidades, lacunas, migrations inesperadas e os estados de `007`, `012` e `015`.

```sql
SELECT to_regclass('public.schema_migrations') IS NOT NULL AS migrations_table_exists;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'schema_migrations'
ORDER BY ordinal_position;

-- Executar as próximas somente se a tabela existir.
SELECT id, filename, applied_at
FROM public.schema_migrations
ORDER BY applied_at NULLS FIRST, id;

SELECT filename, COUNT(*) AS occurrences
FROM public.schema_migrations
GROUP BY filename
HAVING COUNT(*) > 1
ORDER BY filename;

WITH expected(position, filename) AS (
  VALUES
    (1, '001_core_schema.sql'),
    (2, '003_client_portal_tokens.sql'),
    (3, '004_file_sort_order.sql'),
    (4, '005_fix_rejected_post_status.sql'),
    (5, '006_client_last_access.sql'),
    (6, '007_archive_inactive_client_posts.sql'),
    (7, '008_executed_posts_retention.sql'),
    (8, '009_inactive_clients_file_cleanup.sql'),
    (9, '010_client_deactivation_restore_marker.sql'),
    (10, '011_reusable_deleted_emails.sql'),
    (11, '012_remove_legacy_archived_posts.sql'),
    (12, '013_file_storage_identity.sql'),
    (13, '014_storage_retention_audit.sql'),
    (14, '015_post_soundtracks.sql')
)
SELECT e.position, e.filename,
       (sm.filename IS NOT NULL) AS registered
FROM expected e
LEFT JOIN public.schema_migrations sm ON sm.filename = e.filename
ORDER BY e.position;

SELECT
  COUNT(*) FILTER (WHERE filename = '007_archive_inactive_client_posts.sql') > 0 AS migration_007_registered,
  COUNT(*) FILTER (WHERE filename = '012_remove_legacy_archived_posts.sql') > 0 AS migration_012_registered,
  COUNT(*) FILTER (WHERE filename = '015_post_soundtracks.sql') > 0 AS migration_015_registered
FROM public.schema_migrations;

WITH expected(filename) AS (
  VALUES
    ('001_core_schema.sql'),
    ('003_client_portal_tokens.sql'),
    ('004_file_sort_order.sql'),
    ('005_fix_rejected_post_status.sql'),
    ('006_client_last_access.sql'),
    ('007_archive_inactive_client_posts.sql'),
    ('008_executed_posts_retention.sql'),
    ('009_inactive_clients_file_cleanup.sql'),
    ('010_client_deactivation_restore_marker.sql'),
    ('011_reusable_deleted_emails.sql'),
    ('012_remove_legacy_archived_posts.sql'),
    ('013_file_storage_identity.sql'),
    ('014_storage_retention_audit.sql'),
    ('015_post_soundtracks.sql')
)
SELECT sm.filename
FROM public.schema_migrations sm
LEFT JOIN expected e ON e.filename = sm.filename
WHERE e.filename IS NULL
ORDER BY sm.filename;
```

### C. Estrutura do schema — preparado

Finalidade: comparar tabelas, colunas, tipos, nulabilidade, defaults, FKs, checks e índices com o repositório.

```sql
WITH expected(table_name) AS (
  VALUES
    ('users'), ('clients'), ('posts'), ('files'), ('feedback'),
    ('activity_events'), ('notification_reads'), ('client_portal_tokens'),
    ('post_soundtracks'), ('post_soundtrack_versions'),
    ('post_soundtrack_decisions')
)
SELECT e.table_name,
       to_regclass(format('public.%I', e.table_name)) IS NOT NULL AS exists
FROM expected e
ORDER BY e.table_name;

SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'users', 'clients', 'posts', 'files', 'feedback',
    'activity_events', 'notification_reads', 'client_portal_tokens',
    'post_soundtracks', 'post_soundtrack_versions',
    'post_soundtrack_decisions'
  )
ORDER BY table_name, ordinal_position;

SELECT
  c.conrelid::regclass::text AS table_name,
  c.conname AS constraint_name,
  c.contype AS constraint_type,
  c.convalidated AS validated,
  pg_get_constraintdef(c.oid, true) AS definition
FROM pg_constraint c
WHERE c.connamespace = 'public'::regnamespace
  AND c.conrelid::regclass::text IN (
    'users', 'clients', 'posts', 'files', 'feedback',
    'activity_events', 'notification_reads', 'client_portal_tokens',
    'post_soundtracks', 'post_soundtrack_versions',
    'post_soundtrack_decisions'
  )
ORDER BY table_name, constraint_type, constraint_name;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'clients', 'posts', 'files', 'feedback',
    'activity_events', 'notification_reads', 'client_portal_tokens',
    'post_soundtracks', 'post_soundtrack_versions',
    'post_soundtrack_decisions'
  )
ORDER BY tablename, indexname;
```

### D. Clientes — preparado

Finalidade: contar Clientes e identificar grupos afetáveis sem revelar dados pessoais.

```sql
SELECT
  COUNT(*) AS clients_total,
  COUNT(*) FILTER (WHERE is_active IS TRUE) AS clients_active,
  COUNT(*) FILTER (WHERE is_active IS FALSE) AS clients_inactive,
  COUNT(*) FILTER (WHERE is_active IS NULL) AS clients_activity_unknown,
  COUNT(*) FILTER (
    WHERE name IS NULL OR BTRIM(name) = ''
       OR email IS NULL OR BTRIM(email) = ''
       OR password_hash IS NULL OR BTRIM(password_hash) = ''
  ) AS clients_missing_required_identity,
  COUNT(*) FILTER (WHERE company_id IS NULL) AS clients_without_company
FROM public.clients;

SELECT
  COUNT(*) AS inactive_clients_with_posts,
  COUNT(*) FILTER (WHERE affected.live_posts > 0) AS inactive_clients_with_live_posts,
  COALESCE(SUM(affected.all_posts), 0) AS all_posts_of_inactive_clients,
  COALESCE(SUM(affected.live_posts), 0) AS live_posts_of_inactive_clients,
  COALESCE(SUM(affected.archived_posts), 0) AS archived_posts_of_inactive_clients
FROM (
  SELECT c.id,
         COUNT(p.id) AS all_posts,
         COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL) AS live_posts,
         COUNT(p.id) FILTER (WHERE p.status = 'archived') AS archived_posts
  FROM public.clients c
  JOIN public.posts p ON p.client_id = c.id
  WHERE c.is_active IS FALSE
  GROUP BY c.id
) affected;
```

`clients` não possui soft delete no modelo esperado; `is_active=false` é a forma de desativação. Se o schema real tiver `deleted_at`, uma contagem adicional será preparada após a introspecção, sem selecionar identificadores.

### E. Postagens e histórico — preparado

Finalidade: medir estados, soft delete, datas inconsistentes e o histórico ligado a Clientes inativos ou posts arquivados.

```sql
SELECT status,
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE deleted_at IS NULL) AS not_soft_deleted,
       COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted
FROM public.posts
GROUP BY status
ORDER BY status NULLS FIRST;

SELECT
  COUNT(*) AS posts_total,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS posts_soft_deleted,
  COUNT(*) FILTER (WHERE status = 'archived') AS posts_archived,
  COUNT(*) FILTER (WHERE status = 'executed') AS posts_executed,
  COUNT(*) FILTER (WHERE status = 'archived' AND c.is_active IS FALSE)
    AS archived_posts_of_inactive_clients,
  COUNT(*) FILTER (WHERE c.is_active IS FALSE AND p.deleted_at IS NULL)
    AS live_posts_of_inactive_clients
FROM public.posts p
LEFT JOIN public.clients c ON c.id = p.client_id;

SELECT
  COUNT(*) FILTER (WHERE status IS NULL OR BTRIM(status) = '') AS missing_status,
  COUNT(*) FILTER (
    WHERE status NOT IN (
      'draft', 'ready', 'sent', 'pending_approval', 'approved',
      'rejected', 'executed', 'scheduled', 'published', 'archived'
    )
  ) AS unknown_status,
  COUNT(*) FILTER (WHERE status = 'executed' AND executed_at IS NULL)
    AS executed_without_executed_at,
  COUNT(*) FILTER (WHERE status <> 'executed' AND executed_at IS NOT NULL)
    AS non_executed_with_executed_at,
  COUNT(*) FILTER (WHERE status = 'approved' AND approved_at IS NULL)
    AS approved_without_approved_at,
  COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_date IS NULL)
    AS scheduled_without_scheduled_date,
  COUNT(*) FILTER (WHERE files_delete_after IS NOT NULL AND executed_at IS NULL
                    AND COALESCE(archived_by_client_deactivation, false) IS FALSE)
    AS retention_date_without_execution_or_deactivation,
  COUNT(*) FILTER (WHERE archived_by_client_deactivation IS TRUE
                    AND files_delete_after IS NULL)
    AS deactivation_marker_without_cleanup_date
FROM public.posts;

SELECT
  (SELECT COUNT(*) FROM public.activity_events ae
   JOIN public.clients c ON c.id = ae.client_id
   WHERE c.is_active IS FALSE) AS activity_events_of_inactive_clients,
  (SELECT COUNT(*) FROM public.activity_events ae
   JOIN public.posts p ON p.id = ae.post_id
   WHERE p.status = 'archived') AS activity_events_of_archived_posts,
  (SELECT COUNT(*) FROM public.files f
   JOIN public.posts p ON p.id = f.post_id
   JOIN public.clients c ON c.id = p.client_id
   WHERE c.is_active IS FALSE) AS files_of_inactive_clients,
  (SELECT COUNT(*) FROM public.feedback fb
   JOIN public.clients c ON c.id = fb.client_id
   WHERE c.is_active IS FALSE) AS feedback_of_inactive_clients,
  (SELECT COUNT(*) FROM public.feedback fb
   JOIN public.posts p ON p.id = fb.post_id
   WHERE p.status = 'archived') AS feedback_of_archived_posts;
```

Se a coluna `archived_by_client_deactivation` não existir, as expressões que a usam serão puladas e registradas como diferença estrutural.

### F. Anexos e mídias — preparado

Finalidade: medir identidade reconciliável, legado, referências ausentes e duplicação sem acessar o Storage.

```sql
SELECT
  COUNT(*) AS files_total,
  COUNT(*) FILTER (WHERE p.id IS NULL) AS files_without_existing_post,
  COUNT(*) FILTER (WHERE original_name IS NULL OR BTRIM(original_name) = '')
    AS files_without_original_name,
  COUNT(*) FILTER (WHERE url IS NULL OR BTRIM(url) = '')
    AS files_without_url,
  COUNT(*) FILTER (WHERE bucket IS NULL OR BTRIM(bucket) = '')
    AS files_without_bucket,
  COUNT(*) FILTER (WHERE storage_path IS NULL OR BTRIM(storage_path) = '')
    AS files_without_storage_path,
  COUNT(*) FILTER (WHERE mime_type IS NULL OR BTRIM(mime_type) = '')
    AS files_without_mime,
  COUNT(*) FILTER (WHERE size_bytes IS NULL) AS files_without_size,
  COUNT(*) FILTER (WHERE size_bytes < 0) AS files_with_negative_size,
  COUNT(*) FILTER (
    WHERE bucket IS NULL OR BTRIM(bucket) = ''
       OR storage_path IS NULL OR BTRIM(storage_path) = ''
  ) AS files_without_storage_identity,
  COUNT(*) FILTER (
    WHERE storage_deleted_at IS NULL
      AND (bucket IS NULL OR BTRIM(bucket) = ''
        OR storage_path IS NULL OR BTRIM(storage_path) = '')
  ) AS active_objects_not_reconcilable_from_database
FROM public.files f
LEFT JOIN public.posts p ON p.id = f.post_id;

SELECT
  COUNT(*) AS duplicated_identities,
  COALESCE(SUM(reference_count), 0) AS records_sharing_identity
FROM (
  SELECT bucket, storage_path, COUNT(*) AS reference_count
  FROM public.files
  WHERE bucket IS NOT NULL AND BTRIM(bucket) <> ''
    AND storage_path IS NOT NULL AND BTRIM(storage_path) <> ''
  GROUP BY bucket, storage_path
  HAVING COUNT(*) > 1
) duplicates;

SELECT
  COUNT(*) AS duplicated_urls,
  COALESCE(SUM(reference_count), 0) AS records_sharing_url
FROM (
  SELECT url, COUNT(*) AS reference_count
  FROM public.files
  WHERE url IS NOT NULL AND BTRIM(url) <> ''
  GROUP BY url
  HAVING COUNT(*) > 1
) duplicates;
```

Essas consultas identificam apenas órfãos e objetos não reconciliáveis inferíveis pelo banco. Objetos existentes no bucket sem linha no banco exigem inventário separado do Storage e não serão acessados nesta etapa.

### G. Fundo sonoro — preparado

Finalidade: confirmar `015`, compatibilidade de posts antigos e integridade sem consultar conteúdo de áudio.

```sql
SELECT
  to_regclass('public.post_soundtracks') IS NOT NULL AS post_soundtracks_exists,
  to_regclass('public.post_soundtrack_versions') IS NOT NULL AS versions_exists,
  to_regclass('public.post_soundtrack_decisions') IS NOT NULL AS decisions_exists;

-- Executar as próximas somente se as três tabelas existirem com as colunas esperadas.
SELECT
  (SELECT COUNT(*) FROM public.post_soundtracks) AS soundtracks_total,
  (SELECT COUNT(*) FROM public.post_soundtracks WHERE deleted_at IS NULL) AS soundtracks_active,
  (SELECT COUNT(*) FROM public.post_soundtrack_versions) AS soundtrack_versions_total,
  (SELECT COUNT(*) FROM public.post_soundtrack_decisions) AS soundtrack_decisions_total,
  (SELECT COUNT(*) FROM public.posts p
   WHERE NOT EXISTS (
     SELECT 1 FROM public.post_soundtracks ps
     WHERE ps.post_id = p.id AND ps.deleted_at IS NULL
   )) AS posts_without_active_soundtrack;

SELECT
  COUNT(*) FILTER (WHERE p.id IS NULL) AS soundtracks_without_post,
  COUNT(*) FILTER (WHERE ps.source_media_id IS NOT NULL AND f.id IS NULL)
    AS soundtracks_with_missing_source_media,
  COUNT(*) FILTER (WHERE ps.source_media_id IS NOT NULL
                    AND f.post_id IS DISTINCT FROM ps.post_id)
    AS source_media_from_another_post,
  COUNT(*) FILTER (WHERE ps.mode NOT IN ('none', 'embedded', 'uploaded', 'external_reference'))
    AS invalid_mode,
  COUNT(*) FILTER (WHERE ps.approval_status NOT IN ('pending', 'approved', 'adjustment_requested'))
    AS invalid_approval_status,
  COUNT(*) FILTER (WHERE ps.mode = 'embedded' AND ps.source_media_id IS NULL)
    AS embedded_without_source_media,
  COUNT(*) FILTER (WHERE ps.mode = 'uploaded'
                    AND (ps.bucket IS NULL OR ps.storage_path IS NULL
                      OR ps.mime_type IS NULL OR ps.size_bytes IS NULL))
    AS uploaded_without_complete_identity,
  COUNT(*) FILTER (WHERE ps.mode = 'external_reference'
                    AND (ps.external_url IS NULL OR BTRIM(ps.external_url) = ''))
    AS external_reference_without_url,
  COUNT(*) FILTER (WHERE ps.deleted_at IS NULL AND ps.mode = 'none')
    AS active_none_rows,
  COUNT(*) FILTER (WHERE ps.approval_status = 'approved' AND ps.approved_at IS NULL)
    AS approved_without_date,
  COUNT(*) FILTER (WHERE ps.approval_status = 'adjustment_requested'
                    AND (ps.adjustment_comment IS NULL OR BTRIM(ps.adjustment_comment) = ''))
    AS adjustment_without_comment,
  COUNT(*) FILTER (WHERE p.status = 'executed'
                    AND ps.deleted_at IS NULL
                    AND ps.mode <> 'none'
                    AND ps.approval_status <> 'approved')
    AS executed_posts_with_unapproved_soundtrack
FROM public.post_soundtracks ps
LEFT JOIN public.posts p ON p.id = ps.post_id
LEFT JOIN public.files f ON f.id = ps.source_media_id;

SELECT
  COUNT(*) AS posts_with_multiple_active_soundtracks
FROM (
  SELECT post_id
  FROM public.post_soundtracks
  WHERE deleted_at IS NULL
  GROUP BY post_id
  HAVING COUNT(*) > 1
) duplicates;
```

Posts antigos sem linha em `post_soundtracks` são compatibilidade esperada, não inconsistência.

### H. Integridade referencial e pré-condições — preparado

Finalidade: localizar órfãos, FKs ausentes/não validadas, duplicidades que bloqueiam `011` e condições que poderiam impedir `015`.

```sql
SELECT
  c.conrelid::regclass::text AS table_name,
  c.conname,
  c.convalidated,
  pg_get_constraintdef(c.oid, true) AS definition
FROM pg_constraint c
WHERE c.connamespace = 'public'::regnamespace
  AND c.contype = 'f'
  AND c.conrelid::regclass::text IN (
    'posts', 'files', 'feedback', 'activity_events', 'client_portal_tokens',
    'post_soundtracks', 'post_soundtrack_versions', 'post_soundtrack_decisions'
  )
ORDER BY table_name, c.conname;

SELECT
  (SELECT COUNT(*) FROM public.posts p
   LEFT JOIN public.clients c ON c.id = p.client_id
   WHERE c.id IS NULL) AS posts_without_client,
  (SELECT COUNT(*) FROM public.files f
   LEFT JOIN public.posts p ON p.id = f.post_id
   WHERE p.id IS NULL) AS files_without_post,
  (SELECT COUNT(*) FROM public.feedback fb
   LEFT JOIN public.clients c ON c.id = fb.client_id
   WHERE c.id IS NULL) AS feedback_without_client,
  (SELECT COUNT(*) FROM public.feedback fb
   LEFT JOIN public.posts p ON p.id = fb.post_id
   WHERE fb.post_id IS NOT NULL AND p.id IS NULL) AS feedback_without_post,
  (SELECT COUNT(*) FROM public.client_portal_tokens t
   LEFT JOIN public.clients c ON c.id = t.client_id
   WHERE c.id IS NULL) AS portal_tokens_without_client;

SELECT
  (SELECT COUNT(*) FROM (
    SELECT LOWER(email)
    FROM public.clients
    WHERE is_active IS TRUE
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
  ) d) AS duplicate_active_client_emails,
  (SELECT COUNT(*) FROM (
    SELECT LOWER(email)
    FROM public.users
    WHERE is_active IS TRUE
    GROUP BY LOWER(email)
    HAVING COUNT(*) > 1
  ) d) AS duplicate_active_user_emails;

SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('posts', 'id'),
    ('files', 'id'),
    ('post_soundtracks', 'id'),
    ('post_soundtracks', 'post_id'),
    ('post_soundtracks', 'source_media_id'),
    ('post_soundtrack_versions', 'soundtrack_id'),
    ('post_soundtrack_versions', 'post_id'),
    ('post_soundtrack_decisions', 'soundtrack_id'),
    ('post_soundtrack_decisions', 'post_id')
  )
ORDER BY table_name, column_name;

-- Impacto destrutivo potencial da 012 se ainda houver archived.
SELECT
  (SELECT COUNT(*) FROM public.posts WHERE status = 'archived') AS archived_posts,
  (SELECT COUNT(*) FROM public.files f
   JOIN public.posts p ON p.id = f.post_id
   WHERE p.status = 'archived') AS files_cascade_affected,
  (SELECT COUNT(*) FROM public.feedback fb
   JOIN public.posts p ON p.id = fb.post_id
   WHERE p.status = 'archived') AS feedback_cascade_affected,
  (SELECT COUNT(*) FROM public.activity_events ae
   JOIN public.posts p ON p.id = ae.post_id
   WHERE p.status = 'archived') AS activity_events_explicitly_affected;
```

Se `post_notes` existir, será preparada uma contagem isolada de linhas associadas a posts arquivados; se não existir, nenhuma consulta à tabela será feita. Se as tabelas da `015` existirem, também serão comparados `post_id` das versões/decisões com seus pais, sempre por contagem.

### Procedimento manual de execução e devolução

O responsável pelo ambiente pode executar o plano sem revelar segredos:

1. No Render, identificar visualmente qual secret `DATABASE_URL` está associado ao serviço publicado, sem copiar seu conteúdo para o relatório.
2. No Supabase, confirmar que o projeto correspondente é o projeto de produção do Postinder.
3. Abrir um cliente PostgreSQL que mantenha uma única sessão. Não usar um executor que divida silenciosamente o script entre conexões.
4. Executar primeiro `BEGIN; SET TRANSACTION READ ONLY; SHOW transaction_read_only;`.
5. Continuar somente se o resultado for `on`.
6. Executar A, B e C. Usar a estrutura retornada para decidir quais consultas dependentes de D a H são aplicáveis.
7. Executar somente os `SELECTs` compatíveis; erro de tabela/coluna ausente deve ser registrado como evidência, não corrigido.
8. Executar `ROLLBACK;` mesmo se todos os `SELECTs` concluírem.
9. Devolver:
   - versão principal do PostgreSQL, schema e timestamp;
   - linhas de `schema_migrations` contendo apenas `id`, filename e data;
   - metadados de tabelas/colunas/constraints/índices;
   - todas as contagens agregadas de D a H;
   - indicação separada de consultas puladas ou que falharam.
10. Não devolver URL, host, porta, usuário, senha, chaves, tokens, nomes, e-mails, URLs de arquivos ou linhas completas de negócio.

Se o cliente não puder comprovar `transaction_read_only=on`, o procedimento deve ser abortado sem executar A–H.

## 5. Estado das migrations

| Migration | Objetivo | Registrada em produção | Compatibilidade | Risco | Ação futura recomendada |
| --- | --- | --- | --- | --- | --- |
| `007` | Arquivar posts de Clientes inativos e revogar tokens | Não verificada; consulta preparada | Legada; `archived` não integra o enum atual | Crítico se pendente com `012` também pendente | Não aplicar antes de inventário e teste em clone |
| `012` | Remover definitivamente todo post `archived` e histórico relacionado | Não verificada; consulta preparada | Destrutiva e dependente de limpeza externa não automatizada | Crítico | Preservar arquivo histórico; decidir correção nova após clone |
| `015` | Criar o modelo de fundo sonoro | Não verificada; consulta preparada | Obrigatória para o código atual; posts sem trilha são aceitos | Alto para disponibilidade, baixo para dados se aplicada em schema compatível | Validar em clone e executar uma única vez antes do start |

O estado das demais migrations será preenchido a partir de `schema_migrations`. Registro por filename comprova que o migrador marcou a etapa, mas não comprova ausência de drift porque não há checksum.

## 6. Inventário dos dados

| Métrica | Resultado | Estado |
| --- | ---: | --- |
| Clientes totais/ativos/inativos | A verificar | Não consultado |
| Posts por status | A verificar | Não consultado |
| Posts arquivados de Clientes inativos | A verificar | Não consultado |
| Posts excluídos logicamente | A verificar | Não consultado |
| Anexos e arquivos sem identidade | A verificar | Não consultado |
| Trilhas, versões e decisões | A verificar | Não consultado |
| Órfãos e inconsistências | A verificar | Não consultado |

## 7. Risco das migrations `007` e `012`

A `007` altera dados de negócio em massa: para cada Cliente inativo, qualquer post com `deleted_at IS NULL` e status diferente de `archived` passa a `archived`; tokens ativos são revogados. Ela não registra quais posts foram alterados nem distingue arquivamento manual. Se executada novamente, alcança posts criados ou reativados depois.

A `012` remove os eventos vinculados, opcionalmente notas, e depois remove todos os posts `archived`. A exclusão do post aciona cascata de `files` e `feedback`. A identidade física no Storage não é removida pela migration; o script preparatório é separado, destrutivo e também apaga notificações. Assim, a cadeia pode simultaneamente apagar histórico do PostgreSQL e deixar objetos órfãos se o script não for usado, ou remover objetos antes de uma falha transacional se ele for usado.

Migrations antigas já registradas devem permanecer imutáveis para preservar rastreabilidade. A estratégia preliminar é:

- se `007`/`012` já foram aplicadas: não editar nem reaplicar; criar apenas migrations corretivas novas após entender o estado residual;
- se nunca foram aplicadas em produção: impedir a execução automática da cadeia atual e substituir o caminho de upgrade por uma estratégia preservadora, sem falsificar histórico;
- em ambos os casos: validar a decisão e qualquer SQL corretivo em clone restaurado.

As contagens reais de posts, arquivos, feedbacks e eventos afetáveis serão inseridas após o inventário.

## 8. Situação da migration `015`

A `015` cria três tabelas, três FKs para posts/trilhas, uma FK opcional para arquivos, checks de modo/aprovação/revisão/decisão, um índice único parcial para uma trilha ativa por post e índices de histórico e retenção.

Ela não exige backfill: post sem trilha retorna semanticamente `none`. Se as três tabelas ainda não existem e `posts.id`/`files.id` são UUID com chave referenciável, os dados atuais não são transformados. O risco aparece se houver tabelas homônimas parciais ou incompatíveis: `CREATE TABLE IF NOT EXISTS` não completa colunas/constraints ausentes, e os índices seguintes podem falhar.

O backend atual consulta as tabelas em carregamento, duplicação, decisões, exclusões e retenção. Portanto:

- `015` precisa estar concluída antes de o servidor atual aceitar requisições;
- falha da migration deve impedir o start e preservar a versão anterior da aplicação;
- a execução única deve ocorrer em release step serializada pelo advisory lock do migrador, nunca concorrente com o start;
- essa release só pode ser habilitada depois de neutralizar o risco das migrations anteriores pendentes, pois `npm run db:migrate` aplica toda a cadeia.

## 9. Compatibilidade banco versus código

| Diferença a verificar | Classificação preliminar |
| --- | --- |
| Ausência de qualquer tabela/coluna consultada pelo código atual | Bloqueador |
| `015` não registrada e tabelas ausentes | Bloqueador de startup/deploy |
| Registro de migration sem estrutura correspondente | Bloqueador; drift |
| `007`/`012` pendentes com dados de Clientes inativos/arquivados | Bloqueador de segurança dos dados |
| Arquivos sem `bucket + storage_path` | Risco alto para duplicação, exclusão e retenção |
| MIME/tamanho nulos em arquivos antigos | Dado legado esperado; compatibilidade parcial |
| Posts sem trilha | Compatibilidade aceitável |
| Status fora do enum atual, exceto `archived` legado | Risco alto |
| `archived` residual | Risco alto/crítico conforme `012` pendente |
| Datas incompatíveis com status | Risco médio ou alto conforme volume/fluxo |
| Órfãos ou FKs ausentes/não validadas | Risco alto ou bloqueador |

Os resultados reais e suas severidades serão adicionados após a execução segura ou marcados como inconclusivos.

## 10. Backup

Hospedagem esperada pela documentação: PostgreSQL do Supabase. A configuração local disponível não corresponde ao banco publicado e o painel do Supabase exigiu autenticação; portanto, o provedor real não foi confirmado por evidência operacional, apenas pela documentação do projeto.

Disponibilidade de backup, periodicidade, retenção, data do backup mais recente e capacidade de download/restauração: **não verificadas**. Metadados de catálogo SQL não comprovam a existência de um backup recuperável; essa evidência deve vir do painel/API autenticada do provedor ou de um artefato de backup validado.

Evidências que o responsável deve registrar, sem expor segredos:

- nome lógico do ambiente/projeto;
- recurso de backup habilitado ou indisponível;
- periodicidade e retenção mostradas pelo provedor;
- timestamp do backup/ponto de restauração mais recente;
- opções oferecidas: download, PITR ou restauração em projeto separado;
- captura ou anotação operacional sem IDs completos e sem credenciais.

Nenhuma restauração será feita sobre produção. Backup só será considerado recuperável após restauração bem-sucedida em destino isolado e validação de integridade.

## 11. Plano de restauração em clone

Etapa operacional separada, não executada durante este inventário:

1. No provedor, confirmar projeto, plano, política de backup/PITR, retenção e timestamp do ponto escolhido.
2. Criar um projeto/banco PostgreSQL novo, vazio e explicitamente rotulado como clone de auditoria.
3. Gerar credenciais exclusivas do clone; não reutilizar URL, senha ou service role de produção.
4. Bloquear acesso público quando possível e limitar a origem/IP do operador.
5. Não configurar o clone no Render, Vercel, frontend, jobs, webhooks ou Supabase Storage de produção.
6. Restaurar o backup ou dump somente no banco novo, seguindo o mecanismo oficial do provedor.
7. Abrir sessão somente leitura no clone e confirmar banco/schema/horário.
8. Comparar tabelas, constraints, `schema_migrations` e contagens agregadas com a origem.
9. Registrar checksums/manifesto do artefato de backup quando o mecanismo disponibilizar.
10. Criar snapshot adicional do clone antes de testar migrations.
11. Executar as migrations pendentes somente no clone e com integrações externas desativadas.
12. Comparar antes/depois: contagens por status, Clientes inativos, posts, arquivos, feedbacks, eventos, trilhas, órfãos e constraints.
13. Testar o backend contra o clone apenas em processo local/isolado, com Storage falso ou desabilitado e sem tráfego real.
14. Documentar resultado e remover credenciais.
15. Descartar o clone pelo procedimento do provedor somente após retenção de evidências e autorização operacional específica.

Critérios mínimos de sucesso: restauração concluída sem erro; migrations e schema coerentes; contagens essenciais iguais às da origem no mesmo ponto temporal; nenhum tráfego/aplicação externa conectada; e teste das migrations sem perda não planejada.

## 12. Impacto no plano de correções

Dependem deste inventário:

- desenho da migration corretiva que preserve posts/histórico de Clientes inativos;
- decisão de bloquear ou contornar `007`/`012` quando pendentes;
- reconciliação de `bucket + storage_path` para arquivos legados;
- tratamento de status e datas inconsistentes;
- validação da `015` e do release step do Render;
- plano de rollback e critérios de abortar o deploy.

Nenhuma migration antiga deve ser editada e nenhuma correção de dados deve ser desenhada com números presumidos.

## 13. Próxima microetapa

**Executar o plano SQL A–H no banco publicado confirmado, em uma única sessão com `transaction_read_only=on`, e devolver somente os resultados agregados e metadados sanitizados descritos neste relatório.**

## 14. Veredito

1. **Os dados atuais estão preservados?** Inconclusivo; não houve acesso ao banco nem confirmação de backup.
2. **As migrations `007` e `012` já foram aplicadas?** Não verificado; não é possível inferir do repositório.
3. **Elas ainda representam risco?** Sim, risco crítico enquanto o estado e os dados afetáveis forem desconhecidos.
4. **A migration `015` já foi aplicada?** Não verificado.
5. **Há dados que impediriam sua aplicação?** Inconclusivo; em schema íntegro, posts antigos sem trilha não impedem, mas tabelas homônimas parciais podem impedir.
6. **Existe backup recuperável?** Não verificado; não deve ser presumido.
7. **É seguro iniciar as correções?** Apenas correções de código independentes de dados; correções de migrations/dados ainda não.
8. **O deploy continua bloqueado?** Sim.

## 15. Execução — tentativa de 29/07/2026

Esta seção registra a tentativa mais recente e prevalece sobre a descrição operacional anterior quando houver diferença de estado.

- Data e horário: `2026-07-29 00:04:34 -03:00` (`America/Sao_Paulo`).
- Fonte de conexão: exclusivamente a variável temporária `POSTINDER_PROD_DATABASE_URL`.
- Variável temporária: disponível, mas em formato não reconhecido como URL PostgreSQL pelo cliente utilizado.
- Conexão: **não confirmada**. A resolução do destino terminou com o código sanitizado `ENOTFOUND`, antes de autenticação, abertura de sessão ou execução de SQL.
- Proteção somente leitura: **não confirmada**, porque não foi possível alcançar `BEGIN`, `SET TRANSACTION READ ONLY` ou `SHOW transaction_read_only`.
- Ambiente de produção: **não confirmado**; nenhum metadado do servidor chegou a ser lido.
- Grupos A–H executados: **nenhum**.
- Consultas não executadas: todo o plano A–H, porque a conexão não foi estabelecida.
- `ROLLBACK`: **não executável nesta tentativa**, pois nenhuma conexão e nenhuma transação chegaram a existir. Não houve `COMMIT`.
- Conexões paralelas: nenhuma. As tentativas de resolução foram sequenciais e nenhuma abriu uma sessão PostgreSQL.

Nenhuma fonte alternativa de credenciais foi procurada ou usada. Em particular, não houve fallback para `DATABASE_URL`, leitura de `.env`, `.env.local`, histórico do terminal, configurações locais, painel do Supabase, logs ou documentos para obter a conexão.

## 16. Resultados agregados — tentativa de 29/07/2026

| Grupo | Resultado |
| --- | --- |
| Migrations | Não consultadas |
| Clientes totais, ativos, inativos ou excluídos logicamente | Não consultados |
| Posts totais, por status, arquivados, aprovados, executados ou excluídos logicamente | Não consultados |
| Posts vinculados a Clientes inativos | Não consultados |
| Anexos, mídias e duplicidades | Não consultados |
| Feedbacks, eventos, trilhas, versões e decisões | Não consultados |
| Órfãos, nulidades, status desconhecidos e demais inconsistências | Não consultados |

Nenhuma contagem local foi usada como substituta de produção.

## 17. Análise das migrations `007` e `012` — tentativa de 29/07/2026

- Aplicação em produção: **não determinada**.
- Alcance pela cadeia automática: permanece **não determinado para o banco publicado**, porque `schema_migrations` não foi consultada. No repositório, ambas continuam na cadeia estrutural automática e a `002_development_seed.sql` continua excluída pelo catálogo.
- Dados já afetados: **não determinado**.
- Posts, anexos, feedbacks, eventos, notas e demais históricos atualmente em risco: **quantidade não determinada**.
- Estratégia segura recomendada: manter o deploy e qualquer execução automática de migrations bloqueados; corrigir exclusivamente a variável temporária e repetir este mesmo inventário antes de desenhar ou executar qualquer ação sobre migrations.

Não há nova evidência que autorize editar, marcar manualmente, aplicar ou reaplicar `007` ou `012`.

## 18. Análise da migration `015` — tentativa de 29/07/2026

- Registrada em produção: **não determinado**.
- Estruturas completas: **não determinado**.
- Dados impeditivos: **não determinado**.
- Execução isolada: **não autorizada nem avaliada contra produção nesta tentativa**.
- Pré-condição para futuro release step: obter uma conexão válida exclusivamente por `POSTINDER_PROD_DATABASE_URL`, concluir A–H com `transaction_read_only=on`, confirmar o estado real de toda a cadeia anterior e validar backup/rollback operacional antes de qualquer escrita.

## 19. Compatibilidade com o código atual — tentativa de 29/07/2026

A compatibilidade entre produção e o backend atual permanece **inconclusiva**, pois nenhuma tabela, coluna, restrição, índice ou migration registrada pôde ser inspecionada. O modelo esperado pelo repositório continua descrito nas seções anteriores, mas não deve ser tratado como evidência do estado publicado.

## 20. Backup — tentativa de 29/07/2026

- Provedor real do banco: não confirmado nesta execução.
- Tipo de plano: não confirmado.
- Recuperação, exportação ou PITR: não confirmados.
- Data do backup mais recente: não confirmada.
- Retenção: não confirmada.

Nenhum backup foi criado, restaurado ou presumido como recuperável.

## 21. Veredito — tentativa de 29/07/2026

1. **A conexão era realmente de produção?** Não confirmada; nenhuma conexão foi estabelecida.
2. **A sessão permaneceu somente leitura?** Não houve sessão. A proteção não pôde ser confirmada.
3. **Quais migrations estão aplicadas?** Não determinado.
4. **`007` e `012` já foram executadas?** Não determinado.
5. **Existe histórico ainda ameaçado?** Pode existir; quantidade e situação permanecem inconclusivas.
6. **`015` está aplicada?** Não determinado.
7. **Existem dados que impedem `015`?** Não determinado.
8. **O schema é compatível com o backend atual?** Inconclusivo.
9. **Existe backup confirmado?** Não.
10. **O deploy continua bloqueado?** Sim.
11. **Qual é a próxima única microetapa recomendada?** Reconfigurar `POSTINDER_PROD_DATABASE_URL` com uma URL PostgreSQL válida do banco publicado, sem revelar seu conteúdo, e repetir exatamente o plano A–H em uma única transação explicitamente somente leitura.

Nesta tentativa não foi realizada nenhuma escrita no banco, migration, seed, reset, reparo, consulta ou alteração no Supabase Storage, mudança de código, alteração de configuração, backup, restauração ou operação Git mutável. A única alteração persistente foi esta atualização autorizada do relatório.

## 22. Execução — tentativa de 29/07/2026 às 00:31:18 -03:00

Esta é a tentativa mais recente e prevalece sobre as seções 15 a 21.

- Fonte de conexão: exclusivamente a variável temporária `POSTINDER_PROD_DATABASE_URL`.
- Tentativas preliminares sem sessão PostgreSQL: uma foi bloqueada pelo isolamento de rede local (`EACCES`) e outra foi encerrada durante a validação da cadeia TLS. Nenhuma delas autenticou, abriu transação ou executou SQL.
- Conexão PostgreSQL efetivamente estabelecida: uma, sem conexões paralelas.
- Proteção: `BEGIN`, `SET TRANSACTION READ ONLY` e `SHOW transaction_read_only` foram executados nessa ordem.
- Resultado de `transaction_read_only`: **`on`**.
- PostgreSQL: versão `17.6`, 64 bits.
- Banco atual: `postgres`.
- Schema atual: `public`.
- Horário retornado pelo servidor: `2026-07-29 03:31:18.598 UTC`.
- Timezone do servidor: `UTC`.
- Schemas relevantes encontrados: `auth`, `public` e `storage`.
- Search path observado: `pg_catalog`, `public` e `extensions`.
- Tabelas estruturais encontradas: `users`, `clients`, `posts`, `files`, `feedback`, `activity_events`, `notification_reads` e `client_portal_tokens`.
- Estruturas de fundo sonoro não encontradas: `post_soundtracks`, `post_soundtrack_versions` e `post_soundtrack_decisions`.
- Tabela de controle de migrations: encontrada, com 11 registros.
- Estrutura de `schema_migrations`: `id` inteiro não nulo com sequência; `filename` varchar não nulo; `applied_at` timestamp anulável com default de horário atual.
- Característica de desenvolvimento verificada: `002_development_seed.sql` está registrada em `schema_migrations`.
- Classificação do ambiente: **recusado como produção**. Embora a origem dedicada, os schemas do provedor e as tabelas centrais tenham sido encontrados, o registro da seed explicitamente destinada a desenvolvimento viola o critério de ausência de características locais/de desenvolvimento.
- Grupos executados integralmente: **A**.
- Metadados mínimos de B e C usados somente no gate de ambiente: existência e estrutura de `schema_migrations`; leitura sanitizada dos filenames para contar registros e detectar a presença da `002`; e existência das tabelas estruturais esperadas. A sequência completa não foi retida na saída do cliente depois da recusa.
- Grupos B e C completos e grupos D a H: **não executados**, porque o gate de ambiente recusou a conexão antes do inventário.
- `ROLLBACK`: **confirmado** pelo cliente PostgreSQL.
- Transação encerrada e conexão fechada: **confirmadas**.
- `COMMIT`: não executado.

Nenhum hostname, usuário, senha, parâmetro ou fragmento da URL foi consultado para classificação, exibido ou registrado. Nenhuma fonte alternativa de conexão foi procurada ou usada.

## 23. Resultados agregados — tentativa de 29/07/2026 às 00:31:18 -03:00

| Grupo | Resultado |
| --- | --- |
| Migrations | Tabela existente; estrutura confirmada; 11 registros no total; `002_development_seed.sql` registrada. A sequência completa não foi retida na saída do cliente após a recusa do ambiente. |
| Clientes | Não consultados. |
| Postagens e status | Não consultados. |
| Arquivados, aprovados, executados e soft delete | Não consultados. |
| Vínculos com Clientes inativos | Não consultados. |
| Anexos e mídias | Não consultados. |
| Feedbacks, eventos, versões e decisões | Não consultados. |
| Órfãos, duplicidades, nulidades e demais inconsistências | Não consultados. |
| Fundo sonoro | As três tabelas esperadas não existem; dados não foram consultados. |

Nenhuma contagem local ou de desenvolvimento foi usada como substituta de produção.

## 24. Análise das migrations `007` e `012` — tentativa de 29/07/2026 às 00:31:18 -03:00

- Aplicação no banco publicado: **não determinada**, porque o ambiente conectado foi recusado antes da leitura da sequência completa.
- Alcance pela cadeia automática do repositório: ambas continuam na cadeia estrutural automática. O catálogo atual exclui `002_development_seed.sql`, portanto a `002` realmente não integra a cadeia estrutural atual, apesar de estar registrada no banco recusado.
- Dados já afetados em produção: **não determinado**.
- Posts, anexos, feedbacks, eventos ou outros históricos em risco em produção: **quantidade não determinada**.
- Evidência do banco recusado não deve ser promovida a evidência de produção.
- Estratégia segura: manter bloqueadas a cadeia automática e qualquer reaplicação; obter uma conexão que passe pelo gate de produção e repetir A–H. Somente depois disso decidir entre preservar o histórico registrado e criar migrations corretivas novas ou neutralizar migrations pendentes por um caminho de upgrade controlado e testado em clone.

## 25. Análise da migration `015` — tentativa de 29/07/2026 às 00:31:18 -03:00

- Registro individual de `015` no banco publicado: **não determinado**.
- Estruturas no banco conectado e recusado: **ausentes**; nenhuma das três tabelas criadas por `015` existe.
- Schema completo: **não** no banco recusado.
- Dados impeditivos: não consultados, porque o ambiente foi recusado.
- Execução isolada: não avaliada nem autorizada nesta tentativa.
- Compatibilidade de posts antigos: não depende de backfill quando a migration é aplicada sobre um schema íntegro; não foi validada contra produção.
- Pré-condições para futuro release step: conexão de produção inequivocamente confirmada; inventário A–H completo em read-only; estado integral da cadeia conhecido; ausência de estruturas parciais incompatíveis; backup/rollback operacional confirmado; e neutralização prévia do risco de `007`/`012`.

## 26. Compatibilidade com o código atual — tentativa de 29/07/2026 às 00:31:18 -03:00

A compatibilidade de **produção** permanece inconclusiva, pois a conexão foi recusada pelo gate de ambiente.

No banco efetivamente conectado, há uma diferença bloqueadora real: `post_soundtracks`, `post_soundtrack_versions` e `post_soundtrack_decisions` não existem, enquanto o backend atual as consulta em fluxos de carregamento, duplicação, revisão, decisão, exclusão e retenção. Esse banco não é compatível com o backend atual quanto ao fundo sonoro, mas essa conclusão não deve ser atribuída ao ambiente publicado sem uma conexão de produção confirmada.

As tabelas centrais anteriores a `015` e a tabela de migrations existem. A comparação completa de colunas, constraints, índices, órfãos e nulabilidade foi deliberadamente interrompida.

## 27. Backup — tentativa de 29/07/2026 às 00:31:18 -03:00

- Provedor tecnicamente compatível com Supabase: os schemas `auth` e `storage` foram observados, mas o ambiente foi recusado como produção.
- Provedor do banco publicado: não confirmado.
- Tipo de plano: não confirmado.
- Recuperação, exportação ou PITR: não confirmados.
- Data do backup mais recente: não confirmada.
- Retenção: não confirmada.

Nenhum backup foi criado, restaurado ou presumido como recuperável.

## 28. Veredito — tentativa de 29/07/2026 às 00:31:18 -03:00

1. **A conexão era realmente de produção?** Não confirmada. A conexão foi recusada como produção porque `002_development_seed.sql` está registrada na tabela de migrations.
2. **A sessão permaneceu somente leitura?** Sim. `transaction_read_only=on` foi confirmado e nenhuma instrução de escrita foi executada.
3. **Quais migrations estão aplicadas?** Há 11 registros, mas a sequência completa não foi retida na saída do cliente após a recusa do ambiente; o único filename confirmado individualmente nesta tentativa é `002_development_seed.sql`.
4. **`007` e `012` já foram executadas?** Não determinado para produção.
5. **Existe histórico ainda ameaçado?** Pode existir; a quantidade em produção continua inconclusiva.
6. **`015` está aplicada?** Não determinado por registro em produção. No banco recusado, suas três estruturas estão ausentes.
7. **Existem dados que impedem `015`?** Não determinado.
8. **O schema é compatível com o backend atual?** Produção: inconclusivo. Banco recusado: não, por ausência das três tabelas de fundo sonoro.
9. **Existe backup confirmado?** Não.
10. **O deploy continua bloqueado?** Sim.
11. **Qual é a próxima única microetapa recomendada?** Configurar `POSTINDER_PROD_DATABASE_URL` para uma conexão do banco publicado que não apresente características de desenvolvimento e repetir exatamente o plano A–H em uma única transação com `transaction_read_only=on`.

Nesta tentativa não foi realizada nenhuma escrita no banco, migration, seed, reset, reparo, sincronização de schema, consulta ou alteração no Supabase Storage, mudança de código, alteração de configuração, backup, restauração ou operação Git mutável. A única alteração persistente foi esta atualização autorizada do relatório.

## 29. Inventário concluído com gate corrigido — 29/07/2026 às 00:39:00 -03:00

Esta seção prevalece sobre as seções 22 a 28. Os resultados anteriores foram preservados como histórico da investigação.

O gate foi corrigido porque a presença de `002_development_seed.sql` em `schema_migrations` não descaracteriza, isoladamente, o banco efetivamente usado pelo serviço publicado. A origem de `POSTINDER_PROD_DATABASE_URL` foi confirmada externamente pelo responsável como a `DATABASE_URL` copiada diretamente do backend publicado no Render. A `002` passa a ser tratada como característica histórica e possível risco de configuração: o banco publicado pode ter sido inicialmente preparado como demo ou desenvolvimento, mas isso não invalida sua função operacional atual.

### 29.1. Execução e proteção

- Fonte de conexão: exclusivamente `POSTINDER_PROD_DATABASE_URL`; nenhuma outra URL foi procurada ou usada.
- Conexões PostgreSQL abertas nesta execução: uma.
- Conexões paralelas: nenhuma.
- Transação: uma, iniciada com `BEGIN`.
- Proteção explicitamente configurada com `SET TRANSACTION READ ONLY`.
- Resultado de `SHOW transaction_read_only`: **`on`**.
- Grupos executados: **B, C, D, E, F, G e H**.
- Consultas dependentes das colunas de `013`/`014` e das tabelas de `015` foram registradas como não aplicáveis ao schema atual; nenhuma tentativa de correção foi feita.
- Finalização: **`ROLLBACK` confirmado** pelo cliente PostgreSQL.
- Transação encerrada e conexão fechada: **confirmadas**.
- `COMMIT`: não executado.

Metadados sanitizados confirmados:

- PostgreSQL `17.6`, 64 bits;
- banco `postgres`;
- schema atual `public`;
- horário do servidor `2026-07-29 03:39:00.798 UTC`;
- schemas `auth`, `public` e `storage`;
- tabelas centrais `users`, `clients`, `posts`, `files`, `feedback`, `activity_events`, `notification_reads` e `client_portal_tokens`;
- tabela `schema_migrations` existente e estruturalmente utilizável.

Com a proveniência fornecida pelo responsável e esses metadados, a conexão foi aceita como o banco publicado atualmente utilizado pelo backend do Render.

### 29.2. Sequência completa de migrations

Estrutura de `schema_migrations`:

| Coluna | Tipo | Nulável | Default |
| --- | --- | --- | --- |
| `id` | integer | não | sequência de `schema_migrations` |
| `filename` | varchar | não | nenhum |
| `applied_at` | timestamp sem timezone | sim | horário atual |

Sequência registrada, ordenada por aplicação e `id`:

| Ordem | Migration | Aplicada em UTC |
| ---: | --- | --- |
| 1 | `001_core_schema.sql` | `2026-06-05 23:28:54.079` |
| 2 | `002_development_seed.sql` | `2026-06-05 23:28:54.155` |
| 3 | `003_client_portal_tokens.sql` | `2026-06-12 09:13:20.790` |
| 4 | `004_file_sort_order.sql` | `2026-06-12 09:13:20.924` |
| 5 | `005_fix_rejected_post_status.sql` | `2026-06-12 09:13:20.960` |
| 6 | `006_client_last_access.sql` | `2026-06-12 09:13:20.987` |
| 7 | `007_archive_inactive_client_posts.sql` | `2026-06-12 10:57:49.098` |
| 8 | `008_executed_posts_retention.sql` | `2026-06-12 10:57:49.142` |
| 9 | `009_inactive_clients_file_cleanup.sql` | `2026-06-12 10:57:49.181` |
| 10 | `010_client_deactivation_restore_marker.sql` | `2026-06-12 10:57:49.212` |
| 11 | `011_reusable_deleted_emails.sql` | `2026-06-12 20:24:42.741` |

Constatações:

- migrations duplicadas: **0**;
- migrations estruturais inesperadas: **0**;
- sequência estrutural, excluindo a `002`: corresponde exatamente ao prefixo esperado pelo repositório, de `001` até `011`;
- `002_development_seed.sql`: **registrada**, mas explicitamente excluída do catálogo estrutural atual;
- `007`: **registrada/aplicada**;
- `012`: **não registrada/pendente**;
- `013`: **não registrada/pendente**;
- `014`: **não registrada/pendente**;
- `015`: **não registrada/pendente**.

O migrador atual ainda pode alcançar automaticamente `012`, `013`, `014` e `015`, nessa ordem. A `007` já registrada não será reaplicada pela cadeia normal.

### 29.3. Resultados agregados

#### Clientes

| Métrica | Quantidade |
| --- | ---: |
| Total | 1 |
| Ativos | 1 |
| Inativos | 0 |
| Atividade desconhecida | 0 |
| Identidade obrigatória ausente | 0 |
| Sem `company_id` | 1 |
| Excluídos logicamente | conceito/coluna inexistente |
| Clientes inativos com posts | 0 |
| Potencialmente atingidos pela `007` | 0 |

O `company_id` nulo é permitido pelo schema atual e, isoladamente, não foi classificado como corrupção estrutural.

#### Postagens

| Métrica | Quantidade |
| --- | ---: |
| Total | 0 |
| Arquivadas | 0 |
| Aprovadas | 0 |
| Executadas | 0 |
| Excluídas logicamente | 0 |
| Vinculadas a Clientes inativos | 0 |
| Candidatas atuais à `007` | 0 |
| Candidatas atuais à `012` | 0 |

Não há agrupamentos por status porque a tabela está vazia.

Inconsistências de status e datas:

| Verificação | Quantidade |
| --- | ---: |
| Status ausente | 0 |
| Status desconhecido | 0 |
| Executada sem `executed_at` | 0 |
| Não executada com `executed_at` | 0 |
| Aprovada sem `approved_at` | 0 |
| Agendada sem `scheduled_date` | 0 |
| Retenção sem execução/desativação | 0 |
| Marcador de desativação sem data de limpeza | 0 |

#### Dependências históricas e impacto destrutivo

| Relação | Vinculada a posts de Clientes inativos | Vinculada a posts arquivados |
| --- | ---: | ---: |
| Anexos | 0 | 0 |
| Feedbacks | 0 | 0 |
| Eventos de atividade | 0 | 0 |

- tokens ativos que seriam revogados pela `007`: **0**;
- `post_notes`: tabela ausente;
- anexos que seriam apagados em cascata pela `012`: **0**;
- feedbacks que seriam apagados em cascata pela `012`: **0**;
- eventos que a `012` apagaria explicitamente: **0**;
- trilhas, versões ou decisões atingíveis por cascata: não existem no schema atual.

Não existe histórico PostgreSQL atualmente ameaçado pela execução da `012`. Essa conclusão vale para o snapshot consultado e não afirma nada sobre objetos do Storage, que não foram acessados.

#### Anexos e mídias

| Métrica disponível no schema atual | Quantidade |
| --- | ---: |
| Total | 0 |
| Sem postagem válida | 0 |
| Sem nome original | 0 |
| Sem URL | 0 |
| Grupos com URL duplicada | 0 |
| Registros compartilhando URL duplicada | 0 |

As colunas `bucket`, `storage_path`, `mime_type`, `size_bytes`, `storage_deleted_at` e `storage_delete_error` ainda não existem. Por isso, as contagens dependentes de identidade de Storage, MIME, tamanho e auditoria não são aplicáveis ao schema atual. Essa ausência corresponde às migrations pendentes `013` e `014`; não houve consulta aos objetos reais do Supabase Storage.

#### Integridade

- posts sem Cliente: **0**;
- anexos sem post: **0**;
- feedbacks sem Cliente: **0**;
- feedbacks sem post válido: **0**;
- tokens de portal sem Cliente: **0**;
- grupos de e-mail ativo duplicado entre Clientes: **0**;
- grupos de e-mail ativo duplicado entre usuários: **0**;
- FKs não validadas: **0**;
- todas as sete FKs centrais encontradas estão validadas e têm as ações esperadas de cascata ou `SET NULL`;
- constraints de status em `posts`: não existem, coerente com as migrations atuais, que mantêm esse domínio no código;
- órfãos ou duplicidades estruturalmente incompatíveis encontrados: **0**.

### 29.4. Análise de `007` e `012`

`007_archive_inactive_client_posts.sql` foi aplicada em `2026-06-12 10:57:49.098 UTC`. Portanto:

- ela não está pendente e não será executada novamente pelo migrador normal;
- não é possível reconstruir apenas pelo estado atual quantos registros ela alterou na data histórica da aplicação;
- hoje não existem Clientes inativos, posts candidatos, anexos, feedbacks, eventos ou tokens ativos que seriam atingidos por uma reaplicação equivalente.

`012_remove_legacy_archived_posts.sql` não foi aplicada e continua alcançável pela cadeia automática. No snapshot atual:

- posts `archived`: **0**;
- anexos em cascata: **0**;
- feedbacks em cascata: **0**;
- eventos explicitamente removíveis: **0**;
- `post_notes`: tabela ausente.

Assim, não há linhas PostgreSQL atualmente expostas à parte destrutiva da `012`. Como `007` já está registrada, a cadeia automática não criará novos `archived` por meio dela antes de executar `012`.

Estratégia segura recomendada: não editar nem reaplicar `007`; manter seu registro histórico. Aplicar `012` somente dentro de um release step serializado e após confirmar backup/recuperação, registrando novamente as contagens imediatamente antes da execução, pois o estado pode mudar entre este inventário e o release.

### 29.5. Análise de `015`

- registro em `schema_migrations`: ausente;
- `post_soundtracks`: ausente;
- `post_soundtrack_versions`: ausente;
- `post_soundtrack_decisions`: ausente;
- estruturas homônimas parciais: nenhuma;
- `posts.id`: UUID;
- `files.id`: UUID;
- `gen_random_uuid()`: disponível;
- necessidade de backfill de posts existentes: não;
- posts existentes sem trilha: 0;
- bloqueador conhecido nos dados atuais: **nenhum**.

A ausência de `015` é esperada para a versão atualmente publicada e não constitui erro desse ambiente. Para a versão local futura, `015` é uma migration pendente obrigatória.

Tecnicamente, `015` pode criar suas estruturas sobre o schema atual sem transformação de dados. Operacionalmente, o migrador do repositório não a executa isoladamente: ele alcançará primeiro `012`, `013` e `014`. Portanto, o futuro release deve validar e executar a cadeia pendente completa em ordem, nunca apenas iniciar o backend novo contra o schema atual.

### 29.6. Compatibilidade entre banco e código

#### Versão atualmente publicada

O banco possui a sequência estrutural contínua de `001` a `011`, sem lacunas, duplicidades, migrations estruturais inesperadas ou drift detectado nessa faixa. As tabelas centrais, FKs, colunas e índices esperados até `011` estão presentes. Isso é compatível com a versão atualmente publicada, que ainda não inclui o fundo sonoro.

Essa compatibilidade é uma conclusão operacional baseada na proveniência informada para a URL, na sequência registrada e no schema observado; o binário do Render não foi alterado nem inspecionado nesta etapa.

#### Versão local futura

Diferenças esperadas, porque ainda não foram publicadas:

- `012` pendente, sem alteração estrutural, mas com limpeza histórica destrutiva;
- `013` pendente: faltam `files.bucket`, `files.storage_path`, `files.mime_type`, `files.size_bytes` e `idx_files_storage_identity`;
- `014` pendente: faltam `posts.files_retention_policy`, `files.storage_deleted_at`, `files.storage_delete_error`, o check de política de retenção e `idx_files_storage_retention_pending`;
- `015` pendente: faltam as três tabelas, checks, FKs e índices de fundo sonoro.

Inconsistências reais encontradas no banco atual:

- nenhuma FK inválida ou não validada;
- nenhum órfão;
- nenhuma duplicidade ativa incompatível;
- nenhum status desconhecido;
- nenhum dado de postagem, anexo ou histórico inconsistente;
- a `002` registrada é uma característica histórica e risco de configuração, não drift impeditivo para o migrador atual, que a exclui do catálogo estrutural.

Bloqueadores para publicar o backend local futuro:

1. migrations `012` a `015` ainda não aplicadas;
2. ausência de backup/recuperação confirmada;
3. necessidade de um release step serializado que aplique a cadeia antes de iniciar o backend novo.

### 29.7. Backup e situação do deploy

- Provedor: compatível e confirmado por metadados como Supabase; a URL foi fornecida externamente como a configuração do backend publicado no Render.
- Tipo de plano: não confirmado.
- Backup, exportação ou PITR: não confirmados.
- Data do backup mais recente: não confirmada.
- Retenção: não confirmada.

Nenhum backup foi criado, restaurado ou considerado recuperável nesta execução.

O serviço atualmente publicado permanece compatível com o banco atual. O deploy da versão local futura continua **bloqueado** até que haja evidência de recuperação e um release step seguro para `012` a `015`.

### 29.8. Veredito atualizado

1. **A conexão é o banco publicado?** Sim, conforme a proveniência fornecida pelo responsável e os metadados confirmados.
2. **A sessão permaneceu somente leitura?** Sim; `transaction_read_only=on`.
3. **O `ROLLBACK` foi executado?** Sim, confirmado; não houve `COMMIT`.
4. **Quais migrations estão aplicadas?** `001`, a histórica `002`, e `003` a `011`.
5. **`007` foi executada?** Sim.
6. **`012` foi executada?** Não; está pendente e alcançável pela cadeia automática.
7. **Existe histórico atualmente ameaçado por `012`?** Não no PostgreSQL: 0 posts arquivados e 0 dependências relacionadas.
8. **`015` está aplicada?** Não; sua ausência é esperada para a versão publicada.
9. **Existem dados que impedem `015`?** Nenhum bloqueador conhecido.
10. **O banco é compatível com a versão publicada?** Sim, para o schema contínuo até `011`.
11. **O banco está pronto para iniciar diretamente a versão local futura?** Não; faltam `012` a `015`.
12. **Existe backup confirmado?** Não.
13. **O deploy futuro continua bloqueado?** Sim.
14. **Próxima única microetapa recomendada:** confirmar no provedor a existência, retenção e ponto mais recente de um backup/PITR recuperável do banco publicado, sem executar migrations.

Nenhuma correção foi implementada. Não houve escrita no banco, migration, seed, reset, reparo, sincronização de schema, acesso ou alteração no Supabase Storage, mudança de código, alteração de configuração, backup, restauração ou operação Git mutável. A única alteração persistente foi esta atualização autorizada do relatório.
