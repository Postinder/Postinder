# Arquitetura de Storage e Retencao

## Modelo de identidade

Cada registro de `files` identifica seu objeto por `bucket + storage_path`. A `url` publica e mantida para exibicao e compatibilidade, mas nao e usada como identidade nem como fonte para reconstruir caminhos de remocao.

Os metadados persistidos incluem caminho, bucket, MIME, tamanho, ordem e estado de aprovacao. Registros legados que nao puderam receber identidade segura continuam compativeis por URL, mas bloqueiam duplicacao para evitar uma copia parcial ou ambigua.

Arquivos de fundo sonoro usam a mesma identidade no registro `post_soundtracks`, mas permanecem separados de `files`: nao recebem `sort_order` nem entram na ordenacao de cards. O path segue `posts/{postId}/soundtracks/{id}` e existe no mesmo bucket/adaptador dos demais objetos.

## Upload e remocao

1. O frontend valida tipo e limite de 200 MB antes da rede.
2. Quando ha varios anexos, o frontend envia um arquivo por requisicao, preserva `sort_order` e apresenta progresso individual.
3. O backend repete a validacao, envia o objeto ao Storage e classifica o arquivo a partir do MIME.
4. O registro em `files` recebe a identidade, URL publica, MIME, tamanho, nome, categoria e ordem retornados pelo upload.
5. Se o banco falhar, o backend tenta remover imediatamente os objetos enviados na mesma operacao.
6. Remocoes usam somente `bucket + storage_path`; falhas retornam informacao auditavel e nao sao ignoradas silenciosamente.

O limite excedido retorna HTTP `413` com codigo `FILE_TOO_LARGE`. Tipo recusado retorna HTTP `415` com codigo `UNSUPPORTED_FILE_TYPE`. A interface apresenta a mensagem do backend e, se a postagem ja tiver sido criada, preserva o registro para nova tentativa pela edicao.

O upload de fundo sonoro aceita um unico arquivo ativo por postagem, ate 50 MB, inicialmente nos formatos MP3, WAV, OGG, AAC e M4A. Extensao, MIME e assinatura basica sao confrontados antes do envio ao Storage. Falha de persistencia compensa o objeto enviado; substituicao remove o objeto anterior somente quando nenhuma referencia ativa permanece.

Em producao, o Multer ainda recebe cada arquivo em memoria antes de o backend o enviar ao Supabase. O envio sequencial limita esse pico a um arquivo por vez, mas nao elimina a passagem pelo backend. Upload direto ou retomavel por URL assinada permanece trabalho futuro.

## Visualizacao de midia

Os metadados de MIME e tamanho acompanham os arquivos nas consultas administrativas e no portal. Um componente compartilhado decide entre imagem, video e arquivo generico usando categoria, MIME e extensao.

Videos usam o elemento nativo `video` com controles, `playsInline` e `preload="metadata"`. O sistema nao transcodifica conteiner ou codec; MP4 com H.264/AAC e a recomendacao de compatibilidade. Quando o navegador nao reproduz o arquivo, a interface explica a limitacao e oferece acesso ao original.

## Logo institucional

O logo global reutiliza o mesmo adaptador local/Supabase. A identidade persistida em `platform_branding` e `logo_bucket + logo_storage_path`; URL publica nao e armazenada no banco. O servidor controla paths versionados no formato `branding/logo/{uuid}.{ext}` e aceita apenas PNG, JPEG ou WebP estatico de ate 2 MB. Antes do Storage, confronta MIME, extensao e formato detectado; valida comprimentos/CRC de chunks PNG; rejeita APNG, WebP animado e multipagina; e decodifica a unica imagem com limite de 16 milhoes de pixels. O processo admite no maximo duas decodificacoes simultaneas e retorna `503/BRANDING_VALIDATION_BUSY` quando ocupado.

Na substituicao, o novo objeto e enviado e a nova referencia e confirmada em transacao antes da remocao do anterior. Falha de persistencia tenta compensar o objeto novo; falha posterior ao remover o anterior nao invalida a configuracao salva. Cada alteracao incrementa `logo_version`, e o frontend usa essa versao estavel no cache. O endpoint publico nao retorna bucket, path ou credenciais.

## Duplicacao

Duplicar uma postagem cria um objeto fisico novo para cada arquivo identificado, em path associado a nova postagem. Os registros de `files` tambem sao novos e independentes; status de aprovacao e decisao de rejeicao nao sao compartilhados com a origem.

Falha na copia ou na gravacao da duplicacao compensa os novos objetos e reverte a nova postagem. O sistema nao adota compartilhamento implicito de URL para novas duplicacoes.

Quando o fundo sonoro e `uploaded`, a duplicacao tambem cria objeto e registro fisicamente independentes. No modo `embedded`, o vinculo e remapeado para a copia independente do video correspondente. Referencias externas copiam apenas os metadados; nenhuma midia e baixada.

## Retencao

Ao marcar uma postagem como `executed`, a agencia escolhe `immediate`, `1d`, `7d`, `30d` ou `never`. A escolha calcula a elegibilidade do arquivo; ela nao remove o objeto dentro da requisicao de execucao.

O comando manual abaixo processa anexos vencidos:

```bash
cd backend
npm run storage:cleanup-retention
```

Depois da remocao fisica, o registro permanece. `storage_deleted_at` registra sucesso e `storage_delete_error` registra falha. O comando nao tenta remover novamente objetos ja marcados como removidos. Interface e historico preservam nome, tipo, tamanho, ordem, decisao, politica e data de remocao.

O comando processa anexos e audios enviados. Antes da remocao, verifica referencias ativas em ambos os conjuntos; para fundo sonoro preserva tambem revisoes e decisoes historicas.

## Limitacoes atuais

- Nao ha scheduler, fila, outbox ou retry automatico.
- O bucket publicado continua publico no fluxo atual; URLs assinadas e bucket privado ainda nao existem.
- Nao ha upload direto, retomavel nem transcodificacao de video; cada arquivo ainda atravessa a memoria do backend em producao.
- Objetos compartilhados e arquivos legados sem identidade possuem diagnostico, mas nao migracao automatica.
- Multiempresa ainda nao esta implementada; um path futuro devera incluir identificador de Empresa/agencia antes de habilitar isolamento por Storage.
- O sistema nao baixa, transcodifica, mixa nem renderiza audio externo. Links de referencia nao geram objeto local nem player no portal.
