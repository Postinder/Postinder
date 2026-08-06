# Changelog do Postinder

Este changelog registra os principais marcos funcionais e arquiteturais do projeto. O estado vigente esta em [PROJECT_STATE.md](PROJECT_STATE.md).

## Nao publicado - identidade institucional global

- Foi corrigida a tentativa estatica de branding: os SVGs duplicados foram substituidos por configuracao global persistente e componente compartilhado no menu administrativo e no portal do Cliente. A entrada e as telas publicas de autenticacao permanecem com a marca Postinder.
- A area **Identidade visual**, exclusiva de `admin`, permite visualizar, selecionar, previsualizar, confirmar, substituir e remover PNG, JPEG ou WebP de ate 2 MB.
- A migration aditiva `017_platform_branding.sql` armazena somente referencia de Storage e metadados. O endpoint publico nao expoe bucket/path; substituicao e compensacao preservam o logo anterior em falhas intermediarias.

## Publicado em 30/07/2026 - consolidacao pre-deploy

Estas alteracoes foram publicadas em backend e frontend em 30/07/2026:

- A fronteira de autenticacao passou a separar access tokens administrativos, tokens de Cliente, refresh tokens e tokens privados de portal. Tokens ambiguos ou de contexto incorreto sao recusados antes dos controllers.
- A autorizacao administrativa passou a usar 36 capacidades tipadas e negacao por padrao em 43 rotas. Os perfis oficiais sao `admin`, `manager`, `editor` e `viewer`.
- O reset demo passou a exigir `DEPLOYMENT_MODE=demo`, `ENABLE_DEMO_RESET=true`, autenticacao administrativa e capacidade exclusiva, com rota condicional e segunda guarda no controller.
- URLs privadas do portal, query strings sensiveis, objetos e erros passaram a ser sanitizados; tokens privados deixaram de ser persistidos nos eventos de atividade.
- Credenciais e chamadas de integracoes foram removidas do frontend. Anthropic e Z-API sao server-side; Twilio, GoHighLevel, Canva e Resend permanecem desabilitados.
- A IA passou a usar endpoint proprio do backend, autorizacao `ai-insights:generate`, URL fixa, modelo allowlisted, timeout/abort e payload agregado e pseudonimizado.
- A estrutura de fundo sonoro foi concluida com estado atual, revisoes, decisoes, Storage e Retencao auditaveis.
- As migrations `012`, `013`, `014` e `015` foram aplicadas com sucesso em producao e confirmadas em `schema_migrations` na publicacao de 30/07/2026.
- O backup logico foi criado e sua restauracao foi validada em stack Supabase local com uma adaptacao minima e documentada na copia de `roles.sql`.
- O migrador real aplicou `012` a `015` em clone restaurado, na ordem correta; a segunda execucao foi no-op e o advisory lock foi liberado corretamente.
- Depois da publicacao, `/health`, `/health/db` e `/health/storage` responderam com sucesso.

## Publicado em 31/07/2026 - hotfix de Clientes

- Backend: 151/151 testes. Frontend: 40/40 testes. Builds e `git diff --check` aprovados nesta hotfix; o bundle scan aprovado na auditoria permanece valido.
- CPF/CNPJ opcional passou a ser persistido em `document_type` e `document_number`, com digitos no banco, mascara na interface e validacao de digitos verificadores no frontend e no backend.
- Criacao, edicao, remocao, listagem, detalhe e busca passaram a usar o contrato oficial `document_type`/`document_number`; documentos ausentes permanecem nulos e documentos cadastrados antes da correcao nao foram recuperados retroativamente.
- O frontend passou a enviar `deadline_days` na criacao, edicao e importacao VCF. O backend preserva compatibilidade temporaria de entrada com `deadlineDays`.
- A migration `016_client_documents.sql` adiciona as duas colunas anulaveis e uma constraint de coerencia entre tipo, quantidade e somente digitos. Nao ha indice unico.
- A hotfix foi commitada, enviada ao Git e publicada em backend e frontend. A `016` foi aplicada com sucesso, o banco publicado esta em `016` e nao existe migration pendente.
- Os health checks foram aprovados, assim como criacao com CPF, criacao e edicao com CNPJ, remocao do documento, Cliente antigo sem documento e prazo diferente de 7 dias.
- O ambiente permanece em modo demo para avaliacao da 20Cinco em `https://portal-20cinco.vercel.app`.

## Rodada local de interface e identidade

- A Previa do Feed passou a reconhecer videos pelo mecanismo compartilhado e a renderiza-los com `MediaPreview`, mantendo imagens e a primeira midia na ordenacao oficial sem alteracao de Storage, API ou backend.
- **Atividade recente** e **Postagens** passaram a iniciar recolhidas no Dashboard, com expansao independente, conteudo preservado e controles acessiveis.
- **Visao geral / Acompanhamento do conteudo** passou a iniciar recolhida no portal, mantendo a aprovacao em destaque e preservando metricas, abas, filtros e dados montados sob expansao.
- O swipe do portal passou a cobrir videos com o mesmo sentido de decisao das imagens, reconhecimento de intencao horizontal, rolagem vertical preservada e protecao dos controles nativos, fullscreen e clique residual.
- A tela principal do portal recebeu coluna lateral mais estreita, cards compactos, cabecalho e resumo centralizados e mais espaco para a midia, preservando `object-contain`, videos verticais, mobile e breakpoints.
- O portal adotou a identidade visual da 20Cinco em tokens restritos aos temas claro e escuro. O magenta passou a orientar navegacao e destaques nao semanticos, enquanto verde, vermelho e amarelo/laranja permaneceram funcionais.
- O cabecalho usa temporariamente uma adaptacao vetorial SVG aprovada, sem apresenta-la como asset oficial. A substituicao por asset vetorial oficial ou variante oficial para fundos escuros ficou como melhoria futura; o PNG recebido permanece preservado, mas nao e renderizado atualmente.
- A barra lateral administrativa manteve o magenta no tema escuro, e cards de Clientes, listagem de postagens, textos, metadados, chips e acoes receberam contraste reforcado.
- Foram adicionados testes de branding, escopo dos tokens, legibilidade, cores semanticas, swipe e paineis recolhiveis. O lint continua indisponivel porque ESLint e sua configuracao nao existem; nenhum workflow de CI nem configuracao versionada/documentada de Vercel ou Render o executa.

## Consolidacao arquitetural

- A documentacao oficial foi promovida a partir da reconstrucao das conversas historicas, auditorias tecnicas, correcoes implementadas e revisao final.
- O estado foi separado em arquitetura atual, decisoes de produto, backlog e historico.
- Os arquivos `*_TEMP.md` foram preservados como referencia de conferencia durante a validacao da promocao.

## Banco de dados

- Migrations versionadas em `database/migrations` passaram a ser a unica fonte de verdade do schema.
- O DDL automatico no startup e o schema inicial legado foram removidos do fluxo de instalacao.
- A seed historica foi separada do migrador estrutural; seed demo e bootstrap do primeiro admin passaram a ser comandos explicitos.
- `post_notes` foi identificado como uso morto e removido do fluxo ativo.
- Foram adicionadas migrations para portal, ordenacao, status recusado, ultimo acesso, compatibilidade de desativacao, execucao, Retencao, unicidade de e-mail, remocao de `archived` e identidade/auditoria de Storage.

## Dominio, seguranca e ciclo de vida

- Aprovacao e reprovacao passaram a ser exclusivas do Cliente. JWT de Cliente foi bloqueado em toda a arvore administrativa, antes dos controllers.
- O endpoint generico de status foi limitado a `draft <-> ready`.
- Postagens `executed` passaram a ser imutaveis no backend e na interface; duplicacao permanece permitida.
- O uso operacional de `archived` foi removido. Exclusao de postagem passou a usar `deleted_at`; `approved` exige admin e `executed` nao pode ser excluida.
- A unicidade de e-mail entre usuarios e Clientes ativos passou a usar normalizacao, indices parciais e advisory lock transacional.
- Usuarios ganharam alteracao de papel e exclusao protegida para o administrador principal. Clientes ganharam desativacao reversivel e exclusao definitiva separada.

## Fundo sonoro da postagem

- Foi adicionada uma secao independente dos anexos com os modos `none`, `embedded`, `uploaded` e `external_reference`.
- A migration `015_post_soundtracks.sql` introduziu estado atual, revisoes imutaveis e decisoes historicas sem alterar postagens antigas, que continuam equivalentes a `none`.
- Fundo sonoro passou a ter decisao exclusiva do Cliente. Pendencia ou ajuste bloqueia a aprovacao integral, enquanto controles de reproducao e mute permanecem neutros.
- Troca de modalidade, arquivo, video ou referencia invalida a aprovacao vigente e preserva as decisoes anteriores. Postagens `executed` continuam imutaveis.
- Audio enviado reutiliza o Storage atual, recebe identidade por bucket e path, copia fisica na duplicacao e auditoria de Retencao. O portal mantem a reproducao entre cards e separa som original do video e trilha.
- Busca, download externo, integracoes, varias opcoes de trilha, mixagem, renderizacao e metricas de musica ficaram deliberadamente fora desta versao.

## Portal e experiencia

- Foi criado portal de revisao por token e suporte equivalente a Cliente autenticado.
- Portal ganhou swipe, botoes alternativos, feedbacks, tags, desfazer limitado, recusados, calendario, historico e identificacao de correcao.
- O quadro principal de revisao foi compactado: cabecalho, faixa de contexto, midia, legenda e acoes passaram a ocupar melhor o primeiro viewport, com acoes fixas no mobile e junto da legenda no desktop.
- Legendas extensas ganharam `Ver mais`/`Ver menos`, quebra segura, preservacao de linhas e hifenizacao automatica em portugues, mantendo alinhamento a esquerda.
- Imagens e videos passaram a usar uma previa centralizada. Videos ganharam player nativo nas telas administrativas e no portal, controles protegidos do swipe, carregamento por metadados e alternativa para codecs nao reproduziveis.
- Textos do fluxo de exclusao receberam correcoes de portugues e acentuacao.
- Rascunhos e itens prontos deixaram de ficar visiveis ao Cliente e de gerar notificacoes indevidas.
- A central administrativa foi organizada em Em andamento, Aprovado pelo cliente e Postado na rede.
- A edicao ganhou previa compacta navegavel do feed, e as telas receberam ajustes responsivos.

## Storage A - Identidade e compensacao

- `files` passou a persistir `bucket`, `storage_path`, MIME e tamanho.
- Uploads passaram a compensar objetos enviados quando a gravacao no banco falha.
- Selecao de anexos passou a validar formato e limite de 200 MB no frontend; lotes passaram a ser enviados um arquivo por vez, com progresso individual.
- O backend passou a responder `413` para arquivo acima do limite e `415` para tipo nao suportado. Falha depois da criacao preserva a postagem editavel e orienta nova tentativa.
- O portal passou a receber MIME e tamanho junto dos metadados de arquivo.
- Remocoes deixaram de reconstruir caminho a partir de URL publica.

## Storage B - Copia independente

- Duplicacao de postagem passou a copiar fisicamente cada arquivo para novo path e a criar registros independentes.
- Falhas de copia ou banco passaram a reverter a nova postagem e compensar os objetos criados.
- Foi adicionado diagnostico somente leitura para referencias compartilhadas e arquivos legados sem identidade.

## Storage C - Retencao auditavel

- Foram adicionadas politicas `immediate`, `1d`, `7d`, `30d` e `never` por postagem.
- O comando `storage:cleanup-retention` remove objetos vencidos, preserva metadados e registra data ou erro de remocao.
- Scheduler, retry automatico, fila, bucket privado e signed URLs ficaram deliberadamente fora desta fase.

## Limpeza de legados

- Componentes sem rota do swipe antigo, servicos exclusivos, layout nao utilizado, DTO sem consumidor e barrels/placeholders sem imports foram removidos.
- O schema inicial depreciado, configuracao do Nodemon e log de desenvolvimento foram removidos.
- Migrations historicas, marcadores de compatibilidade, rotas ativas e funcoes futuras de IA foram preservados conscientemente.

## Validacao conhecida

- A auditoria pre-deploy foi concluida e os bloqueadores tecnicos foram corrigidos localmente.
- O Render foi conferido manualmente sem valores: nenhuma variavel `VITE_*`, credencial de integracao ou Environment Group foi evidenciado; as variaveis da demo e a credencial server-side da IA ainda nao estao configuradas.
- A Vercel ainda exige inventario manual de variaveis, ambientes e deployments historicos.
- A consolidacao anterior foi publicada em 30/07/2026 com as migrations `012` a `015`. A hotfix de Clientes e a migration `016` foram publicadas e validadas em 31/07/2026.
