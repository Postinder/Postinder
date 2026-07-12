# Decisoes de Produto Temporarias Consolidadas

> Registro temporario apenas das decisoes vigentes apos as conversas historicas e as revisoes tecnicas posteriores. Decisoes substituidas e sua evolucao ficam exclusivamente no `CHANGELOG_TEMP.md`.

## 1. Direcao do produto

- O Postinder deve operar como sistema SaaS de trabalho diario para agencias, nao apenas como demonstracao visual.
- O foco principal e reduzir erro operacional entre criacao, revisao interna, aprovacao do cliente, correcao e execucao.
- A area administrativa deve continuar preservada enquanto a experiencia do cliente evolui de forma independente.
- O fluxo principal tem prioridade sobre WhatsApp, e-mail e outras integracoes perifericas.
- A versao atual continua sendo de testes controlados; publicacao para clientes reais foi explicitamente adiada.

## 2. Responsabilidade pela aprovacao

- A agencia cria, revisa, corrige, envia e acompanha.
- Somente o cliente pode aprovar ou reprovar o conteudo.
- A API deve reforcar essa separacao: JWT de cliente nao acessa rotas administrativas de postagens, e o endpoint generico de status nao pode simular aprovacao, rejeicao, envio ou execucao.
- A pagina administrativa de aprovacoes e uma tela de acompanhamento, nao um local para a agencia decidir em nome do cliente.
- Uma rodada concluida com qualquer arquivo recusado nao significa postagem aprovada.
- Um unico item recusado mantem a postagem em revisao/recusada ate que seja corrigido e reenviado.

## 3. Fluxo interno antes do cliente

- Criar uma postagem nao deve envia-la automaticamente.
- Toda postagem nasce como `draft` ou `ready`.
- A agencia pode criar varios itens, revisar, editar, duplicar, remover anexos, ordenar arquivos e somente depois enviar.
- `draft` e `ready` devem ser reversiveis entre si.
- `PATCH /posts/:id/status` permite apenas `draft -> ready` e `ready -> draft`; qualquer outro estado ou transicao deve falhar no backend.
- `draft` e `ready` sao internos e nao podem aparecer para o cliente.
- Envio individual e em lote fazem parte da central de gerenciamento.
- A central de postagens e diferente da pagina de nova postagem.

## 4. Ciclo operacional do conteudo

Fluxo de referencia vigente:

`draft -> ready -> sent/pending_approval -> approved ou rejected -> correcao/reenvio -> approved -> executed`

- Aprovado significa que o cliente liberou o conteudo.
- Executado significa que a agencia viu a aprovacao e efetivamente encaminhou/publicou o trabalho.
- Depois de `executed`, a postagem e um registro historico imutavel; somente consulta e duplicacao do original sao permitidas.
- Exclusao operacional usa `deleted_at`; ela substitui o uso operacional legado de `archived` e remove a postagem nao executada das consultas e metricas operacionais sem exclusao fisica imediata.
- Postagem `approved` so pode ser excluida por `admin`, mediante confirmacao reforcada; postagens em andamento seguem a permissao administrativa de edicao.

## 5. Portal de Revisao

- O portal deve ser acessivel por link privado com token, sem login tradicional obrigatorio.
- O token deve ser longo, aleatorio, imprevisivel, expirar e ficar armazenado somente como hash.
- O link deve permitir apenas dados e acoes do cliente vinculado.
- A rota `/aprovar` deve continuar funcionando para cliente autenticado, reutilizando a mesma experiencia.
- O link privado deve ter validade configuravel de 7 ou 15 dias e poder ser regenerado.
- O portal deve parecer uma area profissional de acompanhamento, nao uma tela pobre de aprovar/reprovar.

## 6. Revisao estilo Tinder

- A primeira informacao vista pelo cliente deve ser a selecao de projeto e a revisao dos itens.
- Cards de resumo e abas sao complementares.
- Cada arquivo deve ser analisado individualmente.
- Swipe e a interacao principal, com botoes como alternativa acessivel e previsivel.
- No mobile, o gesto horizontal deve coexistir com a rolagem vertical e nunca acionar o arraste nativo da imagem.
- O cliente pode desfazer apenas a ultima decisao, impedindo revisoes arbitrarias de itens antigos.
- Ao aprovar o projeto inteiro, o retorno e bloqueado.
- A recusa pode ser reconsiderada posteriormente na aba `Recusados`, pois transformar recusado em aprovado reduz retrabalho para a agencia.
- O cliente pode editar comentario e tags de um item recusado.
- Uma nova versao deve ser identificada explicitamente como `Correcao`, diferenciando-a de projeto novo.

## 7. Organizacao do portal

- Revisao principal organizada por projeto/postagem.
- Abas complementares: Calendario, Recusados, Historico, Arquivos e Feedbacks.
- A aba de recusados deve listar decisoes anteriores enquanto nao houver nova versao.
- Ao reenviar uma correcao, o recusado antigo deixa a lista operacional de recusados e volta para analise.
- Arquivos devem aparecer na ordem definida pela agencia.

## 8. Ordem dos anexos

- Ordem de carrossel e dado de negocio, nao apenas detalhe visual.
- Deve ser persistida no backend por `sort_order`.
- A mesma sequencia deve aparecer em criacao, edicao, aprovacao, portal e previews.
- Controles de subir/descer foram aceitos como alternativa simples e confiavel a drag and drop, especialmente em mobile.
- Arquivos novos entram ao final e podem ser reordenados.

## 9. Organizacao da central de postagens

- Postagens Em andamento, Concluidas (`approved`, exibidas como `Aprovado pelo cliente`) e Executadas (`executed`, exibidas como `Postado na rede`) devem ficar separadas.
- Aprovados saem da lista principal para reduzir ruido operacional.
- A aba `Aprovado pelo cliente` nao precisa de filtro de status.
- A aba `Postado na rede` representa encerramento operacional.
- Recusados podem ser selecionados para reenvio depois da correcao.
- Aprovados nao podem ser reenviados pela selecao normal.
- Excluir postagem usa `deleted_at` e deve sempre usar confirmacao por modal; para `approved`, a confirmacao exige digitar `EXCLUIR`.
- A edicao deve oferecer uma previa compacta e navegavel do feed sem obrigar a abertura da Previa do Feed completa.

## 10. Metricas historicas

- Taxas nao devem ser recalculadas apenas pelo estado final.
- Se um projeto foi recusado e depois aprovado, a recusa inicial continua existindo como dado historico.
- Devem coexistir:
  - aprovacao/recusa inicial por projeto;
  - concluidos com revisao;
  - concluidos sem revisao;
  - aprovacao/recusa inicial por item/arquivo;
  - tempo medio de decisao;
  - analise de tags de reprovacao.
- A visao por projeto mede quantos projetos exigiram revisao.
- A visao por item mostra a proporcao real de arquivos aprovados/recusados dentro desses projetos.
- Feedbacks e tags historicos nao devem sumir quando o cliente aprova a versao corrigida.

## 11. Escopo ativo e historico

- Operacao diaria deve priorizar clientes ativos.
- Dashboard e Previa do Feed iniciam em `Clientes ativos`.
- Deve existir opcao `Geral` para consultar o historico de clientes desativados.
- Insights deve permitir `Geral` ou `Somente clientes ativos` junto aos filtros temporais e por cliente.
- A central de postagens deve ocultar clientes desativados na operacao normal.
- Exportacoes devem registrar o escopo aplicado.

## 12. Dashboard e atividade recente

- Cards continuam clicaveis e agora devem abrir a central de postagens com o recorte correspondente.
- `Gerenciar postagens` e suficiente; o atalho `Ver pendentes de envio` foi considerado redundante e removido.
- `Empresa em foco` deve ficar antes dos dados que altera.
- Atividade recente continua sendo relevante para administradores e rastreabilidade.
- A lista deve consultar ate 50 eventos e exibir 5 ou 10 por pagina.

## 13. Cliente: desativar versus excluir

- Desativar e uma acao reversivel para clientes sem trabalho atual.
- Desativacao preserva metricas, posts e historico, oculta dados das telas operacionais, revoga tokens e agenda exclusao dos anexos em 1 dia.
- Ao reativar antes da limpeza, posts voltam e a exclusao pendente e cancelada.
- Desativacao nao deve alterar o status original dos posts.
- Exclusao definitiva e uma acao separada e destrutiva, usada quando dados e arquivos realmente devem ser removidos.
- A confirmacao de exclusao definitiva deve avisar que posts, arquivos, feedbacks e metricas tambem serao apagados.
- Posts do cliente excluido devem desaparecer da central de postagens, do feed e do portal.
- Se o objetivo e preservar metricas, deve-se desativar, nao excluir definitivamente.
- E-mails de registros inativos/excluidos podem ser reutilizados; uma reativacao so pode ocorrer se nao violar a unicidade vigente.

## 14. Execucao e retencao

- A aprovacao do cliente nao prova que a agencia ja executou o trabalho.
- A agencia deve marcar manualmente como executado.
- Executado representa conteudo ja publicado e nao pode ser editado, reenviado, ter anexos alterados, mudar de status ou ser excluido.
- Arquivos podem ser mantidos ou excluidos imediatamente, em 1 dia, em 7 dias ou em 30 dias; a escolha e feita por postagem nesta fase.
- `immediate` torna o arquivo elegivel no proximo comando de limpeza; a marcacao de `executed` nao remove o objeto durante a propria requisicao.
- A exclusao de anexos nao deve apagar metadados, metricas, status nem atividades; o registro de arquivo deve guardar data de remocao e eventual erro do Storage.
- A limpeza ocorre por comando manual auditavel. Nao ha scheduler, retry automatico, fila ou cron nesta fase.

## 15. Reset de testes

- Enquanto o produto estiver em versao de testes, admin pode zerar os dados pela interface.
- A confirmacao deve exigir a palavra exata `RESETAR`.
- O reset remove dados, metricas e arquivos da plataforma e recria somente usuario/cliente padrao.
- Esse recurso e aceitavel em ambiente controlado e nao deve ser tratado como funcionalidade normal de producao.

## 16. Ultimo acesso e detalhes do cliente

- Pagina de detalhes deve usar as mesmas metricas historicas dos Insights.
- Ultimo acesso deve ser dado real, atualizado por login e uso do portal.

## 17. Notificacoes, timeline e auditoria

- Sino deve continuar acionavel, com leitura por usuario.
- Conteudo da notificacao permanece derivado dos posts.
- Salvar como `draft` ou `ready` nao deve gerar notificacao de espera pelo cliente.
- A notificacao de aguardando retorno so deve existir depois do envio; recusa e correcao devem manter mensagens distintas.
- Timeline e feedbacks devem ajudar a entender o andamento.
- `activity_events` e a base definida para rastreabilidade e timeline.
- Exclusao logica de postagem deve registrar ator, papel, status anterior e se havia aprovacao do cliente.

## 18. Permissoes e seguranca

- Viewer continua genuinamente somente leitura.
- Protecao deve existir no frontend e backend.
- Admin, manager e editor devem respeitar a matriz de permissoes existente.
- Somente `admin` pode excluir postagem aprovada; nenhum papel pode excluir ou alterar postagem executada.
- Regras do portal devem ser validadas no backend, nunca somente na interface.
- Desfazer somente a ultima acao e uma regra de dominio e deve ser validada no servidor, nao apenas na interface.
- Cliente desativado nao deve acessar login ou portal.
- O usuario principal padrao nao pode ser excluido.
- O papel de um usuario pode ser alterado depois da criacao, respeitando a matriz de permissoes.

## 19. Identidade, e-mail e credenciais

- Usuarios e clientes ativos compartilham um namespace unico de e-mail: o mesmo endereco nao pode existir simultaneamente nas duas categorias.
- E-mails devem ser normalizados antes de comparacao e persistencia.
- Excluir ou desativar um registro libera seu e-mail para novo cadastro.
- A reativacao nao pode violar a unicidade caso o e-mail tenha sido reutilizado.
- Enquanto a arquitetura atual estiver vigente, a unicidade e global entre usuarios e clientes ativos. A protecao combina indices parciais por tabela com transacao e lock advisory global por e-mail para a validacao cruzada.
- A futura arquitetura multiempresa adotara Identidade global de conta e vinculos por Empresa/agencia; ela nao sera antecipada por duplicacao de clientes nesta fase.
- Formularios de cadastro devem reduzir a interferencia do preenchimento automatico do navegador, mantendo identificadores de login e senha independentes.
- A alternancia entre tema claro e escuro deve funcionar tanto no login quanto dentro da plataforma.

## 20. Deploy e operacao

- Arquitetura Vercel + Render + Supabase permanece a referencia.
- O ambiente publicado permanece destinado inicialmente a testes de equipe/amigos.
- Liberacao para clientes reais permanece fora do escopo atual.
- Credenciais padrao, reset, bucket publico e seeds sao aceitaveis somente nesse contexto temporario e controlado.
- Modo demonstracao e Modo producao devem coexistir no mesmo codigo-fonte; hoje apenas a seed explicita e condicionada a `APP_MODE=demo`, e a separacao completa dos dois modos continua pendente.

## 21. Estrutura de banco e inicializacao

- Migrations versionadas em `database/migrations` sao a unica fonte de verdade estrutural; migrations historicas ja aplicadas nao devem ser reescritas.
- `002_development_seed.sql` e historica: permanece no repositorio e pode constar em bancos antigos, mas nao pertence ao fluxo estrutural de novas instalacoes.
- Dados demo devem ser criados somente por comando explicito e idempotente, protegido por `APP_MODE=demo`; bootstrap de producao deve exigir variaveis de ambiente e nunca reutilizar credenciais demo.
- O startup nao cria ou repara schema, dados, indices ou constraints. Deve revelar schema atrasado, e producao nao deve iniciar com migrations pendentes.
- `schema_migrations` e o registro autoritativo de aplicacao; o migrador deve serializar execucoes concorrentes com lock de banco.
- O schema inicial legado foi removido; somente migrations versionadas podem criar uma instalacao nova.
- Componentes, DTOs, barrels e configuracoes sem rota, import, compatibilidade ou evolucao aprovada nao fazem parte do contrato do produto e devem ser removidos, sem preservar codigo morto por historico.

## 22. Identidade de arquivos

- A identidade oficial de um objeto de Storage e `bucket + storage_path`; URL publica e somente uma representacao de acesso mantida por compatibilidade.
- MIME e tamanho devem ser persistidos no momento do upload.
- Upload que nao puder ser registrado no banco deve compensar removendo os objetos novos enviados na mesma operacao.
- Cada novo registro criado por duplicacao deve possuir um objeto fisico proprio; a copia usa um novo path vinculado ao novo post e nao compartilha URL ou identidade com a origem.
- Duplicacao com arquivo legado sem identidade de Storage deve falhar integralmente e orientar a regularizacao, sem omitir anexos silenciosamente.
- Remocao fisica so pode ocorrer quando nao houver outra referencia registrada ao mesmo `bucket + storage_path`; compartilhamentos legados sao diagnosticados, nao migrados automaticamente.
- Bucket privado, signed URLs, assets compartilhados formais e versionamento permanecem decisoes de sprints posteriores.
