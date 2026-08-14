# Estado Atual do Postinder

## Fluxo configuravel de aprovacao do Cliente - pacote local auditado e nao publicado

- Branch atual: `configuracoes-gerais-plataforma`. Implementacao, auditoria e documentacao ocorreram sem commits intermediarios; o pacote esta tecnicamente concluido no worktree, mas ainda nao foi commitado nem publicado.
- A configuracao global **Forma de aprovacao do cliente** aceita `content` e `item`. O default e fallback para instalacoes antigas e `content`; overrides simplificado/detalhado do portal nao alteram essa escolha global.
- Em `content`, a postagem inteira recebe uma unica decisao. Em `item`, cada midia recebe um draft provisorio editavel e todas as escolhas so se tornam oficiais em **Concluir analise**. Todos aprovados resultam em `approved`; qualquer reprovado resulta em `rejected`.
- Navegacao dentro da postagem e livre, inclusive por indicadores clicaveis, e nunca consome rewind. O rewind reabre no nivel da postagem apenas a conclusao elegivel mais recente do Cliente, uma vez por ciclo; um novo envio/reenvio reseta a permissao do novo ciclo.
- A conclusao oficial aplica um snapshot sob lock e transacao. Retry e duplo submit sao idempotentes; uma conclusao concorrente prevalece e a outra recebe `already_completed`. Autosave usa os mesmos locks para nao atravessar a conclusao.
- Drafts item a item nao alimentam estado canonico, metricas, feedback, atividade ou notificacao. Conclusao em modo `content`, envio e reenvio removem drafts obsoletos aplicaveis.
- Contadores operacionais por estado representam o estado canonico atual da postagem. Quantidade de arquivos, cliques, drafts ou revisoes intermediarias nao multiplica o total de posts aprovados/reprovados; analises historicas de primeira decisao, arquivos e feedbacks continuam separadas em Insights.
- **Selecionar todos** usa a lista carregada e visivel nos filtros atuais e inclui somente `draft`, `ready` ou `rejected` com ao menos uma midia, ou E-mail Marketing como unico canal com URL nao vazia. Checkbox individual, mestre, estado `indeterminate`, modal e API usam o mesmo conjunto contextual.
- Soundtrack permanece compativel, opcional e secundario. Ausente, desabilitado ou `none` nunca bloqueia. No modo `item`, sua decisao isolada nao conclui/reprova a postagem; uma trilha aplicavel pendente so bloqueia quando o snapshot visual resultaria em aprovacao.
- Cada submissao oficial possui `content_revision`; aprovacao e execucao selam `approved_revision` e `executed_revision`. Conteudo protegido exige reabertura para alteracao material, e operacoes stale sao recusadas por `expectedRevision`.
- Funil permanece configuravel como `hidden|optional|required`. `platform_settings.post_field_client_visibility` usa `{"funnel_tag": false}` por default, e `posts.review_field_visibility` preserva o snapshot de cada revisao sem reescrita retroativa.
- A migration local mais recente e `023_soundtrack_history_append_only.sql`. A `021` introduz revisao/certificacao e historico oficial, a `022` adiciona visibilidade/snapshot do funil e a `023` protege versions/decisions de soundtrack como append-only preservando hard deletes em cascade.
- A auditoria independente corrigiu: SQL PostgreSQL `42P08`, corrida autosave/conclusao, drafts obsoletos, elegibilidade divergente no lote, estado intermediario causado por soundtrack, reset de rewind em E-mail Marketing sem arquivo, integridade cruzada de drafts e default legado de funil.
- Gate tecnico final: typecheck e build backend aprovados; backend 211/211; PostgreSQL de revisao 26/26; portal approval 12/12; soundtrack focal 8/8; retention focal 7/7; validator integrado de soundtrack e gate append-only aprovados; `git diff --check` aprovado. As migrations `021`/`022` foram ensaiadas sobre dump sanitizado representativo, e a `023` em PostgreSQL 18.4 descartavel; a segunda execucao do migrador foi no-op.
- Ressalva tecnica baixa: estado oficial, revisao e feedback sao atomicos, mas `activity_events` e gravado pelo controller depois do commit transacional da decisao oficial no banco, em modo best-effort. Uma falha pode omitir esse evento secundario sem corromper postagem, revisao, feedback ou metricas. Outbox/transacao compartilhada nao foi implementada.
- O proximo passo seguro e auditar o diff final e criar um commit local autorizado. Deploy continua pendente e exigira migrations `017` a `023`, backup/preflight e smoke tests no ambiente publicado.

## Configuracoes gerais da plataforma — pacote local nao publicado

- A instalacao passa a ter um singleton `platform_settings`, separado de `platform_branding` e sem `agency_id`, `tenant_id` ou arquitetura multiagencia. A area `/admin/platform-settings` e exclusiva do admin na interface; `GET /api/v1/platform-settings` possui leitura administrativa e `PATCH` exige a capacidade exclusiva `platform-settings:update`.
- Defaults de dominio: retencao de 24 horas, fundo sonoro desligado, WhatsApp/segmento/prazo opcionais, documento oculto, legenda/data opcionais, funil oculto e portal global simplificado com aprovacao sequencial em modo `content`. Nome, e-mail e senha de Cliente e cliente/titulo/canal de postagem permanecem invariantes.
- Ao marcar uma postagem aprovada como `executed`, o backend grava `executed_at` e prazo calculado com a configuracao vigente. Somente registros executados com timestamp confiavel e prazo vencido sao elegiveis. Postagens historicas sem prazo seguro nao recebem backfill.
- A limpeza roda no startup e a cada hora, em lotes globais de ate 50, com lock por objeto, rechecagem transacional e retry. Remove apenas o objeto fisico; registros, decisoes, historico e metricas permanecem. `storage_deleted_at` marca sucesso e a interface mostra o arquivo removido sem URL quebrada.
- O toggle de fundo sonoro preserva tabelas e historico. Desligado, novas postagens usam `none` e a trilha nao bloqueia; ligado, somente uma trilha existente e aplicavel participa como condicao secundaria conforme o modo de aprovacao.
- O portal usa defaults globais de lista, informacoes complementares, sequencia e forma de aprovacao. `clients.portal_mode_override` e anulavel: `NULL` herda imediatamente a plataforma; `simplified` e `detailed` alteram apresentacao/sequencia sem substituir `approval_mode`. O booleano legado da migration 018 continua aceito e `true` historico permanece detalhado.
- `019_platform_settings.sql` cria o singleton e o override sem backfill; `020_portal_approval_mode_and_review_drafts.sql` adiciona modo de aprovacao e drafts; `021` a `023` completam revisao/certificacao, snapshot de visibilidade e imutabilidade do historico de soundtrack. Todas permanecem nao publicadas. A cadeia completa ate `023` foi validada em PostgreSQL local descartavel.
- Branding permanece em area, tabela e endpoints proprios; cores, white label e multiempresa nao foram adicionados.

## Status da auditoria e da publicacao

- A auditoria tecnica pre-deploy foi concluida.
- Os bloqueadores tecnicos C-01, C-02, H-02, H-03 e H-04 foram corrigidos e validados localmente.
- O gate atual aprovou 211 testes de backend, 26 testes PostgreSQL de revisao, 12 de portal approval, 8 focais de soundtrack e 7 de retention, alem do validator integrado, typecheck, build backend e validacao final do diff.
- As correcoes anteriores foram publicadas em 30/07/2026: backend e frontend foram atualizados, e `/health`, `/health/db` e `/health/storage` responderam com sucesso.
- A hotfix de CPF/CNPJ e `deadline_days` foi commitada, enviada ao Git e publicada em backend e frontend em 31/07/2026.
- A migration `016_client_documents.sql` foi aplicada com sucesso e confirmada em producao. O ultimo schema publicado esta em `016`; no codigo local, as migrations `017` a `023` permanecem pendentes.
- O ambiente permanece em modo demo para avaliacao da 20Cinco em `https://portal-20cinco.vercel.app`.

## Rodada local para novos testes com Clientes

- O portal usa por padrao uma fila guiada: data prevista crescente, depois criacao e ID; itens sem data ficam por ultimo. No modo simplificado somente a primeira postagem pendente pode ser revisada, e a decisao faz a fila avancar ate **Tudo em dia**.
- `clients.portal_detailed_view` permite restaurar por Cliente o seletor de postagens e a visao geral. O default explicito e `false`, inclusive para Clientes antigos, e a mesma configuracao vale no portal por token e no portal autenticado sem exigir novo link.
- O link principal do portal pode ser consultado, copiado e aberto novamente. Tokens novos continuam validados pelo hash e recebem copia cifrada AES-256-GCM somente para recuperacao administrativa autorizada. Criacao nao substitui link ativo; substituicao e explicita, confirmada e transacional. Links antigos baseados apenas em hash continuam validos, embora nao recuperaveis.
- E-mail Marketing exige preview `http://` ou `https://`. Quando for o unico canal, anexos sao opcionais e a decisao ocorre pela postagem; combinacoes com outros canais mantem a exigencia normal de arquivos. O portal abre a previa em nova aba, sem iframe nem fetch backend.
- A criacao de Cliente deixou de exibir, validar ou enviar CPF/CNPJ; leitura e edicao de registros antigos continuam compativeis e nenhuma coluna ou dado historico foi removido.
- Canais usam icones vetoriais; `3A3R` nao e oferecido nem aceito em novas postagens, mas valores historicos podem ser preservados em edicao. Fundo sonoro permanece sob feature flag, mantendo tabelas, services e historico compativeis sem assumir papel central na aprovacao.
- O viewer preserva swipe e botoes de decisao e adiciona anterior/proximo entre anexos pendentes, com indicador, estados desabilitados e bloqueio de propagacao. A Previa do Feed usa o texto **Todos status**.
- Instagram oferece Card, Carrossel, Stories, Reels e Foto para novas selecoes; valores historicos continuam legiveis. Drag-and-drop foi adiado porque nao ha infraestrutura leve reutilizavel; as setas de ordenacao e `sort_order` permanecem.
- A migration aditiva `018_client_portal_preferences_and_recoverable_links.sql` foi aplicada em PostgreSQL 18.4 local temporario pelo migrador oficial e a segunda execucao foi no-op. Nenhuma publicacao ou acesso a producao foi realizado.

## Correcao local de branding ainda nao publicada

- A tentativa anterior consistia em SVGs hardcoded e duplicados na barra lateral e no portal; o PNG versionado nao era renderizado e nao existiam banco, API, upload ou persistencia.
- Login e recuperacao permanecem Postinder e ficam estruturalmente fora do `BrandingProvider`, sem consulta a `GET /api/v1/branding`. A identidade configuravel atua somente na area administrativa, no portal por token e na area autenticada do Cliente, com previa, confirmacao explicita e fallback Postinder. Nenhuma variavel `VITE_*` foi adicionada.
- A migration aditiva `017_platform_branding.sql` persiste somente identidade de Storage, MIME, tamanho e versao. Ela esta local e nao foi aplicada em producao.
- A leitura publica e `GET /api/v1/branding`; upload e remocao usam `/api/v1/branding/logo` e a capacidade `branding:update`, exclusiva de `admin`.
- PNG, JPEG e WebP estaticos de ate 2 MB e 16 milhoes de pixels sao confrontados por MIME/extensao/formato. WebP animado, APNG, multipagina, truncamentos e PNG com chunks ou CRC invalidos sao recusados antes do Storage; a unica imagem estatica e decodificada com Sharp. A substituicao confirma a nova referencia antes de remover a anterior, e paths UUID mais `logo_version` evitam cache obsoleto.
- `logo_configured` deriva da referencia persistida e permite ao admin remover configuracao cuja URL esteja temporariamente indisponivel, sem expor bucket ou path. Frontend novo usa `logo_url` somente como fallback para backend antigo sem o booleano. O logo da empresa usa texto alternativo proprio; o fallback continua identificado como Postinder.
- Multer 2.2.0, limite de um arquivo/nenhum campo e semaforo local de duas decodificacoes reduzem os riscos do endpoint administrativo. Lockfiles v3 da raiz, backend e frontend, `npm ci`, Node 24.x, npm 11.13.0 e `.npmrc` por artefato tornam os fluxos reproduziveis mesmo quando npm inicia nos subdiretorios.
- A rodada local atual foi validada com 161/161 testes de backend, 45 testes frontend legados e 22 testes React reais, alem dos builds dos dois projetos. O migrador oficial havia aplicado `016` e `017` somente no PostgreSQL local e confirmado idempotencia; nenhuma migration foi aplicada em producao.

## Rodada visual e funcional publicada

- A Previa do Feed reconhece videos pelo mecanismo compartilhado de midia e usa `MediaPreview`, sem enviar URL de video para `<img>`. Imagens preservam o comportamento anterior, a primeira midia continua seguindo a ordenacao oficial dos arquivos e nao houve alteracao de Storage, API ou backend para gerar thumbnails.
- No Dashboard, **Atividade recente** e **Postagens** iniciam recolhidas, expandem de forma independente e mantem seus conteudos montados. O estado e local a cada carregamento, e os controles expõem `aria-expanded`, `aria-controls` e regioes associadas.
- No portal do Cliente, a area principal de aprovacao permanece prioritaria. No modo detalhado, **Visao geral / Acompanhamento do conteudo** inicia recolhida e preserva aba ativa, filtros e dados; no modo simplificado default, esse conjunto periferico fica oculto. O antigo desfazer por arquivo foi substituido pelo rewind controlado da postagem concluida.
- Imagens e videos compartilham navegacao e interacoes de decisao: o gesto horizontal preserva rolagem vertical, protege clique residual, controles nativos e fullscreen padrao/WebKit, e nao remonta o video. Os botoes explicitos **Aprovar** e **Reprovar** continuam disponiveis; no modo `item`, a escolha permanece provisoria ate **Concluir analise**.
- A tela principal do portal ganhou coluna lateral responsiva mais estreita, cards compactos, cabecalho e resumo centralizados e mais espaco para a midia principal. `object-contain`, videos verticais, breakpoints e experiencia movel foram preservados.
- O portal do Cliente adotou a identidade visual da 20Cinco em temas claro e escuro, com tokens restritos ao portal, magenta em navegacao, selecao, foco e destaques nao semanticos, e contraste reforcado. Verde, vermelho e amarelo/laranja continuam reservados a aprovacao, ajuste/recusa e pendencia.
- O cabecalho usa, nesta etapa, uma adaptacao vetorial SVG da marca aprovada visualmente. Ela nao e descrita como o asset oficial fornecido; a troca por asset vetorial oficial ou variante oficial para fundos escuros permanece melhoria futura. O PNG horizontal recebido esta preservado no repositorio, mas nao e o asset renderizado atualmente.
- A barra lateral administrativa mantem magenta nos dois temas. Cards de Clientes, listagem administrativa de postagens, titulos, metadados, chips e acoes receberam ajustes de contraste no tema escuro.
- A camada de tokens prepara uma futura parametrizacao por empresa sem implementar multiempresa ou white-label.
- A hotfix de Clientes persiste CPF/CNPJ opcional em `document_type` e `document_number`, sempre com digitos no banco e mascara apenas na interface. Criacao, edicao, remocao, listagem, detalhe e busca usam o mesmo contrato; a validacao de digitos verificadores ocorre no frontend e no backend. Nao ha unicidade, consulta externa nem preenchimento retroativo.
- O prazo de aprovacao passou a ser enviado oficialmente como `deadline_days` na criacao, edicao e importacao VCF. O backend aceita temporariamente `deadlineDays` apenas como compatibilidade de entrada e normaliza internamente para `deadline_days`.
- Em producao, foram validados criacao com CPF, criacao e edicao com CNPJ, remocao do documento, compatibilidade de Cliente antigo sem documento e persistencia/recuperacao de prazo diferente de 7 dias. Documentos cadastrados antes da correcao nao foram recuperados retroativamente.

## Visao do produto

O Postinder e uma plataforma para agencias prepararem postagens, enviarem conteudo para revisao do Cliente e preservarem o historico da decisao e da execucao.

O fluxo implementado e:

`draft -> ready -> sent/pending_approval -> approved ou rejected -> correcao/reenvio -> approved -> executed`

- `draft` e `ready` sao internos.
- O Cliente aprova ou reprova arquivos e postagens pelo portal.
- `approved` representa conteudo aprovado pelo Cliente e aparece na central como **Aprovado pelo cliente**.
- `executed` representa conteudo efetivamente publicado ou realizado pela agencia e aparece como **Postado na rede**.
- Postagens `executed` sao registros historicos imutaveis; podem ser consultadas e duplicadas, mas nao editadas, reenviadas, alteradas ou excluidas.
- Excluir postagem e exclusao logica por `deleted_at`. Postagem `approved` exige admin e confirmacao reforcada; `executed` nunca pode ser excluida.

## Arquitetura

| Area | Implementacao |
| --- | --- |
| Frontend | React, Vite, React Router, Tailwind, Zustand e Axios em `apps/admin` |
| Backend | Express e TypeScript em `backend`, organizado por modulos |
| Banco | PostgreSQL via `pg` |
| Storage local | Diretorio `uploads` em desenvolvimento |
| Storage publicado | Supabase Storage em producao |
| Infraestrutura de referencia | Vercel para frontend, Render para API e Supabase para Postgres/Storage |

Os modulos ativos incluem autenticacao, usuarios, Clientes, postagens, aprovacoes, portal, arquivos, fundos sonoros, feedbacks, atividades, notificacoes e manutencao de demonstracao.

## Areas e acesso

- A area administrativa concentra dashboard, Clientes, usuarios, postagens, aprovacoes, feed, insights, reset e configuracoes disponiveis.
- O portal por token esta em `/portal/:token`; o portal para Cliente autenticado esta em `/aprovar`.
- Tokens de portal sao aleatorios, validados por hash, expiram, podem ser recuperados quando possuem ciphertext e sao substituidos somente por acao explicita; tambem sao revogados quando o Cliente e desativado.
- Identidades administrativas, identidades de Cliente, refresh tokens e tokens privados de portal sao contextos distintos. Access tokens administrativos exigem `type: "admin"`; tokens de Cliente exigem `type: "client"` em seus fluxos proprios.
- Todas as rotas administrativas passam pela cadeia central de autenticacao, validacao do contexto administrativo e autorizacao por capacidade. Tokens ambiguos, mistos, legados ou de refresh usados como access token sao rejeitados antes dos controllers.
- A autorizacao administrativa e tipada, nega por padrao e possui 37 capacidades aplicadas explicitamente a 48 rotas. Uma rota administrativa sem politica declarada recebe `403`.
- Os perfis oficiais sao `admin`, `manager`, `editor` e `viewer`: admin possui todas as capacidades; manager opera sem administrar usuarios, executar exclusoes destrutivas ou reset; editor atua no fluxo editorial sem mutacoes de Clientes, execucao, exclusoes, usuarios ou reset; viewer possui somente leituras aprovadas.
- Criacao e alteracao de usuarios ou papeis exigem capacidades exclusivas de admin. Perfis desconhecidos, legados ou identidades nao administrativas recebem zero capacidades.
- O frontend ainda possui referencias visuais legadas a `gestor` e `equipe`; elas podem exibir acoes que o backend recusara, mas nao contornam a barreira autoritativa.
- Aprovacao e reprovacao sao operacoes exclusivas do Cliente. `PATCH /posts/:id/status` aceita somente `draft <-> ready`; envio, reenvio, decisao e execucao possuem endpoints especificos.

## Postagens, anexos e metricas

- A agencia cria, edita, ordena anexos, duplica e envia postagens individualmente ou em lote. Na lista atual, **Selecionar todos** respeita filtros e considera apenas o conjunto carregado de ate 500 registros, sem selecao global de itens ocultos ou nao carregados.
- O portal oferece navegacao livre equivalente para imagens e videos, botoes acessiveis, feedback e tags. No modo `item`, os indicadores distinguem atual, pendente, aprovado e reprovado e permitem acesso direto sem remover midias do carrossel. Em dispositivos moveis, as acoes permanecem acessiveis; a auditoria verificou oito midias em `375x812` sem overflow horizontal.
- Imagens e videos usam uma previa reutilizavel nas telas administrativas e no portal. Videos possuem player nativo com controles, `playsInline`, carregamento por metadados e alternativa para abrir o arquivo original quando o navegador nao reproduz o codec.
- Os controles do video sao isolados do gesto horizontal de decisao. Titulo e legenda aparecem completos, com quebras e hifenizacao; o portal atual nao usa **Ver mais** nem exibe filename tecnico. **Data de publicacao**, canais com icones compartilhados e a nomenclatura **Reprovar** compoem o contexto da decisao.
- As tags de reprovacao atuais sao Design, Foto, Video, Legenda, Texto do conteudo, Titulo/chamada e Outro. Comentario permanece obrigatorio; no modo `item`, motivo e tags ficam associados a midia reprovada.
- A ordem dos anexos e persistida por `files.sort_order` e usada em criacao, edicao, portal e previews.
- A edicao administrativa possui previa compacta navegavel do feed.
- Contadores operacionais de aprovacao/reprovacao usam o estado canonico vigente de cada postagem depois da conclusao. Arquivos, drafts, cliques e revisoes intermediarias nao sao contados como postagens adicionais. Insights preserva analises historicas distintas de primeira decisao e arquivos; Dashboard, feed e insights tratam Clientes ativos como escopo padrao.
- Notificacoes nao sao criadas para `draft` ou `ready`; eventos de envio, recusa e correcao permanecem distintos.

## Fundo sonoro

- A infraestrutura de fundo sonoro preserva as modalidades sem fundo, incorporado a um video, arquivo de audio enviado e referencia externa. A feature e opcional, secundaria, de baixa prioridade e potencialmente removivel; a trilha nunca participa de `files.sort_order` nem define a arquitetura principal de aprovacao.
- Postagens anteriores a esta capacidade carregam normalmente como `none`, sem migracao retroativa de conteudo ou historico.
- O modo incorporado vincula um video ativo da propria postagem. O modo enviado aceita um unico audio ativo e metadados de faixa, origem, ponto inicial e observacoes. Referencias externas exibem somente seus dados e link quando nao ha audio local.
- Ausente, desabilitada ou em modo `none`, a trilha nunca cria pendencia. Se estiver ativa e houver trilha aplicavel, a compatibilidade de decisao e preservada; no modo `item`, decisao isolada da trilha nao conclui/reprova o post, e trilha pendente nao bloqueia um snapshot visual que ja resulte em reprovacao.
- Versoes e decisoes anteriores permanecem nas tabelas de auditoria. `activity_events` continua best-effort depois do commit transacional da decisao oficial no banco; postagens `executed` permanecem somente leitura.

## Clientes, usuarios e e-mail

- Cliente pode ser desativado de modo reversivel, preservando historico e metricas, ou excluido definitivamente com os dados relacionados.
- `archived_by_client_deactivation` permanece somente como marcador tecnico de compatibilidade no fluxo de desativacao/reativacao de Cliente. Ele nao representa o antigo status `archived`, nao pertence ao dominio operacional das postagens e nao deve aparecer como estado na interface.
- Usuarios podem ter o papel alterado entre `admin`, `manager`, `editor` e `viewer`. O administrador principal de demonstracao nao pode ser excluido.
- E-mails sao normalizados com `trim` e minusculas. Usuarios e Clientes ativos compartilham unicidade global, inclusive entre tabelas.
- Criacao e reativacao usam transacao, consulta cruzada e `pg_advisory_xact_lock` por e-mail. Indices unicos parciais mantem a defesa dentro de cada tabela.
- CPF/CNPJ historico nao possui unicidade e continua armazenado somente com digitos. Novos cadastros nao coletam documento; leitura e edicao de Clientes anteriores permanecem compativeis, inclusive com valores nulos.

## Banco de dados

`database/migrations` e a unica fonte de verdade do schema. O migrador registra aplicacoes em `schema_migrations`; o startup nao cria nem repara tabelas, colunas, indices ou dados.

Uma instalacao vazia usa `npm run db:migrate` no diretorio `backend`. A migration `002_development_seed.sql` e historica e nao integra a cadeia estrutural. As migrations estruturais locais vigentes vao de `001` e `003` a `023`, incluindo branding, preferencias do portal, configuracoes operacionais, revisao/certificacao de conteudo, snapshot do funil e historico append-only de soundtrack.

O backend publicado usa PostgreSQL da Supabase. O estado confirmado depois da publicacao da hotfix em 31/07/2026 e:

- `001`, a `002` historica e `003` a `016` estao registradas;
- `016_client_documents.sql` foi aplicada com sucesso;
- o banco publicado esta em `016`;
- aquele deploy terminou sem migration pendente; `017` a `023`, criadas depois, continuam ausentes do banco publicado.

O backup logico foi criado, preservado e validado. A restauracao foi comprovada em stack Supabase local compativel, em transacao unica, usando copia de `roles.sql` com somente a instrucao de `statement_timeout` de `supabase_admin` comentada; schema e dados permaneceram identicos. O backup e restauravel com esse procedimento documentado de compatibilidade, mas nao inclui objetos fisicos do Supabase Storage.

Sobre o clone restaurado, o migrador real `backend/scripts/migrate.ts`, executado por `npm run db:migrate` em `backend`, aplicou `012` a `015` na ordem correta. Em producao, essas quatro migrations foram aplicadas em 30/07/2026. Na publicacao de 31/07/2026, o migrador ignorou as migrations ja registradas e aplicou `016_client_documents.sql`. `017` a `023` ainda nao integram o banco publicado. Em validacao local posterior, a cadeia `001`, `003` a `023` foi aplicada em PostgreSQL descartavel e a segunda execucao foi no-op.

## Seguranca e demonstracao

- C-01 separa de forma autoritativa JWT administrativo, JWT de Cliente, refresh tokens e token privado do portal. Sessoes antigas ambiguas podem exigir novo login.
- C-02 separa `NODE_ENV`, que representa apenas o modo tecnico do Node, de `DEPLOYMENT_MODE`, que representa a finalidade da implantacao.
- O reset so existe quando `DEPLOYMENT_MODE=demo` e `ENABLE_DEMO_RESET=true`, e ainda exige admin autenticado com a capacidade propria. A rota nao e montada quando indisponivel e o controller repete a guarda antes de qualquer efeito lateral.
- `VITE_DEPLOYMENT_MODE` e apenas apresentacao; o frontend nao consegue habilitar o reset no backend.
- URLs de portal, query strings sensiveis, objetos, arrays, erros, stacks e causes passam pela sanitizacao H-02. Tokens privados nao sao persistidos em eventos, refletidos em respostas ou registrados integralmente em logs da aplicacao; subrotas desconhecidas recebem resposta generica.
- O token real continua intacto ate o hashing e a validacao. A entrega deliberada de um novo link ao administrador autorizado permanece necessaria ao recurso e nao e tratada como vazamento.
- Logs historicos e logs externos antigos do Render nao foram auditados. Alguns `console.error` nao relacionados ao request permanecem como risco defensivo residual.

## Integracoes e IA

- O frontend atual consome somente `VITE_API_URL`, `VITE_DEPLOYMENT_MODE` e `VITE_GA_MEASUREMENT_ID`, todas publicas. Nenhuma chave, token ou client secret deve usar prefixo `VITE_*`.
- Anthropic e Z-API sao server-side. Twilio, GoHighLevel, Canva e Resend permanecem desabilitados ate implementacao segura. Google Analytics conserva somente o identificador publico.
- A IA usa `POST /api/v1/integrations/ai-insights` e a capacidade `ai-insights:generate`, atualmente exclusiva de `admin`.
- Fluxo: frontend -> API do Postinder -> autenticacao C-01 -> capacidade H-03 -> controller -> service -> adaptador Anthropic server-side.
- A URL do provedor e fixa no backend, o modelo usa allowlist, e a chamada possui timeout e abort. Configuracao ausente produz indisponibilidade segura e nao existe chamada no startup.
- O provedor recebe somente periodo, totais e metricas agregadas, contagem de Clientes, rotulos efemeros `Cliente N` e a pergunta explicita do administrador. Nomes, e-mails, telefones, IDs internos, tokens, links privados e mapa persistente de reidentificacao nao sao enviados.
- A politica formal de privacidade, provedor e tratamento de dados para uso real da IA continua pendente. A credencial server-side so deve ser configurada quando o recurso for deliberadamente habilitado.

## Storage e Retencao

- A identidade de cada objeto e `bucket + storage_path`; a URL publica e apenas uma forma de acesso mantida por compatibilidade.
- `files` persiste bucket, caminho, MIME e tamanho. Uploads compensam objetos enviados quando o banco falha.
- O frontend valida tipo e limite de 200 MB antes do envio, apresenta progresso por arquivo e envia anexos sequencialmente. O backend devolve `413` para excesso de tamanho e `415` para tipo nao suportado.
- Se a postagem for criada e um anexo falhar, o registro permanece editavel e a interface informa que o envio pode ser tentado novamente.
- Duplicacao cria copia fisica independente em novo path e registro proprio; arquivos legados sem identidade bloqueiam a duplicacao de modo explicito.
- A retencao global usa 24 horas por default e e materializada quando a postagem vira `executed`. O comando manual permanece, e o scheduler interno executa no startup e a cada hora; falhas ficam para retry posterior.
- Nao existe fila distribuida, outbox ou cron externo; locks e lotes de 50 protegem as varreduras concorrentes.
- Arquivos de fundo sonoro usam o mesmo bucket e adaptador de Storage, em path proprio da postagem, com limite de 50 MB e validacao inicial de MP3, WAV, OGG, AAC e M4A. Duplicacao e Retencao aplicam as mesmas garantias de identidade independente e auditoria dos anexos.

## Estado operacional e limitacoes

- O pacote local mais recente passou por typecheck e build backend, backend 211/211, PostgreSQL de revisao 26/26, portal approval 12/12, soundtrack focal 8/8, retention focal 7/7, validator integrado de soundtrack, gate append-only e `git diff --check`. As validacoes publicadas anteriores e seus health checks permanecem historicamente registradas.
- O script `npm run lint` do frontend existe, mas ESLint e sua configuracao nao estao disponiveis. O comando nao foi aprovado. Nao ha workflow de CI no repositorio, e as configuracoes versionadas da Vercel e os comandos documentados do Render nao invocam lint; por isso, a pendencia e tecnica e nao bloqueante para a publicacao atual. A verificacao administrativa da Vercel continua necessaria para confirmar que nao existe override remoto.
- A publicacao de 31/07/2026 incluiu commit, push, migration `016`, backend e frontend. O banco publicado continua em `016`; as migrations locais `017` a `023` devem integrar, em ordem, um futuro deploy autorizado.
- A verificacao manual da Vercel continua pendente para nomes de variaveis, Production/Preview/Development, commit ativo, deployments historicos e previews. Eventual segredo historico exigira rotacao ou invalidacao em etapa separada.
- A verificacao manual do Render confirmou categorias de URL/CORS, banco, JWT, Supabase/Storage e `NODE_ENV`; nenhum `VITE_*`, credencial de integracao ou Environment Group foi evidenciado. O backend da hotfix foi publicado em 31/07/2026 e os tres endpoints de health responderam com sucesso.
- O ambiente publicado continua em modo demo, disponivel em `https://portal-20cinco.vercel.app` e preparado para testes pela 20Cinco.
- As observacoes anteriores do backend no Render foram superadas pela publicacao confirmada de 31/07/2026.
- A versao publicada nao deve receber dados reais sensiveis nem novas credenciais frontend.
- O bucket continua publico no fluxo atual; bucket privado e signed URLs nao foram implementados.
- Em producao, cada arquivo ainda passa pela memoria do backend antes do Supabase. Upload direto ou retomavel para o Storage nao foi implementado.
- A seed explicita continua condicionada a `APP_MODE=demo`; o reset e protegido separadamente por `DEPLOYMENT_MODE` e `ENABLE_DEMO_RESET`.
- Multiempresa, identidade global de contas e entidades proprias de Projeto/Campanha ainda nao foram implementadas.
- Fundo sonoro nao inclui busca ou download externo, integracoes com plataformas, escolha entre varias trilhas, editor, mixagem, renderizacao final ou metricas musicais.
- Super Like/"Adorei", metricas de entusiasmo, tags de reprovacao configuraveis/editor de tags, integracao ClickUp, limpeza agressiva do schema legado, remocao definitiva de soundtrack e outbox de atividades nao foram implementados.

Consulte [DEPLOYMENT.md](docs/DEPLOYMENT.md) para instalacao e ambientes, [STORAGE_ARCHITECTURE.md](docs/STORAGE_ARCHITECTURE.md) para arquivos e Retencao, e [ROADMAP.md](ROADMAP.md) para o trabalho futuro.

## Ordem de leitura para retomada

1. [PROJECT_STATE.md](PROJECT_STATE.md) — estado consolidado e limites atuais.
2. [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md) — regras permanentes.
3. [ROADMAP.md](ROADMAP.md) — proxima frente e trabalho pendente.
4. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — procedimento operacional.
5. [docs/deploy/CHECKLIST_DEPLOY_TESTE.md](docs/deploy/CHECKLIST_DEPLOY_TESTE.md) — gates antes e depois do deploy.
6. [CHANGELOG.md](CHANGELOG.md) — alteracoes locais ainda nao publicadas.

Os relatorios `INVESTIGACAO_*` e `CORRECAO_*` devem ser consultados somente
quando forem necessarios detalhes de evidencia, testes ou limitacoes tecnicas.
