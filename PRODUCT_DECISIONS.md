# Decisoes de Produto do Postinder

## Rodada de testes com Clientes

- O portal simplificado e o default. A ordem autoritativa e data prevista crescente, criacao crescente e ID crescente, com itens sem data por ultimo. O Cliente nao escolhe outra postagem nesse modo; apos aprovar ou solicitar ajuste, recebe o proximo item.
- Um unico booleano por Cliente restaura conjuntamente seletor de postagens e informacoes perifericas. A preferencia vale para acesso por token e autenticado e nao altera o link ativo.
- Cada Cliente possui um link principal ativo. Consulta e copia reutilizam o mesmo segredo; substituicao e acao separada, confirmada e atomica. Hash continua autoritativo para autenticacao, e a copia recuperavel fica cifrada para o endpoint administrativo autorizado.
- E-mail Marketing sempre exige URL HTTP(S) validada. Como canal unico, a URL substitui a obrigatoriedade de anexo; em combinacoes, as regras de arquivo dos outros canais permanecem. A previa abre externamente e nunca e carregada ou buscada pelo Postinder.
- Novos cadastros de Cliente nao coletam CPF/CNPJ. Campos e valores historicos permanecem para compatibilidade de leitura e edicao.
- `3A3R` nao integra novas selecoes. Fundo sonoro permanece implementado no dominio, mas oculto de criacao, edicao e aprovacao nesta rodada.
- Setas anterior/proximo navegam pelos anexos pendentes sem disparar decisoes e preservam swipe, controles de video e botoes de aprovacao.
- Novos formatos de Instagram sao Card, Carrossel, Stories, Reels e Foto; valores antigos nao sao convertidos. Drag-and-drop fica adiado e as setas de ordenacao continuam como mecanismo oficial.

## Fluxo e responsabilidade

- A agencia cria, revisa, corrige, envia e marca a postagem como Executada.
- Somente o Cliente aprova ou reprova. A area administrativa acompanha o processo, mas nao decide em nome do Cliente.
- `draft` e `ready` sao estados internos e reversiveis. O endpoint generico de status existe apenas para essa alternancia.
- O portal deve ser acessivel por token privado e tambem por Cliente autenticado, com a mesma regra de decisao.

## Estados da postagem

- **Em andamento** compreende os estados anteriores a `approved`.
- **Concluida** corresponde a `approved` e e exibida como **Aprovado pelo cliente**.
- **Executada** corresponde a `executed` e e exibida como **Postado na rede**.
- Uma postagem Executada e historico imutavel quanto a conteudo, anexos ativos, status e decisoes de negocio. Usuarios nao podem editar, reenviar, reabrir, substituir, excluir ou modificar o registro original; somente consulta e duplicacao do original sao permitidas.
- A correcao posterior a uma Executada deve ocorrer como nova postagem ou revisao explicitamente auditavel; nao por reabertura silenciosa do registro historico.
- Retencao e excecao tecnica controlada: pode remover apenas o objeto fisico e atualizar campos de auditoria de Storage, preservando registro, metadados, metricas e historico da postagem Executada.

## Exclusao e ciclo de vida

- Excluir postagem usa `deleted_at`, nao um estado de arquivamento. `archived` nao pertence ao dominio atual.
- Postagens Em andamento seguem a permissao administrativa de edicao. `approved` so pode ser excluida por `admin`, com confirmacao textual `EXCLUIR`; `executed` nao pode ser excluida.
- Desativar Cliente e reversivel e preserva historico e metricas. Excluir Cliente definitivamente remove seus dados relacionados e deve avisar esse impacto.
- Para preservar historico, a operacao correta e desativar, nao excluir definitivamente.

## Portal e aprovacao

- Cada arquivo e revisado individualmente; swipe e a interacao principal, com botoes como alternativa acessivel. E-mail Marketing sem anexos e a excecao deliberada: a decisao ocorre na postagem depois da abertura opcional do preview externo.
- O portal deve priorizar o conteudo que exige decisao do Cliente. Metricas, calendario, historico, arquivos e feedbacks sao informacoes complementares e iniciam recolhidos, permanecendo disponiveis sob demanda.
- Swipe deve oferecer experiencia equivalente em imagens e videos sem substituir os botoes explicitos.
- O gesto horizontal nao deve bloquear rolagem vertical nem acionar arraste nativo da imagem.
- Controles interativos e fullscreen de video prevalecem em suas areas e nao participam do gesto de swipe. Reproduzir, pausar, alterar volume ou navegar no video nao pode aprovar nem reprovar o arquivo.
- Imagens e videos devem ser visualizados no proprio fluxo de revisao. Para video, o padrao e player nativo sem reproducao automatica, com `playsInline`, `preload="metadata"` e acesso ao arquivo original como alternativa.
- A legenda permanece alinhada a esquerda. Textos extensos usam expansao explicita, quebras preservadas e hifenizacao automatica com idioma `pt-BR`; justificacao nao e usada em colunas estreitas por prejudicar a regularidade dos espacos.
- O primeiro viewport deve priorizar a decisao: contexto da postagem, midia, identificacao do arquivo, instrucao, legenda e acoes devem caber juntos sempre que a altura disponivel permitir, sem comprimir controles essenciais.
- O Cliente pode desfazer somente a ultima decisao quando o fluxo permitir. Pode editar feedback e reconsiderar uma recusa antes de uma nova correcao.
- Uma nova versao enviada pela agencia deve ser identificada como `Correcao`.
- A ordem dos anexos e dado de negocio, persistida por `sort_order` e mantida em todas as telas.

## Interface administrativa

- O Dashboard pode compactar sua abertura com paineis recolhiveis. **Atividade recente** e **Postagens** iniciam recolhidas, expandem independentemente e preservam filtros, paginacao, ordenacao e acoes quando abertas.
- O estado de expansao e local ao carregamento atual; nao existe requisito de persistencia entre sessoes.

## Identidade visual

- Existe uma unica identidade institucional global da empresa de marketing responsavel pela plataforma. Ela nao representa o logo individual de cada Cliente.
- Somente `admin`, por meio da capacidade `branding:update`, pode enviar, substituir ou remover o logo. A leitura publica contem apenas nome institucional, URL utilizavel, indicador booleano de configuracao, versao e data de atualizacao.
- A entrada da plataforma e as telas publicas de autenticacao preservam a marca Postinder e ficam fora do provider configuravel. O logo da empresa e carregado dinamicamente apenas na area administrativa e no portal do Cliente, sem depender de variavel `VITE_*` ou rebuild. Ausencia, registro antigo, indisponibilidade ou falha da imagem usam o fallback Postinder.
- O magenta da marca pertence a navegacao, selecao, foco e destaques nao semanticos. Verde para aprovacao, vermelho para recusa ou ajuste e amarelo/laranja para pendencia nao devem ser substituidos pela cor da marca.
- Tokens de marca devem permanecer centralizados e restritos ao portal para permitir futura parametrizacao sem reescrever componentes.
- O logo configurado aceita somente PNG, JPEG ou WebP estatico de ate 2 MB e 16 milhoes de pixels. WebP animado, APNG, GIF, AVIF, TIFF, PDF, SVG e qualquer arquivo multipagina, truncado ou estruturalmente invalido permanecem recusados.
- Multiempresa e white-label permanecem possibilidades futuras; nao sao funcionalidades atuais.

## Fundo sonoro

- Nesta rodada o recurso esta dormente: nenhuma interface cria, edita, reproduz ou decide trilha, e a decisao de arquivos no portal nao fica bloqueada por estado de fundo sonoro. As regras abaixo permanecem preservadas no dominio para uma futura reativacao deliberada.
- O fundo sonoro e uma parte independente da postagem e nao pertence a lista ordenavel de anexos. Suas modalidades sao `none`, `embedded`, `uploaded` e `external_reference`; nenhuma modalidade e inferida automaticamente a partir dos anexos.
- `none` nao cria requisito adicional. Nos demais modos, somente o Cliente pode aprovar ou solicitar ajuste do fundo sonoro, com comentario obrigatorio no ajuste. Reproduzir, pausar, silenciar ou reativar audio serve apenas para a previa e nunca representa uma decisao.
- A aprovacao integral exige todos os anexos obrigatorios e, quando houver fundo sonoro, a decisao `approved` da revisao vigente. Fundo sonoro `pending` ou `adjustment_requested` impede que a postagem seja considerada aprovada.
- `embedded` referencia exclusivamente um video ativo da mesma postagem e possui decisao semantica propria, mesmo quando audio e imagem estao no mesmo arquivo. `uploaded` aceita um unico arquivo de audio ativo. `external_reference` registra apenas a indicacao e nao simula player quando nao existe arquivo local.
- Alteracao material, substituicao ou troca de modalidade invalida a aprovacao vigente, abre nova revisao e preserva versoes e decisoes anteriores. Postagens `executed` nao podem ter o fundo sonoro alterado.
- Na primeira versao nao existem busca, download de fonte externa, integracao com plataformas, multiplas opcoes, mixagem, renderizacao definitiva nem controle avancado de volume.

## Historico e comunicacao

- Metricas preservam a primeira decisao e feedbacks historicos; uma correcao aprovada nao apaga uma recusa anterior.
- `draft` e `ready` nao geram notificacao de espera nem aparecem ao Cliente.
- Notificacoes de espera surgem somente depois do envio; recusa e correcao usam eventos distintos.
- `activity_events` e a base de rastreabilidade do ciclo operacional.

## Identidade e seguranca

- Usuarios e Clientes ativos compartilham namespace global de e-mail neste modelo. O mesmo endereco nao pode existir simultaneamente nas duas categorias.
- E-mails de registros excluidos ou inativos podem ser reutilizados; reativacao nao pode violar a unicidade vigente.
- A protecao combina normalizacao, indices unicos parciais e lock transacional por e-mail.
- Identidade administrativa e identidade de Cliente sao contextos distintos. Assinatura valida, sozinha, nao promove um token a contexto administrativo.
- Access tokens, refresh tokens e tokens privados de portal possuem finalidades explicitas e nao sao intercambiaveis.
- A autorizacao administrativa e baseada em capacidades, ocorre depois da autenticacao/contexto e nega por padrao.
- Toda nova rota administrativa deve declarar uma capacidade; rota nao declarada recebe `403`.
- Os perfis oficiais sao `admin`, `manager`, `editor` e `viewer`. Perfis desconhecidos, legados ou identidades nao administrativas recebem zero capacidades.
- `admin` possui todas as capacidades; `manager` possui capacidades operacionais sem usuarios administrativos, exclusoes destrutivas ou reset; `editor` possui capacidades editoriais sem mutacoes de Clientes, execucao, exclusoes, usuarios ou reset; `viewer` possui somente leituras aprovadas.
- `viewer` e estritamente somente leitura. Criacao e alteracao de usuarios e papeis exigem capacidades exclusivas do administrador.
- O administrador principal de demonstracao nao pode ser excluido.

## Banco, demonstracao e producao

- Migrations versionadas sao a unica fonte de verdade do schema. Startup nao corrige schema nem cria dados.
- Migrations de producao devem executar em Pre-Deploy Command/release step separado, serializado e bloqueante. Falha de migration deve impedir o startup do backend novo.
- Backup logico recuperavel e preflight atualizado sao obrigatorios antes de executar migrations em producao.
- Dados demo sao criados somente por comando explicito; bootstrap do primeiro admin e processo separado.
- `NODE_ENV` descreve somente o modo tecnico do Node; `DEPLOYMENT_MODE` descreve a finalidade da implantacao.
- Reset e credenciais de demonstracao sao aceitaveis apenas em implantacao explicitamente demo.
- O reset exige simultaneamente `DEPLOYMENT_MODE=demo`, `ENABLE_DEMO_RESET=true`, autenticacao administrativa e a capacidade propria. Configuracao ausente ou invalida nega por padrao.
- O frontend pode refletir o modo por `VITE_DEPLOYMENT_MODE`, mas nunca habilita o reset do backend.

## Integracoes e inteligencia artificial

- O frontend nunca recebe chaves, tokens, client secrets ou outras credenciais.
- Integracoes que exigem segredo executam exclusivamente no backend, depois de autenticacao e autorizacao.
- Somente `VITE_API_URL`, `VITE_DEPLOYMENT_MODE` e `VITE_GA_MEASUREMENT_ID` sao configuracoes frontend permitidas no estado atual.
- A IA envia somente dados agregados, minimizados e pseudonimizados. Nomes, contatos, IDs internos, tokens e links privados nao integram o payload.
- A pergunta livre do administrador e enviada apenas por acao explicita, com transparencia no ponto de uso; nao existe chamada automatica no startup.
- A habilitacao real da IA depende de decisao formal sobre provedor, privacidade e tratamento de dados, seguida de configuracao server-side deliberada.

## Arquivos e Retencao

- A identidade oficial de arquivo e `bucket + storage_path`; URL publica nao e identidade de dominio.
- O limite atual e 200 MB por arquivo. A selecao deve validar tamanho e tipos aceitos antes da rede, e lotes devem ser enviados sequencialmente com progresso individual para reduzir o pico de memoria.
- Falhas de upload posteriores a criacao nao devem ocultar a postagem: o registro permanece editavel e a interface orienta nova tentativa.
- MP4 com H.264/AAC e a recomendacao de compatibilidade para revisao no navegador. Outros conteineres podem ser armazenados, mas dependem dos codecs suportados pelo navegador e devem oferecer acesso ao original quando nao houver reproducao.
- Duplicacao de postagem cria objetos fisicos independentes.
- Retencao preserva metadados, decisao, metricas e historico depois da remocao fisica do objeto.
- As politicas disponiveis por postagem sao `immediate`, `1d`, `7d`, `30d` e `never`. `immediate` torna o arquivo elegivel ao comando de limpeza, sem apagar durante a marcacao de execucao.
- Audio enviado usa o mesmo Storage dos anexos, com identidade `bucket + storage_path`, limite proprio de 50 MB e formatos iniciais MP3, WAV, OGG, AAC e M4A. A duplicacao cria copia fisica independente e a Retencao preserva metadados, versoes e decisoes depois da remocao do objeto.

## Direcao futura

- Multiempresa deve adotar Identidade global de conta e vinculos por Empresa/agencia, sem antecipar duplicacao de Clientes na arquitetura atual.
- O Cliente devera possuir uma unica identidade global, sem contas duplicadas por agencia. Um unico login devera permitir alternar entre os contextos das Empresas/agencias vinculadas por seletor, abas ou solucao equivalente.
- Cada contexto futuro exibira somente os Projetos/Campanhas, postagens, aprovacoes e historicos correspondentes a respectiva Empresa/agencia.
- Bucket privado, signed URLs, versionamento formal de arquivos e entidade propria de Projeto/Campanha sao evolucoes futuras, nao regras da versao atual.
- Upload direto ou retomavel para o Storage e evolucao futura para evitar que videos grandes atravessem integralmente a memoria do backend.
