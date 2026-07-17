# Decisoes de Produto do Postinder

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

- Cada arquivo e revisado individualmente; swipe e a interacao principal, com botoes como alternativa acessivel.
- O gesto horizontal nao deve bloquear rolagem vertical nem acionar arraste nativo da imagem.
- Controles interativos de video nao participam do gesto de swipe. Reproduzir, pausar, alterar volume ou navegar no video nao pode aprovar nem reprovar o arquivo.
- Imagens e videos devem ser visualizados no proprio fluxo de revisao. Para video, o padrao e player nativo sem reproducao automatica, com `playsInline`, `preload="metadata"` e acesso ao arquivo original como alternativa.
- A legenda permanece alinhada a esquerda. Textos extensos usam expansao explicita, quebras preservadas e hifenizacao automatica com idioma `pt-BR`; justificacao nao e usada em colunas estreitas por prejudicar a regularidade dos espacos.
- O primeiro viewport deve priorizar a decisao: contexto da postagem, midia, identificacao do arquivo, instrucao, legenda e acoes devem caber juntos sempre que a altura disponivel permitir, sem comprimir controles essenciais.
- O Cliente pode desfazer somente a ultima decisao quando o fluxo permitir. Pode editar feedback e reconsiderar uma recusa antes de uma nova correcao.
- Uma nova versao enviada pela agencia deve ser identificada como `Correcao`.
- A ordem dos anexos e dado de negocio, persistida por `sort_order` e mantida em todas as telas.

## Historico e comunicacao

- Metricas preservam a primeira decisao e feedbacks historicos; uma correcao aprovada nao apaga uma recusa anterior.
- `draft` e `ready` nao geram notificacao de espera nem aparecem ao Cliente.
- Notificacoes de espera surgem somente depois do envio; recusa e correcao usam eventos distintos.
- `activity_events` e a base de rastreabilidade do ciclo operacional.

## Identidade e seguranca

- Usuarios e Clientes ativos compartilham namespace global de e-mail neste modelo. O mesmo endereco nao pode existir simultaneamente nas duas categorias.
- E-mails de registros excluidos ou inativos podem ser reutilizados; reativacao nao pode violar a unicidade vigente.
- A protecao combina normalizacao, indices unicos parciais e lock transacional por e-mail.
- `viewer` e somente leitura. O administrador principal de demonstracao nao pode ser excluido.

## Banco, demonstracao e producao

- Migrations versionadas sao a unica fonte de verdade do schema. Startup nao corrige schema nem cria dados.
- Dados demo sao criados somente por comando explicito; bootstrap do primeiro admin e processo separado.
- Reset e credenciais de demonstracao sao aceitaveis apenas em ambiente controlado de demonstracao.
- O produto deve evoluir para Modo demonstracao e Modo producao no mesmo codigo-fonte. Hoje apenas a seed explicita e protegida por `APP_MODE=demo`; a separacao integral ainda nao esta implementada.

## Arquivos e Retencao

- A identidade oficial de arquivo e `bucket + storage_path`; URL publica nao e identidade de dominio.
- O limite atual e 200 MB por arquivo. A selecao deve validar tamanho e tipos aceitos antes da rede, e lotes devem ser enviados sequencialmente com progresso individual para reduzir o pico de memoria.
- Falhas de upload posteriores a criacao nao devem ocultar a postagem: o registro permanece editavel e a interface orienta nova tentativa.
- MP4 com H.264/AAC e a recomendacao de compatibilidade para revisao no navegador. Outros conteineres podem ser armazenados, mas dependem dos codecs suportados pelo navegador e devem oferecer acesso ao original quando nao houver reproducao.
- Duplicacao de postagem cria objetos fisicos independentes.
- Retencao preserva metadados, decisao, metricas e historico depois da remocao fisica do objeto.
- As politicas disponiveis por postagem sao `immediate`, `1d`, `7d`, `30d` e `never`. `immediate` torna o arquivo elegivel ao comando de limpeza, sem apagar durante a marcacao de execucao.

## Direcao futura

- Multiempresa deve adotar Identidade global de conta e vinculos por Empresa/agencia, sem antecipar duplicacao de Clientes na arquitetura atual.
- O Cliente devera possuir uma unica identidade global, sem contas duplicadas por agencia. Um unico login devera permitir alternar entre os contextos das Empresas/agencias vinculadas por seletor, abas ou solucao equivalente.
- Cada contexto futuro exibira somente os Projetos/Campanhas, postagens, aprovacoes e historicos correspondentes a respectiva Empresa/agencia.
- Bucket privado, signed URLs, versionamento formal de arquivos e entidade propria de Projeto/Campanha sao evolucoes futuras, nao regras da versao atual.
- Upload direto ou retomavel para o Storage e evolucao futura para evitar que videos grandes atravessem integralmente a memoria do backend.
