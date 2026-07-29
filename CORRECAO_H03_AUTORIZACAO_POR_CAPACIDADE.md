# Correção H-03 — Autorização administrativa por capacidade

Data da validação: 2026-07-29  
Escopo: backend administrativo local do Postinder  
Estado: implementada e validada

## 1. Problema e causa raiz

O backend autenticava a identidade administrativa, mas a autorização de perfil
era incompleta e distribuída. A proteção geral anterior classificava operações
principalmente pelo método HTTP para bloquear escritas do `viewer`, enquanto
alguns controllers aplicavam verificações próprias. Isso não atribuía uma
permissão explícita a cada rota e permitia que uma rota administrativa nova
herdasse acesso amplo apenas por estar atrás da autenticação.

A causa raiz era a ausência de:

- catálogo central e tipado de capacidades;
- mapa autoritativo perfil → capacidades no servidor;
- política explícita rota → capacidade;
- negação automática para rotas sem política;
- validação única dos papéis administrativos aceitos.

O frontend já ocultava algumas ações, mas essas verificações não eram e não
passaram a ser consideradas uma barreira de segurança.

## 2. Investigação inicial delimitada

### 2.1 Perfis e valores encontrados

Os perfis oficiais do domínio são:

- `admin`;
- `manager`;
- `editor`;
- `viewer`.

Eles estão definidos no enum `UserRole`, são persistidos na coluna textual
`users.role`, aparecem no JWT administrativo validado pela C-01 e podem ser
definidos na criação ou edição de usuários administrativos.

O banco não possui uma restrição `CHECK` que enumere os valores da coluna. Antes
da H-03, o controller de usuários também aceitava `gestor` e `equipe`, e o
frontend ainda contém referências legadas a esses nomes. Eles não fazem parte
do enum oficial nem possuem uma política inequívoca documentada. Por segurança:

- tokens com esses papéis não são reconhecidos como identidades administrativas
  válidas;
- criação ou atualização de usuário com esses valores retorna erro de validação;
- nenhum deles recebe capacidades.

O campo `permissions` persistido para usuários continua disponível para
compatibilidade visual, mas não participa da autorização do backend e não pode
ser usado por uma requisição para ampliar privilégios.

### 2.2 Comportamento anterior

- `adminAuthMiddleware` confirmava o contexto administrativo introduzido pela
  C-01.
- `readOnlyAdminMiddleware` permitia `GET`, `HEAD` e `OPTIONS` ao `viewer` e
  bloqueava os demais métodos.
- o controller de usuários repetia uma checagem manual de administrador;
- o reset demo possuía defesa própria de administrador, além das condições da
  C-02;
- o repositório de postagens possuía verificações adicionais para exclusão;
- as demais rotas administrativas não declaravam uma capacidade própria.

O `viewer` conseguia consultar Clientes, postagens, fila de aprovação, métricas,
atividades, notificações e fundos sonoros. A listagem de usuários já era
restrita a administrador pelo controller. Escritas por métodos não seguros eram
genericamente bloqueadas, mas a proteção não descrevia o efeito real da rota e
não era fail-closed para novas montagens.

### 2.3 Rotas fora do RBAC administrativo

Permanecem fora desta política:

- autenticação pública;
- portal por token privado;
- portal autenticado do Cliente, protegido pelo contexto `type: "client"`;
- health checks;
- arquivos estáticos de upload.

Nenhuma regra desses fluxos foi ampliada.

## 3. Modelo central de capacidades

Foi criado um catálogo tipado com 36 capacidades:

| Família | Capacidades |
| --- | --- |
| Clientes | `clients:read`, `clients:create`, `clients:update`, `clients:deactivate`, `clients:delete`, `clients:notify`, `clients:portal-access` |
| Usuários administrativos | `admin-users:read`, `admin-users:create`, `admin-users:update`, `admin-users:delete` |
| Postagens | `posts:read`, `posts:create`, `posts:update`, `posts:change-status`, `posts:submit`, `posts:resubmit`, `posts:execute`, `posts:delete`, `posts:duplicate` |
| Arquivos | `files:upload`, `files:reorder`, `files:replace`, `files:delete`, `files:review` |
| Aprovação e observabilidade | `approvals:read`, `feedback:create`, `metrics:read`, `activities:read`, `activities:create`, `notifications:read`, `notifications:update` |
| Fundo sonoro | `soundtracks:read`, `soundtracks:update`, `soundtracks:upload` |
| Manutenção | `demo-reset:execute` |

Não foi criada uma capacidade artificial quando não há endpoint administrativo
correspondente. Leituras de arquivos pertencem à leitura da postagem atual, e o
upload de fundo sonoro é representado separadamente por
`soundtracks:upload`.

As listas são congeladas. A função de autorização:

1. aceita somente o access token administrativo tipado pela C-01;
2. normaliza e valida o papel contra o enum oficial;
3. consulta exclusivamente o mapa do servidor;
4. rejeita perfil ausente, vazio, desconhecido, identidade de Cliente, token
   privado, refresh token e capacidade inexistente;
5. ignora `permissions` ou qualquer papel enviado no corpo da requisição.

## 4. Matriz perfil × capacidade

| Perfil | Capacidades concedidas | Total |
| --- | --- | ---: |
| `admin` | Todas as 36 capacidades declaradas | 36 |
| `manager` | Clientes: leitura, criação, atualização, desativação, notificação e portal; postagens: leitura, criação, atualização, status, envio, reenvio, execução e duplicação; upload/reordenação/substituição de arquivos; leituras operacionais; atualização de notificações; leitura/atualização/upload de fundo sonoro | 25 |
| `editor` | Leitura de Clientes; leitura, criação, atualização, status, envio, reenvio e duplicação de postagens; upload/reordenação/substituição de arquivos; leituras operacionais; atualização de notificações; leitura/atualização/upload de fundo sonoro | 19 |
| `viewer` | `clients:read`, `posts:read`, `approvals:read`, `metrics:read`, `activities:read`, `notifications:read`, `soundtracks:read` | 7 |
| ausente, inválido, desconhecido, `gestor`, `equipe`, Cliente ou token privado | Nenhuma | 0 |

Decisões conservadoras para perfis intermediários:

- `manager` não administra usuários, não exclui permanentemente registros, não
  revisa arquivos em nome do Cliente, não cria feedback/atividade artificial e
  não executa reset;
- `editor` não altera Clientes, não executa postagens, não exclui registros, não
  administra usuários e não executa reset;
- nenhuma capacidade ambígua foi concedida apenas porque o perfil não era
  `viewer`.

## 5. Middleware e negação por padrão

Foi implementado o middleware reutilizável
`requireCapability(capability)`. Uma identidade administrativa válida sem a
capacidade recebe:

- HTTP `403`;
- código seguro já utilizado pelo projeto;
- mensagem genérica `Insufficient access`;
- nenhuma lista de papéis ou capacidades.

A montagem administrativa usa a cadeia:

`authMiddleware` → `adminAuthMiddleware` → `requireAdminRouteCapability` →
router/controller.

`requireAdminRouteCapability` resolve método e caminho contra uma tabela
central. Se não existir uma política exata, a requisição é negada antes do
router. `HEAD` é tratado como a leitura `GET` correspondente; query string e
barra final não alteram a política.

Assim, uma nova rota montada sob `/api/v1` no router administrativo não se torna
disponível até receber uma decisão explícita.

## 6. Inventário rota × capacidade

Foram inventariadas 43 rotas administrativas, todas com uma única política:

### Notificações

| Método e rota | Capacidade |
| --- | --- |
| `GET /api/v1/notifications` | `notifications:read` |
| `POST /api/v1/notifications/read` | `notifications:update` |
| `POST /api/v1/notifications/read-all` | `notifications:update` |

### Postagens, arquivos e fundo sonoro

| Método e rota | Capacidade |
| --- | --- |
| `GET /api/v1/posts` | `posts:read` |
| `POST /api/v1/posts` | `posts:create` |
| `POST /api/v1/posts/send-batch-for-approval` | `posts:submit` |
| `GET /api/v1/posts/:id` | `posts:read` |
| `PUT /api/v1/posts/:id` | `posts:update` |
| `DELETE /api/v1/posts/:id` | `posts:delete` |
| `POST /api/v1/posts/:id/duplicate` | `posts:duplicate` |
| `GET /api/v1/posts/:id/soundtrack` | `soundtracks:read` |
| `PUT /api/v1/posts/:id/soundtrack` | `soundtracks:update` |
| `POST /api/v1/posts/:id/soundtrack/file` | `soundtracks:upload` |
| `PATCH /api/v1/posts/:id/status` | `posts:change-status` |
| `POST /api/v1/posts/:id/execute` | `posts:execute` |
| `POST /api/v1/posts/:id/files` | `files:upload` |
| `PATCH /api/v1/posts/:id/files/reorder` | `files:reorder` |
| `POST /api/v1/posts/:id/files/:fileId/replace` | `files:replace` |
| `DELETE /api/v1/posts/:id/files/:fileId` | `files:delete` |
| `POST /api/v1/posts/:id/submit-for-approval` | `posts:submit` |
| `POST /api/v1/posts/:id/send-for-approval` | `posts:submit` |
| `POST /api/v1/posts/:id/resubmit` | `posts:resubmit` |

### Clientes

| Método e rota | Capacidade |
| --- | --- |
| `GET /api/v1/clients` | `clients:read` |
| `POST /api/v1/clients` | `clients:create` |
| `GET /api/v1/clients/:id` | `clients:read` |
| `POST /api/v1/clients/:id/notify` | `clients:notify` |
| `PATCH /api/v1/clients/:id/activate` | `clients:update` |
| `POST /api/v1/clients/:id/portal-link` | `clients:portal-access` |
| `PUT /api/v1/clients/:id` | `clients:update` |
| `DELETE /api/v1/clients/:id/permanent` | `clients:delete` |
| `DELETE /api/v1/clients/:id` | `clients:deactivate` |

### Usuários administrativos

| Método e rota | Capacidade |
| --- | --- |
| `GET /api/v1/users` | `admin-users:read` |
| `POST /api/v1/users` | `admin-users:create` |
| `PUT /api/v1/users/:id` | `admin-users:update` |
| `DELETE /api/v1/users/:id` | `admin-users:delete` |

### Aprovação, feedback e atividades

| Método e rota | Capacidade |
| --- | --- |
| `GET /api/v1/approvals/queue` | `approvals:read` |
| `POST /api/v1/files/:id/approve` | `files:review` |
| `POST /api/v1/files/:id/reject` | `files:review` |
| `GET /api/v1/feedback/monthly` | `metrics:read` |
| `POST /api/v1/feedback` | `feedback:create` |
| `GET /api/v1/activities` | `activities:read` |
| `POST /api/v1/activities` | `activities:create` |

### Manutenção

| Método e rota | Capacidade |
| --- | --- |
| `POST /api/v1/maintenance/reset-demo-data` | `demo-reset:execute` |

O reset somente chega à política acima quando a C-02 montou a rota para
`DEPLOYMENT_MODE=demo` com opt-in explícito. Em produção definitiva ou demo sem
opt-in, a resposta permanece `404`, inclusive para `admin`.

## 7. Viewer, administrador e elevação de privilégio

### Viewer

A matriz automatizada percorre as 43 rotas. O `viewer` alcança somente as sete
leituras aprovadas. Todas as escritas retornam `403` antes do handler. Durante
essas recusas, os spies confirmam:

- nenhum controller privilegiado chamado;
- nenhuma consulta ou transação de banco;
- nenhum upload, substituição ou exclusão;
- nenhum registro de atividade;
- nenhum reset;
- nenhuma alteração de status.

### Administrador

O `admin` possui todas as capacidades declaradas e alcançou as 43 rotas no
harness local. Defesas de domínio mais restritas continuam válidas, e o perfil
não contorna a indisponibilidade ambiental do reset estabelecida pela C-02.

### Elevação

Somente `admin-users:create` e `admin-users:update`, concedidas apenas a
`admin`, permitem chegar às operações que recebem `role` no corpo. Foram
validados:

- `viewer` tentando criar usuário ou alterar papel;
- `editor` tentando atribuir papel superior;
- Cliente tentando acessar usuários administrativos;
- corpo contendo `role: "admin"` ou `permissions` sem ampliar a autorização;
- papéis legados, vazios ou desconhecidos rejeitados antes do repositório;
- exclusão do próprio usuário ainda bloqueada pela regra de domínio existente.

O refresh administrativo continua validando o contexto e o papel oficial por
meio da C-01. Não foi criado um sistema novo de hierarquia.

## 8. Integração com C-01, C-02 e H-02

- **C-01:** identidade ausente/inválida continua em `401`; Cliente, token
  privado, refresh token e identidade de contexto incorreto continuam
  bloqueados antes do RBAC; somente access token `type: "admin"` com papel
  oficial pode consultar capacidades.
- **C-02:** o reset continua ausente (`404`) fora de demo com opt-in. Quando
  montado, exige também identidade administrativa e `demo-reset:execute`.
- **H-02:** a camada não registra token, payload, papel ou conjunto de
  capacidades. A suíte de redação permaneceu integralmente verde.

## 9. Impacto no frontend

Nenhum arquivo do frontend foi alterado nesta microetapa. O backend é
autoritativo e o frontend já possui tratamento geral de erros HTTP.

Permanece uma divergência não bloqueadora: o frontend contém uma matriz visual
por telas e referências legadas a `gestor`/`equipe`; ela pode apresentar ações a
`manager` ou `editor` que o backend agora recusará com `403`. Alinhar a
experiência visual à matriz de capacidades exige uma decisão de produto e uma
microetapa própria; não é necessário para fechar o bloqueador de segurança.

## 10. Arquivos da H-03

Criados:

- `backend/src/modules/auth/domain/AdminCapability.ts`;
- `backend/src/shared/authorization/AdminRoutePolicy.ts`;
- `backend/src/shared/middlewares/requireCapability.ts`;
- `backend/src/shared/middlewares/adminAuthorization.test.ts`;
- `CORRECAO_H03_AUTORIZACAO_POR_CAPACIDADE.md`.

Alterados:

- `backend/src/app.ts`;
- `backend/src/modules/auth/domain/AuthToken.ts`;
- `backend/src/modules/users/presentation/controllers/UsersController.ts`;
- `backend/src/shared/middlewares/authBoundary.test.ts`;
- `backend/package.json`.

Removido:

- `backend/src/shared/middlewares/readOnlyAdminMiddleware.ts`.

O diretório de trabalho já continha alterações das microetapas anteriores e
outros arquivos não relacionados. Eles foram preservados; não houve descarte,
stage, commit ou outra operação Git mutável.

## 11. Testes e resultados

### Testes novos da H-03

O arquivo `adminAuthorization.test.ts` adiciona 38 testes cobrindo:

- catálogo e mapa imutáveis;
- quatro perfis oficiais e identidades inválidas;
- middleware com e sem capacidade;
- inventário automático das 43 rotas;
- `admin` em todas as rotas;
- matriz completa do `viewer`;
- limites representativos de `manager` e `editor`;
- tentativa de elevação por `role` e `permissions`;
- Cliente, token privado, papel legado e rota não declarada;
- composição do reset com C-01, C-02 e H-03;
- ausência de acesso local a banco e efeitos laterais nas recusas.

### Comandos executados

| Comando | Resultado |
| --- | --- |
| `npm run test:h03` | 38/38 aprovados |
| `npm run test:auth` | 33/33 aprovados |
| `npm run test:c02` | 18/18 aprovados |
| `npm run test:h02` | 14/14 aprovados |
| `npm test` | 111/111 aprovados |
| `npm run build` | TypeScript compilado sem erros |
| `git diff --check` | sem erro de whitespace; somente avisos informativos de conversão LF/CRLF em arquivos já modificados |

A suíte e o build do frontend não foram executados porque nenhum arquivo do
frontend foi alterado pela H-03.

Todos os testes usaram aplicação local, controllers/repositórios substituídos e
spies. Nenhum serviço remoto, banco publicado ou Supabase Storage foi acessado.
Nenhuma migration foi executada.

## 12. Busca estática final

A busca por declarações de rota e a comparação automática entre os routers e a
tabela de políticas encontraram:

- 43 rotas administrativas montadas;
- 43 políticas correspondentes;
- zero rota sem capacidade;
- zero política duplicada;
- rota administrativa desconhecida negada antes do router.

Classificação das verificações de papel remanescentes:

| Ocorrência | Classificação |
| --- | --- |
| `adminAuthMiddleware` | fronteira de identidade da C-01, necessária antes do RBAC |
| `MaintenanceController.ensureAdmin` | defesa adicional válida da C-02 para invocação direta |
| verificações no `PostRepository` para exclusão | defesa de domínio adicional; não substitui a capacidade de rota |
| validação de `role` no `UsersController` | validação de entrada contra o conjunto oficial |
| comparações em `apps/admin` | frontend não autoritativo e parcialmente legado |
| `readOnlyAdminMiddleware` | substituído e removido |

## 13. Ambiguidades, limitações e riscos residuais

- A política exata de produto para `manager` e `editor` não está detalhada por
  ação. Foram concedidos somente fluxos operacionais comprovados e capacidades
  ambíguas ficaram negadas.
- `gestor` e `equipe` ainda aparecem no frontend, mas não pertencem ao domínio
  oficial. Se existirem registros persistidos com esses valores, eles ficarão
  sem acesso até uma decisão de produto e eventual saneamento de dados.
- O campo `permissions` permanece persistido para compatibilidade, mas não
  representa autorização do servidor.
- A validação provou bloqueio estrutural e comportamento HTTP com mocks; não
  executou testes end-to-end contra banco ou Storage remoto, conforme o escopo.
- Não foram implementadas permissões personalizadas, ABAC, políticas no banco
  ou capacidades por tenant.

## 14. Veredito

**H-03 concluída.**

Todas as rotas administrativas atuais possuem uma capacidade explícita. A
autorização é central, tipada e deny-by-default; perfis e identidades
desconhecidos recebem zero capacidades; `viewer` permanece estritamente de
leitura; `admin` preserva as operações legítimas; perfis intermediários não
receberam permissões não comprovadas; alterações de usuários e papéis ficaram
restritas à capacidade específica; e as recusas ocorrem antes de efeitos
laterais.

C-01, C-02 e H-02 continuam aprovadas. O backend passou em 111/111 testes e no
build. Não houve acesso remoto, alteração de banco, Storage, migrations, deploy
ou operação Git mutável.

## 15. Próxima única microetapa recomendada

Executar isoladamente a correção **H-04 da auditoria pré-deploy**, sem iniciar
release step, atualização dos documentos oficiais ou deploy.
