# Investigação operacional H-04 — Vercel, Render e bundles publicados

## 1. Objetivo

Verificar, em modo somente leitura e sem visualizar valores de variáveis, o
estado operacional posterior à correção técnica H-04: configuração nominal de
ambiente na Vercel e no Render, deployment frontend ativo, bundles públicos e
deployments históricos ainda acessíveis.

## 2. Escopo e proteções

- Nenhum valor de variável foi lido, baixado, copiado, impresso ou registrado.
- Nenhum arquivo `.env` real, cache de CLI ou token de plataforma foi aberto.
- Nenhum login, vínculo de projeto, shell remoto, consulta a banco, chamada a
  provedor de integração, build, deploy ou operação Git mutável foi executado.
- A inspeção remota limitou-se às páginas de login dos painéis, para constatar a
  ausência de sessão, e ao HTML/JavaScript público do próprio Postinder.
- O JavaScript publicado foi tratado como texto e não foi executado.
- Evidências temporárias foram mantidas fora do repositório e reduzidas a
  metadados, contagens e hashes neste relatório.
- O HTML, o bundle e os snapshots auxiliares temporários foram removidos após a
  validação; nenhum artefato remoto foi preservado no disco ou no Git.

## 3. Data e estado local

- Verificação iniciada em: **2026-07-29 19:49:08 -03:00**.
- Branch: `Consolidação-arquitetura`.
- `HEAD`: `59adbe20a5c54678379e07841a179e163fd4cfe4`.
- Assunto do `HEAD`: `Ajustes finos e correção vídeo`.
- Data do `HEAD`: **2026-07-17 14:46:43 -03:00**.
- O worktree já estava extensamente modificado pelas microetapas anteriores. O
  estado inicial foi preservado; esta investigação não alterou esses arquivos.

## 4. Mecanismos read-only utilizados

- consultas locais com PowerShell, `rg` e comandos Git somente leitura;
- verificação não destrutiva da disponibilidade das CLIs;
- navegação somente leitura às páginas iniciais da Vercel e do Render;
- `Invoke-WebRequest` somente contra `https://postinder.vercel.app/` e seus
  artefatos estáticos no mesmo host;
- SHA-256 dos arquivos públicos baixados;
- busca textual e expressões regulares sem emissão de trechos encontrados.

## 5. Limitações de autenticação e vínculo

### Vercel

- Vercel CLI instalada: **não**.
- Versão da Vercel CLI: **não aplicável**.
- Vínculo local preexistente `.vercel/project.json`: **ausente**.
- Sessão no navegador disponível: **não autenticada**; a Vercel redirecionou
  para sua página de login.
- `npx`, `vercel login`, `vercel link`, `vercel pull`, `vercel env pull` e
  qualquer alternativa interativa não foram usados.

Consequentemente, não foi seguro executar `vercel env ls`, `vercel list`,
`vercel list --prod` ou `vercel inspect`. O nome e o identificador público do
projeto vinculado também não puderam ser obtidos por metadados locais.

### Render

- Render CLI instalada: **não**.
- Não existe conector/API read-only do Render já configurado.
- Sessão no navegador disponível: **não autenticada**; o Render exibiu sua
  página de login.
- Nenhuma tentativa de login, criação de API key, conexão de MCP ou leitura de
  valores foi feita.

## 6. Inventário de referência das variáveis H-04

| Variável | Integração | Classificação H-04 | Permitida no frontend atual? |
| --- | --- | --- | --- |
| `VITE_ANTHROPIC_API_KEY` | Anthropic | segredo | não |
| `VITE_ZAPI_INSTANCE` | Z-API | privada/ambígua | não |
| `VITE_ZAPI_TOKEN` | Z-API | segredo | não |
| `VITE_TWILIO_SID` | Twilio | privada/ambígua | não |
| `VITE_TWILIO_TOKEN` | Twilio | segredo | não |
| `VITE_TWILIO_FROM` | Twilio | configuração interna | não |
| `VITE_GHL_API_KEY` | GoHighLevel | segredo | não |
| `VITE_GHL_LOCATION_ID` | GoHighLevel | identificador interno | não |
| `VITE_CANVA_CLIENT_ID` | Canva | identificador público, sem fluxo implementado | não |
| `VITE_CANVA_CLIENT_SECRET` | Canva | segredo | não |
| `VITE_RESEND_API_KEY` | Resend | segredo | não |
| `VITE_API_URL` | Postinder API | pública permitida | sim |
| `VITE_DEPLOYMENT_MODE` | modo do frontend | pública permitida | sim |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics | identificador público | sim |

## 7. Vercel — ambientes e nomes de variáveis

Os ambientes Production, Preview, Development e eventuais ambientes
customizados **não puderam ser inventariados administrativamente**. A ausência
de CLI, vínculo local e sessão autenticada impediu uma consulta nominal segura.

Logo:

- nenhum nome legado foi confirmado ou descartado na configuração da Vercel;
- nenhuma data de criação/alteração ou branch associada foi obtida;
- não foi possível aplicar o gate de **exposição presumida**, que exige
  evidência de uma variável secreta legada configurada na plataforma frontend;
- a ocorrência dos nomes no bundle, descrita adiante, é evidência de código
  legado publicado, não prova isolada de que valores estavam configurados.

Captura manual necessária: Project Settings > Environment Variables, com
valores ocultos, mostrando somente nomes e escopos de Production, Preview,
Development e ambientes customizados. Nenhum campo de valor deve ser aberto.

## 8. Vercel — deployments

Sem `vercel list`/`inspect` ou painel autenticado, não foi possível enumerar IDs,
datas, branches, commits, aliases, previews ou deployments históricos.

Foi identificado publicamente:

| URL pública | Ambiente inferível | Estado HTTP | Proteção de acesso | Situação |
| --- | --- | --- | --- | --- |
| `https://postinder.vercel.app/` | produção | 200 | não protegida | ativa e acessível |

O nome do domínio consta na documentação de deploy existente e sua resposta
HTTP confirmou que ele continua servindo o frontend. O commit exato publicado
permanece **indisponível**.

## 9. Deployment atualmente ativo

- Domínio público: `https://postinder.vercel.app/`.
- Resposta: HTTP 200.
- Asset JavaScript referenciado: `assets/index-BDL-34EA.js`.
- Commit publicado: **inconclusivo por bloqueio administrativo**.
- Relação com H-04: **anterior à H-04**, confirmada pela presença dos onze nomes
  legados no bundle e pela ausência de qualquer publicação da correção local.
- Arquitetura vulnerável: **sim**, na forma de registro/configuração frontend
  legada; chamada direta ao Anthropic não foi evidenciada nesse bundle.

## 10. Bundles examinados

| Origem | Arquivo | Tamanho | SHA-256 | Source map público |
| --- | --- | ---: | --- | --- |
| produção | `index.html` | 667 bytes | `11733c662c30e867dfe422875c34cbbccfbf97e3a524272517a6398d27dc771d` | não aplicável |
| produção | `index-BDL-34EA.js` | 554.808 bytes | `e1003c4c3862a8fe9fd4d75474e5853640c22f4ab12700f6c54bb679dfc89d2a` | não referenciado |
| `dist` local pós-H-04 | `index-DqG1pDbZ.js` | 597.688 bytes | `a22b22ae0bac57b48d696b8bbaeafd9b4cc433513321cde5bbe05469fb36a4d7` | não avaliado como remoto |

Somente um bundle JavaScript público foi referenciado pelo HTML ativo. Não
houve duplicatas a eliminar nesse conjunto. O hash remoto difere do `dist`
local pós-H-04.

## 11. Evidências sanitizadas da arquitetura antiga

No bundle de produção:

| Indicador | Contagem |
| --- | ---: |
| `VITE_ANTHROPIC_API_KEY` | 3 |
| `VITE_ZAPI_INSTANCE` | 2 |
| `VITE_ZAPI_TOKEN` | 2 |
| `VITE_TWILIO_SID` | 2 |
| `VITE_TWILIO_TOKEN` | 2 |
| `VITE_TWILIO_FROM` | 2 |
| `VITE_GHL_API_KEY` | 2 |
| `VITE_GHL_LOCATION_ID` | 2 |
| `VITE_CANVA_CLIENT_ID` | 2 |
| `VITE_CANVA_CLIENT_SECRET` | 2 |
| `VITE_RESEND_API_KEY` | 2 |
| `VITE_GA_MEASUREMENT_ID` | 2 |

Resultado adicional:

- 23 ocorrências agregadas dos onze nomes proibidos pela H-04;
- zero ocorrência dos domínios de API examinados para Anthropic, Z-API,
  Twilio, GoHighLevel, Canva e Resend;
- zero `x-api-key`;
- zero `fetch` literal direto para URL externa;
- três ocorrências de `Bearer `, atribuíveis ao mecanismo geral de sessão da
  aplicação e não acompanhadas de domínio de provedor;
- zero padrão reconhecível de chave Anthropic, chave Resend ou JWT literal;
- o `dist` local pós-H-04 possui zero ocorrência dos onze nomes legados;
- três strings únicas com formato de e-mail e uma com formato de CPF no bundle
  remoto já existem literalmente no código frontend atual; nenhuma string
  nova dessas categorias foi identificada. Nenhum dado foi reproduzido.

## 12. Classificação por integração

| Integração | Nome legado no bundle | Variável na Vercel | Deployment vulnerável | Situação |
| --- | --- | --- | --- | --- |
| Anthropic | sim | inconclusivo | sim | código vulnerável publicado sem credencial evidenciada |
| Z-API | sim | inconclusivo | sim | código/configuração legada publicada sem credencial evidenciada |
| Twilio | sim | inconclusivo | sim | placeholder legado publicado sem credencial evidenciada |
| GoHighLevel | sim | inconclusivo | sim | placeholder legado publicado sem credencial evidenciada |
| Canva | sim | inconclusivo | sim | placeholder legado publicado sem credencial evidenciada |
| Resend | sim | inconclusivo | sim | placeholder legado publicado sem credencial evidenciada |
| Google Analytics | sim, identificador nominal | inconclusivo | aplicável | identificador público permitido |

Não há evidência nesta etapa de uso indevido por terceiros.

## 13. Render — nomes de variáveis e Environment Groups

O Render **não foi verificado**. A ausência de sessão/mecanismo seguro impede
confirmar nomes do serviço backend e Environment Groups.

A captura manual, sempre com valores ocultos, deve mostrar somente a presença,
ausência e escopo destes nomes:

- backend principal: `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`,
  `JWT_EXPIRY_MINUTES`, `JWT_REFRESH_EXPIRY_DAYS`, `LOG_LEVEL`,
  `APP_PUBLIC_URL`, `CORS_ORIGINS`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `DEPLOYMENT_MODE` e
  `ENABLE_DEMO_RESET`;
- integrações server-side: `ZAPI_INSTANCE`, `ZAPI_TOKEN`,
  `ZAPI_CLIENT_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` e
  `ANTHROPIC_TIMEOUT_MS`;
- legados/condicionais a conferir: `APP_MODE`, `RESEND_API_KEY`,
  `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD`;
- indevidos no backend: qualquer variável `VITE_*`;
- todos os Environment Groups vinculados, somente por nome.

A ausência de `ANTHROPIC_API_KEY` no Render não constitui exposição; mantém
apenas a IA indisponível até configuração server-side posterior autorizada.

## 14. Correlação temporal

- A leitura legada de `VITE_ANTHROPIC_API_KEY` entrou no commit
  `97becb04043eb92bbc63ec2a705fe7611ea2a055`, de
  **2026-05-09 15:50:50 -03:00**.
- O `HEAD` atual, `59adbe20a5c54678379e07841a179e163fd4cfe4`, é de
  **2026-07-17 14:46:43 -03:00** e ainda contém a arquitetura anterior.
- A implementação local da H-04 ocorreu em **2026-07-29**, aproximadamente
  entre 19:36 e 19:43, e permanece não commitada/não publicada.
- O `dist` local pós-H-04 foi gerado em **2026-07-29 19:41:10 -03:00**.
- O domínio ativo foi inspecionado em **2026-07-29 19:51 -03:00** e ainda
  contém os onze nomes legados.

Não foi possível correlacionar o bundle ativo a um SHA publicado específico,
nem comparar datas de criação de variáveis, porque esses metadados dependem da
Vercel autenticada.

## 15. Deployments antigos acessíveis

- Deployment ativo vulnerável acessível: **1**.
- Deployments de produção anteriores enumerados: **inconclusivo**.
- Previews `READY` enumerados: **inconclusivo**.
- Proteção de acesso do ativo: **ausente**; conteúdo estático público.
- Proteção de deployments históricos: **inconclusivo**.

Não se deve concluir que inexistem deployments antigos. A listagem autenticada
é necessária para conhecer a quantidade e seus URLs. Remover um deployment em
etapa futura não substituirá a rotação de uma credencial que tenha sido
publicada.

## 16. Exposições confirmadas, presumidas e inconclusivas

### Exposição confirmada

**Nenhuma** no bundle examinado. Não foi detectada sequência reconhecível que
pudesse ser classificada como credencial funcional.

### Exposição presumida

**Não estabelecida nesta etapa.** A condição depende de confirmar que uma
variável secreta legada estava configurada na Vercel, e esse inventário ficou
bloqueado. Isso não equivale a ausência de exposição.

### Código vulnerável publicado sem credencial evidenciada

**Confirmado.** O bundle ativo contém todos os onze nomes legados da H-04.

### Historicamente inconclusivo

Permanece para Anthropic, Z-API, Twilio, GoHighLevel, Canva e Resend, pois:

- o inventário atual e histórico de variáveis da Vercel não foi obtido;
- deployments anteriores e previews não foram enumerados;
- valores não foram — corretamente — recuperados;
- ausência de padrão reconhecível no bundle atual não prova que uma credencial
  nunca esteve em outro bundle.

## 17. Rotação, invalidação e identificadores públicos

### Rotação

Nenhuma rotação pode ser declarada obrigatória com a evidência disponível. Se a
captura nominal confirmar presença atual ou histórica do respectivo segredo na
Vercel, deverão ser rotacionados em microetapa separada:

- chave Anthropic;
- token Z-API;
- token Twilio;
- API key/token GoHighLevel;
- client secret Canva;
- API key Resend.

### Invalidação

Quando o mecanismo do provedor permitir revogação, devem ser invalidados, após
confirmação de exposição, tokens Z-API, Twilio, GoHighLevel e credenciais/tokens
OAuth Canva. Nenhuma invalidação foi executada.

### Identificadores públicos preserváveis

- `VITE_API_URL`;
- `VITE_DEPLOYMENT_MODE`;
- `VITE_GA_MEASUREMENT_ID`;
- um eventual Canva Client ID somente poderá voltar ao frontend quando existir
  um fluxo OAuth específico e autorizado; ele não integra a configuração
  frontend atual.

## 18. Busca local complementar

- O `HEAD` versionado preserva a implementação antiga.
- O worktree contém a correção H-04 ainda não publicada.
- O `dist` local pós-H-04 não contém os onze nomes legados.
- Os exemplos atuais do frontend expõem nominalmente somente
  `VITE_API_URL` e `VITE_DEPLOYMENT_MODE`; o identificador GA continua
  permitido pelo código, embora não esteja presente no exemplo atual.
- Nenhum arquivo `.env` real, cache de CLI ou credencial foi aberto.

## 19. Limitações e bloqueadores

1. Vercel sem CLI instalada, vínculo local ou sessão autenticada.
2. Render sem CLI/conector read-only ou sessão autenticada.
3. Commit e data exatos do deployment ativo indisponíveis.
4. Histórico de deployments e previews indisponível.
5. Ambientes e nomes efetivamente configurados na Vercel indisponíveis.
6. Nomes do serviço e Environment Groups no Render indisponíveis.
7. Histórico de variáveis das plataformas pode não estar disponível mesmo após
   a captura atual.
8. Ausência de source map público limita a análise ao JavaScript minificado.

## 20. Veredito operacional da H-04

**H-04 técnica corrigida localmente, mas operacionalmente ainda bloqueadora.**

O domínio público continua servindo frontend anterior à H-04. O bundle ativo
confirma a arquitetura nominal legada, porém não evidencia credencial
utilizável nem chamada direta a provedor. Como Vercel, Render e deployments
históricos não puderam ser inventariados, não é seguro declarar ausência de
exposição nem liberar o deploy por este achado.

O banco, o Storage, integrações externas e configurações de plataforma não
foram alterados. Nenhuma migration, restauração, build ou publicação foi
executada.

## 21. Próxima única microetapa recomendada

**Coletar evidência manual somente leitura dos painéis Vercel e Render, sempre
com valores ocultos.**

Na Vercel, a captura deve mostrar os nomes e escopos de variáveis por
Production, Preview, Development e ambientes customizados, além da lista de
deployments de produção/previews com URL, data, branch e commit. No Render,
deve mostrar os nomes das variáveis do backend e dos Environment Groups
vinculados. Nenhum valor deve ser aberto, copiado ou enviado.

Somente após essa evidência deve ser decidida, em microetapa separada, a rotação
ou invalidação de credenciais. Não fazer deploy antes dessa decisão.
