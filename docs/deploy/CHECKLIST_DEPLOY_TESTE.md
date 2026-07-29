# Checklist de deploy de teste

Consulte [../DEPLOYMENT.md](../DEPLOYMENT.md) para configuracao de Render, Vercel, Supabase e migrations.

O deploy permanece **nao autorizado** ate a conclusao desta checklist ou de uma
versao equivalente aprovada posteriormente.

## Consolidacao e verificacao

1. [ ] Concluir os ajustes pontuais de layout.
2. [ ] Alinhar visualmente `admin`, `manager`, `editor` e `viewer`.
3. [ ] Remover referencias visuais legadas a `gestor` e `equipe`.
4. [ ] Executar validacao local final, incluindo 139 testes de backend, 14 de
   frontend, builds, bundle scan e `git diff --check`.
5. [ ] Concluir a verificacao manual da Vercel: nomes, escopos, ambientes,
   commit ativo, deployments historicos e previews, sempre sem abrir valores.
6. [ ] Rotacionar ou invalidar credenciais somente se exposicao historica for
   confirmada ou presumida.
7. [ ] Revisar as variaveis finais da Vercel; manter no frontend apenas
   `VITE_API_URL`, `VITE_DEPLOYMENT_MODE` e `VITE_GA_MEASUREMENT_ID`.
8. [ ] Configurar no Render `DEPLOYMENT_MODE=demo` e
   `ENABLE_DEMO_RESET=true`.
9. [ ] Configurar no frontend `VITE_DEPLOYMENT_MODE=demo`.
10. [ ] Decidir se a IA sera habilitada.
11. [ ] Se habilitada, configurar a credencial e o modelo somente no backend.
12. [ ] Criar novo backup logico do banco.
13. [ ] Executar preflight final somente leitura.
14. [ ] Reconfirmar o impacto da migration `012`.
15. [ ] Configurar `npm run db:migrate` como Pre-Deploy Command/release step
    bloqueante anterior ao Start Command.

## Publicacao

16. [ ] Publicar primeiro o backend.
17. [ ] Confirmar aplicacao de `012` a `015`, ausencia de pendencias e startup.
18. [ ] Publicar o frontend.
19. [ ] Confirmar commits e bundles ativos.

## Depois do deploy

20. [ ] Executar smoke tests: health checks, autenticacao, perfis, criacao,
    upload, ordenacao, envio, portais, decisao, correcao, execucao, exclusao
    logica, duplicacao e Retencao com dados descartaveis.
21. [ ] Conferir logs sanitizados, inclusive redacao de tokens de portal em
    sucesso, recusa, erro e subrota inexistente.
22. [ ] Confirmar o reset da demo com admin autorizado e comprovar recusa para
    viewer, Cliente e configuracao indisponivel.

Validacoes de midia dentro do smoke test:

- [ ] MP4 H.264/AAC e enviado com progresso e reproduzido no portal e nas telas administrativas.
- [ ] Controles de reproducao nao acionam swipe, aprovacao ou solicitacao de ajuste.
- [ ] Arquivo acima de 200 MB e tipo nao suportado exibem mensagens especificas; falha depois da criacao preserva a postagem editavel.
- [ ] Codec nao reproduzivel oferece acesso ao arquivo original.
- [ ] `draft` e `ready` nao aparecem ao Cliente.
- [ ] Postagem Executada nao aceita mutacoes e a duplicacao cria novo registro.
- [ ] Copia fisica na duplicacao persiste `bucket`, `storage_path`, MIME e tamanho.

## Observacao

O scheduler de Retencao, retries/outbox, bucket privado, signed URLs, upload direto/retomavel e transcodificacao ainda nao existem. Nao considere esses comportamentos validados ate a conclusao dos itens correspondentes no [ROADMAP](../../ROADMAP.md).
