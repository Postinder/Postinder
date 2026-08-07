# Investigação técnica geral pré-deploy do Postinder

Data da investigação: 28/07/2026  
Escopo: estado atual do worktree da branch `Consolidação-arquitetura`, incluindo arquivos modificados e não rastreados  
Modo: investigação e validação não destrutiva; nenhuma correção implementada

## 1. Resumo executivo

### Situação geral

O monorepo está estruturalmente coerente com a arquitetura documentada: frontend React/Vite em `apps/admin`, backend Express/TypeScript em `backend`, PostgreSQL por migrations versionadas e Supabase Storage em produção. Os builds de frontend e backend passaram e os 17 testes unitários existentes passaram.

Apesar disso, o estado atual **não está tecnicamente seguro para publicação**. Há falhas de autorização que permitem que um JWT de Cliente alcance operações administrativas de Clientes, inclusive geração de token de portal e exclusão definitiva. Também há um reset destrutivo disponível em produção, sem proteção por `APP_MODE`, e uma cadeia histórica de migrations capaz de excluir definitivamente postagens `archived`, incluindo registros que migrations anteriores podem ter arquivado ao desativar Clientes.

O deploy também depende obrigatoriamente da migration `015_post_soundtracks.sql`. O backend recusa o startup em produção quando há migrations pendentes, mas o repositório não configura uma etapa automática de release no Render.

### Veredito

**NÃO APTO PARA DEPLOY.**

### Quantidade de achados

| Severidade | Quantidade |
| --- | ---: |
| Crítico | 3 |
| Alto | 6 |
| Médio | 8 |
| Baixo | 4 |
| Informativo | 4 |
| **Total** | **25** |

### Bloqueadores confirmados

1. Fronteira administrativa quebrada para JWT de Cliente.
2. Reset demo destrutivo disponível em produção e recriação de credenciais previsíveis.
3. Risco de perda de dados na sequência das migrations `007` e `012`.
4. Migration `015` obrigatória sem etapa de release garantida no Render.
5. Tokens brutos do portal são persistidos nos logs de requisição.
6. Permissões funcionais dos papéis administrativos são, em grande parte, apenas controles de interface.

### Condições externas não verificadas

Não houve acesso ao Render, Vercel, Supabase ou banco publicado. Portanto, não foi possível confirmar:

- branch configurada nos provedores;
- valores ou presença das variáveis;
- migrations já aplicadas em produção;
- existência de registros `archived`;
- política real do bucket;
- backup/restore;
- configurações de build/start/release;
- vulnerabilidades atuais do registro npm.

## 2. Estado arquitetural encontrado

### Estrutura

| Área | Diretório/arquivo | Tecnologia e responsabilidade |
| --- | --- | --- |
| Frontend | `apps/admin` | React 18, Vite 5, React Router, Tailwind, Zustand, Axios |
| Backend | `backend` | Express 4, TypeScript, `pg`, JWT, Multer |
| Banco | `database/migrations` | PostgreSQL; migrations `001`, `003` a `015`; `002` excluída da cadeia estrutural |
| Storage local | `backend/uploads` em execução local | Arquivos em disco |
| Storage publicado | Supabase Storage | Upload pela service role; URLs públicas |
| Frontend publicado | Vercel | SPA Vite |
| Backend publicado | Render | Serviço Node |

### Estado do worktree

- 33 arquivos rastreados já estavam modificados antes da criação deste relatório.
- 8 entradas estavam não rastreadas, incluindo todo o novo módulo de fundo sonoro e `database/migrations/015_post_soundtracks.sql`.
- Não foi executada nenhuma operação Git mutável.
- Os arquivos de fundo sonoro precisam ser incluídos juntos em uma futura publicação; publicar o backend sem a migration `015` impede o startup em produção.

### Fluxo de inicialização do backend

1. `backend/src/server.ts` consulta `schema_migrations`.
2. Em produção, qualquer migration pendente lança erro antes de `app.listen`.
3. Em desenvolvimento, migrations pendentes geram aviso, mas o servidor pode abrir.
4. O startup não aplica migrations.
5. O migrador separado usa advisory lock e transação individual por migration.

Evidências:

- `backend/src/server.ts:7-19`
- `backend/src/shared/database/migrationStatus.ts:9-18`
- `backend/scripts/migrate.ts:59-83`

### Fluxo de deploy inferido

Render:

```text
Root Directory: backend
Build: npm install --include=dev && npm run build
Start: npm run start
Release/migration: ainda precisa ser configurada ou executada manualmente
```

Vercel:

```text
Root Directory: apps/admin
Install: npm install
Build: npm run build
Output: dist
SPA rewrite: /(.*) -> /index.html
```

Há dois `vercel.json`: um na raiz para projeto com Root Directory na raiz e outro em `apps/admin` para Root Directory no frontend. Os comandos são equivalentes, mas o painel deve usar uma única estratégia de forma consistente.

## 3. Validações executadas

| Comando | Resultado | Observações |
| --- | --- | --- |
| `npm.cmd run build --prefix backend` | Passou | `tsc`; sem erros |
| `npm.cmd run build --prefix apps/admin` | Passou | 1.574 módulos; bundle JS 592,82 kB; aviso acima de 500 kB |
| `npm.cmd test --prefix backend` | Passou | 8 testes, todos aprovados |
| `npm.cmd test --prefix apps/admin` | Passou | 9 testes, todos aprovados |
| `npm.cmd run lint --prefix apps/admin` | Falhou | `eslint` não está instalado; não há configuração; script limita extensões a TS/TSX embora o app use JS/JSX |
| `git diff --check` | Passou | Apenas avisos de futura conversão LF/CRLF |
| `npm.cmd ls --depth=0 --prefix backend` | Passou | Árvore instalada resolvida |
| `npm.cmd ls --depth=0 --prefix apps/admin` | Passou | Árvore instalada resolvida |
| `npm.cmd audit --omit=dev --prefix backend` | Inconclusivo | Endpoint de auditoria npm indisponível/restrito; não há resultado de vulnerabilidades |

Ambiente das validações:

- Node.js `v24.16.0`
- npm `11.13.0`

Não executados:

- `db:migrate`, seeds, bootstrap, reset e limpeza de Retenção: alteram dados.
- `test:integration:soundtracks`: cria e remove dados e arquivos.
- validadores `db:validate-*`: exigem banco isolado e alguns alteram dados de teste.
- health checks em runtime: exigem conexão com banco/serviços e poderiam apontar para ambiente externo por `.env`.
- auditoria do Supabase/Render/Vercel: fora do repositório e não autorizada nesta etapa.

## 4. Bloqueadores de deploy

### C-01 — JWT de Cliente alcança operações administrativas de Clientes

- **Severidade:** Crítico
- **Área:** backend, autenticação, autorização, privacidade e integridade
- **Evidência:** `backend/src/app.ts:79-88` aplica `adminAuthMiddleware` apenas em `/api/v1/posts`. `/api/v1/clients` recebe apenas `authMiddleware` e `readOnlyAdminMiddleware`. `backend/src/modules/clients/presentation/routes/clients.routes.ts:12-45` expõe listagem, criação, edição, ativação, notificação, criação de link de portal, desativação e exclusão definitiva. Os controllers de Clientes não verificam `req.user.type`.
- **Impacto:** um Cliente autenticado pode listar outros Clientes, obter seus identificadores, criar/revogar links privados de portal e excluir definitivamente Clientes e seus dados. Com `company_id` nulo — situação compatível com seed e registros antigos — as consultas ficam sem filtro de empresa.
- **Cenário de reprodução:** autenticar como Cliente; usar o JWT em `GET /api/v1/clients`; escolher um ID retornado; chamar `POST /api/v1/clients/:id/portal-link` ou `DELETE /api/v1/clients/:id/permanent`.
- **Recomendação:** aplicar fronteira administrativa explícita a todas as rotas administrativas, negar JWT de Cliente por padrão e adicionar testes de matriz de acesso para cada método/rota. Rotas do portal autenticado devem permanecer na árvore `/client-portal`.
- **Bloqueia deploy:** **Sim.**

### C-02 — Reset demo destrutivo permanece habilitado em produção

- **Severidade:** Crítico
- **Área:** manutenção, banco, Storage, credenciais e produção
- **Evidência:** `backend/src/modules/maintenance/presentation/controllers/MaintenanceController.ts:15-29` verifica apenas papel `admin`; não verifica `APP_MODE`. Em `:31-85`, remove objetos, executa `TRUNCATE ... CASCADE`, recria contas com hashes/credenciais previsíveis e devolve essas credenciais na resposta. `backend/src/config/environment.ts:6-22` nem inclui `APP_MODE` no ambiente carregado.
- **Impacto:** qualquer admin de produção pode zerar todos os Clientes, postagens, aprovações, arquivos, trilhas, histórico e usuários. Falhas após a remoção de objetos e antes do commit podem manter referências do banco para objetos já apagados.
- **Cenário de reprodução:** iniciar com `NODE_ENV=production`; autenticar como admin; enviar confirmação esperada a `POST /api/v1/maintenance/reset-demo-data`.
- **Recomendação:** tornar a rota inexistente ou responder 404/403 fora de `APP_MODE=demo`; exigir configuração central validada; nunca recriar credenciais previsíveis em produção; tornar o processo operacional separado da API.
- **Bloqueia deploy:** **Sim**, salvo ambiente de demonstração isolado, descartável e explicitamente aceito.

### C-03 — Cadeia de migrations pode apagar histórico de Clientes inativos

- **Severidade:** Crítico
- **Área:** PostgreSQL, migrations e compatibilidade de dados
- **Evidência:** `database/migrations/007_archive_inactive_client_posts.sql:1-8` transforma postagens de Clientes inativos em `archived`. `database/migrations/012_remove_legacy_archived_posts.sql:1-13` apaga eventos e todas as postagens `archived`. O comentário exige que objetos de Storage sejam removidos antes por um script, mas o migrador estrutural executa a migration sem executar esse script.
- **Impacto:** banco que ainda não recebeu essas migrations pode perder permanentemente postagens, anexos por cascata, feedbacks e histórico de Clientes inativos. Sem o script preparatório, os objetos físicos podem permanecer órfãos no Storage. Não há distinção segura entre arquivamento manual legado e arquivamento por desativação.
- **Cenário de reprodução:** banco anterior à migration `007` com Cliente inativo e postagens ativas; executar a cadeia até `012`.
- **Recomendação:** antes de qualquer migration no banco publicado, fazer backup restaurável, consultar `schema_migrations`, contar/classificar `posts.status='archived'`, identificar `archived_by_client_deactivation`, definir transformação preservadora e validar em clone do banco. Não executar `db:migrate` em produção até esse preflight.
- **Bloqueia deploy:** **Sim**, enquanto o histórico de migrations e os dados publicados não forem verificados.

### H-01 — Migration `015` é obrigatória, mas não há release step garantida

- **Severidade:** Alto
- **Área:** Render, banco e disponibilidade
- **Evidência:** o código consulta `post_soundtracks` incondicionalmente em repositórios, manutenção e retenção. `backend/src/server.ts:8-12` recusa produção com migration pendente. `docs/DEPLOYMENT.md` informa que a etapa de release do Render ainda é pendência operacional.
- **Impacto:** publicar o novo backend antes da migration `015` causa falha de startup. Aplicar migrations depois do start não funciona porque a API não abre. Aplicar toda a cadeia sem preflight pode acionar o risco C-03.
- **Cenário de reprodução:** deploy do commit com módulo de trilha e sem registro de `015_post_soundtracks.sql` em `schema_migrations`.
- **Recomendação:** após resolver C-03, configurar uma única etapa de release/migration anterior ao start, com falha bloqueante, backup e observabilidade. Confirmar que todos os novos arquivos não rastreados foram incluídos no commit.
- **Bloqueia deploy:** **Sim.**

### H-02 — Tokens privados do portal são gravados em logs

- **Severidade:** Alto
- **Área:** portal por token, logs e privacidade
- **Evidência:** o token bruto faz parte do path em `backend/src/modules/portal/presentation/routes/portal.routes.ts:13-24`. `backend/src/shared/middlewares/requestLogger.ts:4-9` registra `req.path` para toda requisição. `backend/src/shared/middlewares/errorHandler.ts:13` também registra o path em erros.
- **Impacto:** cada acesso e decisão do portal persiste o bearer token em logs do Render. Quem obtiver acesso aos logs pode reutilizar o link até expirar/revogar e ler ou alterar decisões do Cliente.
- **Cenário de reprodução:** acessar `/api/v1/portal/<token>` e consultar o log gerado.
- **Recomendação:** redigir segmentos sensíveis antes de logar; registrar apenas hash curto/ID do token; definir política de retenção e acesso a logs; revogar tokens potencialmente já registrados.
- **Bloqueia deploy:** **Sim** para uso com dados/clientes reais.

### H-03 — Matriz de permissões não é garantida pelo backend

- **Severidade:** Alto
- **Área:** RBAC e autorização administrativa
- **Evidência:** `readOnlyAdminMiddleware` em `backend/src/shared/middlewares/readOnlyAdminMiddleware.ts:4-12` bloqueia apenas o papel `viewer`. Permissões como `clients`, `posts`, `feed` e `insights` são aplicadas no frontend em `apps/admin/src/App.jsx:38-47`, mas não nas rotas correspondentes. Um `editor` pode chamar diretamente mutações de Clientes e atividades.
- **Impacto:** ocultar uma tela não impede ação pela API. Papéis com escopo limitado podem criar/desativar/excluir Clientes ou fabricar eventos.
- **Cenário de reprodução:** autenticar um usuário `editor`; chamar diretamente uma rota de mutação que não aparece na UI.
- **Recomendação:** criar autorização por capacidade/rota no backend, com deny-by-default e testes por papel e método HTTP.
- **Bloqueia deploy:** **Sim** para ambiente com mais de um papel administrativo.

## 5. Riscos altos e médios

### H-04 — Integrações instruem a colocar segredos em variáveis `VITE_*`

- **Severidade:** Alto
- **Área:** frontend, segredos e integrações
- **Evidência:** `apps/admin/src/services/integrations/registry.js:16-76` lê tokens e chaves como `VITE_*`; `apps/admin/src/services/integrations/ai.integration.js:8-31` incorpora a chave de IA no bundle e chama o provedor diretamente do navegador. A própria observação do arquivo reconhece que produção deveria usar backend.
- **Impacto:** qualquer variável `VITE_*` é pública no JavaScript compilado. Configurar API keys, client secrets ou auth tokens na Vercel expõe as credenciais a todo visitante. O fluxo de IA também envia nomes e métricas de Clientes diretamente a terceiro.
- **Recomendação:** não configurar nenhuma credencial secreta `VITE_*`; manter apenas identificadores realmente públicos; mover chamadas e segredos para backend; avaliar consentimento e minimização de dados.
- **Bloqueia deploy:** Condicional. Bloqueia se qualquer uma dessas credenciais estiver configurada na Vercel.

### H-05 — Bucket público expõe mídia fora da autorização da aplicação

- **Severidade:** Alto
- **Área:** Supabase Storage e privacidade
- **Evidência:** `backend/src/shared/upload/storage.ts:103-120` usa upload com service role e `getPublicUrl`. A documentação oficial assume bucket público.
- **Impacto:** quem conhecer uma URL acessa a mídia sem JWT/token do Postinder. Revogar portal ou desativar Cliente não revoga URLs já compartilhadas. Conteúdo de campanhas pode permanecer público até remoção física.
- **Recomendação:** para uso com Clientes reais, adotar bucket privado e signed URLs curtas, ou formalizar/aceitar explicitamente o risco para ambiente de teste. Confirmar que apenas service role pode escrever/remover.
- **Bloqueia deploy:** Não para demonstração controlada; **sim** se a política de privacidade exigir conteúdo privado.

### H-06 — Upload em memória permite pico elevado e confia no MIME declarado

- **Severidade:** Alto
- **Área:** upload, Render, disponibilidade e segurança de arquivos
- **Evidência:** `backend/src/shared/upload/multer.ts:51-59` usa `memoryStorage` em produção e aceita até 200 MB por arquivo; `upload.array('files')` em `posts.routes.ts` não define quantidade máxima. A validação geral verifica apenas `file.mimetype`, fornecido pelo multipart. A validação por assinatura existe apenas para trilhas.
- **Impacto:** requisições diretas podem enviar vários arquivos grandes e esgotar memória/tempo do Render. Conteúdo incompatível pode ser armazenado com MIME falsificado e distribuído pelo bucket público.
- **Recomendação:** limitar número/tamanho total, streaming/upload direto assinado, rate limit, magic-byte validation e lista de tipos baseada na necessidade real.
- **Bloqueia deploy:** Não isoladamente em teste restrito; risco alto em acesso externo.

### M-01 — Banco e Storage não são atomicamente coordenados

- **Severidade:** Médio
- **Área:** integridade de arquivos
- **Evidência:** exclusão definitiva remove objetos antes do `DELETE`/commit em `ClientRepository.ts:288-357`; Retenção remove o objeto dentro da transação antes de marcar o banco em `StorageRetentionCleanupService.ts:154-196`; remoção manual apaga o registro antes de tentar o objeto em `PostRepository.ts:583-598`.
- **Impacto:** falha de commit pode deixar registro apontando para objeto ausente; falha de remoção pode deixar objeto órfão depois de o registro desaparecer.
- **Recomendação:** adotar estados/outbox e operações idempotentes; preservar referência/auditoria até confirmação; evitar chamada externa dentro de transação longa.
- **Bloqueia deploy:** Não para o fluxo básico, mas exige cuidado em exclusões e Retenção.

### M-02 — Instalações não são reproduzíveis e Node não está fixado

- **Severidade:** Médio
- **Área:** dependências e deploy
- **Evidência:** `.gitignore` ignora todos os lockfiles; nenhum lockfile está rastreado. Não há `engines`, `.nvmrc`, `.node-version` ou configuração equivalente.
- **Impacto:** Render e Vercel podem resolver versões transitivas diferentes entre deploys. Mudança de runtime ou pacote pode quebrar uma publicação sem alteração de código.
- **Recomendação:** escolher npm ou pnpm, versionar um lockfile coerente para o monorepo, usar instalação determinística e fixar uma versão suportada de Node nos provedores e no repositório.
- **Bloqueia deploy:** Não, mas reduz previsibilidade e rollback.

### M-03 — Lint inexistente e testes cobrem somente fundo sonoro

- **Severidade:** Médio
- **Área:** qualidade e regressão
- **Evidência:** o lint falhou porque `eslint` não existe; não há configuração; o script cobre `ts,tsx` enquanto o frontend é majoritariamente JS/JSX. Os 17 testes existentes cobrem domínio/utilitários de trilha, não autenticação, autorização, portal, migrations, upload ou exclusões.
- **Impacto:** falhas críticas como C-01 não são detectadas automaticamente.
- **Recomendação:** configurar lint real para JS/JSX/TS/TSX e criar testes de integração para matriz de autorização, ciclo de status, portal, reset e migrations.
- **Bloqueia deploy:** Não por si só; aumenta o risco dos bloqueadores.

### M-04 — Sessão fica em `localStorage` e logout não revoga refresh token

- **Severidade:** Médio
- **Área:** autenticação frontend/backend
- **Evidência:** `apps/admin/src/lib/axios.js:15-55` e `auth.service.js:9-31` persistem access/refresh token em `localStorage`. `/auth/logout` apenas responde sucesso. Quando há 401 sem refresh token, o usuário persistido em Zustand não é limpo nem há redirecionamento.
- **Impacto:** XSS teria acesso aos tokens; refresh token roubado continua válido até expirar; estado visual pode permanecer autenticado com tokens ausentes/inválidos.
- **Recomendação:** rotação/revogação de refresh tokens, sessão em cookie HttpOnly quando aplicável, limpeza central de store/tokens em qualquer falha irrecuperável e política CSP.
- **Bloqueia deploy:** Não.

### M-05 — Confirmação reforçada de exclusão aprovada não existe na API

- **Severidade:** Médio
- **Área:** postagens e integridade
- **Evidência:** `PostsController.ts:93-120` não recebe/verifica confirmação textual. `PostRepository.ts:320-355` verifica apenas o papel para `approved`.
- **Impacto:** chamada direta da API por admin exclui logicamente uma postagem aprovada sem a barreira `EXCLUIR` documentada.
- **Recomendação:** validar confirmação/intent token no backend, não apenas no modal.
- **Bloqueia deploy:** Não.

### M-06 — Último admin pode ser rebaixado

- **Severidade:** Médio
- **Área:** usuários e continuidade operacional
- **Evidência:** `UsersController.ts:64-77` permite alteração de papel; a única proteção especial está na exclusão do e-mail demo em `UsersRepository.ts:121-127`. Não há contagem/lock do último admin.
- **Impacto:** instância pode ficar sem usuário capaz de gerenciar usuários/reset/configuração.
- **Recomendação:** impedir rebaixamento/exclusão do último admin ativo em transação.
- **Bloqueia deploy:** Não.

### M-07 — Telas ativas simulam funções não implementadas

- **Severidade:** Médio
- **Área:** frontend e contrato funcional
- **Evidência:** `EmailPage.jsx:41-48` mostra sucesso sem enviar e-mail; `auth.service.js:34-35` chama `/auth/forgot-password`, rota inexistente no backend; `App.jsx:64-79` mantém ambas acessíveis.
- **Impacto:** operador pode acreditar que um e-mail foi enviado; recuperação de senha falha sempre.
- **Recomendação:** desabilitar/rotular explicitamente como indisponível ou implementar contrato real antes de uso operacional.
- **Bloqueia deploy:** Não para o fluxo central.

### M-08 — `schema_migrations` não detecta drift de migrations já aplicadas

- **Severidade:** Médio
- **Área:** banco e rastreabilidade
- **Evidência:** `backend/scripts/migrate.ts:24-49` registra somente `filename`; o startup compara somente nomes.
- **Impacto:** alteração posterior de um SQL já aplicado não é detectada; repositório e banco podem divergir silenciosamente.
- **Recomendação:** migrations imutáveis e checksum registrado/verificado; comparar schema publicado antes da release atual.
- **Bloqueia deploy:** Não, mas o schema real precisa de conferência manual.

## 6. Achados baixos e informativos

### L-01 — Health checks públicos devolvem detalhe de erro

- **Severidade:** Baixo
- **Evidência:** `backend/src/app.ts:55-74` devolve `error.message` do banco/Supabase.
- **Impacto:** pode revelar detalhes operacionais do provedor.
- **Recomendação:** resposta pública genérica e detalhe apenas em log redigido.
- **Bloqueia deploy:** Não.

### L-02 — Documentação e variáveis possuem divergências

- **Severidade:** Baixo
- **Evidência:** `docs/deploy/DEPLOY_POSTINDER.html` menciona `VITE_APP_URL` e `VITE_APPROVAL_BASE_URL`, não lidas pelo código; `.env.example` lista `RESEND_API_KEY` e `ANTHROPIC_API_KEY`, também não lidas pelo backend; `INITIAL_ADMIN_*` não aparece nos exemplos.
- **Impacto:** configuração equivocada no painel e falsa expectativa de integrações.
- **Recomendação:** consolidar a matriz de ambiente após as correções.
- **Bloqueia deploy:** Não.

### L-03 — Bundle grande e textos com mojibake

- **Severidade:** Baixo
- **Evidência:** build Vite gerou 592,82 kB de JS e aviso de chunk; diversos textos no código contêm sequências mojibake.
- **Impacto:** carregamento inicial maior e UX com acentuação incorreta.
- **Recomendação:** code splitting e normalização UTF-8 em etapa posterior.
- **Bloqueia deploy:** Não.

### L-04 — Configuração de deploy duplicada e sem CI/manifest do Render

- **Severidade:** Baixo
- **Evidência:** `vercel.json` e `apps/admin/vercel.json`; não há `render.yaml`, Dockerfile ou workflow CI.
- **Impacto:** painel remoto vira fonte de verdade não versionada e pode divergir.
- **Recomendação:** escolher uma estratégia Vercel e versionar configuração do Render/CI quando estabilizada.
- **Bloqueia deploy:** Não.

### I-01 — Builds e testes existentes passaram

- **Severidade:** Informativo
- **Evidência:** builds TypeScript/Vite e 17 testes passaram.
- **Impacto:** o código compila no ambiente local auditado.
- **Bloqueia deploy:** Não elimina os bloqueadores de segurança/dados.

### I-02 — Compatibilidade de postagens sem trilha está bem modelada

- **Severidade:** Informativo
- **Evidência:** `post_soundtracks` é opcional; repositórios retornam `none`/nulo; testes cobrem registros antigos sem trilha. A migration `015` não faz backfill obrigatório.
- **Impacto:** postagens antigas sem fundo sonoro tendem a continuar funcionando após `015`.
- **Bloqueia deploy:** Não.

### I-03 — Nenhum segredo real rastreado foi identificado

- **Severidade:** Informativo
- **Evidência:** inspeção de arquivos rastreados encontrou exemplos/placeholders e credenciais demo conhecidas, não valores reais de `.env`.
- **Impacto:** não há evidência local de service role, JWT secret ou senha real versionada.
- **Bloqueia deploy:** Não. O histórico Git e os painéis ainda precisam de conferência própria.

### I-04 — Retenção é manual e sem retry/scheduler

- **Severidade:** Informativo
- **Evidência:** comando `storage:cleanup-retention`; documentação e código não incluem scheduler, fila ou retry.
- **Impacto:** objetos vencidos permanecem até execução operacional; falhas exigem nova execução manual.
- **Bloqueia deploy:** Não, desde que o procedimento seja explícito.

## 7. Banco e migrations

### Ordem encontrada

```text
001_core_schema.sql
002_development_seed.sql          (histórica, excluída da cadeia estrutural)
003_client_portal_tokens.sql
004_file_sort_order.sql
005_fix_rejected_post_status.sql
006_client_last_access.sql
007_archive_inactive_client_posts.sql
008_executed_posts_retention.sql
009_inactive_clients_file_cleanup.sql
010_client_deactivation_restore_marker.sql
011_reusable_deleted_emails.sql
012_remove_legacy_archived_posts.sql
013_file_storage_identity.sql
014_storage_retention_audit.sql
015_post_soundtracks.sql
```

### Estado estrutural inferido

- A ordenação lexicográfica funciona com os nomes atuais.
- `002` é corretamente excluída pelo catálogo.
- O migrador usa lock advisory de sessão e transação por migration.
- Falha em uma migration faz rollback daquela migration e encerra com erro.
- O servidor só começa a escutar depois da verificação.
- A migration `015` cria tabelas, checks e índices coerentes com o módulo de trilha.
- Colunas históricas de MIME/tamanho/identidade continuam anuláveis, compatíveis com dados antigos.
- Não há checksum das migrations.

### Riscos de dados existentes

| Tipo de dado antigo | Comportamento esperado | Risco |
| --- | --- | --- |
| Post sem trilha | Tratado como `none` | Baixo |
| Anexo sem MIME/tamanho | Frontend usa tipo/nome como fallback | Baixo |
| Anexo sem bucket/path | Visualização por URL continua; duplicação e Retenção podem bloquear/falhar | Médio |
| Post `archived` | Migration `012` apaga | Crítico |
| Cliente inativo antes da cadeia completa | `007` pode arquivar posts; `012` pode apagá-los | Crítico |
| Post `approved` com arquivo rejeitado | `005` muda para `rejected` | Esperado, mas revisar métricas |
| E-mails com duplicidade case-insensitive | Índices da `011` podem falhar ao criar | Médio; executar diagnóstico em clone |
| Post executado | Código bloqueia mutações principais | Compatível |
| Datas nulas antigas | Mapeadores usam nulo/fallback | Baixo |

### Comportamento esperado no Render

- Sem `schema_migrations`: startup falha.
- Com migration pendente: startup falha em produção.
- Com todas aplicadas: servidor abre.
- Duas execuções do migrador são serializadas pelo advisory lock.
- A release deve executar no diretório `backend`, com acesso ao diretório irmão `database/migrations`.

### Preflight obrigatório antes de aplicar

Executar apenas em clone/restauração do banco publicado, ou em sessão explicitamente aprovada:

1. backup e teste de restauração;
2. listar `schema_migrations`;
3. contar posts por status, especialmente `archived`;
4. identificar Clientes inativos e seus posts;
5. auditar `archived_by_client_deactivation`;
6. verificar duplicidades de e-mail;
7. verificar arquivos sem bucket/path;
8. simular migrations em clone;
9. comparar contagens e constraints;
10. só então planejar release.

## 8. Variáveis de ambiente

Nenhum valor foi lido ou registrado neste relatório.

| Nome | Finalidade | Serviço | Obrigatoriedade | Situação encontrada |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | Seleciona produção, SSL e Storage remoto | Render | Obrigatória operacionalmente | Documentada; default de código é `development` |
| `PORT` | Porta HTTP | Render/local | Opcional; default 3001 | Documentada em exemplos |
| `DATABASE_URL` | PostgreSQL | Render/backend | Obrigatória | Validada pelo backend |
| `JWT_SECRET` | Assinatura de access/refresh token | Render/backend | Obrigatória | Mínimo técnico de apenas 8 caracteres |
| `JWT_EXPIRY_MINUTES` | Expiração do access token | Render/backend | Opcional | Exemplo e default 15 |
| `JWT_REFRESH_EXPIRY_DAYS` | Expiração do refresh token | Render/backend | Opcional | Exemplo e default 7 |
| `LOG_LEVEL` | Nível de log | Render/backend | Opcional | Exemplo e default `info` |
| `APP_PUBLIC_URL` | Links do portal e origem CORS | Render/backend | Obrigatória operacionalmente | Schema permite ausência |
| `CORS_ORIGINS` | Origens extras separadas por vírgula | Render/backend | Opcional | Documentada |
| `SUPABASE_URL` | Endpoint do Supabase | Render/backend | Obrigatória em produção | Schema permite ausência; health/upload falham sem ela |
| `SUPABASE_SERVICE_ROLE_KEY` | Escrita/remoção no Storage | Render/backend | Obrigatória em produção | Nunca deve existir na Vercel |
| `SUPABASE_STORAGE_BUCKET` | Nome do bucket | Render/backend | Obrigatória em produção | Default `postinder-uploads` |
| `APP_MODE` | Protege somente a seed atualmente | Backend/script | Obrigatória para seed demo | Não protege reset nem integra o schema carregado |
| `INITIAL_ADMIN_NAME` | Bootstrap do primeiro admin | Render shell/backend | Condicional | Não aparece nos `.env.example` |
| `INITIAL_ADMIN_EMAIL` | Bootstrap do primeiro admin | Render shell/backend | Condicional | Não aparece nos `.env.example` |
| `INITIAL_ADMIN_PASSWORD` | Bootstrap do primeiro admin | Render shell/backend | Condicional e secreta | Não aparece nos `.env.example` |
| `ZAPI_INSTANCE` | Integração Z-API | Render/backend | Opcional | Lida pelo backend |
| `ZAPI_TOKEN` | Token Z-API | Render/backend | Opcional e secreto | Lida pelo backend |
| `ZAPI_CLIENT_TOKEN` | Token adicional Z-API | Render/backend | Opcional e secreto | Lida pelo backend |
| `STORAGE_AUDIT_LIMIT` | Limite do diagnóstico de Storage | Backend/script | Opcional/local | Não documentada |
| `VITE_API_URL` | Base `/api/v1` do backend | Vercel/frontend | Obrigatória em produção | Corretamente documentada |
| `VITE_GA_MEASUREMENT_ID` | Identificador público de analytics | Vercel/frontend | Opcional | Lida pelo registry; integração não consolidada |
| `VITE_ANTHROPIC_API_KEY` | Chave de IA no browser | **Não configurar** | Insegura | Lida e incorporada no bundle |
| `VITE_ZAPI_TOKEN` | Token Z-API no browser | **Não configurar** | Insegura | Lida pelo registry |
| `VITE_TWILIO_TOKEN` | Token Twilio no browser | **Não configurar** | Insegura | Lida pelo registry |
| `VITE_GHL_API_KEY` | Chave CRM no browser | **Não configurar** | Insegura | Lida pelo registry |
| `VITE_CANVA_CLIENT_SECRET` | Secret Canva no browser | **Não configurar** | Insegura | Lida pelo registry |
| `VITE_RESEND_API_KEY` | Chave Resend no browser | **Não configurar** | Insegura | Lida pelo registry |
| `VITE_APP_URL` | URL do frontend | Vercel | Possivelmente obsoleta | Só aparece no HTML de deploy |
| `VITE_APPROVAL_BASE_URL` | URL de aprovação | Vercel | Possivelmente obsoleta | Só aparece no HTML de deploy |
| `RESEND_API_KEY` | Integração futura | Backend | Obsoleta/futura | Exemplo, mas backend não lê |
| `ANTHROPIC_API_KEY` | Integração futura | Backend | Obsoleta/futura | Exemplo, mas backend não lê |

Variáveis de validadores isolados (`*_TEST_DATABASE_URL`, `*_TEST_CONFIRM`) são apenas locais e não devem ser configuradas nos provedores de produção.

## 9. Checklist do Render

### Antes do deploy

- [ ] Confirmar a branch de produção.
- [ ] Confirmar Root Directory `backend`.
- [ ] Fixar versão suportada do Node; não depender do default do provedor.
- [ ] Usar instalação reprodutível depois de versionar lockfile.
- [ ] Build Command: `npm install --include=dev && npm run build` ou equivalente determinístico.
- [ ] Start Command: `npm run start`.
- [ ] Configurar release/migration anterior ao start somente depois do preflight de C-03.
- [ ] Confirmar backup e rollback do banco.
- [ ] Confirmar `NODE_ENV=production`.
- [ ] Confirmar nomes obrigatórios de ambiente sem expor valores.
- [ ] Garantir que nenhuma credencial demo foi criada no banco publicado.
- [ ] Desabilitar reset fora de demo.
- [ ] Corrigir fronteira administrativa e RBAC.
- [ ] Redigir token do portal nos logs.
- [ ] Conferir plano de memória/timeout para uploads de 200 MB.
- [ ] Confirmar acesso do processo a `../database/migrations`.
- [ ] Confirmar que `015_post_soundtracks.sql` integra o mesmo commit do backend.

### Depois do deploy

- [ ] `/health` retorna 200.
- [ ] `/health/db` retorna 200 sem detalhe sensível.
- [ ] `/health/storage` retorna 200.
- [ ] Startup não relata migrations pendentes.
- [ ] Testar CORS do domínio de produção.
- [ ] Testar uma origem Vercel Preview explicitamente permitida, se previews consumirem a API.
- [ ] Conferir logs e confirmar que tokens do portal não aparecem.
- [ ] Monitorar memória e tempo de upload.
- [ ] Confirmar que restart não perde arquivos.

## 10. Checklist da Vercel

### Antes do deploy

- [ ] Confirmar branch de produção.
- [ ] Escolher Root Directory `apps/admin` e usar `apps/admin/vercel.json`, ou raiz e usar `vercel.json`; não misturar.
- [ ] Framework Preset: Vite.
- [ ] Install Command: `npm install` ou equivalente determinístico.
- [ ] Build Command: `npm run build`.
- [ ] Output Directory: `dist`.
- [ ] Fixar a mesma linha de Node validada localmente/provedor.
- [ ] Configurar `VITE_API_URL` com `/api/v1`.
- [ ] Não configurar nenhum segredo em variável `VITE_*`.
- [ ] Confirmar rewrite SPA para `/portal/:token`, `/aprovar` e rotas administrativas.
- [ ] Confirmar ambientes Production e Preview separadamente.

### Depois do deploy

- [ ] Abrir diretamente `/login`.
- [ ] Recarregar uma rota `/admin/...`.
- [ ] Abrir diretamente um `/portal/:token` de teste.
- [ ] Confirmar chamadas à API sem mixed content/CORS.
- [ ] Confirmar assets JS/CSS e favicon, sem rewrite incorreto.
- [ ] Confirmar que o bundle não contém credenciais.

## 11. Checklist do Supabase

- [ ] Confirmar projeto e banco corretos.
- [ ] Confirmar backup/PITR ou procedimento equivalente antes de migrations.
- [ ] Ler `schema_migrations` antes de aplicar qualquer mudança.
- [ ] Auditar registros `archived`, Clientes inativos e marcador de desativação.
- [ ] Validar migration `015` em clone.
- [ ] Confirmar bucket esperado.
- [ ] Confirmar se o bucket é público por decisão consciente.
- [ ] Confirmar que clientes anônimos não podem gravar/remover objetos.
- [ ] Confirmar que somente o backend possui service role.
- [ ] Conferir paths de anexos e `posts/<postId>/soundtracks/...`.
- [ ] Auditar objetos sem linha correspondente e linhas sem objeto.
- [ ] Auditar arquivos legados sem `bucket + storage_path`.
- [ ] Auditar identidades compartilhadas antes de exclusões/Retenção.
- [ ] Testar MIME real, tamanho e reprodução de imagem/vídeo/áudio com dados descartáveis.
- [ ] Confirmar limites de arquivo do projeto/bucket.
- [ ] Definir migração para bucket privado/signed URLs antes de Clientes reais, se privacidade for requisito.
- [ ] Não executar limpeza de Retenção em dados reais sem backup e amostra descartável validada.

## 12. Checklist de teste de fumaça em produção

Executar com Cliente e dados descartáveis, após corrigir bloqueadores:

1. Abrir frontend e recarregar rota interna.
2. Fazer login administrativo e logout; testar token expirado.
3. Criar um Cliente de teste.
4. Criar postagem em `draft`.
5. Alterar `draft -> ready -> draft`.
6. Enviar imagem válida e conferir preview.
7. Enviar vídeo MP4 compatível e usar play/pause/volume sem disparar swipe.
8. Enviar arquivo geral permitido.
9. Reordenar anexos e conferir a mesma ordem no admin e portal.
10. Configurar cada modalidade de fundo sonoro em cenários separados.
11. Testar áudio enviado, ponto inicial e mute.
12. Enviar postagem para aprovação.
13. Abrir portal por token e confirmar isolamento do Cliente.
14. Aprovar um item por botão e por swipe.
15. Solicitar ajuste com comentário obrigatório.
16. Solicitar ajuste de trilha e confirmar bloqueio da aprovação integral.
17. Desfazer somente a última ação.
18. Corrigir/substituir arquivo ou trilha.
19. Reenviar e confirmar identificação de correção.
20. Aprovar todos os arquivos e a trilha.
21. Confirmar status `approved`, métricas e histórico.
22. Marcar como `executed` com Retenção `never`.
23. Confirmar imutabilidade de executada e duplicação independente.
24. Testar exclusão lógica de postagem em andamento.
25. Testar exclusão reforçada de aprovada por admin.
26. Confirmar que Cliente JWT recebe 403 em toda rota administrativa.
27. Confirmar matriz `admin/manager/editor/viewer`.
28. Confirmar logs sem token bruto.
29. Testar erro de rede e estados vazios no mobile.
30. Executar reset apenas se o ambiente for demo descartável e o recurso estiver intencionalmente habilitado.

## 13. Divergências documentais

### Documentado, mas não garantido pelo código

- Separação entre endpoints administrativos e Cliente: verdadeira para `/posts`, falsa para `/clients` e `/activities`.
- Reset aceitável somente em demo: rota não verifica `APP_MODE`.
- Confirmação textual `EXCLUIR` para postagem aprovada: não validada no backend.
- Permissões por papel: majoritariamente frontend; backend bloqueia apenas `viewer` de forma global.
- Histórico preservado de Cliente desativado: migrations históricas podem apagá-lo.
- Objetos removidos antes da migration `012`: o migrador não executa o script preparatório.

### Implementado, mas incompletamente documentado

- Variáveis perigosas `VITE_*` usadas pelo registry de integrações.
- Variáveis de bootstrap `INITIAL_ADMIN_*`.
- Variáveis de validadores isolados e `STORAGE_AUDIT_LIMIT`.
- Tokens do portal presentes nos paths/logs.

### Documentado/visível, mas funcionalidade não existe

- Recuperação de senha.
- Envio real na tela de E-mail.
- Várias integrações listadas como configuráveis pelo frontend.

### Possivelmente obsoleto

- `VITE_APP_URL` e `VITE_APPROVAL_BASE_URL`.
- `RESEND_API_KEY` e `ANTHROPIC_API_KEY` nos exemplos do backend sem consumidores.
- Orientações do HTML de deploy para credenciais demo em contexto de produção.

## 14. Plano recomendado de correções

### Etapa 0 — Congelar publicação e proteger dados

1. Não executar migrations no banco publicado.
2. Fazer inventário somente leitura de `schema_migrations` e dados `archived`.
3. Criar backup e validar restauração em clone.

### Etapa 1 — Fechar a fronteira de autorização

1. Negar JWT de Cliente em toda árvore administrativa.
2. Aplicar capacidades por rota/método para papéis administrativos.
3. Criar testes de acesso cruzado e exclusões.

### Etapa 2 — Isolar demonstração de produção

1. Validar `APP_MODE`.
2. Remover/desabilitar rota de reset em produção.
3. Remover credenciais previsíveis e respostas que as exponham.
4. Proteger último admin.

### Etapa 3 — Sanear tokens e logs

1. Redigir token de portal.
2. Rever retenção/acesso de logs.
3. Revogar tokens possivelmente registrados.
4. Adicionar rate limit para login e portal.

### Etapa 4 — Resolver migrations legadas

1. Reproduzir a cadeia em clone do banco publicado.
2. Substituir qualquer passo destrutivo por estratégia preservadora compatível.
3. Auditar objetos de Storage.
4. Validar `015` e rollback.
5. Configurar release step única no Render.

### Etapa 5 — Endurecer Storage/upload

1. Limites de quantidade e tamanho total.
2. Validação real de conteúdo.
3. Upload direto/streaming.
4. Processo idempotente para exclusões.
5. Decisão sobre bucket privado.

### Etapa 6 — Tornar deploy reproduzível

1. Versionar lockfile.
2. Fixar Node.
3. Configurar lint.
4. Adicionar CI com build, testes, lint e verificação de migrations.

### Etapa 7 — Corrigir contratos não centrais

1. Recuperação de senha.
2. Tela de E-mail.
3. Integrações via backend.
4. Sessão/logout.
5. Mojibake e code splitting.

## 15. Veredito final

### 1. A versão atual pode ser publicada?

**Não.** Builds e testes passam, mas há bloqueadores de autorização, perda de dados, reset de produção, logs de token e operação de migrations.

### 2. Quais itens impedem o deploy?

- JWT de Cliente alcança operações administrativas e destrutivas.
- RBAC não é garantido no backend.
- Reset destrutivo ativo em produção.
- Migration histórica `012` pode apagar dados relevantes.
- Migration `015` é obrigatória e não há release step garantida.
- Tokens privados do portal são registrados em logs.

### 3. Quais itens podem ser corrigidos depois?

- bundle/code splitting;
- mojibake;
- telas não centrais, desde que claramente desabilitadas;
- CI/manifest de infraestrutura;
- melhorias de health check;
- scheduler de Retenção;
- UX de sessão.

### 4. Há migrations pendentes ou riscos para dados existentes?

Há pelo menos uma migration nova no worktree, `015_post_soundtracks.sql`, que precisa ser aplicada antes do backend. O estado publicado é desconhecido. Há risco crítico na cadeia `007`/`012` e risco médio em dados legados sem identidade de Storage e e-mails duplicados.

### 5. Render, Vercel ou Supabase exigem alteração de configuração?

Sim:

- Render precisa de release/migration segura, variáveis validadas, Node fixado e bloqueadores corrigidos.
- Vercel precisa de `VITE_API_URL`, estratégia única de Root Directory e ausência de segredos `VITE_*`.
- Supabase precisa de preflight de migrations, backup, conferência de bucket/políticas e auditoria de objetos/dados legados.

### 6. Qual deve ser a próxima microetapa?

**Executar uma investigação somente leitura do banco publicado, em especial `schema_migrations`, quantidade/origem de posts `archived`, Clientes inativos e arquivos sem identidade, acompanhada de backup/restauração em clone.** Em paralelo futuro, a primeira correção de código deve fechar a fronteira administrativa para JWT de Cliente com testes de autorização.

