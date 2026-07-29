# Correção H-04 — Segredos e integrações no frontend

Data da validação: 2026-07-29  
Escopo: integrações do frontend, fluxo de IA e configuração server-side  
Estado: correção técnica implementada e validada; verificação operacional externa pendente

## 1. Risco e causa raiz

O frontend lia chaves, tokens, client secrets e identificadores ambíguos em
variáveis `VITE_*`. Esses valores seriam incorporados ao JavaScript público pelo
Vite. O fluxo de IA também montava autenticação do Anthropic no navegador,
chamava diretamente o provedor e incluía nomes reais de Clientes nos prompts.

A causa raiz era tratar integrações que exigem segredo como configuração e
execução do frontend. O registro visual também apresentava placeholders como se
pudessem ser ativados adicionando credenciais ao `.env` do navegador.

## 2. Inventário das integrações

| Integração | Situação anterior | Classificação | Ação aplicada |
| --- | --- | --- | --- |
| Anthropic/Claude | chave `VITE_*`, header e chamada direta pelo navegador | segredo e fluxo implementado | chave, modelo e chamada movidos para backend |
| WhatsApp Z-API | instance/token sugeridos como `VITE_*`; fluxo real já existia no backend | token secreto; instance tratada como privada/ambígua | leituras frontend removidas; registro marcado server-side; erro upstream tornou-se genérico |
| WhatsApp Twilio | SID, token e origem em placeholder frontend | token secreto; SID/origem ambíguos | placeholder desabilitado até fluxo server-side |
| GoHighLevel | API key e location ID em placeholder frontend | segredo e identificador interno | placeholder desabilitado até fluxo server-side |
| Canva | client ID e client secret no frontend | client ID público; client secret privado | placeholder desabilitado até OAuth seguro; nenhuma variável consumida |
| Resend | API key em placeholder frontend | segredo | placeholder desabilitado até fluxo server-side |
| Google Analytics | Measurement ID | identificador público | `VITE_GA_MEASUREMENT_ID` preservada e identificada como pública |

Foram encontrados sete registros. Somente IA possuía chamada frontend real. O
Z-API já executava no backend. Twilio, GoHighLevel, Canva e Resend eram
placeholders sem contrato funcional completo e não foram implementados nesta
etapa.

## 3. Classificação das variáveis

### Removidas do frontend

| Variável legada | Classificação |
| --- | --- |
| `VITE_ANTHROPIC_API_KEY` | segredo |
| `VITE_ZAPI_INSTANCE` | privada/ambígua |
| `VITE_ZAPI_TOKEN` | segredo |
| `VITE_TWILIO_SID` | privada/ambígua |
| `VITE_TWILIO_TOKEN` | segredo |
| `VITE_TWILIO_FROM` | configuração interna |
| `VITE_GHL_API_KEY` | segredo |
| `VITE_GHL_LOCATION_ID` | identificador interno |
| `VITE_CANVA_CLIENT_ID` | identificador público, mas sem fluxo implementado |
| `VITE_CANVA_CLIENT_SECRET` | segredo |
| `VITE_RESEND_API_KEY` | segredo |

Nenhuma delas é lida pelo código frontend após a correção.

### Públicas preservadas

| Variável | Justificativa |
| --- | --- |
| `VITE_API_URL` | URL pública da API do Postinder |
| `VITE_DEPLOYMENT_MODE` | flag visual pública e fail-closed do modo demo |
| `VITE_GA_MEASUREMENT_ID` | identificador público de medição; não autoriza operações |

### Configuração server-side da IA

| Variável | Uso |
| --- | --- |
| `ANTHROPIC_API_KEY` | segredo usado somente pelo adaptador backend |
| `ANTHROPIC_MODEL` | modelo server-side validado contra allowlist |
| `ANTHROPIC_TIMEOUT_MS` | timeout server-side entre 1 e 30 segundos |

A URL do provedor é fixa no adaptador. O frontend não fornece nem recebe chave,
modelo, URL ou headers upstream. Configuração ausente, vazia ou inválida deixa
somente o recurso de IA indisponível; o restante da API continua iniciando.

## 4. Arquitetura server-side implementada

Fluxo final:

`frontend autenticado` → `API do Postinder` → `C-01` → `H-03` →
`AIInsightsController` → `AIInsightsService` → `AnthropicAIProvider` →
`resposta validada e sanitizada`

O adaptador:

- usa exclusivamente configuração server-side;
- possui URL fixa;
- aceita somente o modelo allowlisted;
- monta `x-api-key` internamente;
- aplica timeout e `AbortController`;
- não chama o provedor no import ou startup;
- rejeita corpo excessivo, JSON inválido e resposta sem conteúdo textual;
- não lê nem reflete o corpo de erro upstream;
- não repassa headers ou status detalhado do provedor;
- permite `fetch` falso nos testes.

Nenhuma dependência foi adicionada.

## 5. Endpoint e capacidade

Endpoint:

`POST /api/v1/integrations/ai-insights`

Capacidade:

`ai-insights:generate`

A H-03 passou de 36 para 37 capacidades e de 43 para 44 rotas administrativas
inventariadas.

Matriz:

| Identidade/perfil | Resultado |
| --- | --- |
| `admin` | permitido |
| `manager` | 403 |
| `editor` | 403 |
| `viewer` | 403 |
| perfil ausente/desconhecido | sem capacidade |
| Cliente | bloqueado pela C-01 |
| token privado/refresh/sem token/inválido | bloqueado pela C-01 |

Somente `admin` recebeu a nova capacidade. Não havia evidência inequívoca para
conceder uma operação externa com custo a perfis intermediários.

## 6. Validação e limites do payload

O body é uma união estrita de duas ações:

- `performance`;
- `chat`.

São rejeitados campos extras, incluindo `apiKey`, `providerUrl`, `model`,
`Authorization`, IDs, nomes ou objetos brutos. Os limites incluem:

- período restrito a `week`, `month` ou `year`;
- contadores inteiros limitados;
- até 100 agregados pseudonimizados de Clientes;
- pergunta entre 1 e 500 caracteres;
- resposta upstream e texto resultante limitados;
- estrutura de desempenho validada antes de retornar ao frontend.

## 7. Minimização de dados

### Desempenho

O provedor recebe somente:

- período;
- total de postagens;
- totais aprovados, rejeitados e pendentes;
- quantidade de Clientes;
- até 100 rótulos efêmeros `Cliente N`, com total e aprovados.

### Chat

O provedor recebe:

- pergunta iniciada explicitamente pelo administrador;
- período;
- totais agregados;
- quantidade de Clientes.

O frontend substitui, antes da requisição, ocorrências conhecidas de:

- nome do Cliente por `Cliente N`;
- e-mail;
- WhatsApp;
- ID;
- token de portal.

E-mails livres e bearer tokens reconhecíveis também são removidos. O fluxo não
envia por padrão nome, e-mail, telefone, token, JWT, ID interno, URL privada,
comentários de feedback, nomes de usuários ou dados de outros Clientes.

O rótulo é calculado em memória e não cria mapa persistente de reidentificação.

## 8. Ação explícita e transparência

A integração permanece acionada somente pelos botões “Analisar agora” e
“Enviar” do chat. Não existe chamada automática em carregamento, mudança de
filtro, polling ou startup.

A interface informa no ponto da ação que a pergunta, as métricas agregadas e os
Clientes pseudonimizados serão processados pelo provedor configurado.

## 9. Integração com H-02

A sanitização central passou a reconhecer também:

- `apiKey`;
- `clientSecret`;
- `providerToken`;
- `upstreamRequest`;
- `prompt`;
- `messages`.

O adaptador não registra prompts, bodies, respostas brutas ou configuração. Os
testes capturaram logs e respostas com sentinelas sintéticos e encontraram zero
ocorrências dos valores sensíveis.

O fluxo Z-API existente deixou de refletir o corpo de erro do provedor e retorna
mensagem genérica.

## 10. Tratamento seguro de falhas

| Condição | Resposta |
| --- | --- |
| payload inválido, excessivo ou com campos extras | 400 |
| sem autenticação/token inválido | C-01: 401 |
| identidade sem capacidade | H-03: 403 |
| integração ausente, vazia ou com configuração inválida | 503 genérico |
| erro HTTP ou rede do provedor | 502 genérico |
| timeout/abort | 504 genérico |
| resposta malformada ou fora do contrato | 502 genérico |

Respostas upstream `401`, `403`, `429` e `500` são tratadas sem revelar corpo,
credencial ou detalhes de configuração.

## 11. Frontend

O antigo módulo que chamava o Anthropic foi substituído por:

- construtor puro de payload minimizado;
- cliente injetável e testável;
- chamada exclusiva ao endpoint do Postinder pelo `apiClient`;
- mensagens locais seguras para `400`, `401`, `403`, `429`, `502`, `503`, `504`
  e timeout.

Foram removidos:

- leitura da chave do Anthropic;
- `fetch` direto ao provedor;
- header externo;
- URL do provedor;
- prompt contendo nomes reais;
- instruções para adicionar segredos ao `.env` frontend;
- instruções equivalentes na tela de integrações.

## 12. Arquivos da H-04

Criados:

- `apps/admin/src/services/integrations/ai.core.js`;
- `apps/admin/src/services/integrations/ai.integration.test.js`;
- `backend/src/modules/integrations/domain/AIInsight.ts`;
- `backend/src/modules/integrations/application/AIInsightsService.ts`;
- `backend/src/modules/integrations/infrastructure/AnthropicAIProvider.ts`;
- `backend/src/modules/integrations/presentation/controllers/AIInsightsController.ts`;
- `backend/src/modules/integrations/presentation/routes/integrations.routes.ts`;
- `backend/src/modules/integrations/aiInsights.test.ts`;
- `CORRECAO_H04_SEGREDOS_INTEGRACOES_FRONTEND.md`.

Alterados:

- `.env.example`;
- `apps/admin/package.json`;
- `apps/admin/src/components/ai/AIInsightsPanel.jsx`;
- `apps/admin/src/features/settings/IntegrationsPage.jsx`;
- `apps/admin/src/services/integrations/ai.integration.js`;
- `apps/admin/src/services/integrations/registry.js`;
- `backend/.env.example`;
- `backend/package.json`;
- `backend/src/app.ts`;
- `backend/src/config/environment.ts`;
- `backend/src/modules/auth/domain/AdminCapability.ts`;
- `backend/src/modules/clients/presentation/controllers/ClientsController.ts`;
- `backend/src/shared/authorization/AdminRoutePolicy.ts`;
- `backend/src/shared/middlewares/adminAuthorization.test.ts`;
- `backend/src/shared/utils/logSanitizer.ts`.

O worktree já possuía alterações das etapas anteriores. Nenhuma foi descartada,
sobrescrita ou incluída em operação Git mutável.

## 13. Testes adicionados

### Backend H-04 — 26 testes

- schema estrito e limites;
- minimização e pseudonimização;
- rejeição de chave, URL, modelo e campos extras;
- resposta do provedor validada;
- configuração ausente, vazia e inválida;
- URL fixa, modelo allowlisted e autenticação server-side;
- erros upstream `401`, `403`, `429` e `500`;
- falha de rede, timeout/abort e resposta malformada;
- endpoint HTTP real;
- matriz de perfis e identidades;
- controller não chamado nas recusas de autenticação/autorização;
- provider não chamado nas recusas de entrada;
- logs, respostas e sanitização sem sentinelas.

### Frontend — 4 testes H-04

- agregação e pseudonimização;
- remoção de nomes, e-mail, token e IDs conhecidos;
- chamada exclusiva à API do Postinder;
- ausência de chave, URL, modelo e Authorization no body;
- erros seguros;
- busca estática nas fontes de integração.

## 14. Comandos e resultados

| Comando | Resultado |
| --- | --- |
| `npm run test:h04` no backend | 26/26 |
| `npm run test:auth` | C-01: 33/33 |
| `npm run test:c02` | C-02: 18/18 |
| `npm run test:h02` | H-02: 14/14 |
| `npm run test:h03` | H-03: 40/40 |
| `npm test` no backend | 139/139 |
| `npm test` no frontend | 14/14 |
| `npm run build` no backend | aprovado |
| `npm run build` no frontend | TypeScript e Vite aprovados |
| build frontend com sentinelas sintéticos | aprovado |
| scan recursivo de `dist` | 0 ocorrências |
| `git diff --check` | aprovado |

O Vite informou apenas que o chunk principal, com aproximadamente 597 kB
minificado, supera a recomendação de 500 kB. É um aviso de desempenho já fora
do escopo da H-04 e não indica exposição de segredo.

Nenhum provedor real, Vercel, Render, Supabase, banco ou Storage remoto foi
acessado. Nenhuma migration foi executada.

## 15. Bundle scan

O build de produção foi executado com o mesmo sentinela sintético atribuído às
onze antigas variáveis secretas ou ambíguas. Foram inspecionados recursivamente
JavaScript, HTML, CSS e demais artefatos gerados em `dist`.

Resultado:

`BUNDLE_SENTINEL_OCCURRENCES=0`

Não foi utilizado qualquer segredo real.

## 16. Busca estática final

### Frontend

- zero ocorrência de `VITE_ANTHROPIC_API_KEY`;
- zero ocorrência dos antigos `VITE_*` de Z-API, Twilio, GoHighLevel, Canva e
  Resend;
- zero chamada ao domínio da API do Anthropic;
- zero header `x-api-key`;
- zero `fetch` de integração externa;
- nenhuma credencial de integração em `localStorage` ou `sessionStorage`;
- somente `VITE_API_URL`, `VITE_DEPLOYMENT_MODE` e
  `VITE_GA_MEASUREMENT_ID`, todas classificadas como públicas.

Os access e refresh tokens encontrados em `localStorage` pertencem ao mecanismo
de sessão existente e ao achado M-04, não à configuração de integrações. Eles
não foram alterados nesta etapa.

### Backend

- URL do Anthropic e `x-api-key` aparecem somente no adaptador server-side;
- chave lida somente de `ANTHROPIC_API_KEY`;
- Z-API continua exclusivamente server-side;
- ocorrências de `Authorization`/`Bearer` restantes pertencem à autenticação da
  C-01 ou à sanitização da H-02;
- nenhuma chave hardcoded ou fallback secreto foi encontrado.

## 17. Limitações e decisões pendentes

- Não foi verificado se credenciais já foram configuradas historicamente na
  Vercel ou publicadas em bundles anteriores.
- Não foi verificado se valores equivalentes já existem no Render.
- O modelo allowlisted preserva o contrato já usado pelo projeto; alterar
  provedor ou modelo exige decisão técnica própria.
- `manager`, `editor` e `viewer` ficaram sem a capacidade por ausência de uma
  política de produto inequívoca.
- Perguntas livres são necessárias ao chat. O frontend remove dados conhecidos e
  informa o processamento externo, mas uma decisão formal sobre provedor,
  privacidade e base de tratamento continua pendente.
- Canva Client ID é público, mas foi removido porque não existe fluxo OAuth
  funcional. Reintroduzi-lo depende de implementação específica.
- Não foram implementados Twilio, GoHighLevel, Canva ou Resend.
- Os testes usam providers falsos e não validam contrato real ou disponibilidade
  comercial do Anthropic.

## 18. Riscos residuais

Qualquer credencial que tenha aparecido em um deployment público anterior deve
ser considerada potencialmente comprometida. Corrigir o código atual não revoga
chaves nem remove bundles históricos.

O deploy continua bloqueado condicionalmente até a verificação operacional dos
painéis e bundles publicados confirmar a ausência de exposição ou concluir a
rotação necessária.

## 19. Checklist operacional pendente

Antes do deploy:

1. verificar se alguma credencial secreta foi configurada historicamente como
   `VITE_*` na Vercel;
2. remover essas variáveis do frontend;
3. configurar segredos equivalentes somente no Render/backend;
4. considerar comprometida qualquer credencial publicada em bundle acessível;
5. rotacionar credenciais previamente expostas;
6. invalidar tokens antigos quando aplicável;
7. gerar novo build depois da remoção;
8. confirmar que deployments antigos não continuam em uso;
9. inspecionar o bundle publicado;
10. validar logs sanitizados.

Nenhum item dessa lista foi executado nesta microetapa.

## 20. Veredito

**Correção técnica H-04 concluída.**

O frontend não consome segredos, não chama diretamente o provedor de IA e não
incorpora os sentinelas ao bundle. Operações secretas ocorrem somente no
backend, após C-01 e a capacidade exclusiva da H-03. O payload foi minimizado,
os erros e logs são seguros e todos os testes e builds passaram.

Não é possível afirmar que nunca houve exposição histórica. A liberação
operacional do deploy para este achado depende da verificação posterior de
Vercel, Render e bundles já publicados.

## 21. Próxima única microetapa recomendada

Executar uma **verificação operacional somente leitura da H-04** nos painéis da
Vercel e do Render e nos bundles publicados, para identificar credenciais
históricas. Caso seja encontrada exposição, a rotação e invalidação devem ser
autorizadas e executadas em uma microetapa separada.
