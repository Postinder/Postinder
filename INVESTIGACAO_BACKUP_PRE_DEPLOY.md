# Investigação do backup lógico manual pré-deploy do Postinder

## 1. Objetivo

Criar e validar um backup lógico manual do PostgreSQL publicado no Supabase, antes das migrations pendentes `012`, `013`, `014` e `015`, sem alterar o banco, executar migrations, acessar objetos físicos do Supabase Storage ou armazenar dumps no repositório.

**Resultado:** backup lógico criado e estruturalmente validado; restauração ainda não testada.

## 2. Contexto considerado

Foram consultadas somente:

- a seção 7, “Banco e migrations”, de `INVESTIGACAO_AUDITORIA_PRE_DEPLOY.md`;
- as subseções 29.1 a 29.5, 29.7 e 29.8 de `INVESTIGACAO_INVENTARIO_BANCO_PRODUCAO.md`.

O estado previamente inventariado é:

- plano gratuito do Supabase, sem backups agendados e sem PITR disponíveis;
- migrations aplicadas: `001`, `002` histórica e `003` a `011`;
- migrations pendentes: `012`, `013`, `014` e `015`;
- 1 Cliente ativo;
- 0 posts;
- 0 anexos.

Não foi feita nova auditoria geral nem novo inventário.

## 3. Fonte da conexão e proteção

A disponibilidade de `POSTINDER_PROD_DATABASE_URL` foi confirmada sem imprimir, transformar ou persistir seu valor. Nenhuma outra fonte de conexão foi lida ou procurada.

A conexão foi passada aos processos somente pela referência à variável de ambiente. URL, usuário, senha, hostname e fragmentos da conexão não foram exibidos, gravados em arquivo auxiliar ou incluídos neste relatório.

As saídas dos comandos de dump foram capturadas. A verificação silenciosa não identificou eco do valor completo nem dos componentes sensíveis testados da conexão.

## 4. Ferramentas e versões

| Item | Situação |
| --- | --- |
| Node.js | `v24.16.0`; requisito de versão 20 ou superior atendido |
| Supabase CLI | `2.110.0` |
| Disponibilização | Temporária, pelo cache do `npx` |
| Docker Desktop | Operacional ao final |
| Docker client/server | `29.6.2` / `29.6.2` |
| `pg_dump` | Disponível, PostgreSQL `18.4`; não utilizado diretamente |
| `psql` | Disponível, PostgreSQL `18.4`; não utilizado |

A versão foi descoberta uma única vez com `npx --yes supabase@latest --version`. Todas as operações seguintes usaram exclusivamente `supabase@2.110.0`.

Não houve instalação global, alteração de `PATH`, inclusão da CLI nas dependências, `supabase init`, `supabase link`, `supabase login` ou `supabase start`.

## 5. Procedimento utilizado

1. Confirmada de forma booleana a variável temporária autorizada.
2. Confirmado Node.js `v24.16.0`.
3. Registrado o baseline do repositório.
4. Confirmada a Supabase CLI oficial `2.110.0` pelo cache temporário do `npx`.
5. Criada a pasta externa datada obrigatória.
6. Após uma interrupção inicial causada pelo encerramento acidental do Docker Desktop, o aplicativo foi reiniciado com autorização e o engine foi reconfirmado.
7. Gerado `roles.sql` com o modo oficial de roles.
8. Gerado `schema.sql` com o dump oficial de schema.
9. Gerado `data.sql` somente com dados, usando `COPY` e excluindo `storage.buckets_vectors` e `storage.vector_indexes`.
10. Validados localmente existência, tamanho, legibilidade, estrutura básica, ausência aparente de credenciais, hashes, timestamps, ACL e localização externa.
11. Comparado o estado final do repositório com o baseline.

Os comandos usaram caminhos absolutos e `POSTINDER_PROD_DATABASE_URL` somente por referência à variável. Nenhuma alternativa com `pg_dump` direto foi improvisada.

## 6. Data, horário e pasta externa

- Pasta criada em: 2026-07-29 às 16:06:06 -03:00.
- Último dump concluído em: 2026-07-29 às 16:38:48 -03:00.
- Validação final concluída em: 2026-07-29 às 16:40:50 -03:00.
- Pasta externa: `C:\Users\Murilo\Backups\Postinder\2026-07-29_16-06-06`.
- Caminho fora do repositório: confirmado.
- Dumps dentro do repositório: nenhum.

## 7. Arquivos, tamanhos e SHA-256

| Arquivo | Tamanho | SHA-256 |
| --- | ---: | --- |
| `roles.sql` | 358 bytes | `4350A72B5EC109888E740C17F3EB4DA2FCD95AB73AF26499538ED0BF615DB543` |
| `schema.sql` | 15.000 bytes | `7BBABD8F2403E2391776CCDC979B52BBD7A7BEE34BD8F4D3CF19C6E84F638690` |
| `data.sql` | 13.364 bytes | `25FEF3F1D31814415D2C95868B7898CAED7511E716A456BFFD54F5E2428E2CC6` |

## 8. Validação estrutural

### `roles.sql`

- existe, é legível e não está vazio;
- 16 linhas;
- 8 terminadores de instrução;
- 4 instruções `ALTER ROLE`;
- validação estrutural básica: **aprovada**.

### `schema.sql`

- existe, é legível e não está vazio;
- 714 linhas;
- 130 terminadores de instrução;
- 9 instruções `CREATE TABLE`;
- 29 instruções `ALTER TABLE`;
- 34 instruções `GRANT`;
- validação estrutural básica: **aprovada**.

### `data.sql`

- existe, é legível e não está vazio;
- 348 linhas;
- 36 blocos `COPY`;
- 36 terminadores de bloco `COPY`;
- quantidade de aberturas e terminadores compatível;
- validação estrutural básica: **aprovada**.

Nenhum SQL foi executado durante a validação.

## 9. Validação de credenciais, permissões e localização

Em cada um dos três arquivos, a busca silenciosa verificou:

- valor completo da conexão;
- hostname;
- senha;
- identificador de usuário não trivial;
- URLs PostgreSQL;
- URLs HTTP/HTTPS;
- senhas SQL entre aspas;
- padrões de JWT.

Resultado agregado: **nenhum indício encontrado**.

Os três arquivos:

- são legíveis localmente;
- possuem ACL herdada, com quatro regras observadas em cada arquivo;
- estão na pasta externa autorizada;
- não estão sob a raiz do repositório nem no alcance do Git.

## 10. Comparação do repositório

Baseline antes do `npx`:

- `package.json`: SHA-256 `F32AD5E9B2E8346926A80FAB9626CF61EF7A726C581409006C5FE8B3BC6CA4C3`;
- `package-lock.json`: ausente;
- `node_modules`: existente, 2.595 arquivos; arquivo mais recente em `2026-05-22T16:11:50.6495590Z`;
- pasta `supabase`: ausente;
- worktree já possuía alterações rastreadas e não rastreadas do usuário.

Depois dos dumps:

- hash de `package.json`: inalterado;
- `package-lock.json`: continua ausente;
- `node_modules`: mesma quantidade e mesmo horário máximo de modificação;
- pasta `supabase`: continua ausente;
- lista de caminhos do `git status`: igual ao baseline, exceto pela atualização autorizada deste relatório;
- nenhuma nova alteração inesperada foi detectada.

Não houve operação Git mutável nem descarte de mudanças preexistentes.

## 11. Limitações e Supabase Storage

- A validação foi estrutural e local; não prova restauração completa.
- A restauração não foi testada nesta microetapa.
- O backup lógico PostgreSQL não inclui objetos físicos do Supabase Storage.
- Nenhum bucket ou objeto físico do Storage foi acessado, copiado ou alterado.
- A consistência dos objetos físicos do Storage com referências futuras do banco exige procedimento separado.
- O plano gratuito não fornece backup agendado nem PITR; estes três arquivos devem ser preservados com cuidado.

## 12. Confirmações de não alteração

- Os comandos executados foram exclusivamente dumps lógicos somente leitura.
- O banco remoto não foi alterado por esta microetapa.
- Nenhum comando de escrita no banco foi executado.
- Nenhuma migration foi executada.
- Nenhum seed, reset, SQL manual ou restauração foi executado.
- Nenhum `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `TRUNCATE` ou `CREATE` remoto foi executado.
- Nenhum deploy foi executado.
- Nenhum objeto do Supabase Storage foi acessado ou alterado.
- Nenhuma dependência do Postinder foi modificada.

## 13. Situação da recuperabilidade

**Backup lógico criado e estruturalmente validado; restauração ainda não testada.**

Os três arquivos formam um ponto lógico anterior às migrations `012` a `015` e devem ser preservados juntos. É seguro preservá-los como evidência e artefato de rollback lógico pré-migrations, mas a recuperabilidade operacional completa só poderá ser afirmada após um teste de restauração isolado.

## 14. Veredito

1. **O backup lógico foi criado?** Sim.
2. **Os três arquivos esperados existem?** Sim.
3. **Eles passaram pela validação estrutural básica?** Sim.
4. **Alguma credencial foi encontrada?** Não.
5. **O backup inclui objetos físicos do Storage?** Não.
6. **A restauração foi testada?** Não.
7. **É seguro preservar este backup como ponto anterior às migrations?** Sim, com a limitação explícita de que a restauração ainda não foi testada.
8. **Houve alteração inesperada no repositório?** Não.
9. **O banco foi alterado?** Não.
10. **Alguma migration foi executada?** Não.

## 15. Próxima única microetapa recomendada

Planejar e executar, em etapa separada e com autorização específica, um teste de restauração desses três arquivos em um PostgreSQL isolado e descartável, sem conexão com produção, sem Supabase Storage e sem executar as migrations pendentes.
