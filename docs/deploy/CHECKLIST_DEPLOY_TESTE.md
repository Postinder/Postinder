# Checklist de deploy de teste

Consulte [../DEPLOYMENT.md](../DEPLOYMENT.md) para configuracao de Render, Vercel, Supabase e migrations.

## Antes do deploy

- [ ] Build do backend e frontend executados.
- [ ] `npm run db:migrate` aplicado no banco alvo e `schema_migrations` conferido.
- [ ] `DATABASE_URL`, `JWT_SECRET`, `APP_PUBLIC_URL`, `CORS_ORIGINS`, `SUPABASE_*` e `VITE_API_URL` configurados.
- [ ] URLs do portal usam o dominio publicado correto.
- [ ] Nenhum segredo foi versionado.

## Depois do deploy

- [ ] `/health`, `/health/db` e `/health/storage` respondem como esperado.
- [ ] Login administrativo e portal por token funcionam.
- [ ] Criacao, upload, ordenacao, envio, decisao do Cliente, correcao e execucao funcionam.
- [ ] Video MP4 H.264/AAC e enviado com progresso e reproduzido no portal e nas telas administrativas.
- [ ] Controles de reproducao nao acionam swipe, aprovacao ou solicitacao de ajuste.
- [ ] Arquivo acima de 200 MB e tipo nao suportado exibem mensagens especificas; falha depois da criacao preserva a postagem editavel.
- [ ] Codec nao reproduzivel oferece acesso ao arquivo original.
- [ ] `draft` e `ready` nao aparecem ao Cliente.
- [ ] Postagem Executada nao aceita mutacoes e a duplicacao cria novo registro.
- [ ] Exclusao logica e regras de `approved` funcionam.
- [ ] Copia fisica na duplicacao persiste `bucket`, `storage_path`, MIME e tamanho.
- [ ] Retencao e validada somente com dados descartaveis.

## Observacao

O scheduler de Retencao, retries/outbox, bucket privado, signed URLs, upload direto/retomavel e transcodificacao ainda nao existem. Nao considere esses comportamentos validados ate a conclusao dos itens correspondentes no [ROADMAP](../../ROADMAP.md).
