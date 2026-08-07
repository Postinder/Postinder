# Checklist de deploy de teste

Consulte [../DEPLOYMENT.md](../DEPLOYMENT.md) para configuracao de Render, Vercel, Supabase e migrations.

A hotfix de Clientes foi publicada e validada em 31/07/2026. O banco publicado
esta em `016`, e o ambiente demo esta disponivel para avaliacao da 20Cinco em
`https://portal-20cinco.vercel.app`. A `017_platform_branding.sql` e a
microcorrecao pos-auditoria continuam locais e devem integrar uma publicacao futura.

## Consolidacao e verificacao

1. [x] Concluir os ajustes pontuais de layout definidos na rodada atual.
2. [ ] Alinhar visualmente `admin`, `manager`, `editor` e `viewer`.
3. [ ] Remover referencias visuais legadas a `gestor` e `equipe`.
4. [x] Executar validacao local final, incluindo 151 testes de backend, 40 de
   frontend, builds, bundle scan e `git diff --check`.
5. [ ] Concluir a verificacao manual da Vercel: nomes, escopos, ambientes,
   commit ativo, deployments historicos e previews, sempre sem abrir valores.
6. [ ] Rotacionar ou invalidar credenciais somente se exposicao historica for
   confirmada ou presumida.
7. [ ] Revisar as variaveis finais da Vercel; manter no frontend apenas
   `VITE_API_URL`, `VITE_DEPLOYMENT_MODE` e `VITE_GA_MEASUREMENT_ID`.
8. [x] Configurar no Render `DEPLOYMENT_MODE=demo` e
   `ENABLE_DEMO_RESET=true`.
9. [x] Configurar no frontend `VITE_DEPLOYMENT_MODE=demo`.
10. [ ] Decidir se a IA sera habilitada.
11. [ ] Se habilitada, configurar a credencial e o modelo somente no backend.
12. [ ] Criar novo backup logico do banco.
13. [ ] Executar preflight final somente leitura.
14. [x] Reconfirmar o impacto da migration `016`.
15. [ ] Configurar `npm run db:migrate` como Pre-Deploy Command/release step
    bloqueante anterior ao Start Command.

## Publicacao

16. [x] Publicar primeiro o backend.
17. [x] Confirmar que o migrador ignorou `001` a `015`, aplicou somente a `016`
    e iniciou sem pendencias.
18. [x] Publicar o frontend.
19. [x] Confirmar commits e bundles ativos.

### Proxima publicacao do branding

- [ ] Criar backup e executar preflight somente leitura.
- [ ] Confirmar os tres lockfiles v3, `engine-strict=true` na raiz/backend/frontend, instalacao limpa com `npm ci`, Node 24 no Vercel e `NODE_VERSION=24.16.0` no Render; nao presumir que o painel ja esta correto.
- [ ] Confirmar que o release step aplicara somente a `017_platform_branding.sql` sobre o banco publicado em `016`.
- [ ] Publicar o backend somente depois da migration e validar leitura, upload, substituicao e remocao de PNG/JPEG/WebP estatico; WebP animado, APNG e CRC PNG invalido devem falhar antes do Storage.
- [ ] Concluir health checks e smoke tests do backend antes de publicar o frontend.
- [ ] Publicar o frontend e confirmar que login/recuperacao nao consultam branding, enquanto admin e portais exibem o logo configuravel.
- [ ] Reexecutar 161 testes de backend, 45 testes frontend legados, 22 testes React reais, builds e `git diff --check` no artefato final.
- [ ] Em rollback, retornar frontend e depois backend; manter a migration aditiva `017`.

## Depois do deploy

Validacoes especificas da hotfix:

- [x] `/health`, `/health/db` e `/health/storage` aprovados.
- [x] Criacao com CPF e criacao/edicao com CNPJ aprovadas.
- [x] Remocao do documento e compatibilidade de Cliente antigo sem documento aprovadas.
- [x] Prazo diferente de 7 dias persistido e recuperado corretamente.

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
- [ ] Swipe em videos preserva rolagem vertical, fullscreen, posicao do player e botoes explicitos.
- [ ] Arquivo acima de 200 MB e tipo nao suportado exibem mensagens especificas; falha depois da criacao preserva a postagem editavel.
- [ ] Codec nao reproduzivel oferece acesso ao arquivo original.
- [ ] `draft` e `ready` nao aparecem ao Cliente.
- [ ] Postagem Executada nao aceita mutacoes e a duplicacao cria novo registro.
- [ ] Copia fisica na duplicacao persiste `bucket`, `storage_path`, MIME e tamanho.

Validacoes da interface consolidada:

- [ ] Dashboard inicia **Atividade recente** e **Postagens** recolhidas e permite expansao independente.
- [ ] Portal mantem a aprovacao prioritaria e a **Visao geral** recolhida por padrao, sem perder aba ou filtros ao reabrir.
- [ ] Identidade da 20Cinco, contraste, foco e cores semanticas permanecem corretos nos temas claro e escuro.
- [x] Cliente pode ser criado e editado com ou sem CPF/CNPJ; documento pode ser removido e prazo diferente de 7 dias persiste.

O script `npm run lint` existe, mas ESLint e sua configuracao ainda nao estao
disponiveis. Nenhum workflow de CI, configuracao versionada da Vercel ou
comando documentado do Render executa lint; portanto, essa pendencia tecnica
nao bloqueia a publicacao desta rodada e nao deve ser marcada como validacao
aprovada. A verificacao administrativa da Vercel ainda deve confirmar a
ausencia de override remoto.

## Observacao

O scheduler de Retencao, retries/outbox, bucket privado, signed URLs, upload direto/retomavel e transcodificacao ainda nao existem. Nao considere esses comportamentos validados ate a conclusao dos itens correspondentes no [ROADMAP](../../ROADMAP.md).
