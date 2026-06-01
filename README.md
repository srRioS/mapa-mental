Instruções para aplicar a migration SQL no Supabase

Arquivo de migration: add_maps_json_columns.sql

Passos rápidos (Supabase console):

1. Entre no seu projeto Supabase e abra o `SQL Editor`.
2. Crie uma nova query e cole o conteúdo de `migrations/add_maps_json_columns.sql`.
3. Clique em `Run` para executar. Deve retornar sucesso sem erros.

Verificações:

- Verifique se as colunas foram adicionadas:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'maps'
  AND column_name IN ('node_radius','node_notes','node_rich_text');
```

Testando a aplicação:

1. Abra o app (index.html) no navegador (assegure que `config.js` tenha as credenciais do Supabase corretas).
2. Faça login com um usuário existente.
3. Crie/abra um mapa e clique em `Salvar` ou `Salvar tudo`.
4. Se ocorrer erro, abra o console do navegador — mensagens de erro do Supabase agora aparecem no toast e no `console.error`.

Observações:

- A migration adiciona colunas JSONB com valor padrão `{}`.
- Se preferir, execute o SQL manualmente linha a linha no SQL Editor.

Contatos / próxima etapa:

Se quiser, eu crio um `README.md` na raiz com instruções gerais do projeto ou um arquivo `migrations/rollback.sql` para reverter a alteração.
