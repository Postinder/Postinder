# Correção H-02 — redação de tokens privados do portal em logs

## 1. Objetivo e risco

Esta microetapa corrige exclusivamente a exposição de tokens privados do portal do Cliente em observabilidade, erros, respostas reflexivas e eventos de atividade.

O token funciona como credencial bearer: quem conhece um valor válido pode usar o portal até sua expiração ou revogação. Antes da correção, o valor fazia parte do path e era enviado integralmente aos logs de acesso e de erro. Em uma implantação cujo processo escreve em stdout/stderr, essas saídas integram os logs do serviço.

Nenhum token real, banco publicado, Storage remoto, provedor ou painel foi acessado.

## 2. Causa raiz

A rota pública do backend usa o prefixo `/api/v1/portal/:token`. O frontend usa `/portal/:token`.

O middleware HTTP registrava `req.path` sem redação:

```text
método + path bruto + status + duração
```

O handler global de erros também adicionava `req.path` e `error.message` diretamente ao contexto do logger. O logger central apenas repassava mensagem e metadados a `console.log`, `console.warn` ou `console.error`; não havia sanitização de URL, campos sensíveis, erros, stacks, causas ou estruturas aninhadas.

Uma subrota desconhecida podia ainda alcançar o fallback padrão ou outra árvore de middlewares, permitindo reflexão inadequada do destino solicitado.

## 3. Fluxo do token confirmado

- Geração: `crypto.randomBytes(32).toString('hex')`.
- Formato: valor opaco de aproximadamente 64 caracteres hexadecimais.
- Persistência: somente SHA-256 em `client_portal_tokens.token_hash`; o valor bruto é devolvido uma vez para compor o link.
- Validação: SHA-256 do valor recebido, comparado a `token_hash`.
- Condições: token não revogado, não expirado e Cliente ativo.
- Rota de backend: `/api/v1/portal/:token` e suas subrotas de posts, files, feedback e fundo sonoro.
- Resposta de recusa: genérica e igual para inexistente, expirado, revogado ou Cliente inativo.
- Não existe service próprio do portal. O controller usa repositories diretamente.

O modelo persistente não foi alterado e nenhum token existente foi invalidado.

## 4. Locais de exposição encontrados

| Local | Exposição anterior | Situação final |
| --- | --- | --- |
| `requestLogger.ts` | `req.path` bruto em toda resposta finalizada | destino derivado de `originalUrl/url/path`, sanitizado antes do logger |
| `errorHandler.ts` | path e `error.message` brutos | path, `Error`, stack, cause e resposta reflexiva sanitizados |
| `Logger.ts` | mensagem e metadados encaminhados diretamente ao console | todas as quatro severidades sanitizam mensagem e metadados |
| fallback de subrota do portal | podia seguir para tratamento não específico | `404` JSON genérico sem refletir a URL |
| atividade do portal | comentários/descrições podiam repetir a própria credencial | representação destinada ao evento é sanitizada; entrada funcional permanece intacta |

Não foram encontrados logs manuais de token no controller, no repository do portal ou em um service de portal. O repository envia ao PostgreSQL apenas o hash do token; não registra SQL nem parâmetros.

## 5. Estratégia central de sanitização

Foi criada uma utilidade central e sem mutação do valor original.

Ela trata:

- paths do portal no backend e frontend;
- parâmetros de query com nomes sensíveis;
- rótulos sensíveis em texto;
- cabeçalho Bearer;
- valores no formato específico do token opaco atual;
- chaves `token`, `portalToken`, `privateToken`, `accessToken`, `refreshToken`, `authorization`, `cookie`, `password` e `secret`, inclusive variantes de caixa e separadores;
- objetos aninhados e arrays;
- `Error`, `message`, `stack`, `cause` e propriedades adicionais;
- objetos circulares;
- `Buffer`;
- profundidade e quantidade máximas de entradas;
- valores nulos, escalares, datas, funções, símbolos e bigint.

Segredos extraídos do destino da requisição são usados como candidatos exatos para remover o mesmo valor caso ele reapareça em mensagem, stack, causa ou contexto sob chave não sensível. A utilidade produz uma nova representação e não altera `req`, `req.params`, objetos de domínio ou argumentos funcionais.

UUIDs e IDs normais não são redigidos genericamente.

## 6. Formato final das URLs nos logs

Exemplo abstrato:

```text
/api/v1/portal/[REDACTED]/posts?view=compact
```

Uma query sensível aparece como:

```text
?token=[REDACTED]
```

Parâmetros não sensíveis, como `view=compact`, permanecem visíveis. O logger HTTP conserva método, status e duração.

## 7. Tratamento de objetos e erros

O logger central sanitiza toda mensagem e todo metadata antes de qualquer chamada a console.

O handler global:

1. extrai candidatos secretos do destino original;
2. registra método e path sanitizado;
3. serializa e sanitiza nome, mensagem, stack, cause e campos adicionais do erro;
4. sanitiza mensagens de `AppException`, detalhes de validação e mensagens reflexivas permitidas antes da resposta;
5. mantém resposta genérica para erros internos.

O valor bruto não é incluído em mensagem pública para token inexistente, revogado, expirado ou Cliente inativo.

## 8. Eventos de atividade

Os eventos de aprovação já continham somente IDs internos e categorias.

Nos fluxos públicos que aceitam comentário, tags ou descrição, a representação enviada ao `ActivityRepository` agora remove exatamente o token da rota caso o usuário o repita no conteúdo. O texto funcional enviado ao repository de feedback/decisão permanece inalterado. Assim:

- o evento não persiste token nem URL privada;
- a validação continua usando o token real;
- comentário, feedback e decisão continuam com o contrato funcional existente.

Não foi criada atividade adicional para tentativas inválidas.

## 9. Comportamento do portal preservado

- token válido continua carregando o portal;
- token inválido, expirado, revogado ou associado a Cliente inativo continua recebendo `401` genérico;
- aprovação continua funcionando;
- solicitação de ajustes continua funcionando;
- o repository recebe o token integral original para hashing e validação;
- `req.params.token` não é substituído;
- token não é revogado nem regravado;
- o contrato de sucesso não mudou;
- a emissão deliberada do novo link pela rota administrativa permanece, pois é a entrega funcional da credencial ao administrador autorizado, não reflexão em log.

A única mudança de erro de rota é o `404` JSON genérico para subrotas desconhecidas sob `/api/v1/portal`, sem ecoar o destino.

## 10. Arquivos alterados

| Arquivo | Alteração H-02 |
| --- | --- |
| `backend/src/shared/utils/logSanitizer.ts` | sanitização central de texto, URL, objetos e erros |
| `backend/src/shared/utils/Logger.ts` | redação obrigatória antes de todos os sinks de console |
| `backend/src/shared/middlewares/requestLogger.ts` | log HTTP estruturado com destino sanitizado |
| `backend/src/shared/middlewares/errorHandler.ts` | log e respostas reflexivas sanitizados |
| `backend/src/modules/portal/presentation/controllers/PortalController.ts` | sanitização da representação destinada a atividades |
| `backend/src/modules/portal/presentation/routes/portal.routes.ts` | injeção opcional do controller para teste do roteamento real |
| `backend/src/app.ts` | injeção de teste e fallback genérico das subrotas do portal |
| `backend/src/shared/utils/logSanitizer.test.ts` | testes unitários e HTTP H-02 |
| `backend/package.json` | script `test:h02` e inclusão na suíte completa |
| `CORRECAO_H02_REDACAO_TOKENS_PORTAL_LOGS.md` | relatório exclusivo desta microetapa |

`app.ts`, `PortalController.ts` e `package.json` já continham mudanças anteriores no worktree; elas foram preservadas. Nenhum arquivo de frontend, migration ou documento oficial foi alterado pela H-02.

## 11. Testes adicionados e matriz

O arquivo H-02 usa somente credenciais sintéticas construídas em runtime; nenhum token real ou URL privada real aparece em fixture ou snapshot.

| Cenário | Log | Resposta | Atividade | Resultado funcional |
| --- | --- | --- | --- | --- |
| acesso válido | redigido | sem reflexão | sem token | portal carregado |
| inválido | redigido | genérica | nenhuma | recusado |
| expirado | redigido | genérica | nenhuma | recusado |
| revogado | redigido | genérica | nenhuma | recusado |
| Cliente inativo | redigido | genérica | nenhuma | recusado |
| query string | path e chave sensível redigidos | sem reflexão | não aplicável | query comum preservada |
| erro de repository | message/stack/cause redigidos | `500` genérico | nenhuma | erro tratado |
| erro de controller | message/stack redigidos | mensagem redigida | nenhuma | status preservado |
| erro originado em service simulado | message/stack/cause redigidos | `500` genérico | nenhuma | erro tratado |
| subrota inexistente | redigido | `404` genérico | nenhuma | URL não refletida |
| aprovação | redigido | sem token | sem token | aprovada |
| solicitação de ajuste | redigido | sem token | conteúdo redigido | comentário funcional preservado |

Os testes diretos cobrem path, query, params, body, headers, campos sensíveis múltiplos, objeto aninhado, array, erro, stack, cause, circularidade, buffer, nulos, valores não textuais, URL comum e UUID normal preservado.

Foram reportados 14 testes/subtestes H-02, todos aprovados.

## 12. Comandos e resultados

Executados em `backend`:

```text
npm run test:h02
npm run test:auth
npm run test:c02
npm test
npm run build
```

Executado na raiz:

```text
git diff --check
```

| Validação | Resultado |
| --- | --- |
| H-02 | 14 executados, 14 aprovados |
| C-01 | 33 executados, 33 aprovados |
| C-02 | 18 executados, 18 aprovados |
| suíte completa do backend | 73 executados, 73 aprovados |
| build/typecheck do backend | aprovado |
| `git diff --check` | aprovado |
| frontend | não executado; nenhum arquivo ou contrato de frontend foi alterado |
| banco, Storage ou serviço remoto | não acessados |
| migration | nenhuma executada |

O primeiro typecheck após a criação dos testes apontou que a biblioteca ES2020 não tipa o segundo parâmetro moderno de `Error`. O teste passou a atribuir `cause` explicitamente e o typecheck final foi aprovado. Essa correção foi somente de compatibilidade do teste.

Os logs de erro exibidos pelas regressões C-01/C-02 são esperados para os casos negativos. Os avisos de LF/CRLF do Git são informativos; não houve erro de whitespace.

## 13. Busca estática final

| Grupo | Classificação |
| --- | --- |
| `requestLogger` usando `originalUrl/url/path` | sanitizado antes do logger |
| `errorHandler` usando destino e `Error` | sanitizado com candidatos exatos |
| `Logger` chamando console | sanitizado centralmente |
| `req.params.token` no controller | seguro e funcional para validação; também usado como candidato de redação de atividade |
| criação da URL administrativa | funcional; entrega deliberada ao admin, não é log |
| `PortalRepository` | seguro para H-02; hash antes da query e nenhum log de parâmetros |
| demais `req.params` | não relacionados; IDs comuns |
| demais chamadas `logger.*` | passam pela sanitização central |
| `console.error` de ambiente, pool e compensação de upload | não relacionado; não recebe rota/request/token do portal no fluxo atual |
| tokens sintéticos em testes antigos e H-02 | não relacionados a segredo real; não são snapshots nem saídas esperadas |

Não foi encontrado `morgan`, `pino`, `winston` ou outro middleware automático de request logging.

## 14. Limitações e riscos residuais

- Não houve inspeção do painel nem dos logs históricos do Render. Tokens eventualmente gravados antes desta correção continuam exigindo avaliação e possível revogação em microetapa própria.
- Um proxy, CDN ou recurso de access log configurado fora do processo pode registrar a URL antes de ela chegar à aplicação. Nenhuma configuração externa foi acessada ou alterada.
- Bibliotecas adicionadas futuramente que escrevam o request diretamente no console podem contornar o logger central; o checklist de revisão deve impedir isso.
- Existem chamadas diretas a `console.error` fora do fluxo do portal. Hoje elas não recebem request, URL ou token; uma futura alteração deve migrá-las ao logger central.
- O logger redige valores hexadecimais de 64 caracteres por corresponderem ao formato atual da credencial. Isso pode ocultar também um hash SHA-256 legítimo de diagnóstico.
- A emissão administrativa do link contém necessariamente a credencial na resposta autorizada. Removê-la quebraria o recurso e não pertence ao achado de logs.
- Os testes são locais com repositories controlados; não validam configuração externa ou retenção de logs do provedor.

## 15. Itens fora de escopo

Não foram realizados:

- mudança do armazenamento persistente;
- rotação ou revogação de tokens;
- RBAC por capacidade;
- release step;
- configuração de Render ou Vercel;
- nova plataforma de observabilidade;
- migration;
- acesso ao banco publicado ou Storage;
- deploy;
- alteração de dependências;
- alteração de frontend;
- atualização de documentos oficiais;
- commit, push, merge, rebase ou checkout.

## 16. Checklist futuro no Render

Após um deploy autorizado:

1. usar apenas um token de teste revogável;
2. exercitar sucesso, recusa, erro e subrota inexistente;
3. pesquisar logs por valor integral e URL integral: ambos devem retornar zero;
4. confirmar a presença de `/api/v1/portal/[REDACTED]`, método, status e duração;
5. verificar access logs externos ao processo, se habilitados;
6. revogar imediatamente o token de teste;
7. avaliar e revogar tokens que possam ter aparecido em logs históricos.

## 17. Veredito

**H-02 corrigida e validada localmente.**

1. Token privado integral nos logs capturados: **0 ocorrências**.
2. URL privada integral nos logs capturados: **0 ocorrências**.
3. Sucesso e falhas cobertos: **sim**.
4. Middleware HTTP usa destino sanitizado: **sim**.
5. Objetos estruturados e erros são sanitizados: **sim**.
6. Eventos do portal persistem token: **não**.
7. Roteamento e validação usam o valor real: **sim**.
8. Portal, aprovação e ajuste permanecem funcionais: **sim**.
9. C-01 e C-02 continuam aprovadas: **sim**.
10. Suíte, typecheck e diff check passam: **sim**.
11. Serviço remoto ou banco publicado acessado: **não**.
12. Migration executada: **não**.
13. Alteração fora do escopo implementada: **não identificada**.

## 18. Próxima única microetapa recomendada

Implementar e validar isoladamente a correção H-03 da auditoria: autorização administrativa por capacidade/rota, sem combinar com release step, configuração do Render, migrations ou deploy.
