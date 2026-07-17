# Arquitetura de Storage e Retencao

## Modelo de identidade

Cada registro de `files` identifica seu objeto por `bucket + storage_path`. A `url` publica e mantida para exibicao e compatibilidade, mas nao e usada como identidade nem como fonte para reconstruir caminhos de remocao.

Os metadados persistidos incluem caminho, bucket, MIME, tamanho, ordem e estado de aprovacao. Registros legados que nao puderam receber identidade segura continuam compativeis por URL, mas bloqueiam duplicacao para evitar uma copia parcial ou ambigua.

## Upload e remocao

1. O frontend valida tipo e limite de 200 MB antes da rede.
2. Quando ha varios anexos, o frontend envia um arquivo por requisicao, preserva `sort_order` e apresenta progresso individual.
3. O backend repete a validacao, envia o objeto ao Storage e classifica o arquivo a partir do MIME.
4. O registro em `files` recebe a identidade, URL publica, MIME, tamanho, nome, categoria e ordem retornados pelo upload.
5. Se o banco falhar, o backend tenta remover imediatamente os objetos enviados na mesma operacao.
6. Remocoes usam somente `bucket + storage_path`; falhas retornam informacao auditavel e nao sao ignoradas silenciosamente.

O limite excedido retorna HTTP `413` com codigo `FILE_TOO_LARGE`. Tipo recusado retorna HTTP `415` com codigo `UNSUPPORTED_FILE_TYPE`. A interface apresenta a mensagem do backend e, se a postagem ja tiver sido criada, preserva o registro para nova tentativa pela edicao.

Em producao, o Multer ainda recebe cada arquivo em memoria antes de o backend o enviar ao Supabase. O envio sequencial limita esse pico a um arquivo por vez, mas nao elimina a passagem pelo backend. Upload direto ou retomavel por URL assinada permanece trabalho futuro.

## Visualizacao de midia

Os metadados de MIME e tamanho acompanham os arquivos nas consultas administrativas e no portal. Um componente compartilhado decide entre imagem, video e arquivo generico usando categoria, MIME e extensao.

Videos usam o elemento nativo `video` com controles, `playsInline` e `preload="metadata"`. O sistema nao transcodifica conteiner ou codec; MP4 com H.264/AAC e a recomendacao de compatibilidade. Quando o navegador nao reproduz o arquivo, a interface explica a limitacao e oferece acesso ao original.

## Duplicacao

Duplicar uma postagem cria um objeto fisico novo para cada arquivo identificado, em path associado a nova postagem. Os registros de `files` tambem sao novos e independentes; status de aprovacao e decisao de rejeicao nao sao compartilhados com a origem.

Falha na copia ou na gravacao da duplicacao compensa os novos objetos e reverte a nova postagem. O sistema nao adota compartilhamento implicito de URL para novas duplicacoes.

## Retencao

Ao marcar uma postagem como `executed`, a agencia escolhe `immediate`, `1d`, `7d`, `30d` ou `never`. A escolha calcula a elegibilidade do arquivo; ela nao remove o objeto dentro da requisicao de execucao.

O comando manual abaixo processa anexos vencidos:

```bash
cd backend
npm run storage:cleanup-retention
```

Depois da remocao fisica, o registro permanece. `storage_deleted_at` registra sucesso e `storage_delete_error` registra falha. O comando nao tenta remover novamente objetos ja marcados como removidos. Interface e historico preservam nome, tipo, tamanho, ordem, decisao, politica e data de remocao.

## Limitacoes atuais

- Nao ha scheduler, fila, outbox ou retry automatico.
- O bucket publicado continua publico no fluxo atual; URLs assinadas e bucket privado ainda nao existem.
- Nao ha upload direto, retomavel nem transcodificacao de video; cada arquivo ainda atravessa a memoria do backend em producao.
- Objetos compartilhados e arquivos legados sem identidade possuem diagnostico, mas nao migracao automatica.
- Multiempresa ainda nao esta implementada; um path futuro devera incluir identificador de Empresa/agencia antes de habilitar isolamento por Storage.
