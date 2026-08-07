# Investigação da restauração do backup lógico do Postinder

## 1. Objetivo

Testar a restauração fiel de `roles.sql`, `schema.sql` e `data.sql` em um PostgreSQL 17 local, isolado e descartável, sem conexão ou alteração em produção, sem modificar os dumps e sem executar migrations.

**Resultado desta tentativa:** bloqueada antes da criação do container porque a imagem obrigatória `postgres:17-alpine` não está disponível localmente e conexões externas, inclusive um pull de registry, não estavam autorizadas.

## 2. Data e horário

- Data: 2026-07-29.
- Gate final e hashes finais: 16:56:35 -03:00.

## 3. Proteção contra conexão remota

- `POSTINDER_PROD_DATABASE_URL`: confirmada como ausente antes de qualquer outra operação.
- `DATABASE_URL`: não utilizada.
- Arquivos `.env`, Render, Supabase, histórico do terminal e arquivos de configuração: não consultados para localizar conexões.
- Hostname remoto: nenhum utilizado.
- Conexão externa: nenhuma realizada.
- Banco publicado: não acessado nem alterado.

## 4. Hashes iniciais

Pasta original: `C:\Users\Murilo\Backups\Postinder\2026-07-29_16-06-06`.

| Arquivo | SHA-256 esperado | SHA-256 inicial | Resultado |
| --- | --- | --- | --- |
| `roles.sql` | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | Idêntico |
| `schema.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Idêntico |
| `data.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Idêntico |

O teste foi interrompido no gate seguinte, sem alteração ou cópia modificada dos dumps.

## 5. Ambiente Docker

| Verificação | Resultado |
| --- | --- |
| Docker client | `29.6.2` |
| Docker server | `29.6.2` |
| Imagem obrigatória | `postgres:17-alpine` ausente localmente |
| Nome pretendido | `postinder-restore-test`, disponível |
| Porta pretendida | `127.0.0.1:55432`, livre |
| Container criado | Não |
| Volume persistente criado | Não |
| Docker Compose do Postinder utilizado | Não |

Não foi feito `docker pull`, pois isso exigiria conexão externa com um registry. A imagem local `postgres:16-alpine` não foi usada por ser incompatível com o requisito explícito de PostgreSQL 17.

## 6. Imagem e versão do PostgreSQL

- Imagem exigida: `postgres:17-alpine`.
- Disponibilidade local: ausente.
- Versão efetiva do servidor PostgreSQL de teste: não aplicável, pois o container não foi criado.

## 7. Destino local

O destino planejado era exclusivamente:

- hostname: `127.0.0.1`;
- porta: `55432`;
- banco: `postinder_restore_test`;
- container: `postinder-restore-test`;
- imagem: `postgres:17-alpine`;
- senha: temporária, local e não persistida.

Esse destino não chegou a ser criado ou conectado. Portanto, não foi possível confirmar versão, banco vazio ou ausência inicial das tabelas do Postinder.

## 8. Comando lógico de restauração

A execução planejada, mas não iniciada, era equivalente a:

```text
psql
  --single-transaction
  --variable ON_ERROR_STOP=1
  --file /backup/roles.sql
  --file /backup/schema.sql
  --command "SET session_replication_role = replica"
  --file /backup/data.sql
  --dbname "host=127.0.0.1 port=55432 dbname=postinder_restore_test user=<administrador-local>"
```

A senha local não seria incluída no comando, no relatório ou em arquivo.

## 9. Resultado da restauração

**Não executada.** Nenhuma sessão `psql` foi aberta e nenhuma transação de restauração foi iniciada.

## 10. Primeiro erro relevante

Gate ambiental: a imagem `postgres:17-alpine` não existe no cache local do Docker.

Classificação: **outro — artefato Docker local obrigatório ausente**.

Não houve erro SQL, de role, extensão, ownership, permissão, versão ou estrutura do dump porque a restauração não chegou a começar.

## 11. Rollback

Não aplicável. Como nenhuma transação foi iniciada e nenhum banco de teste foi criado, não havia estado parcial a reverter.

## 12. Validações executadas

- variável de produção ausente;
- hashes iniciais dos três arquivos idênticos aos esperados;
- Docker client/server operacional;
- imagem obrigatória consultada somente no cache local;
- nome exclusivo disponível;
- porta local `55432` livre;
- inexistência do container após o gate;
- hashes finais recalculados;
- porta local ainda livre.

Não foram executadas consultas SQL, validações de tabelas, contagens, FKs ou órfãos.

## 13. Comparação com o inventário de produção

Referência esperada:

- `schema_migrations` com `001`, `002` histórica e `003` a `011`;
- ausência de `012`, `013`, `014` e `015`;
- tabelas centrais `users`, `clients`, `posts`, `files`, `feedback`, `activity_events`, `notification_reads` e `client_portal_tokens`;
- 1 Cliente total e ativo;
- 0 Clientes inativos;
- 0 posts;
- 0 files;
- ausência das três tabelas de fundo sonoro;
- 0 FKs não validadas;
- 0 órfãos detectáveis.

Comparação efetiva: não realizada, pois não houve banco restaurado.

## 14. Hashes finais

| Arquivo | SHA-256 final | Igual ao inicial |
| --- | --- | --- |
| `roles.sql` | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | Sim |
| `schema.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Sim |
| `data.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Sim |

## 15. Limpeza

- Container `postinder-restore-test`: confirmado ausente.
- Container preexistente removido: nenhum.
- Volume persistente criado: nenhum.
- Porta `55432`: confirmada livre.
- Arquivos de backup: preservados.
- Relatórios existentes: preservados.

## 16. Alterações no repositório

O `git status` inicial foi registrado e já continha alterações rastreadas e não rastreadas do usuário. Nenhuma delas foi modificada, descartada ou submetida a operação Git mutável.

A única nova escrita autorizada no repositório nesta microetapa é `INVESTIGACAO_RESTAURACAO_BACKUP.md`.

## 17. Limitações

- A imagem PostgreSQL 17 exigida não estava disponível localmente.
- A proibição de conexão externa impediu baixar a imagem oficial.
- O destino local não foi criado.
- A transação de restauração não foi executada.
- Contagens, migrations, tabelas, FKs e órfãos não foram validados no destino.
- A restaurabilidade do backup permanece não comprovada.

## 18. Veredito

1. **A variável de produção estava ausente?** Sim.
2. **O destino era inequivocamente local?** Nenhum destino chegou a existir; o único destino planejado era local em `127.0.0.1:55432`.
3. **Os hashes iniciais correspondiam?** Sim.
4. **A restauração foi concluída em uma única transação?** Não; não foi iniciada.
5. **Houve erro?** Houve bloqueio ambiental antes da restauração: imagem local obrigatória ausente.
6. **As contagens restauradas correspondem ao inventário?** Não verificável; não houve restauração.
7. **Os hashes finais permaneceram iguais?** Sim.
8. **O container foi removido?** Nenhum container foi criado; sua ausência foi confirmada.
9. **O banco publicado foi acessado ou alterado?** Não.
10. **Alguma migration foi executada?** Não.
11. **O backup pode ser considerado restaurável?** Ainda não; a restaurabilidade permanece não comprovada.
12. **Qual é a próxima única microetapa?** Disponibilizar localmente a imagem oficial `postgres:17-alpine`, mediante autorização separada para um `docker pull` ou por importação offline confiável, e repetir esta mesma restauração fiel.

## 19. Próxima única microetapa recomendada

Disponibilizar no Docker local a imagem oficial `postgres:17-alpine`. Se for usado `docker pull`, a conexão externa com o registry deve ser autorizada explicitamente em uma etapa separada. Não executar migrations nem alterar os dumps.

---

## 20. Tentativa prevalente após autorização limitada — 2026-07-29

Esta seção prevalece sobre o bloqueio registrado nas seções 1 a 19. O histórico anterior foi preservado.

### 20.1. Autorização e proteção de produção

Foi autorizada exclusivamente a conexão externa necessária para:

```text
docker pull postgres:17-alpine
```

Nenhuma outra conexão externa foi realizada.

- `POSTINDER_PROD_DATABASE_URL`: ausente antes da execução.
- Render, Supabase, banco publicado e Storage: não acessados.
- `DATABASE_URL`: não utilizada.
- Frontend e backend do Postinder: não iniciados nem conectados.
- Migrations: nenhuma executada.

### 20.2. Docker e imagem oficial

- Docker client: `29.6.2`.
- Docker server: `29.6.2`.
- Pull: concluído com sucesso a partir de `library/postgres`.
- Tag local: `postgres:17-alpine`.
- ID: `sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193`.
- Digest: `postgres@sha256:742f40ea20b9ff2ff31db5458d127452988a2164df9e17441e191f3b72252193`.
- Arquitetura: `amd64`.
- Sistema operacional: `linux`.
- Tamanho: 117.165.949 bytes.
- Data de criação da imagem: `2026-07-07T17:46:32.727573082Z`.
- Origem oficial confirmada: `docker.io/library/postgres`.

A imagem foi preservada no cache local após o teste.

### 20.3. Hashes iniciais da tentativa prevalente

| Arquivo | SHA-256 | Resultado |
| --- | --- | --- |
| `roles.sql` | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | Idêntico ao esperado |
| `schema.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Idêntico ao esperado |
| `data.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Idêntico ao esperado |

Os arquivos originais foram montados em `/backup` com bind read-only. Nenhum dump foi alterado ou copiado para uma versão modificada.

### 20.4. Container e destino local

Container efetivo da restauração:

- nome: `postinder-restore-test`;
- ID: `8f8d8cab05f346ca3557927fd12256828168742348c3da4cd134605de29b246c`;
- imagem: `postgres:17-alpine`;
- PostgreSQL: `17.10`;
- host publicado: `127.0.0.1`;
- porta local: `55432`;
- banco: `postinder_restore_test`;
- usuário: administrador PostgreSQL local;
- senha: temporária, não exibida e não persistida em arquivo;
- estado antes da restauração: saudável;
- tabelas públicas antes da restauração: 0;
- tabelas centrais do Postinder antes da restauração: 0.

Proteção de armazenamento:

- dumps: bind read-only em `/backup`;
- dados PostgreSQL: `tmpfs` em `/var/lib/postgresql/data`;
- volume Docker: nenhum;
- Docker Compose: não utilizado;
- rede do Postinder: não utilizada.

Durante a preparação, um primeiro container efêmero saiu antes de inicializar o PostgreSQL porque o gerador de senha usado inicialmente não era compatível com a API local do PowerShell. Esse container, criado exclusivamente nesta tentativa, não abriu sessão `psql`, não restaurou dados, não criou volume e foi removido. O container efetivo acima foi então criado com senha criptograficamente aleatória por uma API compatível. Isso ocorreu antes da única tentativa de restauração.

### 20.5. Comando lógico executado

A única tentativa de restauração foi equivalente a:

```text
psql
  --single-transaction
  --variable ON_ERROR_STOP=1
  --file roles.sql
  --file schema.sql
  --command "SET session_replication_role = replica"
  --file data.sql
  --dbname "host=127.0.0.1 port=55432 dbname=postinder_restore_test user=<administrador-local>"
```

A senha foi fornecida somente por variável temporária local e não foi incluída no comando registrado.

### 20.6. Resultado e primeiro erro

- Sessões de restauração executadas: 1.
- Transação: única, com `--single-transaction`.
- Parada no primeiro erro: habilitada por `ON_ERROR_STOP=1`.
- Resultado: falha.
- Código de saída do `psql`: 3.
- Primeiro erro relevante: `role "anon" does not exist`.
- Classificação: **role ausente / dependência do ambiente Supabase**.

Nenhuma linha dos dumps foi comentada ou modificada. Nenhuma role, extensão ou permissão foi criada manualmente. Não houve segunda tentativa nem correção automática.

### 20.7. Confirmação de rollback

Após a falha, consultas exclusivamente locais confirmaram:

- tabelas públicas: 0;
- tabelas centrais do Postinder: 0;
- `schema_migrations`: ausente;
- roles Supabase verificadas: 0 presentes.

Essas evidências, juntamente com `--single-transaction` e `ON_ERROR_STOP=1`, confirmam que não permaneceu restauração parcial. O rollback foi integral.

### 20.8. Validações e comparação com produção

A restauração não chegou ao schema nem aos dados. Portanto:

- migrations `001` a `011`: não restauradas;
- migrations `012` a `015`: não executadas nem restauradas;
- tabelas centrais: não restauradas;
- Cliente esperado: não restaurado;
- posts e files: não restaurados;
- tabelas de fundo sonoro: ausentes;
- FKs e órfãos: não aplicáveis em banco vazio.

As contagens restauradas não puderam ser comparadas ao inventário porque a transação foi revertida. O banco local após o rollback permaneceu vazio, enquanto o inventário de produção registra 1 Cliente ativo, 0 posts e 0 files.

### 20.9. Hashes finais

| Arquivo | SHA-256 final | Igual ao inicial |
| --- | --- | --- |
| `roles.sql` | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | Sim |
| `schema.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Sim |
| `data.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Sim |

### 20.10. Limpeza

Limpeza concluída em 2026-07-29 às 17:06:13 -03:00:

- container `postinder-restore-test`: parado e removido;
- containers preexistentes: preservados;
- volumes persistentes criados: 0;
- porta `55432`: liberada;
- imagem `postgres:17-alpine`: preservada;
- arquivos originais de backup: preservados.

### 20.11. Repositório

Nenhuma operação Git mutável foi executada. Código, migrations, documentos oficiais, manifests, configurações, `package.json` e `package-lock.json` não foram alterados por esta tentativa.

A única escrita autorizada dentro do repositório foi a atualização de `INVESTIGACAO_RESTAURACAO_BACKUP.md`.

### 20.12. Veredito prevalente

1. **A imagem foi baixada?** Sim.
2. **O destino era exclusivamente local?** Sim, `127.0.0.1:55432`.
3. **Os hashes iniciais correspondiam?** Sim.
4. **A restauração foi concluída?** Não.
5. **Primeiro erro:** `role "anon" does not exist`.
6. **Houve rollback integral?** Sim.
7. **As contagens restauradas correspondem ao inventário?** Não verificável; a transação foi revertida e o banco permaneceu vazio.
8. **Os hashes finais permaneceram iguais?** Sim.
9. **O container foi removido?** Sim.
10. **Algum volume persistente foi criado?** Não.
11. **Produção foi acessada ou alterada?** Não.
12. **Alguma migration foi executada?** Não.
13. **O backup pode ser considerado restaurável?** Ainda não no PostgreSQL oficial puro; a tentativa comprovou uma dependência de roles do ambiente Supabase, não corrupção estrutural dos dumps.

### 20.13. Próxima única microetapa recomendada

Definir e autorizar explicitamente um ambiente local compatível com as roles do Supabase, preservando os dumps originais, e repetir uma única restauração transacional nesse ambiente. Não criar roles manualmente nem modificar os dumps sem uma decisão operacional separada e documentada.

---

## 21. Tentativa prevalente em stack Supabase local — 2026-07-29

Esta seção prevalece sobre as tentativas anteriores. Todo o histórico foi preservado.

### 21.1. Proteção contra produção

- `POSTINDER_PROD_DATABASE_URL`: ausente antes de qualquer operação.
- Render, Supabase remoto, banco publicado e Storage remoto: não acessados.
- Arquivos `.env`, histórico do terminal, logs antigos e configurações de conexão do backend: não consultados.
- `supabase login`, `supabase link`, `db pull`, `db push`, `db dump` e funções remotas: não executados.
- A única conexão externa autorizada ocorreu dentro de `supabase start` para obter imagens oficiais.
- Nenhuma migration pendente foi executada.

### 21.2. Diretório e configuração temporários

- Workdir externo: `C:\Users\Murilo\Temp\PostinderSupabaseRestore\2026-07-29_17-13-42`.
- Diretório dentro do repositório: nenhum.
- `project_id`: `postinder-restore-validation-20260729-171342`.
- Porta do banco: `55432`.
- Porta shadow: `55433`.
- Outras portas reservadas: `55421`, `55423`, `55424`, `55427`, `55429` e `55483`.
- PostgreSQL major configurado: 17.

O `config.toml` temporário foi o único arquivo de configuração alterado e permaneceu fora do Postinder.

### 21.3. CLI, imagens e serviços

- Supabase CLI: `2.110.0`, usada exclusivamente por `npx`.
- Docker client/server: `29.6.2` / `29.6.2`.
- `@latest`: não utilizado.
- Instalação global ou dependência do projeto: nenhuma.

Serviço efetivamente iniciado:

- `supabase_db_postinder-restore-validation-20260729-17`;
- imagem `public.ecr.aws/supabase/postgres:17.6.1.143`;
- image ID `sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453`;
- estado saudável.

Serviços excluídos do start:

- `gotrue`;
- `realtime`;
- `storage-api`;
- `imgproxy`;
- `kong`;
- `mailpit`;
- `postgrest`;
- `postgres-meta`;
- `studio`;
- `edge-runtime`;
- `logflare`;
- `vector`;
- `supavisor`.

Imagens oficiais tagueadas pela CLI durante a inicialização e preservadas no cache:

| Imagem | ID |
| --- | --- |
| `public.ecr.aws/supabase/gotrue:v2.193.0` | `sha256:ac6d4b1e961ae5a1a24d283967485f8195b767a8476e1044959d7a250c2da3f0` |
| `public.ecr.aws/supabase/realtime:v2.113.4` | `sha256:d6a91caf3bd58222530a666a64ce560a872f9406ab69e9576d58e1bc7e53bb14` |
| `public.ecr.aws/supabase/storage-api:v1.66.4` | `sha256:ead6d49b9873d65a030c6c44b46676f4276b234becd6d7819c254351b5400d95` |

A imagem PostgreSQL da stack já estava disponível no cache local por uso anterior da mesma CLI e foi reutilizada.

### 21.4. Destino local confirmado

O destino retornado pela CLI foi validado internamente sem exibir URL, senha, JWT ou chaves:

- host: `127.0.0.1`;
- porta: `55432`;
- banco: `postgres`;
- PostgreSQL: `17.6`;
- container: saudável;
- tabelas públicas do Postinder antes da restauração: 0.

Roles confirmadas:

- `anon`;
- `authenticated`;
- `service_role`;
- `authenticator`;
- `supabase_admin`.

Schemas confirmados:

- `public`;
- `auth`;
- `storage`;
- `extensions`.

O container Docker publicou a porta configurada pela stack local. Todas as conexões efetivamente realizadas por esta investigação usaram explicitamente `127.0.0.1:55432`.

Limitação de exposição: o `docker inspect` registrou o bind da porta como `0.0.0.0:55432`, comportamento padrão da CLI. Nenhum cliente externo se conectou e nenhuma conexão externa foi iniciada, mas a restrição da porta exclusivamente à interface loopback não ficou comprovada.

### 21.5. Hashes iniciais

| Arquivo | SHA-256 | Resultado |
| --- | --- | --- |
| `roles.sql` | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | Idêntico |
| `schema.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Idêntico |
| `data.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Idêntico |

Nenhum arquivo foi alterado ou copiado para uma versão modificada.

### 21.6. Comando lógico executado

A única tentativa foi equivalente a:

```text
psql
  --single-transaction
  --variable ON_ERROR_STOP=1
  --file roles.sql
  --file schema.sql
  --command "SET session_replication_role = replica"
  --file data.sql
  --dbname "<conexão-local-da-stack>"
```

URL local completa, senha, JWTs e chaves não foram registrados.

### 21.7. Resultado da transação

- Tentativas de restauração nesta stack: 1.
- Transação: única.
- `ON_ERROR_STOP=1`: habilitado.
- Resultado: falha.
- Código de saída do `psql`: 3.
- Primeiro erro completo: `"supabase_admin" is a reserved role, only superusers can modify it`.
- Classificação: **role / permissão administrativa reservada**.

O erro ocorreu durante `roles.sql`. `schema.sql` e `data.sql` não foram efetivados.

Não houve edição dos dumps, criação manual de roles, alteração de ownership, comentário de linhas, correção automática ou segunda tentativa.

### 21.8. Rollback

O rollback integral foi confirmado:

- tabelas públicas do Postinder após a falha: 0;
- `schema_migrations`: ausente;
- nenhuma restauração parcial permaneceu.

A evidência é coerente com `--single-transaction` e `ON_ERROR_STOP=1`.

### 21.9. Tabelas, contagens e comparação

Como a restauração foi revertida:

- migrations `001`, `002` histórica e `003` a `011`: não restauradas;
- migrations `012` a `015`: ausentes e não executadas;
- tabelas centrais: não restauradas;
- Clientes restaurados: 0;
- posts restaurados: 0;
- files restaurados: 0;
- tabelas de fundo sonoro: ausentes;
- FKs, órfãos e duplicidades do Postinder: não aplicáveis em banco sem as tabelas.

Não houve correspondência efetiva com o inventário de produção, que registra 1 Cliente ativo, 0 posts e 0 files.

### 21.10. Hashes finais

| Arquivo | SHA-256 final | Igual ao inicial |
| --- | --- | --- |
| `roles.sql` | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | Sim |
| `schema.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Sim |
| `data.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Sim |

### 21.11. Limpeza

A stack foi parada usando o workdir correto e `--no-backup`, sem `--all`.

Confirmações:

- containers da stack restantes: 0;
- volumes da stack restantes: 0;
- redes da stack restantes: 0;
- listeners na porta `55432`: 0;
- container preexistente `postinder-db`: preservado;
- imagens oficiais: preservadas;
- dumps: preservados.

O workdir temporário ficou preservado como evidência inativa. A remoção recursiva foi bloqueada pela política local antes de executar; isso não deixou containers, volumes, redes ou portas ativos.

### 21.12. Projeto e Git

Não houve operação Git mutável. Código, migrations, documentos oficiais, Docker Compose, `package.json`, `package-lock.json` e configurações do Postinder não foram alterados.

A única escrita no repositório foi esta atualização autorizada de `INVESTIGACAO_RESTAURACAO_BACKUP.md`.

### 21.13. Limitações

- A stack local contém as roles esperadas, mas a sessão administrativa fornecida pela CLI não pode modificar a role reservada `supabase_admin`.
- O teste não alcançou `schema.sql` nem `data.sql`.
- As tabelas e contagens do backup continuam sem restauração bem-sucedida.
- A restaurabilidade integral ainda não está comprovada.
- Embora o destino usado pelo cliente tenha sido `127.0.0.1`, o Docker publicou a porta em `0.0.0.0`; a restrição exclusiva à interface local não foi garantida pela configuração padrão da CLI.

### 21.14. Veredito prevalente

1. **A variável de produção estava ausente?** Sim.
2. **O destino usado era local?** Sim, todas as conexões usaram `127.0.0.1:55432`; porém o bind Docker em `0.0.0.0` é uma limitação de isolamento registrada.
3. **A CLI usada foi a versão autorizada?** Sim, `2.110.0`.
4. **O PostgreSQL era major 17?** Sim, `17.6`.
5. **As roles Supabase exigidas existiam?** Sim.
6. **Os hashes iniciais e finais correspondiam?** Sim.
7. **A restauração foi concluída?** Não.
8. **Primeiro erro:** `"supabase_admin" is a reserved role, only superusers can modify it`.
9. **Houve rollback integral?** Sim.
10. **As contagens correspondem ao inventário?** Não; nenhuma linha do Postinder permaneceu após o rollback.
11. **A stack foi removida?** Sim.
12. **Restaram volumes?** Não.
13. **Produção foi acessada ou alterada?** Não.
14. **Alguma migration pendente foi executada?** Não.
15. **O backup pode ser considerado integralmente restaurável?** Ainda não. A falha agora está isolada no tratamento da role administrativa reservada `supabase_admin`.

### 21.15. Próxima única microetapa recomendada

Definir e autorizar um procedimento oficial e controlado para restaurar dumps de roles Supabase que contenham alterações de `supabase_admin`, preservando os originais. Somente depois repetir o teste em uma stack local nova, sem improvisar mudanças de role, ownership ou conteúdo dos dumps.

---

## 22. Tentativa prevalente com cópias derivadas controladas — 2026-07-29

Esta seção prevalece sobre todas as tentativas anteriores. O histórico foi preservado integralmente.

### 22.1. Proteção contra produção

- `POSTINDER_PROD_DATABASE_URL`: ausente antes de qualquer operação.
- Render, Supabase remoto, banco publicado e Storage remoto: não acessados.
- Arquivos `.env`, histórico do terminal, configurações do backend e outras fontes de conexão remota: não consultados.
- `supabase login`, `supabase link`, `db pull`, `db push`, `db dump`, migrations, deploy e backend: não executados.
- Toda conexão PostgreSQL desta tentativa usou exclusivamente `127.0.0.1:55432`.

### 22.2. Originais e hashes iniciais

Pasta original: `C:\Users\Murilo\Backups\Postinder\2026-07-29_16-06-06`.

| Arquivo | SHA-256 inicial | Resultado |
| --- | --- | --- |
| `roles.sql` | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | Idêntico ao esperado |
| `schema.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Idêntico ao esperado |
| `data.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Idêntico ao esperado |

Os originais não foram alterados, renomeados, movidos ou sobrescritos.

### 22.3. Inspeção estática

#### `roles.sql`

| Linha | Tipo/categoria | Role | Decisão e motivo |
| ---: | --- | --- | --- |
| 2 | `SET` de sessão | Não aplicável | Mantido; não redefine role |
| 4 | `SET` de sessão | Não aplicável | Mantido; não redefine role |
| 5 | `SET` de sessão | Não aplicável | Mantido; não redefine role |
| 7 | `ALTER ROLE` | `anon` | Mantido; role reservada, mas a instrução foi aceita pela stack na tentativa anterior |
| 9 | `ALTER ROLE` | `authenticated` | Mantido; role reservada, mas a instrução foi aceita pela stack na tentativa anterior |
| 11 | `ALTER ROLE` | `authenticator` | Mantido; role reservada, mas a instrução foi aceita pela stack na tentativa anterior |
| 13 | `ALTER ROLE` | `supabase_admin` | Incompatível; a stack rejeita alteração dessa role reservada pela sessão fornecida pela CLI |

Instrução exata que causava o erro:

```sql
ALTER ROLE "supabase_admin" SET "statement_timeout" TO '0';
```

Constatações negativas:

- `CREATE ROLE`: nenhum;
- role customizada da aplicação: nenhuma;
- senha ou credencial: nenhuma;
- `GRANT` ou `REVOKE` de role: nenhum;
- padrão `GRANT "postgres" TO "cli_login_postgres" WITH INHERIT FALSE GRANTED BY "supabase_admin"`: ausente.

#### `schema.sql`

Ownership encontrado:

- linhas 67, 83, 103, 117, 135, 148, 174, 184 e 217: `ALTER TABLE ... OWNER TO postgres`;
- linha 196: `ALTER SEQUENCE ... OWNER TO postgres`;
- linha 421: `ALTER PUBLICATION ... OWNER TO postgres`.

Todos foram mantidos. Não existe `ALTER ... OWNER TO "supabase_admin"` em `schema.sql`, portanto nenhuma transformação de schema foi necessária.

### 22.4. Cópias derivadas e manifesto

Diretório externo preservado:

`C:\Users\Murilo\Temp\PostinderRestorePrepared\2026-07-29_17-29-30`

Arquivos:

- `roles.restore.sql`;
- `schema.restore.sql`;
- `data.restore.sql`;
- `RESTORE_TRANSFORMATIONS.md`.

Transformação única:

- arquivo: `roles.restore.sql`;
- linha: 13;
- operação: prefixo `-- RESTORE_COMPAT: `;
- resultado: somente o `ALTER ROLE "supabase_admin" SET "statement_timeout" TO '0';` tornou-se comentário;
- classificação: **adaptação mínima inferida para role reservada**;
- justificativa: erro observado `"supabase_admin" is a reserved role, only superusers can modify it`.

Nenhuma transformação foi aplicada a `schema.restore.sql` ou `data.restore.sql`.

### 22.5. Hashes derivados

| Arquivo | SHA-256 |
| --- | --- |
| `roles.restore.sql` | `2B29CAE6FA2175E522D53D387F713B9E905D2F762AC88D55500B1D267C2C48D2` |
| `schema.restore.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` |
| `data.restore.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` |
| `RESTORE_TRANSFORMATIONS.md` | `7EEFAC0EDE492EA3214672AAAB0668814BB98AAB4331B20C940EFDE29BA68938` |

Validações:

- diferenças entre `roles.sql` e `roles.restore.sql`: somente linha 13;
- `schema.restore.sql`: binariamente idêntico a `schema.sql`;
- `data.restore.sql`: binariamente idêntico a `data.sql`;
- tabelas `CREATE`: 9 em ambos os schemas;
- instruções `ALTER TABLE`: 29 em ambos;
- índices: 25 em ambos;
- blocos `COPY`: 36 em ambos;
- terminadores `COPY`: 36 em ambos;
- credenciais aparentes: nenhuma.

### 22.6. Stack Supabase local

- Workdir: `C:\Users\Murilo\Temp\PostinderSupabaseRestore\2026-07-29_17-29-30`.
- `project_id`: `postinder-restore-prepared-20260729-172930`.
- Supabase CLI: `2.110.0`, via `npx`.
- Docker client/server: `29.6.2` / `29.6.2`.
- PostgreSQL: `17.6`.
- Imagem do banco: `public.ecr.aws/supabase/postgres:17.6.1.143`.
- Serviço iniciado: somente o banco.
- Host usado pelos clientes: `127.0.0.1`.
- Porta: `55432`.
- Banco: `postgres`.
- Estado inicial: saudável e sem tabelas públicas do Postinder.

Roles confirmadas:

- `anon`;
- `authenticated`;
- `service_role`;
- `authenticator`;
- `supabase_admin`.

A CLI publicou temporariamente a porta Docker em `0.0.0.0:55432`. Isso não foi tratado como autorização externa: todos os clientes desta execução usaram exclusivamente `127.0.0.1`, e nenhum cliente externo foi utilizado.

### 22.7. Comando lógico da restauração

A única tentativa derivada foi equivalente a:

```text
psql
  --single-transaction
  --variable ON_ERROR_STOP=1
  --file roles.restore.sql
  --file schema.restore.sql
  --command "SET session_replication_role = replica"
  --file data.restore.sql
  --dbname "<conexão-local-da-stack>"
```

Senha, JWT, chaves e URL completa não foram registrados.

### 22.8. Resultado da transação

- Tentativas derivadas: 1.
- Resultado: sucesso.
- Código de saída do `psql`: 0.
- Transação: única.
- `ON_ERROR_STOP=1`: habilitado.
- Resultado transacional: **commit concluído**.
- Novo erro: nenhum.
- Segunda tentativa ou transformação improvisada: nenhuma.

### 22.9. Migrations e tabelas restauradas

`schema_migrations` existe com 11 registros:

1. `001_core_schema.sql`;
2. `002_development_seed.sql`;
3. `003_client_portal_tokens.sql`;
4. `004_file_sort_order.sql`;
5. `005_fix_rejected_post_status.sql`;
6. `006_client_last_access.sql`;
7. `007_archive_inactive_client_posts.sql`;
8. `008_executed_posts_retention.sql`;
9. `009_inactive_clients_file_cleanup.sql`;
10. `010_client_deactivation_restore_marker.sql`;
11. `011_reusable_deleted_emails.sql`.

Ausentes, como esperado:

- `012`;
- `013`;
- `014`;
- `015`.

Tabelas centrais confirmadas:

- `activity_events`;
- `client_portal_tokens`;
- `clients`;
- `feedback`;
- `files`;
- `notification_reads`;
- `posts`;
- `users`.

### 22.10. Contagens e integridade

| Métrica | Restaurado | Inventário publicado | Correspondência |
| --- | ---: | ---: | --- |
| Clientes totais | 1 | 1 | Sim |
| Clientes ativos | 1 | 1 | Sim |
| Clientes inativos | 0 | 0 | Sim |
| Posts | 0 | 0 | Sim |
| Files | 0 | 0 | Sim |

Estruturas pendentes ausentes:

- `post_soundtracks`;
- `post_soundtrack_versions`;
- `post_soundtrack_decisions`.

Integridade:

- FKs não validadas: 0;
- posts sem Cliente: 0;
- files sem post: 0;
- feedbacks sem Cliente: 0;
- feedbacks sem post válido: 0;
- tokens de portal sem Cliente: 0;
- grupos duplicados de e-mail ativo entre Clientes: 0;
- grupos duplicados de e-mail ativo entre usuários: 0.

O estado restaurado corresponde ao inventário publicado para todas as métricas validadas.

### 22.11. Hashes finais

Originais:

| Arquivo | SHA-256 final | Igual ao inicial |
| --- | --- | --- |
| `roles.sql` | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` | Sim |
| `schema.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` | Sim |
| `data.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` | Sim |

Derivados:

| Arquivo | SHA-256 final |
| --- | --- |
| `roles.restore.sql` | `2B29CAE6FA2175E522D53D387F713B9E905D2F762AC88D55500B1D267C2C48D2` |
| `schema.restore.sql` | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` |
| `data.restore.sql` | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` |

### 22.12. Limpeza

Limpeza concluída em 2026-07-29 às 17:34:22 -03:00:

- containers da stack: 0;
- volumes da stack: 0;
- redes da stack: 0;
- listeners na porta `55432`: 0;
- container preexistente `postinder-db`: preservado;
- imagens oficiais: preservadas;
- dumps originais: preservados;
- cópias derivadas e manifesto: preservados;
- workdir da stack: preservado inativo fora do repositório.

Foi usado `supabase stop --no-backup` com o workdir correto. `supabase stop --all` não foi utilizado.

### 22.13. Projeto e Git

O `git status` final corresponde ao baseline. Nenhuma nova entrada foi criada no repositório e nenhuma operação Git mutável ocorreu.

Permaneceram inalterados:

- código;
- migrations;
- documentos oficiais;
- Docker Compose;
- `package.json`;
- ausência de `package-lock.json`;
- `node_modules`;
- ausência de pasta `supabase` no repositório.

A única escrita dentro do projeto foi esta atualização autorizada de `INVESTIGACAO_RESTAURACAO_BACKUP.md`.

### 22.14. Veredito prevalente

1. **A variável de produção estava ausente?** Sim.
2. **Os hashes originais correspondiam?** Sim.
3. **Qual instrução causava o erro?** `ALTER ROLE "supabase_admin" SET "statement_timeout" TO '0';`, linha 13 de `roles.sql`.
4. **Quais transformações foram aplicadas?** Somente essa linha foi comentada em `roles.restore.sql`; schema e dados permaneceram idênticos.
5. **Os originais permaneceram intactos?** Sim.
6. **O destino era local?** Sim; todos os clientes usaram `127.0.0.1:55432`, com a limitação registrada do bind Docker em `0.0.0.0`.
7. **A restauração derivada foi concluída?** Sim.
8. **Houve novo erro?** Não.
9. **Houve rollback ou commit?** Commit da transação única.
10. **Tabelas e contagens correspondem ao inventário?** Sim.
11. **Os hashes originais permaneceram iguais?** Sim.
12. **A stack foi removida?** Sim.
13. **Produção foi acessada?** Não.
14. **Alguma migration pendente foi executada?** Não.
15. **Classificação do backup:** **restaurável com procedimento documentado de compatibilidade**.

### 22.15. Próxima única microetapa recomendada

Planejar e autorizar a simulação das migrations pendentes `012` a `015` em uma nova stack descartável restaurada por este procedimento documentado, com comparação completa antes/depois. Não executar essa simulação em produção.
