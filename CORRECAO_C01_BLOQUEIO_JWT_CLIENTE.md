# Correção C-01 — bloqueio de JWT de Cliente em rotas administrativas

## 1. Descrição do problema

A API aceitava um JWT de Cliente estruturalmente válido em quase todas as famílias administrativas.

`authMiddleware` verificava corretamente assinatura e expiração, mas aceitava tanto access tokens administrativos quanto de Cliente. Exceto em `/api/v1/posts`, as rotas administrativas encadeavam diretamente `readOnlyAdminMiddleware`, que só restringe escrita quando a identidade já é um admin com papel `viewer`. Um Cliente não é `viewer`; portanto, atravessava esse middleware e alcançava controllers e operações privilegiadas.

O bypass abrangia leitura administrativa e operações com potencial de criação, edição, exclusão, upload, alteração de status, atividade, notificação e reset.

## 2. Causa raiz

A causa raiz era a montagem inconsistente das rotas em `backend/src/app.ts`:

- `/posts` usava `authMiddleware`, `adminAuthMiddleware` e `readOnlyAdminMiddleware`;
- `/clients`, `/users`, `/approvals`, `/files`, `/feedback`, `/activities`, `/notifications` e `/maintenance` não usavam `adminAuthMiddleware`;
- `readOnlyAdminMiddleware` não é uma barreira de identidade administrativa; ele apenas preserva a regra de leitura do papel `viewer`;
- tokens administrativos e de Cliente são assinados pelo mesmo mecanismo, então ambos passam pela validação criptográfica genérica;
- o portal autenticado usava somente `authMiddleware` e dependia de validação tardia dentro do controller.

Não havia falha criptográfica. A vulnerabilidade era de autorização e composição de middlewares.

## 3. Modelo de identidade encontrado

### 3.1. JWT administrativo

Access token:

- assinatura: segredo de ambiente `JWT_SECRET`, sem leitura ou exposição do valor;
- marca autoritativa: `type: "admin"`;
- identidade: `userId` e `email`;
- contexto: `companyId`;
- perfil: `role`;
- permissões declaradas: `permissions`;
- validade: claims temporais padrão do JWT.

### 3.2. JWT de Cliente

Access token:

- assinatura: mesmo `JWT_SECRET`, sem leitura ou exposição do valor;
- marca autoritativa: `type: "client"`;
- identidade: `clientId` e `email`;
- contexto: `companyId`;
- não possui perfil administrativo.

### 3.3. Refresh tokens

Antes da correção, os dois tipos usavam `type: "refresh"` e eram diferenciados somente pela presença de `userId` ou `clientId`.

Agora:

- refresh administrativo: `type: "refresh"` e `context: "admin"`, além de `userId` e `email`;
- refresh de Cliente: `type: "refresh"` e `context: "client"`, além de `clientId`;
- payload legado sem `context`: rejeitado;
- payload misto contendo identidades administrativa e de Cliente: rejeitado;
- refresh token apresentado como access token: rejeitado.

Refresh tokens antigos precisam autenticar novamente. Não foi adicionada compatibilidade ambígua.

### 3.4. Token privado do portal

O token privado do portal não é JWT nem sessão administrativa. É um valor opaco e aleatório recebido no path, armazenado como hash e validado pelo fluxo próprio de `/api/v1/portal/:token`.

Apresentá-lo como Bearer em uma rota administrativa não o promove a sessão: a resposta é `401`.

## 4. Solução implementada

### 4.1. Tipagem e validação autoritativa

Foi criado `AuthToken.ts`, contendo tipos e type guards para:

- access token administrativo;
- access token de Cliente;
- refresh administrativo;
- refresh de Cliente.

Um access token administrativo só é aceito quando possui simultaneamente:

- `type: "admin"`;
- `userId` não vazio;
- `email` não vazio;
- papel pertencente ao conjunto administrativo já suportado pelo projeto.

Um access token de Cliente só é aceito quando possui:

- `type: "client"`;
- `clientId` não vazio;
- `email` não vazio.

Campos genéricos isolados não promovem um token a contexto administrativo.

### 4.2. Fronteira administrativa central

Todas as famílias administrativas foram agrupadas em um único `Router`, cuja primeira cadeia é:

```text
authMiddleware
→ adminAuthMiddleware
→ readOnlyAdminMiddleware
→ rotas/controllers
```

A ordem garante:

1. assinatura e validade;
2. contexto e identidade administrativa;
3. regra de perfil existente;
4. somente então execução do handler.

Um erro de contexto administrativo usa `403`, mensagem genérica `Administrative access required` e código `FORBIDDEN`.

### 4.3. Fronteira do Cliente

Foi criado `clientAuthMiddleware`. `/api/v1/client-portal` agora usa:

```text
authMiddleware
→ clientAuthMiddleware
→ rotas/controllers do Cliente
```

JWT administrativo, refresh token, token ambíguo ou outro contexto recebem `403` antes do controller.

O portal privado por token permanece separado e não passou a aceitar JWT.

### 4.4. Perfis administrativos

As regras preexistentes foram preservadas:

- admin mantém acesso permitido;
- perfis administrativos existentes continuam reconhecidos;
- `viewer` pode executar `GET`, `HEAD` e `OPTIONS`;
- `viewer` continua recebendo `403` em escrita;
- a validação de perfil ocorre somente depois da confirmação de contexto administrativo;
- nenhuma permissão foi ampliada.

## 5. Arquivos alterados

| Arquivo | Alteração desta microetapa |
| --- | --- |
| `backend/src/app.ts` | agrupamento central de todas as famílias administrativas e barreira própria do portal autenticado |
| `backend/src/modules/auth/application/services/AuthService.ts` | contexto explícito e validação estrita de refresh tokens |
| `backend/src/modules/auth/domain/AuthToken.ts` | novo modelo tipado e guards de identidade |
| `backend/src/shared/middlewares/adminAuthMiddleware.ts` | aceitação exclusiva de access token administrativo válido |
| `backend/src/shared/middlewares/clientAuthMiddleware.ts` | nova barreira exclusiva de access token de Cliente |
| `backend/src/shared/middlewares/authBoundary.test.ts` | novos testes unitários/HTTP da fronteira |
| `backend/package.json` | inclusão do teste C-01 na suíte e comando `test:auth` |
| `CORRECAO_C01_BLOQUEIO_JWT_CLIENTE.md` | relatório desta microetapa |

`backend/package.json` já continha mudanças preexistentes de testes de fundo sonoro. Esta microetapa preservou-as e apenas ampliou os scripts de teste.

Nenhum frontend, migration, documento oficial, configuração de provedor ou dependência foi alterado.

## 6. Inventário das rotas administrativas protegidas

Todas as famílias abaixo estão dentro do único router administrativo:

### 6.1. Notificações

- `GET /api/v1/notifications`;
- `POST /api/v1/notifications/read`;
- `POST /api/v1/notifications/read-all`.

### 6.2. Postagens, arquivos e fundo sonoro

- listagem, detalhe, criação, edição, duplicação e exclusão de posts;
- envio em lote e individual para aprovação;
- reenvio;
- mudança de status;
- marcação como executado;
- upload, substituição, remoção e ordenação de files;
- consulta, edição e upload de fundo sonoro.

Prefixo: `/api/v1/posts`.

### 6.3. Clientes

- criação, listagem e detalhe;
- notificação;
- ativação;
- geração de link privado;
- edição;
- desativação;
- exclusão definitiva.

Prefixo: `/api/v1/clients`.

### 6.4. Usuários administrativos

- listagem;
- criação;
- edição;
- exclusão.

Prefixo: `/api/v1/users`.

### 6.5. Aprovações administrativas, files e feedback

- fila administrativa: `/api/v1/approvals`;
- operações administrativas de files: `/api/v1/files`;
- feedbacks e métricas: `/api/v1/feedback`.

### 6.6. Atividades e manutenção

- histórico e criação de atividades: `/api/v1/activities`;
- reset demo via HTTP: `/api/v1/maintenance/reset-demo-data`.

O reset continua existindo e seu problema de disponibilidade em produção não foi corrigido nesta etapa. A C-01 garante somente que JWT de Cliente não pode alcançá-lo.

### 6.7. Seed e bootstrap

Os comandos de seed e bootstrap encontrados são scripts CLI, não rotas HTTP:

- `npm run db:seed-demo`;
- `npm run db:bootstrap-admin`.

Nenhum deles foi alterado ou executado.

### 6.8. Rotas deliberadamente fora do router administrativo

- `/health`, `/health/db` e `/health/storage`;
- `/uploads`, mantida com o comportamento estático existente;
- `/api/v1/auth/login`, `/refresh` e `/logout`;
- `/api/v1/portal/:token`, portal privado;
- `/api/v1/client-portal`, protegido por JWT de Cliente.

Nenhuma rota administrativa identificada permaneceu fora da proteção central.

## 7. Comportamento esperado por tipo de token

| Identidade apresentada | Rota administrativa | Portal autenticado | Portal privado |
| --- | --- | --- | --- |
| Sem token | `401` | `401` | fluxo próprio por token |
| Admin válido e permitido | permitido | `403` | não vira token privado |
| Viewer em leitura | permitido | `403` | não vira token privado |
| Viewer em escrita | `403` somente leitura | `403` | não vira token privado |
| Cliente válido | `403` antes do controller | permitido | não substitui token privado |
| Token privado como Bearer | `401` | `401` | válido somente no path correspondente |
| Token inválido/expirado | `401` | `401` | não aplicável |
| Assinatura válida, contexto incorreto | `403` | `403` | não aplicável |
| Token legado/ambíguo | `403` | `403` | não aplicável |
| Refresh token usado como access token | `403` | `403` | não aplicável |

As respostas não incluem payload, segredo, algoritmo, stack trace ou identidade.

## 8. Testes adicionados

Arquivo: `backend/src/shared/middlewares/authBoundary.test.ts`.

Foram adicionados 33 testes específicos, incluindo subtestes:

- login administrativo produz access/refresh explicitamente administrativos;
- login de Cliente produz access/refresh explicitamente de Cliente;
- refresh legítimo preserva o contexto;
- refresh legado ou misto é rejeitado sem consultar identidade;
- sem token;
- admin válido com permissão;
- viewer em leitura;
- viewer em escrita;
- Cliente válido em rota administrativa;
- token privado usado como Bearer;
- token inválido;
- token expirado;
- assinatura válida com contexto incorreto;
- contexto admin com papel não administrativo;
- access token legado sem tipo;
- refresh usado como access;
- admin recusado no portal autenticado;
- Cliente aceito no portal autenticado;
- aprovação e solicitação de ajuste pelo Cliente nas rotas próprias;
- portal privado continua carregando pelo token próprio.

Matriz administrativa representativa testada com JWT de Cliente:

- leitura;
- criação;
- edição;
- mudança de status;
- upload;
- exclusão de post;
- exclusão irreversível de Cliente;
- fundo sonoro;
- reset demo;
- usuários;
- aprovações;
- feedback/métricas;
- atividades/histórico;
- notificações.

Nos testes de rejeição:

- banco foi substituído por stub que falharia se chamado;
- contador de consultas/conexões permaneceu em 0;
- contadores de repositories e atividades permaneceram inalterados;
- a resposta ocorreu antes dos handlers;
- nenhum upload, Storage, evento, status, exclusão ou reset foi executado.

## 9. Comandos de validação

Executados em `backend`:

```text
npm run test:auth
npm test
npm run build
```

Executado no repositório:

```text
git diff --check
```

`npm run build` executa o typecheck por `tsc`.

Testes de frontend não foram executados porque nenhum arquivo ou contrato legítimo do frontend foi alterado.

## 10. Resultados

| Validação | Resultado |
| --- | --- |
| Testes específicos C-01 | 33 executados, 33 aprovados |
| Suíte completa do backend | 41 executados, 41 aprovados |
| Build/typecheck do backend | aprovado |
| `git diff --check` | aprovado |
| Banco acessado pelos testes de rejeição | não, 0 chamadas |
| Serviço remoto acessado | nenhum |
| Migration executada | nenhuma |

Os logs `[ERROR] Request error` durante os testes são esperados: representam as respostas `401`/`403` exercitadas deliberadamente. Não houve falha de teste.

O Git emitiu avisos informativos sobre possível conversão futura de LF para CRLF em arquivos já presentes no worktree. `git diff --check` terminou com código `0`; nenhum erro de whitespace foi encontrado.

## 11. Riscos residuais

- A C-01 foi corrigida, mas a autorização por capacidade/rota do achado H-03 continua fora de escopo. Perfis como editor mantêm exatamente as permissões que o backend já concedia.
- O reset demo continua disponível para identidade administrativa permitida; C-02 permanece aberto.
- Tokens privados continuam presentes em paths/logs conforme H-02; isso não foi alterado.
- Access tokens não consultam novamente o banco a cada requisição. A identidade foi validada no login e novamente no refresh; revogação imediata de um access token já emitido não foi implementada.
- Não houve teste com banco real. Os testes HTTP usaram repositories controlados e bloquearam qualquer tentativa de conexão, adequado para demonstrar a precedência da autorização.
- As rotas administrativas foram cobertas por famílias representativas. A garantia para todos os endpoints decorre adicionalmente de sua montagem atrás do mesmo router central.
- Refresh tokens emitidos antes desta correção, sem `context`, exigirão novo login.

## 12. Itens fora de escopo

Não foram implementados:

- C-02/reset demo em produção;
- H-02/redação de token nos logs;
- H-03/RBAC por capacidade;
- release step do Render;
- mudança de migrations ou aplicação de migrations;
- acesso a banco publicado, Supabase remoto ou Storage;
- deploy;
- atualização de dependências;
- alteração visual ou de frontend;
- atualização de documentos oficiais;
- commit, push, merge, rebase ou checkout.

Observações de outros achados foram mantidas apenas como riscos residuais.

## 13. Veredito

**C-01 corrigida e validada.**

Critérios:

1. JWT de Cliente é rejeitado por toda família administrativa: **sim**.
2. Rejeição ocorre antes de controller ou efeito lateral: **sim**.
3. Proteção administrativa é central: **sim**.
4. Admin legítimo continua funcionando: **sim**.
5. Viewer permanece somente leitura: **sim**.
6. Portal autenticado aceita somente Cliente: **sim**.
7. Portal privado continua restrito ao token próprio: **sim**.
8. Token antigo ambíguo é promovido a admin: **não**.
9. Build e testes passam: **sim**.
10. Banco ou serviço remoto foi acessado: **não**.
11. Houve alteração fora do escopo: **não**.

O bypass original não permanece alcançável pela montagem atual da aplicação.

## 14. Próxima única microetapa recomendada

Implementar e validar isoladamente a correção C-02: tornar a operação `reset-demo-data` inexistente ou inequivocamente proibida em produção, preservando eventual uso apenas em ambiente de demonstração explicitamente configurado.

Não combinar essa correção com H-02, H-03, configuração de Render ou deploy.
