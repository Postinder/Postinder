# Correção C-02 revisada — reset demo por finalidade do ambiente

## 1. Contexto da versão demo online

A versão atualmente publicada no Render e na Vercel é um ambiente online de demonstração e testes. Embora o backend use `NODE_ENV=production` por razões técnicas, o reset precisa continuar disponível nesse ambiente para restaurar o estado inicial da demonstração.

A correção separa o modo técnico do Node da finalidade da implantação. Nenhuma variável real de Render ou Vercel foi lida ou alterada.

Configuração futura esperada para a demo online:

```text
NODE_ENV=production
DEPLOYMENT_MODE=demo
ENABLE_DEMO_RESET=true
```

Configuração pública correspondente no frontend:

```text
VITE_DEPLOYMENT_MODE=demo
```

## 2. Risco anterior

O endpoint destrutivo estava sempre montado:

```text
POST /api/v1/maintenance/reset-demo-data
```

Após autenticação administrativa, ele:

1. consultava referências de arquivos e fundos sonoros;
2. tentava remover objetos do Storage;
3. abria conexão e transação;
4. adquiria locks de e-mail;
5. executava `TRUNCATE ... RESTART IDENTITY CASCADE`;
6. recriava o admin e o Cliente de demonstração com acessos previsíveis;
7. confirmava a transação;
8. devolvia os acessos demo no contrato da resposta.

Antes desta correção, não existia verificação de finalidade do ambiente. Um admin legítimo poderia chamar o endpoint em uma futura produção definitiva.

## 3. Causa raiz

- `NODE_ENV` era validado centralmente, mas descrevia apenas a execução técnica.
- `APP_MODE=demo` era lido diretamente e exclusivamente por `scripts/seedDemo.ts`.
- `APP_MODE` não fazia parte da configuração validada do backend e não protegia o reset HTTP.
- O controller não possuía guarda ambiental.
- A rota era montada incondicionalmente.
- O frontend sempre mostrava o item de reset para o papel `admin`.

Não existe service ou repository próprio para o reset: o controller chama diretamente pool PostgreSQL, Storage, locks e logger. Também não foi encontrado outro endpoint HTTP com efeito equivalente.

## 4. Distinção entre `NODE_ENV` e `DEPLOYMENT_MODE`

### `NODE_ENV`

Continua representando somente o modo técnico:

- `development`;
- `test`;
- `production`.

Ele não habilita nem desabilita o reset isoladamente.

### `DEPLOYMENT_MODE`

Representa a finalidade da implantação:

- `demo`;
- `production`.

A avaliação central aceita somente esses valores exatos. Ausência, vazio, diferença de caixa, espaços ou qualquer valor desconhecido deixam o reset indisponível.

Configuração desconhecida não é promovida: a avaliação retorna `invalid-deployment-mode`, o reset permanece desabilitado e o backend registra warning genérico sem expor o valor recebido.

## 5. Regra final de habilitação

Função central:

```text
isDemoResetEnabled(configuration)
```

Regra:

```text
DEPLOYMENT_MODE === "demo"
AND
ENABLE_DEMO_RESET === "true"
```

Depois da habilitação ambiental, a requisição ainda precisa atravessar:

```text
authMiddleware
→ adminAuthMiddleware
→ readOnlyAdminMiddleware
→ ensureAdmin(role === "admin")
→ confirmação textual RESETAR
→ handler
```

Não existe condição permissiva com `OR`.

## 6. Comportamento seguro por padrão

O reset retorna indisponível quando:

- `DEPLOYMENT_MODE` está ausente;
- está vazio;
- contém valor inválido;
- é `production`;
- `ENABLE_DEMO_RESET` está ausente;
- é `false`;
- possui qualquer valor diferente da string exata `true`;
- `NODE_ENV` é `production`, `development` ou `test` sem a combinação explícita.

Valores como `TRUE`, `True`, `1`, `yes`, booleano verdadeiro ou string com espaços não habilitam.

Os exemplos técnicos usam:

```text
DEPLOYMENT_MODE=production
ENABLE_DEMO_RESET=false
VITE_DEPLOYMENT_MODE=production
```

## 7. Montagem condicional da rota

`createApp` avalia a disponibilidade antes de montar as rotas administrativas.

Quando habilitado:

- `/api/v1/maintenance/reset-demo-data` é montado dentro da fronteira administrativa da C-01;
- admin autorizado alcança o controller;
- viewer e Cliente são bloqueados antes do controller.

Quando desabilitado:

- o router de manutenção não é montado;
- o caminho recebe máscara genérica `404 { "error": "Not found" }` antes dos middlewares administrativos;
- sem token, admin, viewer, Cliente ou chamada manual observam a mesma indisponibilidade;
- nenhum detalhe de configuração ou da existência do reset em demo é revelado.

## 8. Guarda defensiva

`MaintenanceController.resetDemoData` repete a avaliação central como sua primeira instrução.

Em configuração indisponível, retorna `404` antes de:

- validar confirmação;
- consultar arquivos;
- chamar Storage;
- abrir conexão;
- iniciar transação;
- adquirir locks;
- executar `TRUNCATE`;
- recriar identidades;
- registrar logs de falha;
- produzir qualquer escrita.

Essa guarda protege contra montagem futura incorreta ou chamada direta ao controller.

## 9. Autenticação e perfil

Na demo explicitamente habilitada:

| Identidade | Resultado |
| --- | --- |
| Admin legítimo | permitido após `RESETAR` |
| Viewer | `403` |
| JWT de Cliente | `403` pela fronteira C-01 |
| Refresh usado como access | `403` |
| Token privado usado como Bearer | `401` |
| Sem token | `401` |

Em produção definitiva ou configuração inválida, todos recebem `404` antes dessa matriz, pois o recurso não está disponível.

O frontend não é uma barreira de segurança.

## 10. Comportamento do frontend

Foi introduzida a variável pública:

```text
VITE_DEPLOYMENT_MODE
```

Somente o valor exato `demo`:

- mostra o item “Reset de testes” no menu;
- disponibiliza a rota visual `/admin/reset`.

Ausência, `production` ou valor inválido:

- escondem o item;
- redirecionam acesso visual direto para o dashboard.

O diálogo de confirmação, o texto `RESETAR`, o aviso destrutivo e o contrato de sucesso foram preservados. Resposta `404` é apresentada como indisponibilidade genérica, sem detalhes internos.

O frontend não possui flag capaz de habilitar o backend. Um bundle antigo que mostre o botão continua recebendo `404` quando o backend não autoriza.

## 11. Separação entre reset, seed, bootstrap e migrations

### Reset HTTP

- permanece em `/api/v1/maintenance/reset-demo-data`;
- depende de `DEPLOYMENT_MODE=demo` e `ENABLE_DEMO_RESET=true`;
- exige admin e confirmação;
- recria o estado demo na mesma operação existente.

### Seed

- continua sendo o script CLI `npm run db:seed-demo`;
- continua protegido pela regra preexistente `APP_MODE=demo`;
- não é chamado pelo startup nem pela nova função de configuração;
- não foi executado ou refatorado.

### Bootstrap

- continua sendo `npm run db:bootstrap-admin`;
- exige suas variáveis próprias;
- não é exposto por HTTP;
- não foi alterado ou executado.

### Migrations

- não dependem das novas flags;
- nenhum arquivo `001`–`015` foi alterado;
- nenhuma migration foi executada.

Não existe caminho HTTP alternativo para seed ou bootstrap.

## 12. Arquivos alterados

### Backend

| Arquivo | Alteração |
| --- | --- |
| `backend/src/config/demoReset.ts` | avaliação central, estrita e testável |
| `backend/src/config/environment.ts` | inclusão das duas entradas opcionais, preservando fail-closed |
| `backend/src/app.ts` | montagem condicional, máscara 404 e factory testável |
| `backend/src/modules/maintenance/presentation/routes/maintenance.routes.ts` | injeção da configuração/controller |
| `backend/src/modules/maintenance/presentation/controllers/MaintenanceController.ts` | guarda defensiva e dependências injetáveis para testes |
| `backend/src/modules/maintenance/demoReset.test.ts` | matriz C-02, montagem, guarda e regressão |
| `backend/src/shared/middlewares/authBoundary.test.ts` | configuração explícita da demo para regressão C-01 |
| `backend/package.json` | inclusão da suíte C-02 |

As mudanças preexistentes de fundo sonoro no controller, incluindo limpeza e tabelas adicionais, foram preservadas.

### Frontend

| Arquivo | Alteração |
| --- | --- |
| `apps/admin/src/config/deploymentMode.js` | avaliação pública estrita |
| `apps/admin/src/config/deploymentMode.test.js` | teste da visibilidade fail-closed |
| `apps/admin/src/App.jsx` | rota visual condicional |
| `apps/admin/src/components/layout/AdminLayout.jsx` | item de menu condicional |
| `apps/admin/src/features/settings/ResetDataPage.jsx` | tratamento genérico de 404 |
| `apps/admin/package.json` | inclusão do novo teste |

### Exemplos técnicos

- `.env.example`;
- `backend/.env.example`;
- `apps/admin/.env.example`.

Nenhum `.env` real foi lido ou alterado.

## 13. Matriz de ambientes

| `NODE_ENV` | `DEPLOYMENT_MODE` | `ENABLE_DEMO_RESET` | Resultado validado |
| --- | --- | --- | --- |
| production | demo | true | disponível com autenticação/perfil |
| production | demo | false | indisponível |
| production | demo | ausente | indisponível |
| production | production | true | indisponível |
| production | production | false | indisponível |
| production | production | ausente | indisponível |
| development | demo | true | disponível com autenticação/perfil |
| development | demo | false | indisponível |
| development | production | true | indisponível |
| test | demo | true | disponível no teste explicitamente preparado |
| qualquer | ausente | true | indisponível |
| qualquer | vazio/inválido | true | indisponível |

Cenário crítico comprovado:

```text
NODE_ENV=production
DEPLOYMENT_MODE=production
ENABLE_DEMO_RESET=true
admin válido
```

Resultado: `404`, controller não chamado e zero efeitos laterais.

## 14. Testes adicionados

### Backend

Foram adicionados 18 testes C-02, incluindo subtestes:

- 12 combinações obrigatórias da matriz;
- valores estritamente aceitos/recusados;
- independência de `NODE_ENV`;
- montagem real em demo habilitada;
- ausência real da rota em cenários indisponíveis;
- admin, viewer, Cliente, refresh, token privado e ausência de token;
- chamada direta ao controller em production, inválido e ausente;
- zero banco, transação, locks, Storage ou logs quando bloqueado;
- fluxo legítimo com mocks locais;
- consulta de mídias;
- remoção mockada de objeto;
- `BEGIN`;
- dois locks;
- `TRUNCATE`;
- dois inserts;
- `COMMIT`;
- liberação da conexão;
- contrato HTTP de sucesso preservado.

### Frontend

Foi adicionado 1 teste específico para:

- `demo` exato visível;
- `production`, ausência, vazio, caixa diferente, espaços e valores semelhantes ocultos.

### Regressão

- suíte C-01: 33 testes;
- suíte de domínio de fundo sonoro: 8 testes.

## 15. Comandos e resultados

### Backend

```text
npm run test:c02
npm run test:auth
npm test
npm run build
```

Resultados finais:

- C-02 específica: 18/18;
- C-01 específica: 33/33;
- suíte completa do backend: 59/59;
- build/typecheck: aprovado.

Uma execução intermediária do build detectou que a variável do servidor efêmero no novo teste poderia ser `undefined`. A anotação de nulabilidade do teste foi corrigida; o build final passou sem erros.

### Frontend

```text
npm test
npm run build
```

Resultados:

- suíte completa: 10/10;
- build TypeScript/Vite: aprovado.

### Repositório

```text
git diff --check
```

Resultado: aprovado, código de saída `0`.

Total das suítes completas finais: 69 testes aprovados.

Warnings:

- logs `[ERROR] Request error` são respostas `401`/`403` exercitadas deliberadamente;
- Vite informou chunk principal de aproximadamente 590 kB, risco preexistente e fora do escopo;
- Git informou possíveis conversões futuras LF/CRLF, sem erro de whitespace.

Nenhum serviço remoto, banco ou Storage real foi acessado.

## 16. Comportamento esperado no Render demo

Configurar posteriormente no backend Render:

```text
NODE_ENV=production
DEPLOYMENT_MODE=demo
ENABLE_DEMO_RESET=true
```

Configurar posteriormente no frontend Vercel:

```text
VITE_DEPLOYMENT_MODE=demo
```

Efeito:

- otimizações e comportamento técnico continuam de produção;
- reset permanece visível na interface demo;
- endpoint existe;
- somente admin autenticado e confirmação `RESETAR` executam;
- C-01 continua bloqueando JWT de Cliente.

Essas alterações nos painéis não foram realizadas nesta microetapa.

## 17. Comportamento esperado na produção definitiva

Backend:

```text
NODE_ENV=production
DEPLOYMENT_MODE=production
ENABLE_DEMO_RESET=false
```

Frontend:

```text
VITE_DEPLOYMENT_MODE=production
```

Efeito:

- botão e rota visual ocultos;
- endpoint destrutivo não montado;
- chamada manual recebe `404`;
- admin legítimo não pode executar reset;
- `ENABLE_DEMO_RESET=true` configurado acidentalmente continua insuficiente;
- guarda defensiva bloqueia chamada direta ao controller.

## 18. Limitações

- O fluxo destrutivo legítimo foi validado com mocks locais, não com banco/Storage reais.
- Os testes confirmaram a sequência transacional e o contrato, mas não executaram `TRUNCATE` real.
- O frontend lê a configuração no build; mudar `VITE_DEPLOYMENT_MODE` exige novo build/publicação do frontend.
- A configuração real do ambiente demo ainda precisa ser feita posteriormente nos painéis.
- `APP_MODE` continua existindo apenas para a seed CLI; uma unificação ampla de modos ficou fora do escopo.
- A máscara 404 é específica para o caminho atual do reset. Não foi encontrado endpoint equivalente.

## 19. Riscos residuais

- H-02, exposição de token privado em logs, permanece aberto.
- H-03, RBAC por capacidade no backend, permanece aberto.
- O reset demo continua intencionalmente destrutivo quando explicitamente habilitado e chamado por admin.
- A remoção de objetos do Storage ocorre antes da transação PostgreSQL, comportamento preexistente não alterado.
- As credenciais previsíveis da demo permanecem no contrato do reset, aceitáveis somente no ambiente explicitamente classificado como demo.
- Configuração incorreta do ambiente demo para `production` ocultará o reset; esse é um fail-safe, não uma abertura.

## 20. Veredito

**C-02 revisada corrigida e validada.**

1. Demo online pode manter reset com `NODE_ENV=production`: **sim**.
2. `NODE_ENV` decide sozinho: **não**.
3. Produção definitiva disponibiliza reset: **não**.
4. `production + ENABLE_DEMO_RESET=true` permanece bloqueado: **sim**.
5. Configuração ausente/inválida bloqueia: **sim**.
6. Rota deixa de ser montada quando indisponível: **sim**.
7. Guarda defensiva antecede todos os efeitos: **sim**.
8. Admin continua autorizado na demo: **sim**.
9. Viewer e Cliente continuam bloqueados: **sim**.
10. Frontend é barreira autoritativa: **não**.
11. Seed, bootstrap e migrations continuam separados: **sim**.
12. Builds e testes passaram: **sim**.
13. Serviço remoto foi acessado: **não**.
14. Migration ou deploy foi executado: **não**.

## 21. Próxima única microetapa recomendada

Implementar e validar isoladamente H-02: redigir tokens privados do portal nos logs de requisição e erro, preservando rastreabilidade sem registrar o bearer token contido no path.

Não combinar essa correção com RBAC, release step, alteração de provedores ou deploy.
