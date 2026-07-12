# Changelog do Postinder

Este changelog registra os principais marcos funcionais e arquiteturais do projeto. O estado vigente esta em [PROJECT_STATE.md](PROJECT_STATE.md).

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

- Aprovacao e reprovacao passaram a ser exclusivas do Cliente. JWT de Cliente foi bloqueado nas rotas administrativas de postagens.
- O endpoint generico de status foi limitado a `draft <-> ready`.
- Postagens `executed` passaram a ser imutaveis no backend e na interface; duplicacao permanece permitida.
- O uso operacional de `archived` foi removido. Exclusao de postagem passou a usar `deleted_at`; `approved` exige admin e `executed` nao pode ser excluida.
- A unicidade de e-mail entre usuarios e Clientes ativos passou a usar normalizacao, indices parciais e advisory lock transacional.
- Usuarios ganharam alteracao de papel e exclusao protegida para o administrador principal. Clientes ganharam desativacao reversivel e exclusao definitiva separada.

## Portal e experiencia

- Foi criado portal de revisao por token e suporte equivalente a Cliente autenticado.
- Portal ganhou swipe, botoes alternativos, feedbacks, tags, desfazer limitado, recusados, calendario, historico e identificacao de correcao.
- Rascunhos e itens prontos deixaram de ficar visiveis ao Cliente e de gerar notificacoes indevidas.
- A central administrativa foi organizada em Em andamento, Aprovado pelo cliente e Postado na rede.
- A edicao ganhou previa compacta navegavel do feed, e as telas receberam ajustes responsivos.

## Storage A - Identidade e compensacao

- `files` passou a persistir `bucket`, `storage_path`, MIME e tamanho.
- Uploads passaram a compensar objetos enviados quando a gravacao no banco falha.
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

- Builds e verificacoes locais foram executados durante as consolidacoes tecnicas.
- A confirmacao do deploy final, das migrations no banco publicado e das configuracoes reais de Render, Vercel e Supabase permanece uma etapa operacional posterior.
